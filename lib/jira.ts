import axios from 'axios';
import https from 'https';

const JIRA_DOMAIN = process.env.NEXT_PUBLIC_JIRA_DOMAIN;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY;

// Para desarrollo con certificados autofirmados
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const jiraClient = axios.create({
  baseURL: `https://${JIRA_DOMAIN}/rest/api/2`,
  headers: {
    Authorization: `Bearer ${JIRA_API_TOKEN || ''}`,
  },
  httpsAgent,
});

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    priority: { name: string };
    issuetype: { name: string };
    created: string;
    updated: string;
    resolutiondate?: string;
    customfield_10724?: { name: string } | null; // Grupo Asignado
    customfield_14100?: Array<{ name: string }> | null; // Grupos Involucrados
    customfield_11907?: Array<{ name: string }> | null; // Grupo/s Resolutor/es
    subtasks?: Array<{
      key: string;
      fields: {
        summary: string;
        status: { name: string; statusCategory: { key: string } };
        priority: { name: string };
      };
    }>;
  };
}

export interface SubtaskRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  done: boolean;
  created?: string;
  resolutiondate?: string;
  actionPointType?: string;
  assignedGroup?: string;
  involvedGroups?: string[];
}

export interface WikiPageLink {
  url: string;
  title: string;
}

export interface DashboardIssueRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  type: string;
  created: string;
  resolutiondate?: string;
  assignedGroup: string;
  involvedGroups: string;
  resolvingGroups: string;
  subtasksTotal: number;
  subtasksDone: number;
  subtasks: SubtaskRow[];
  wikiPage?: WikiPageLink;
}

export interface DashboardStats {
  totalOpen: number;
  totalClosed: number;
  byState: Record<string, number>;
  byPriority: Record<string, number>;
  timeline: Array<{ date: string; created: number; closed: number }>;
  issues: DashboardIssueRow[];
}

const SEARCH_FIELDS = [
  'summary',
  'status',
  'priority',
  'issuetype',
  'created',
  'updated',
  'resolutiondate',
  'customfield_10724', // Grupo Asignado
  'customfield_14100', // Grupos Involucrados
  'customfield_11907', // Grupo/s Resolutor/es
  'subtasks',
].join(',');

export interface SubtaskExtraFields {
  actionPointType?: string;
  assignedGroup?: string;
  involvedGroups?: string[];
  created?: string;
  resolutiondate?: string;
}

// El campo "subtasks" del /search solo devuelve summary/status/priority/issuetype,
// así que campos como el tipo de Action Point, el Grupo Asignado o las fechas hay que pedirlos aparte por clave.
async function getSubtaskExtraFields(keys: string[]): Promise<Map<string, SubtaskExtraFields>> {
  const extrasByKey = new Map<string, SubtaskExtraFields>();
  const chunkSize = 150;

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    try {
      const response = await jiraClient.get('/search', {
        params: {
          jql: `key in (${chunk.join(',')})`,
          maxResults: chunkSize,
          fields: 'customfield_11955,customfield_10724,customfield_14100,created,resolutiondate',
        },
      });
      response.data.issues.forEach(
        (issue: {
          key: string;
          fields?: {
            customfield_11955?: { value: string };
            customfield_10724?: { name: string };
            customfield_14100?: Array<{ name: string }>;
            created?: string;
            resolutiondate?: string;
          };
        }) => {
          extrasByKey.set(issue.key, {
            actionPointType: issue.fields?.customfield_11955?.value,
            assignedGroup: issue.fields?.customfield_10724?.name,
            involvedGroups: issue.fields?.customfield_14100?.map((g) => g.name),
            created: issue.fields?.created,
            resolutiondate: issue.fields?.resolutiondate,
          });
        }
      );
    } catch (error) {
      console.error('Error fetching subtask extra fields from Jira:', error);
    }
  }

  return extrasByKey;
}

interface RemoteLink {
  relationship?: string;
  application?: { type?: string };
  object: { url: string; title: string };
}

// Una vez que un postmortem tiene su Wiki Page enlazada en Jira, ese enlace no
// cambia: se cachea en memoria del proceso (vive mientras viva el proceso de
// pm2) para no volver a pedirlo en cada carga del dashboard. Los postmortems
// que TODAVÍA no tienen enlace no se cachean como "sin enlace" — son pocos, y
// así seguimos comprobándolos por si se añade el enlace más adelante.
const wikiPageCache = new Map<string, WikiPageLink>();

