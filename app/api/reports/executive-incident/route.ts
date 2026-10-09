import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveReportRequest, ExecutiveReportResponse } from '@/types/executiveReport';

const BACKEND_URL = process.env.BACKEND_REPORTS_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body: ExecutiveReportRequest = await request.json();

    const incidentRef = body.incidentRef || body.data?.incidentRef;
    if (!incidentRef) {
      const errResponse: ExecutiveReportResponse = {
        success: false,
        incidentRef: '',
        error: 'El identificador de incidencia (incidentRef) es obligatorio para generar el informe.',
      };
      return NextResponse.json(errResponse, { status: 400 });
    }

    // Intentar endpoint OpenAPI v1 prioritario con fallback a ruta legacy
    let resp = await fetch(`${BACKEND_URL}/api/v1/reports/executive-incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 404) {
      resp = await fetch(`${BACKEND_URL}/api/reports/executive-incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data: ExecutiveReportResponse = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    const text = await resp.text();
    console.error('Respuesta no JSON del backend:', resp.status, text.slice(0, 300));
    return NextResponse.json(
      {
        success: false,
        error: `El backend (${BACKEND_URL}) devolvió un código ${resp.status} no esperado. Asegúrese de que el backend de informes (FastAPI en cso-incident-masivas-report o serve_app.py) esté en ejecución.`,
      },
      { status: resp.status >= 400 && resp.status < 500 ? resp.status : 502 }
    );
  } catch (error: unknown) {
    console.error('Error conectando con backend de informes:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: `No se pudo conectar con el servidor de informes (${BACKEND_URL}). Verifique que el backend (FastAPI o serve_app.py) esté arrancado en el puerto 8000.`,
        details,
      },
      { status: 502 }
    );
  }
}

