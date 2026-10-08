import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveReportStatusResponse } from '@/types/executiveReport';

const BACKEND_URL = process.env.BACKEND_REPORTS_URL || 'http://localhost:8000';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;
    const subPath = slug.map(encodeURIComponent).join('/');
    const targetUrl = `${BACKEND_URL}/api/reports/executive-incident/${subPath}`;

    const resp = await fetch(targetUrl);

    if (slug.length >= 2 && slug[slug.length - 1] === 'status') {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data: ExecutiveReportStatusResponse = await resp.json();
        return NextResponse.json(data, { status: resp.status });
      }
      return NextResponse.json({ exists: false, incidentRef: slug[0] }, { status: 200 });
    }

    // Descarga de archivo binario
    if (!resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });
      }
      return NextResponse.json(
        { success: false, error: `Error del backend al descargar archivo (${resp.status})` },
        { status: resp.status }
      );
    }

    const fileBuffer = await resp.arrayBuffer();
    const contentDisposition = resp.headers.get('content-disposition') || 'attachment; filename="informe.pptx"';
    const contentType = resp.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error: unknown) {
    console.error('Error en proxy de descarga/estado de informe:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: `No se pudo comunicar con el servidor backend (${BACKEND_URL}). Verifique que el servicio (FastAPI en cso-incident-masivas-report o serve_app.py) esté arrancado en el puerto 8000.`,
        details,
      },
      { status: 502 }
    );
  }
}

