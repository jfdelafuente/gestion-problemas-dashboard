'use client';

import { useState, useEffect, useRef } from 'react';
import { C } from '@/lib/theme';
import {
  ExecutiveActionPoint,
  ExecutiveReportRequest,
  ExecutiveReportResponse,
  ExecutiveReportStatusResponse,
} from '@/types/executiveReport';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentRef: string;
  summary: string;
  defaultConfluenceUrl?: string;
  issue?: {
    key?: string;
    summary?: string;
    created?: string;
    resolutiondate?: string;
    description?: string;
    subtasks?: Array<{
      key: string;
      summary: string;
      status: string;
      actionPointType?: string;
      assignedGroup?: string;
      resolutiondate?: string;
    }>;
  };
  onGenerated?: () => void;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calculateDuration(startStr?: string, endStr?: string): string {
  if (!startStr || !endStr) return '';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '';
  const totalMins = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

function getFullUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${basePath}${cleanPath}`;
}

export default function ExecutiveReportModal({
  isOpen,
  onClose,
  incidentRef,
  summary,
  defaultConfluenceUrl = '',
  issue,
  onGenerated,
}: ExecutiveReportModalProps) {
  const [confluenceUrl, setConfluenceUrl] = useState(defaultConfluenceUrl);
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ downloadUrl: string; filename: string } | null>(null);
  const [cachedInfo, setCachedInfo] = useState<{ filename: string; downloadUrl: string } | null>(null);

  const prevIsOpenRef = useRef(false);
  const prevIncidentRef = useRef<string | null>(null);

  const formattedStartTime = formatDisplayDate(issue?.created);
  const computedDuration = calculateDuration(issue?.created, issue?.resolutiondate);
  const actionPointsCount = issue?.subtasks?.length || 0;

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const changedIncident = isOpen && incidentRef !== prevIncidentRef.current;

    prevIsOpenRef.current = isOpen;
    prevIncidentRef.current = incidentRef;

    if (justOpened || changedIncident) {
      setConfluenceUrl(defaultConfluenceUrl || '');
      setMode('url');
      setManualText('');
      setError(null);
      setSuccessResult(null);
      setLoading(false);
      setCachedInfo(null);

      if (incidentRef) {
        fetch(getFullUrl(`/api/reports/executive-incident/${encodeURIComponent(incidentRef)}/status`))
          .then(async (r) => {
            const contentType = r.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return (await r.json()) as ExecutiveReportStatusResponse;
            }
            return null;
          })
          .then((data) => {
            const rawUrl = data?.downloadUrl || data?.download_url;
            if (data && data.exists && rawUrl && data.filename) {
              setCachedInfo({
                filename: data.filename,
                downloadUrl: getFullUrl(rawUrl),
              });
            }
          })
          .catch(() => setCachedInfo(null));
      }
    }
  }, [isOpen, defaultConfluenceUrl, incidentRef]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const actionPoints: ExecutiveActionPoint[] = (issue?.subtasks || []).map((s) => {
        const cleanSummary = (s.summary || '').replace(/^\[[^\]]+\]\s*/, '').trim();
        let owner = s.assignedGroup;
        if (!owner || owner === '—' || owner === '-') {
          const matchTeam = cleanSummary.match(/POSTMORTEM\s+([A-Za-z0-9_\-]+)/i);
          if (matchTeam) {
            owner = matchTeam[1];
          }
        }
        return {
          painPoint: s.actionPointType || s.key || 'Acción',
          description: cleanSummary,
          owner: owner || '—',
          forecast: s.status || s.resolutiondate || '—',
        };
      });

      const payload: ExecutiveReportRequest = {
        incidentRef,
        title: summary,
        confluenceUrl: confluenceUrl.trim(),
        force: true,
        data: {
          incidentRef,
          title: summary,
          sourceUrl: confluenceUrl.trim(),
          startTime: formattedStartTime,
          duration: computedDuration,
          description: issue?.description || '',
          actionPoints: actionPoints,
          rawContent: mode === 'manual' ? manualText.trim() : undefined,
        },
      };

      const res = await fetch(getFullUrl('/api/reports/executive-incident'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: ExecutiveReportResponse | null = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = (await res.json()) as ExecutiveReportResponse;
      } else {
        const text = await res.text();
        throw new Error(`Respuesta no esperada del servidor (${res.status}): ${text.slice(0, 150)}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar la presentación PowerPoint');
      }

      const rawDownloadUrl = data.downloadUrl || data.download_url;
      if (!rawDownloadUrl) {
        throw new Error('El backend generó el informe pero no devolvió la URL de descarga (downloadUrl).');
      }
      const downloadUrl = getFullUrl(rawDownloadUrl);
      const filename = data.filename || `RESUMEN_EJECUTIVO_${incidentRef}.pptx`;

      setSuccessResult({
        downloadUrl,
        filename,
      });

      if (onGenerated) {
        onGenerated();
      }

      // Descarga automática inmediata
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error de comunicación con el servicio de informes';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Fondo oscuro para cerrar al hacer clic fuera */}
      <div
        aria-hidden="true"
        onClick={() => {
          if (!loading) onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Tarjeta del Diálogo Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exec-report-modal-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 1,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          maxWidth: 620,
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fff 80%, #fff7f0 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <h2
                id="exec-report-modal-title"
                style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.ink }}
              >
                Informe Ejecutivo de Incidencia
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.g500 }}>
              Generación de presentación PowerPoint (<code style={{ color: C.orange, fontWeight: 600 }}>.pptx</code>) corporativa Orange
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 20,
              color: C.g400,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tarjeta de Incidencia */}
          <div
            style={{
              padding: 14,
              background: '#fafafa',
              borderRadius: 8,
              border: '1px solid #eee',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.g500, textTransform: 'uppercase' }}>Incidencia:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: C.orange }}>
                {incidentRef || 'Sin referencia'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.g700, fontWeight: 500 }}>
              {summary}
            </div>
          </div>

          {/* Indicador de datos Jira precargados */}
          {(formattedStartTime || issue?.description || actionPointsCount > 0) && (
            <div
              style={{
                padding: '10px 14px',
                background: '#f0f5ff',
                border: '1px solid #adc6ff',
                borderRadius: 8,
                fontSize: 12,
                color: '#1d39c4',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <span>📋</span>
                <span>Datos precargados desde Jira para la Diapositiva 1:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 2, color: '#2f54eb' }}>
                {formattedStartTime && (
                  <span>🕒 Inicio: <strong>{formattedStartTime}</strong>{computedDuration ? ` (${computedDuration})` : ''}</span>
                )}
                {issue?.description && (
                  <span>📄 Descripción técnica lista (impacto, causa y solución)</span>
                )}
                {actionPointsCount > 0 && (
                  <span>📌 <strong>{actionPointsCount}</strong> Puntos de acción (subtareas)</span>
                )}
              </div>
            </div>
          )}

          {/* Banner de informe existente en caché */}
          {cachedInfo && !successResult && (
            <div
              style={{
                padding: '10px 14px',
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: 8,
                fontSize: 12.5,
                color: '#0050b3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💾</span>
                <span>Existe un informe previamente generado para esta incidencia.</span>
              </div>
              <a
                href={cachedInfo.downloadUrl}
                download={cachedInfo.filename}
                style={{
                  color: '#fff',
                  background: '#1890ff',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: 12,
                  padding: '5px 12px',
                  borderRadius: 5,
                  whiteSpace: 'nowrap',
                }}
              >
                ⬇️ Descargar
              </a>
            </div>
          )}

          {/* Selector de modo */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
            <button
              type="button"
              onClick={() => setMode('url')}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: mode === 'url' ? 700 : 500,
                color: mode === 'url' ? C.orange : C.g500,
                borderBottom: mode === 'url' ? `2px solid ${C.orange}` : '2px solid transparent',
              }}
            >
              🔗 URL de Confluence
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: mode === 'manual' ? 700 : 500,
                color: mode === 'manual' ? C.orange : C.g500,
                borderBottom: mode === 'manual' ? `2px solid ${C.orange}` : '2px solid transparent',
              }}
            >
              📝 Pegar Contenido / Texto
            </button>
          </div>

          {/* Entrada de URL de Confluence */}
          {mode === 'url' ? (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.g700, marginBottom: 6 }}>
                Enlace al Postmortem en Confluence:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  value={confluenceUrl}
                  onChange={(e) => setConfluenceUrl(e.target.value)}
                  placeholder="https://confluence.si.orange.es/display/..."
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #ccc',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                {confluenceUrl && (
                  <a
                    href={confluenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir página en nueva pestaña para verificar sesión"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f4f4f4',
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      color: C.g700,
                      textDecoration: 'none',
                      fontSize: 12.5,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ↗ Abrir
                  </a>
                )}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: C.g500 }}>
                💡 Se utilizará la plantilla oficial Orange con Diapositiva 1 (Resumen, Causas, Acciones) y Diapositivas 2-3 (Cronología).
              </p>
              <div
                style={{
                  marginTop: 10,
                  padding: '9px 12px',
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#ad6800',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  ℹ️ Diapositiva 1 lista con datos de Jira
                </div>
                <div>
                  La <strong>Diapositiva 1</strong> (Impacto, Causa, Solución y Puntos de Acción) se rellena automáticamente desde Jira. Si el postmortem de Confluence requiere sesión SSO corporativa en tu navegador y deseas incluir además la <strong>cronología detallada</strong> (Diapositivas 2 y 3), copia el texto de Confluence y pégalo en la pestaña <strong>📝 Pegar Contenido / Texto</strong>.
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.g700, marginBottom: 6 }}>
                Pegar texto o contenido copiado de Confluence:
              </label>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Pega aquí los bloques de impacto, causa, solución o la cronología..."
                rows={5}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  fontSize: 12.5,
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {/* Feedback de Error */}
          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: 6,
                fontSize: 13,
                color: '#cf1322',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Feedback de Éxito */}
          {successResult && (
            <div
              style={{
                padding: '12px 16px',
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 6,
                fontSize: 13,
                color: '#389e0d',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <span>✅</span>
                <span>¡Informe PowerPoint generado correctamente!</span>
              </div>
              <a
                href={successResult.downloadUrl}
                download={successResult.filename}
                style={{
                  color: C.orange,
                  fontWeight: 700,
                  textDecoration: 'underline',
                  fontSize: 12.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ⬇️ Descargar de nuevo: {successResult.filename}
              </a>
            </div>
          )}
        </div>

        {/* Pie de Acciones */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            background: '#fafafa',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #d9d9d9',
              background: '#fff',
              color: C.g700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {successResult ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: loading ? '#ffa940' : C.orange,
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 4px rgba(255, 121, 0, 0.25)',
              transition: 'background 0.15s ease',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Generando PowerPoint...</span>
              </>
            ) : (
              <>
                <span>{cachedInfo ? '🔄' : '📄'}</span>
                <span>{cachedInfo ? 'Regenerar y Descargar PPT' : 'Generar y Descargar PPT'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
