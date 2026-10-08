/**
 * Contrato de tipos para la generación y consulta de Informes Ejecutivos PowerPoint (.pptx)
 * Alineado exactamente con el modelo Python ExecutiveIncidentData (Feature 010).
 */

export interface ExecutiveActionPoint {
  painPoint: string;
  description: string;
  owner: string;
  forecast: string;
}

export interface ExecutiveTimelineEvent {
  time: string;
  event: string;
}

export interface ExecutiveIncidentData {
  incidentRef: string;
  title: string;
  startTime?: string;
  duration?: string;
  impactText?: string;
  businessImpact?: string;
  causeText?: string;
  solutionText?: string;
  sourceUrl?: string;
  description?: string;
  rawContent?: string;
  actionPoints?: ExecutiveActionPoint[];
  timelineEvents?: ExecutiveTimelineEvent[];
}

export interface ExecutiveReportRequest {
  incidentRef: string;
  title?: string;
  confluenceUrl?: string;
  force?: boolean;
  data?: ExecutiveIncidentData;
}

export interface ExecutiveReportResponse {
  success: boolean;
  incidentRef: string;
  filename?: string;
  downloadUrl?: string;
  generatedAt?: string;
  sizeBytes?: number;
  slideCount?: number;
  cached?: boolean;
  error?: string;
  details?: string;
}

export interface ExecutiveReportStatusResponse {
  exists: boolean;
  incidentRef: string;
  filename?: string;
  downloadUrl?: string;
  sizeBytes?: number;
  error?: string;
}

