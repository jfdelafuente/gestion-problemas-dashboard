'use client';

import React from 'react';

const NAV_ITEMS = [
  { id: 'portal', label: 'Portal', href: '/dashboards/portal/' },
  { id: 'massive-incidents', label: 'Incidencias masivas', href: '/dashboards/massive-incidents/' },
  { id: 'postmortem', label: 'Release', href: '/dashboards/postmortem/' },
  { id: 'release-kpis', label: 'KPIs Release', href: '/dashboards/release-kpis/' },
  { id: 'reportes-incidencias', label: 'Reportes de Incidencias', href: '/reportes-incidencias/index.html' },
  { id: 'problemas', label: 'Gestión de Problemas', href: '/problemas' },
];

export default function MoTopbar({ active = 'problemas' }: { active?: string }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

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
    </header>
  );
}
