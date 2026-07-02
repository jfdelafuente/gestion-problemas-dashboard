import axios from 'axios';
import https from 'https';

const JIRA_DOMAIN = process.env.NEXT_PUBLIC_JIRA_DOMAIN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY;

// Para desarrollo con certificados autofirmados
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const jiraClient = axios.create({
  baseURL: `https://${JIRA_DOMAIN}/rest/api/2`,
  auth: {
    username: JIRA_EMAIL || '',
    password: JIRA_API_TOKEN || '',
  },
  httpsAgent,
});

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    priority: { name: string };
    created: string;
    updated: string;
    resolutiondate?: string;
  };
}

export interface DashboardStats {
  totalOpen: number;
  totalClosed: number;
  byState: Record<string, number>;
  byPriority: Record<string, number>;
  timeline: Array<{ date: string; created: number; closed: number }>;
}

export async function getIssuesByProject(): Promise<JiraIssue[]> {
  try {
    const jql = `project = ${PROJECT_KEY} AND "AP Área" = "+O IT"`;
    const response = await jiraClient.get('/search', {
      params: {
        jql,
        maxResults: 100,
        expand: 'changelog',
      },
    });
    return response.data.issues;
  } catch (error) {
    console.error('Error fetching issues from Jira:', error);
    return [];
  }
}

export async function getDashboardStats(days: number = 30): Promise<DashboardStats> {
  const issues = await getIssuesByProject();

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

  return {
    totalOpen,
    totalClosed,
    byState,
    byPriority,
    timeline,
  };
}
