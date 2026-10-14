# Dashboard de Gestión de Problemas (CSO / +O IT)

Dashboard corporativo de seguimiento de **Problemas**, **Postmortems** y **Action Points** desde Jira (Server / Data Center) con generación automatizada de **Informes Ejecutivos en PowerPoint (`.pptx`)** desde Confluence, diseñado bajo la identidad visual de **MASORANGE**.

---

## Características Principales

- 📑 **4 vistas analíticas especializadas**:
  - **General**: visión consolidada de todos los issues (*Problema* + *Postmortem*) del periodo.
  - **Postmortem**: KPIs y tabla detallada de postmortems con sus *PM Tasks* y acceso directo a la documentación en Confluence.
  - **Problema**: KPIs y desglose de problemas con sus *Action Points* asociados.
  - **Action Points**: distribución por *Grupo Involucrado* y tabla filtrable de seguimiento.

- 📊 **KPIs ejecutivos con comparativa temporal**:
  - Total de registros, abiertos/pendientes, cerrados/completados y tiempo medio de resolución (*MTTR*), cada uno con indicador de variación (`↑` / `↓`) frente al periodo anterior equivalente.

- 📈 **Gráficos interactivos SVG a medida** (sin dependencias pesadas):
  - Distribución por estado y prioridad (barra segmentada + leyenda interactiva).
  - Evolución temporal: entradas vs. resueltas + curva de backlog acumulado.
  - Volumen de incidencias no cerradas por estado + backlog acumulado.
  - Desglose de Action Points por Grupo Involucrado y estado.

- 📑 **Generación Asíncrona de Informes Ejecutivos PowerPoint (`.pptx`)**:
  - Integración BFF con el motor de reporting `cso-incident-masivas-report` (FastAPI `:8000`).
  - Extracción automática del postmortem vinculado en **Confluence** (*WikiPageLinks* de Jira) y maquetación en plantilla corporativa PowerPoint.
  - Cola asíncrona en segundo plano (`HTTP 202 Accepted` + *polling* no bloqueante cada `2.5s`) con barra de progreso en vivo y descarga directa en 1 clic.

- 🛡️ **Alta Disponibilidad, Caché Persistente y Observabilidad**:
  - **Caché persistente desacoplada** (`/infocodes/var/cache/problemas` en producción, `.cache/` en local) con escrituras atómicas (`.tmp` + `renameSync`) y política *Stale-If-Error* ante caídas o lentitud de Jira.
  - **Sondas HTTP estándar**: `/api/healthz` (*Liveness*) y `/api/readyz` (*Readiness* con verificación de frescura de caché Jira y conectividad con el backend de reporting).
  - **Trazabilidad End-to-End (`X-Request-ID`)**: correlación automática de peticiones entre navegador, Next.js BFF y FastAPI.

---

## Requisitos

- **Node.js** 20 LTS (recomendado) o 18+
- **npm**
- **Personal Access Token (PAT)** de Jira Server / Data Center
- *(Opcional)* Servicio backend `cso-incident-masivas-report` en `:8000` para la generación de presentaciones `.pptx`

---

## Instalación y Desarrollo Local

1. **Clonar el repositorio e instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   Copia `.env.example` a `.env.local` y configura tus credenciales de Jira (consulta [SETUP_JIRA.md](SETUP_JIRA.md)):
   ```bash
   cp .env.example .env.local
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en el navegador.

---

## Scripts Disponibles (`package.json`)

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:3000` |
| `npm run build` | Compila la aplicación Next.js para producción |
| `npm run build:standalone` | Valida contratos OpenAPI, compila en modo *Standalone* y filtra exclusivamente los artefactos de runtime |
| `npm run package` | Genera el paquete autónomo optimizado `dist/gestion-problemas-standalone.tar.gz` (~4 MB) |
| `npm run check:contracts` | Verifica la sincronización entre `contracts/executive-reports.openapi.json`, `types/executiveReport.ts` y `backend/schemas.py` |
| `npm run generate:types` | Regenera `types/executiveReport.ts` a partir de la especificación OpenAPI 3.1 |
| `npm run lint` | Ejecuta el análisis estático con ESLint |

---

## Estructura del Proyecto

