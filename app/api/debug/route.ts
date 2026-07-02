import axios from 'axios';
import https from 'https';
import { NextRequest, NextResponse } from 'next/server';

const JIRA_DOMAIN = process.env.NEXT_PUBLIC_JIRA_DOMAIN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY;

export async function GET(request: NextRequest) {
  try {
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

    const jql = `project = ${PROJECT_KEY} AND "AP Área" = "+O IT"`;

    console.log('Testing Jira connection...');
    console.log('Domain:', JIRA_DOMAIN);
    console.log('Email:', JIRA_EMAIL);
    console.log('JQL:', jql);

    const response = await jiraClient.get('/search', {
      params: {
        jql,
        maxResults: 5,
      },
    });

    return NextResponse.json({
      success: true,
      issueCount: response.data.total,
      issues: response.data.issues.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
      })),
    });
  } catch (error: any) {
    console.error('Jira API Error:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: error.response?.data || error.message,
      statusCode: error.response?.status,
    }, { status: error.response?.status || 500 });
  }
}
