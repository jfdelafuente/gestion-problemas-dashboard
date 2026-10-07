import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_REPORTS_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const resp = await fetch(`${BACKEND_URL}/api/reports/executive-incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    const text = await resp.text();
    console.error('Respuesta no JSON del backend:', resp.status, text.slice(0, 300));
    return NextResponse.json(
      {
        success: false,
        error: `El backend devolvió un código ${resp.status} no esperado. Asegúrese de que serve_app.py está en ejecución.`,
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error('Error conectando con backend de informes:', error);
    return NextResponse.json(
      {
        success: false,
        error: `No se pudo conectar con el servidor de informes (${BACKEND_URL}). Verifique que 'python serve_app.py' esté arrancado.`,
        details: error?.message,
      },
      { status: 502 }
    );
  }
}
