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

export type ExecutiveReportJobStatus = 'NOT_FOUND' | 'PROCESSING' | 'READY' | 'FAILED';

export interface ExecutiveReportRequest {
  incidentRef: string;
  title?: string;
  confluenceUrl?: string;
  force?: boolean;
  asyncMode?: boolean;
  async_mode?: boolean;
  data?: ExecutiveIncidentData;
}

export interface ExecutiveReportResponse {
  success: boolean;
  status?: ExecutiveReportJobStatus;
  incidentRef: string;
  incident_ref?: string;
  filename?: string;
  downloadUrl?: string;
  download_url?: string;
  generatedAt?: string;
  generated_at?: string;
  sizeBytes?: number;
  size_bytes?: number;
  slideCount?: number;
  slide_count?: number;
  cached?: boolean;
  requestId?: string;
  request_id?: string;
  error?: string;
  details?: string;
}

export interface ExecutiveReportStatusResponse {
  exists: boolean;
  status?: ExecutiveReportJobStatus;
  incidentRef: string;
  incident_ref?: string;
  filename?: string;
  downloadUrl?: string;
  download_url?: string;
  sizeBytes?: number;
  size_bytes?: number;
  requestId?: string;
  request_id?: string;
  error?: string;
}
