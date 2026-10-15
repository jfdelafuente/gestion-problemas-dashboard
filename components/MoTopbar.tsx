'use client';

import React, { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { id: 'portal', label: 'Portal', href: '/dashboards/portal/' },
  { id: 'massive-incidents', label: 'Incidencias masivas', href: '/dashboards/massive-incidents/' },
  { id: 'postmortem', label: 'Release', href: '/dashboards/postmortem/' },
  { id: 'release-kpis', label: 'KPIs Release', href: '/dashboards/release-kpis/' },
  { id: 'reportes-incidencias', label: 'Reportes de Incidencias', href: '/dashboards/reportes-incidencias/' },
  { id: 'problemas', label: 'Gestión de Problemas', href: '/problemas' },
];

type SyncState = 'syncing' | 'online' | 'offline';

interface SyncEventDetail {
  state: SyncState;
  cacheStatus?: string | null;
  title?: string;
}

export default function MoTopbar({ active = 'problemas' }: { active?: string }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const [statusState, setStatusState] = useState<SyncState>('syncing');
  const [statusText, setStatusText] = useState<string>('API');
  const [statusTitle, setStatusTitle] = useState<string>('Comprobando conexión con servicios...');

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    fetch(`${basePath}/api/readyz`, { signal: controller.signal, cache: 'no-store' })
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error(`HTTP ${r.status}`);
      })
      .then((data) => {
        if (!mounted) return;
        clearTimeout(timer);
        const reportingOk = data?.checks?.reportingBackend?.status === 'ok';
        const jiraCacheOk = data?.checks?.jiraCache?.status === 'ok';
        setStatusState('online');
        setStatusText('API OK');
        setStatusTitle(
          reportingOk
            ? 'Servicios operativos (Jira + Backend Informes FastAPI)'
            : jiraCacheOk
              ? 'Servicio Gestión de Problemas operativo (Caché Jira activa)'
              : 'Servicio Gestión de Problemas operativo'
        );
      })
      .catch(() => {
        if (!mounted) return;
        clearTimeout(timer);
        setStatusState('offline');
        setStatusText('API Offline');
        setStatusTitle('Servicio de backend no accesible');
      });

    const handleSync = (evt: Event) => {
      const customEvt = evt as CustomEvent<SyncEventDetail>;
      const detail = customEvt.detail;
      if (!detail || !mounted) return;
      if (detail.state === 'syncing') {
        setStatusState('syncing');
        setStatusText('Sincronizando');
        setStatusTitle(detail.title || 'Sincronizando datos con Jira...');
      } else if (detail.state === 'online') {
        setStatusState('online');
        setStatusText(detail.cacheStatus === 'STALE' ? 'Caché Stale' : 'API OK');
        setStatusTitle(
          detail.title ||
            (detail.cacheStatus
              ? `Servicio operativo (Origen datos: ${detail.cacheStatus})`
              : 'Servicios operativos')
        );
      } else if (detail.state === 'offline') {
        setStatusState('offline');
        setStatusText('Error API');
        setStatusTitle(detail.title || 'Error al sincronizar datos con el backend');
      }
    };

    window.addEventListener('mo:dashboard-sync', handleSync);
    return () => {
      mounted = false;
      clearTimeout(timer);
      window.removeEventListener('mo:dashboard-sync', handleSync);
    };
  }, [basePath]);

  return (
    <header className="mo-topbar" role="banner">
      <a href="/dashboards/portal/" className="mo-topbar-brand" aria-label="Ir al Portal de Fiabilidad">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${basePath}/assets/orange-logo.svg`}
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== '/dashboards/assets/orange-logo.svg') {
              target.src = '/dashboards/assets/orange-logo.svg';
            }
          }}
          alt="Orange"
        />
      </a>
      <div className="mo-topbar-sep" aria-hidden="true" />
      <span className="mo-topbar-dept">Customer &amp; Service Operations</span>
      <nav className="mo-topbar-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={item.id === active ? 'active' : ''}
            aria-current={item.id === active ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="mo-topbar-right">
        <div className="mo-status-badge" id="mo-api-status" title={statusTitle}>
          <span className={`mo-status-dot ${statusState}`} id="mo-api-status-dot" />
          <span className="mo-status-text" id="mo-api-status-text">
            {statusText}
          </span>
        </div>
      </div>
    </header>
  );
}