// La "Wiki Page" de un postmortem no es un campo de Jira: es un remote link a
// Confluence (relationship "Wiki Page"), y solo se puede pedir issue por issue
// vía /issue/{key}/remotelink, no en el /search masivo. Se piden en tandas para
// no lanzar cientos de peticiones a la vez.
async function getWikiPageLinks(keys: string[]): Promise<Map<string, WikiPageLink>> {
  const linksByKey = new Map<string, WikiPageLink>();
  const keysToFetch: string[] = [];

  keys.forEach((key) => {
    const cached = wikiPageCache.get(key);
    if (cached) {
      linksByKey.set(key, cached);
    } else {
      keysToFetch.push(key);
    }
  });

  const concurrency = 15;
  for (let i = 0; i < keysToFetch.length; i += concurrency) {
    const chunk = keysToFetch.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (key) => {
        try {
          const response = await jiraClient.get<RemoteLink[]>(`/issue/${key}/remotelink`);
          const wikiLink = response.data.find(
            (link) => link.relationship === 'Wiki Page' || link.application?.type === 'com.atlassian.confluence'
          );
          if (wikiLink) {
            const link = { url: wikiLink.object.url, title: wikiLink.object.title };
            linksByKey.set(key, link);
            wikiPageCache.set(key, link);
          }
        } catch (error) {
          console.error(`Error fetching remote links for ${key}:`, error);
        }
      })
    );
  }

  return linksByKey;
}

export async function getIssuesByProject(): Promise<JiraIssue[]> {
  const jql = `project = ${PROJECT_KEY} AND "AP Área" = "+O IT"`;
  const pageSize = 100;
  const issues: JiraIssue[] = [];

  try {
    let startAt = 0;
    let total = Infinity;

    while (startAt < total) {
      const response = await jiraClient.get('/search', {
        params: {
          jql,
          startAt,
          maxResults: pageSize,
          fields: SEARCH_FIELDS,
        },
      });
      issues.push(...response.data.issues);
      total = response.data.total;
      startAt += pageSize;
    }

    return issues;
  } catch (error) {
    console.error('Error fetching issues from Jira:', error);
    return issues;
  }
}

export async function getDashboardStats(days: number = 30): Promise<DashboardStats> {
  const issues = await getIssuesByProject();

  const subtaskKeys = issues.flatMap((issue) => issue.fields.subtasks?.map((s) => s.key) || []);
  const subtaskExtras = await getSubtaskExtraFields(subtaskKeys);

  const postmortemKeys = issues.filter((issue) => issue.fields.issuetype.name === 'Postmortem').map((issue) => issue.key);
  const wikiPageLinks = await getWikiPageLinks(postmortemKeys);

  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const byState: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const timelineMap: Record<string, { created: number; closed: number }> = {};

  let totalOpen = 0;
  let totalClosed = 0;

  issues.forEach((issue) => {
    const status = issue.fields.status.name;
    const priority = issue.fields.priority.name;
    const createdDate = new Date(issue.fields.created);
    const dateKey = createdDate.toISOString().split('T')[0];

    // Count by state
    byState[status] = (byState[status] || 0) + 1;
    if (status === 'Open' || status === 'To Do' || status === 'In Progress') {
      totalOpen++;
    } else {
      totalClosed++;
    }

    // Count by priority
    byPriority[priority] = (byPriority[priority] || 0) + 1;

    // Timeline data
    if (createdDate >= pastDate) {
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { created: 0, closed: 0 };
      }
      timelineMap[dateKey].created++;

      if (issue.fields.resolutiondate) {
        const resolvedDate = new Date(issue.fields.resolutiondate);
        const resolvedKey = resolvedDate.toISOString().split('T')[0];
        if (!timelineMap[resolvedKey]) {
          timelineMap[resolvedKey] = { created: 0, closed: 0 };
        }
        timelineMap[resolvedKey].closed++;
      }
    }
  });

  const timeline = Object.entries(timelineMap)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, data]) => ({ date, ...data }));

  const issueRows: DashboardIssueRow[] = issues
    .map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority.name,
      type: issue.fields.issuetype.name,
      created: issue.fields.created,
      resolutiondate: issue.fields.resolutiondate,
      assignedGroup: issue.fields.customfield_10724?.name || '-',
      involvedGroups: issue.fields.customfield_14100?.map((g) => g.name).join(', ') || '-',
      resolvingGroups: issue.fields.customfield_11907?.map((g) => g.name).join(', ') || '-',
      subtasksTotal: issue.fields.subtasks?.length || 0,
      subtasksDone: issue.fields.subtasks?.filter((s) => s.fields.status.statusCategory.key === 'done').length || 0,
      subtasks: (issue.fields.subtasks || []).map((s) => ({
        key: s.key,
        summary: s.fields.summary,
        status: s.fields.status.name,
        priority: s.fields.priority.name,
        done: s.fields.status.statusCategory.key === 'done',
        actionPointType: subtaskExtras.get(s.key)?.actionPointType,
        assignedGroup: subtaskExtras.get(s.key)?.assignedGroup,
        involvedGroups: subtaskExtras.get(s.key)?.involvedGroups,
        created: subtaskExtras.get(s.key)?.created,
        resolutiondate: subtaskExtras.get(s.key)?.resolutiondate,
      })),
      wikiPage: wikiPageLinks.get(issue.key),
    }))
    .sort((a, b) => b.created.localeCompare(a.created));

  return {
    totalOpen,
    totalClosed,
    byState,
    byPriority,
    timeline,
    issues: issueRows,
  };
}
