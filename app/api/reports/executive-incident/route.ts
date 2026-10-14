import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveReportRequest, ExecutiveReportResponse } from '@/types/executiveReport';

const BACKEND_URL = process.env.BACKEND_REPORTS_URL || 'http://localhost:8000';

function resolveRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export async function POST(request: NextRequest) {
  const reqId = resolveRequestId(request);
  const startMs = Date.now();
  try {
    const body: ExecutiveReportRequest = await request.json();

    const incidentRef = body.incidentRef || body.data?.incidentRef;
    if (!incidentRef) {
      const errResponse: ExecutiveReportResponse = {
        success: false,
        status: 'FAILED',
        incidentRef: '',
        requestId: reqId,
        error: `El identificador de incidencia (incidentRef) es obligatorio para generar el informe. (Ref: ${reqId})`,
      };
      return NextResponse.json(errResponse, {
        status: 400,
        headers: { 'X-Request-ID': reqId },
      });
    }

    const upstreamHeaders = {
      'Content-Type': 'application/json',
      'X-Request-ID': reqId,
    };

    // Intentar endpoint OpenAPI v1 prioritario con fallback a ruta legacy
    let resp = await fetch(`${BACKEND_URL}/api/v1/reports/executive-incident`, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });

    if (resp.status === 404) {
      resp = await fetch(`${BACKEND_URL}/api/reports/executive-incident`, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(body),
      });
    }

    const backendReqId = resp.headers.get('x-request-id') || reqId;
    const elapsedMs = Date.now() - startMs;
    console.log(`[${backendReqId}] POST /api/reports/executive-incident (${incidentRef}) -> ${resp.status} (${elapsedMs}ms)`);

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      const rawDownloadUrl = data.downloadUrl || data.download_url;
      const normalizedData: ExecutiveReportResponse = {
        ...data,
        status: data.status || (resp.status === 202 ? 'PROCESSING' : data.success ? 'READY' : 'FAILED'),
        downloadUrl: rawDownloadUrl,
        download_url: rawDownloadUrl,
        incidentRef: data.incidentRef || data.incident_ref,
        incident_ref: data.incident_ref || data.incidentRef,
        sizeBytes: data.sizeBytes ?? data.size_bytes,
        size_bytes: data.size_bytes ?? data.sizeBytes,
        slideCount: data.slideCount ?? data.slide_count,
        slide_count: data.slide_count ?? data.slideCount,
        generatedAt: data.generatedAt || data.generated_at,
        generated_at: data.generated_at || data.generatedAt,
        requestId: data.requestId || data.request_id || backendReqId,
      };
      return NextResponse.json(normalizedData, {
        status: resp.status,
        headers: { 'X-Request-ID': backendReqId },
      });
    }

    const text = await resp.text();
    console.error(`[${backendReqId}] Respuesta no JSON del backend:`, resp.status, text.slice(0, 300));
    return NextResponse.json(
      {
        success: false,
        status: 'FAILED',
        incidentRef,
        requestId: backendReqId,
        error: `El backend (${BACKEND_URL}) devolvió un código ${resp.status} no esperado. (Ref: ${backendReqId})`,
      },
      {
        status: resp.status >= 400 && resp.status < 500 ? resp.status : 502,
        headers: { 'X-Request-ID': backendReqId },
      }
    );
  } catch (error: unknown) {
    console.error(`[${reqId}] Error conectando con backend de informes:`, error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        status: 'FAILED',
        incidentRef: '',
        requestId: reqId,
        error: `No se pudo conectar con el servidor de informes (${BACKEND_URL}). Verifique que el backend esté arrancado en el puerto 8000. (Ref: ${reqId})`,
        details,
      },
      {
        status: 502,
        headers: { 'X-Request-ID': reqId },
      }
    );
  }
}
