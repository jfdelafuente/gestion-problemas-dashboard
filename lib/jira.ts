import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

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
  incidentRef?: string;
  description?: string;
}

export interface DashboardStats {
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

// Los postmortems y problemas referencian a veces un incidente de Remedy/ServiceNow
// como texto suelto dentro de la Descripción (no es un campo de Jira independiente),
// con un formato variable de dígitos: INC000004068764, INC000004030052, etc.
function extractIncidentRef(description?: string): string | undefined {
  return description?.match(/INC\d{6,}/)?.[0];
}

interface IncidentInfo {
  incidentRef?: string;
  description?: string;
}

// La Descripción pesa bastante (varios KB por issue) y solo hace falta para
// extraer el incidente en Postmortems y Problemas, así que se pide aparte —vía
// key in (...), igual que getSubtaskExtraFields— en vez de en SEARCH_FIELDS,
// donde se pediría (y pagaría en bytes) para los ~1650 issues del proyecto.
async function getIncidentRefs(keys: string[]): Promise<Map<string, IncidentInfo>> {
  const refsByKey = new Map<string, IncidentInfo>();
  if (keys.length === 0) return refsByKey;
  const chunkSize = 150;
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += chunkSize) {
    chunks.push(keys.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await jiraClient.get('/search', {
          params: {
            jql: `key in (${chunk.join(',')})`,
            maxResults: chunkSize,
            fields: 'description',
          },
        });
        response.data.issues?.forEach((issue: { key: string; fields?: { description?: string } }) => {
          const desc = issue.fields?.description;
          const ref = extractIncidentRef(desc);
          refsByKey.set(issue.key, { incidentRef: ref, description: desc });
        });
      } catch (error) {
        console.error('Error fetching issue descriptions from Jira:', error);
      }
    })
  );

  return refsByKey;
}

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
  if (keys.length === 0) return extrasByKey;
  const chunkSize = 150;
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += chunkSize) {
    chunks.push(keys.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await jiraClient.get('/search', {
          params: {
            jql: `key in (${chunk.join(',')})`,
            maxResults: chunkSize,
            fields: 'customfield_11955,customfield_10724,customfield_14100,created,resolutiondate',
          },
        });
        response.data.issues?.forEach(
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
    })
  );

  return extrasByKey;
}

interface RemoteLink {
  relationship?: string;
  application?: { type?: string };
  object: { url: string; title: string };
}

// Caché persistente en disco para enlaces a Confluence
const CACHE_DIR = path.join(process.cwd(), '.cache');
const WIKI_LINKS_CACHE_FILE = path.join(CACHE_DIR, 'jira_wiki_links.json');

function loadWikiPageCache(): Map<string, WikiPageLink> {
  const map = new Map<string, WikiPageLink>();
  try {
    if (fs.existsSync(WIKI_LINKS_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(WIKI_LINKS_CACHE_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'url' in v && typeof (v as Record<string, unknown>).url === 'string') {
          map.set(k, v as unknown as WikiPageLink);
        }
      }
    }
  } catch (err) {
    console.warn('No se pudo cargar la caché de WikiPageLinks desde disco:', err);
  }
  return map;
}

function saveWikiPageCache(map: Map<string, WikiPageLink>) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(WIKI_LINKS_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('No se pudo guardar la caché de WikiPageLinks en disco:', err);
  }
}

const wikiPageCache = loadWikiPageCache();

// La "Wiki Page" de un postmortem no es un campo de Jira: es un remote link a
// Confluence (relationship "Wiki Page"), y solo se puede pedir issue por issue
// vía /issue/{key}/remotelink. Se cachean persistentemente para no volver a pedirlas.
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

  if (keysToFetch.length === 0) {
    return linksByKey;
  }

  let hasNewLinks = false;
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
            hasNewLinks = true;
          }
        } catch (error) {
          console.error(`Error fetching remote links for ${key}:`, error);
        }
      })
    );
  }

  if (hasNewLinks) {
    saveWikiPageCache(wikiPageCache);
  }

  return linksByKey;
}

export async function getIssuesByProject(): Promise<JiraIssue[]> {
  const jql = `project = ${PROJECT_KEY} AND "AP Área" = "+O IT"`;
  const pageSize = 100;
  const issues: JiraIssue[] = [];

  try {
    const firstResponse = await jiraClient.get('/search', {
      params: {
        jql,
        startAt: 0,
        maxResults: pageSize,
        fields: SEARCH_FIELDS,
      },
    });

    issues.push(...(firstResponse.data.issues || []));
    const total = firstResponse.data.total;

    if (total > pageSize) {
      const offsets: number[] = [];
      for (let offset = pageSize; offset < total; offset += pageSize) {
        offsets.push(offset);
      }

      // Descargamos en lotes concurrentes de 5 peticiones simultáneas
      const concurrency = 5;
      for (let i = 0; i < offsets.length; i += concurrency) {
        const batch = offsets.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map((startAt) =>
            jiraClient.get('/search', {
              params: {
                jql,
                startAt,
                maxResults: pageSize,
                fields: SEARCH_FIELDS,
              },
            })
          )
        );
        for (const res of batchResults) {
          if (res.data.issues) {
            issues.push(...res.data.issues);
          }
        }
      }
    }

    return issues;
  } catch (error) {
    console.error('Error fetching issues from Jira:', error);
    return issues;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const issues = await getIssuesByProject();

  const subtaskKeys = issues.flatMap((issue) => issue.fields.subtasks?.map((s) => s.key) || []);
  const postmortemKeys = issues.filter((issue) => issue.fields.issuetype.name === 'Postmortem').map((issue) => issue.key);
  const problemaKeys = issues.filter((issue) => issue.fields.issuetype.name === 'Problema').map((issue) => issue.key);

  const [subtaskExtras, wikiPageLinks, incidentRefs] = await Promise.all([
    getSubtaskExtraFields(subtaskKeys),
    getWikiPageLinks(postmortemKeys),
    getIncidentRefs([...postmortemKeys, ...problemaKeys]),
  ]);

  const issueRows: DashboardIssueRow[] = issues
    .map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority.name,
      type: issue.fields.issuetype.name,
      created: issue.fields.created,
      resolutiondate: issue.fields.resolutiondate,
      incidentRef: incidentRefs.get(issue.key)?.incidentRef,
      description: incidentRefs.get(issue.key)?.description,
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

  return { issues: issueRows };
}
