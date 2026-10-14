import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveReportStatusResponse } from '@/types/executiveReport';

const BACKEND_URL = process.env.BACKEND_REPORTS_URL || 'http://localhost:8000';

function resolveRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const reqId = resolveRequestId(request);
  try {
    const { slug } = await context.params;
    const subPath = slug.map(encodeURIComponent).join('/');
    const upstreamHeaders = { 'X-Request-ID': reqId };

    // Intentar primero endpoint v1 con fallback a legacy si devuelve 404
    let targetUrl = `${BACKEND_URL}/api/v1/reports/executive-incident/${subPath}`;
    let resp = await fetch(targetUrl, { headers: upstreamHeaders, cache: 'no-store' });

    if (resp.status === 404) {
      targetUrl = `${BACKEND_URL}/api/reports/executive-incident/${subPath}`;
      resp = await fetch(targetUrl, { headers: upstreamHeaders, cache: 'no-store' });
    }

    const backendReqId = resp.headers.get('x-request-id') || reqId;

    if (slug.length >= 2 && slug[slug.length - 1] === 'status') {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        const rawDownloadUrl = data.downloadUrl || data.download_url;
        const normalizedData: ExecutiveReportStatusResponse = {
          ...data,
          status: data.status || (data.exists ? 'READY' : 'NOT_FOUND'),
          downloadUrl: rawDownloadUrl,
          download_url: rawDownloadUrl,
          incidentRef: data.incidentRef || data.incident_ref,
          incident_ref: data.incident_ref || data.incidentRef,
          sizeBytes: data.sizeBytes ?? data.size_bytes,
          size_bytes: data.size_bytes ?? data.sizeBytes,
          requestId: data.requestId || data.request_id || backendReqId,
        };
        return NextResponse.json(normalizedData, {
          status: resp.status,
          headers: { 'X-Request-ID': backendReqId, 'Cache-Control': 'no-store' },
        });
      }
      return NextResponse.json(
        { exists: false, status: 'NOT_FOUND', incidentRef: slug[0], requestId: backendReqId },
        { status: 200, headers: { 'X-Request-ID': backendReqId, 'Cache-Control': 'no-store' } }
      );
    }

    // Descarga de archivo binario
    if (!resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        return NextResponse.json(
          { ...data, requestId: backendReqId },
          { status: resp.status, headers: { 'X-Request-ID': backendReqId } }
        );
      }
      return NextResponse.json(
        {
          success: false,
          requestId: backendReqId,
          error: `Error del backend al descargar archivo (${resp.status}) (Ref: ${backendReqId})`,
        },
        { status: resp.status, headers: { 'X-Request-ID': backendReqId } }
      );
    }

    const fileBuffer = await resp.arrayBuffer();
    const contentDisposition = resp.headers.get('content-disposition') || `attachment; filename="RESUMEN_EJECUTIVO_${slug[0]}.pptx"`;
    const contentType = resp.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'X-Request-ID': backendReqId,
      },
    });
  } catch (error: unknown) {
    console.error(`[${reqId}] Error en proxy de descarga/estado de informe:`, error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        status: 'FAILED',
        requestId: reqId,
        error: `No se pudo comunicar con el servidor backend (${BACKEND_URL}). Verifique que el servicio esté arrancado en el puerto 8000. (Ref: ${reqId})`,
        details,
      },
      { status: 502, headers: { 'X-Request-ID': reqId } }
    );
  }
}
