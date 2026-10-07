import { NextRequest, NextResponse } from 'next/server';

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
        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });
      }
      return NextResponse.json({ exists: false }, { status: 200 });
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
  } catch (error: any) {
    console.error('Error en proxy de descarga/estado de informe:', error);
    return NextResponse.json(
      {
        success: false,
        error: `No se pudo comunicar con el servidor backend (${BACKEND_URL}). Verifique que 'serve_app.py' esté arrancado.`,
        details: error?.message,
      },
      { status: 502 }
    );
  }
}
