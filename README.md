# Dashboard de Problemas

Dashboard de seguimiento de Problemas, Postmortems y Action Points desde Jira (Server / Data Center), con el diseño visual de MASORANGE.

## Características

- 📑 **4 pestañas**:
  - **General**: todos los issues (Problema + Postmortem) del periodo
  - **Postmortem**: KPIs y detalle de postmortems, con sus PM Tasks
  - **Problema**: KPIs y detalle de problemas, con sus Action Points
  - **Action Points**: desglose por Grupo Involucrado y tabla filtrable de todos los Action Points

- 📊 **KPIs por pestaña**: total, abiertos/pendientes, cerrados/completados y tiempo medio de resolución, cada uno con una variación (`↑`/`↓`) respecto al periodo anterior equivalente.

- 📈 **Gráficos** (SVG a medida, sin librería de gráficos):
  - Distribución por estado y por prioridad (barra segmentada + leyenda)
  - Tendencia temporal: entradas vs. resueltas + backlog acumulado
  - No cerradas por estado + backlog acumulado (Postmortem y Problema)
  - Action Points por Grupo Involucrado y estado

- 🎛️ **Filtros**:
  - Rango de fechas (7, 30, 90, 365 días), en la cabecera
  - Búsqueda y filtros por estado/grupo en la tabla de Action Points
  - Actualización automática cada hora, o manual con el botón "Actualizar"

## Requisitos

- Node.js 18+
- npm
- Un Personal Access Token (PAT) de una instancia de Jira Server/Data Center

## Instalación

1. Clona el repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Copia `.env.example` a `.env.local` y rellena tus credenciales (ver [SETUP_JIRA.md](SETUP_JIRA.md)):
   ```bash
   cp .env.example .env.local
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abre [http://localhost:3000](http://localhost:3000)

## Autenticación con Jira

Esta app está pensada para **Jira Server / Data Center**, no Jira Cloud: usa autenticación `Bearer` con un **Personal Access Token** generado desde el propio Jira (Perfil → Personal Access Tokens), no un API token de `id.atlassian.com`. Detalles paso a paso en [SETUP_JIRA.md](SETUP_JIRA.md).

## Estructura del proyecto

```
├── app/
│   ├── api/dashboard/route.ts     # Único endpoint: agrega y devuelve los datos de Jira
│   ├── layout.tsx                 # Fuentes (Inter/Roboto Mono) y layout raíz
│   ├── page.tsx                   # Página principal: estado, filtros, pestañas y composición
│   └── globals.css                # Tokens de diseño (colores, tipografía) y estilos globales
├── components/
│   ├── DashboardHeader.tsx        # Cabecera negra: logo, tabs, selector de periodo
│   ├── KpiCard.tsx                # Tarjeta KPI con pill de variación
│   ├── StateAndPriorityChart.tsx  # Distribución por estado/prioridad (barra + leyenda)
│   ├── TimelineChart.tsx          # Entradas/Resueltas/Backlog
│   ├── OpenByStatusChart.tsx      # No cerradas por estado + backlog
│   ├── GroupByStatusChart.tsx     # Desglose por grupo (barras horizontales)
│   ├── IssuesTable.tsx            # Tabla de issues con fila expandible (PM Tasks/Action Points)
│   ├── ActionPointsTable.tsx      # Tabla filtrable de Action Points
│   ├── charts/                    # Primitivas de gráfico (SVG bar+line, leyenda, card)
│   └── ui/Chips.tsx               # Chip de estado, pill de prioridad, enlace de clave
├── lib/
│   ├── jira.ts                    # Cliente Jira y agregación de datos (getDashboardStats)
│   └── theme.ts                   # Colores por estado/prioridad, helpers de formato
├── .env.local                     # Variables de entorno (NO se commitea)
└── package.json
```

## Cómo funciona

1. `page.tsx` llama a `/api/dashboard?days=N` al cargar y cada vez que cambias el periodo.
2. El endpoint llama a `getDashboardStats()` en `lib/jira.ts`, que pagina todos los issues del proyecto (filtrados por `"AP Área" = "+O IT"`) y sus subtareas (PM Tasks / Action Points).
3. El cliente recibe la lista completa de issues y calcula en el navegador las estadísticas, gráficos y deltas de cada pestaña a partir del periodo seleccionado — el servidor no filtra por fecha, solo trae todo.

## Personalización

### Cambiar el filtro de issues

En `lib/jira.ts`, la consulta JQL está en `getIssuesByProject`:

```typescript
const jql = `project = ${PROJECT_KEY} AND "AP Área" = "+O IT"`;
```

### Cambiar colores de estado/prioridad

Los mapas de color están en `lib/theme.ts` (`statusColor`, `priorityStyle`). Si aparecen estados de Jira que no estén en el mapa, se les asigna un color determinista de una paleta de reserva.

## Troubleshooting

### Error 403 al consultar Jira

- Confirma que `JIRA_API_TOKEN` es un **Personal Access Token** generado desde tu instancia de Jira, no un token de `id.atlassian.com`.
- Revisa que el token no haya expirado.

### Sin datos en el dashboard

- Verifica que `NEXT_PUBLIC_JIRA_PROJECT_KEY` sea correcto.
- Comprueba que hay issues que cumplan el filtro `"AP Área" = "+O IT"` en ese proyecto.
- Revisa la consola del navegador y los logs del servidor (`npm run dev`) para ver errores de la API de Jira.

## Despliegue

### En Vercel

1. Sube el código a GitHub
2. Crea un proyecto en Vercel conectado a tu repo
3. Agrega las variables de entorno de `.env.example` en Vercel Settings
4. Vercel desplegará automáticamente

### En tu servidor

```bash
npm run build
npm start
```

## Licencia

MIT