```text
├── app/
│   ├── api/
│   │   ├── dashboard/route.ts                  # Endpoint BFF de Jira (caché atómica + Stale-If-Error)
│   │   ├── healthz/route.ts                    # Sonda Liveness (HTTP 200)
│   │   ├── readyz/route.ts                     # Sonda Readiness (verifica caché Jira + backend :8000)
│   │   └── reports/executive-incident/         # Proxy BFF hacia FastAPI (:8000) con X-Request-ID
│   ├── layout.tsx                              # Fuentes corporativas (Inter / Roboto Mono) y layout raíz
│   ├── page.tsx                                # Vista principal: pestañas, filtros, KPIs y gráficos
│   └── globals.css                             # Tokens de diseño MASORANGE y estilos globales
├── components/
│   ├── DashboardHeader.tsx                     # Cabecera: navegación por pestañas, filtro temporal y refresco
│   ├── KpiCard.tsx                             # Tarjeta KPI con indicador de variación porcentual
│   ├── StateAndPriorityChart.tsx               # Gráfico de distribución por estado y prioridad
│   ├── TimelineChart.tsx                       # Gráfico combinado Entradas / Resueltas / Backlog
│   ├── OpenByStatusChart.tsx                   # Gráfico de no cerradas por estado + curva de backlog
│   ├── GroupByStatusChart.tsx                  # Desglose horizontal por Grupo Involucrado
│   ├── IssuesTable.tsx                         # Tabla maestra con filas expandibles (PM Tasks / Action Points)
│   ├── ActionPointsTable.tsx                   # Tabla filtrable de Action Points
│   ├── ExecutivePowerPointModal.tsx            # Modal de generación/descarga asíncrona de informes .pptx
│   ├── charts/                                 # Primitivas SVG reutilizables
│   └── ui/Chips.tsx                            # Badges de estado, prioridad y enlaces a Jira/Confluence
├── contracts/
│   └── executive-reports.openapi.json          # Contrato formal OpenAPI 3.1 (BFF <-> Backend CSO)
├── lib/
│   ├── cache-paths.ts                          # Resolución y migración automática de caché (/infocodes/var/cache/problemas)
│   ├── jira.ts                                 # Cliente Jira Server/DC, enriquecimiento Confluence y caché atómica
│   ├── request-id.ts                           # Generación y propagación de X-Request-ID end-to-end
│   └── theme.ts                                # Paleta corporativa por estado y prioridad
├── scripts/
│   ├── deploy-production.ps1                   # Despliegue automatizado 1-clic (SSH/SCP), verificación y rollback
│   ├── prepare-standalone.js                   # Ensamblado y limpieza estricta de .next/standalone
│   ├── package-standalone.js                   # Empaquetador de artefacto .tar.gz
│   └── sync-openapi-types.js                   # Sincronizador y validador OpenAPI <-> TypeScript <-> Pydantic
├── types/
│   └── executiveReport.ts                      # Tipos sincronizados para Informes Ejecutivos PowerPoint
├── start.sh / stop.sh / restart.sh / status.sh # Scripts de operación del servicio en Linux
├── rollback.sh                                 # Script de reversión atómica (< 1s) a la release previa
└── refresh-cache.sh                            # Script para forzar la recarga de caché Jira en caliente
```

---

## Despliegue en Producción (`infocodes.si.orange.es`)

La aplicación se despliega en el servidor corporativo `10.132.26.96` (`http://infocodes.si.orange.es:8081/problemas`) mediante **releases atómicas por symlink** (`releases/<timestamp>` $\rightarrow$ `current`) y estado persistente desacoplado en `/infocodes/var/`.

### Comandos rápidos desde Windows (PowerShell)

```powershell
# 1. Despliegue estándar (compila paquete de 4 MB, sube por SCP, activa symlink y verifica /api/readyz)
.\scripts\deploy-production.ps1

# 2. Despliegue conjunto Frontend + Backend CSO FastAPI
.\scripts\deploy-production.ps1 -IncludeBackend

# 3. Desplegar reutilizando el último paquete compilado (en ~12 segundos)
.\scripts\deploy-production.ps1 -SkipBuild

# 4. Verificar salud de producción sin desplegar
.\scripts\deploy-production.ps1 -VerifyOnly

# 5. Rollback instantáneo a la release anterior (< 5 segundos)
.\scripts\deploy-production.ps1 -Rollback
```

---

## Documentación Técnica y Operativa

- 🏛️ [**ARCHITECTURE.md**](ARCHITECTURE.md): Diseño detallado de la arquitectura distribuida de 3 servicios, topología de puertos, almacenamiento en `/infocodes/var/`, contratos OpenAPI, matriz RACI y SLOs.
- 🗺️ [**ARCHITECTURE_ROADMAP.md**](ARCHITECTURE_ROADMAP.md): Hoja de ruta evolutiva (Fases 0 a 3 — **100% Completada**).
- 🚀 [**DEPLOYMENT.md**](DEPLOYMENT.md): Manual de operación en servidor Linux, comandos de ciclo de vida, rollback y configuración de Nginx.
- 🔑 [**SETUP_JIRA.md**](SETUP_JIRA.md): Guía paso a paso para generar y configurar el Personal Access Token (PAT) de Jira Server / Data Center.

---

## Licencia

Uso interno corporativo — **MASORANGE (CSO / +O IT)**.
