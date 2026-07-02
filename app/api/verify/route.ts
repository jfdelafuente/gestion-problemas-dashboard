import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    domain: process.env.NEXT_PUBLIC_JIRA_DOMAIN,
    email: process.env.JIRA_EMAIL,
    tokenLength: process.env.JIRA_API_TOKEN?.length,
    projectKey: process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY,
    message: 'Verifica que el email y token sean exactos',
  });
}
