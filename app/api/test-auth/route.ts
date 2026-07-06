import axios from 'axios';
import https from 'https';
import { NextResponse } from 'next/server';

const JIRA_DOMAIN = process.env.NEXT_PUBLIC_JIRA_DOMAIN;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

export async function GET() {
  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Intentar con endpoint más simple
    const response = await axios.get(
      `https://${JIRA_DOMAIN}/rest/api/2/myself`,
      {
        headers: {
          Authorization: `Bearer ${JIRA_API_TOKEN || ''}`,
        },
        httpsAgent,
      }
    );

    return NextResponse.json({
      success: true,
      user: response.data.name,
      email: response.data.emailAddress,
      displayName: response.data.displayName,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      headers: error.response?.headers,
    }, { status: error.response?.status || 500 });
  }
}
