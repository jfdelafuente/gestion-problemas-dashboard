/**
 * Fase 3.2: Sincronización y validación automática de contratos tipados (OpenAPI <-> TypeScript <-> Pydantic)
 *
 * Modos de uso:
 *   - node scripts/sync-openapi-types.js          (Genera/actualiza types/executiveReport.ts desde contracts/executive-reports.openapi.json)
 *   - node scripts/sync-openapi-types.js --check  (Valida que types/executiveReport.ts y backend/schemas.py estén sincronizados sin discrepancias)
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const openApiPath = path.join(rootDir, 'contracts', 'executive-reports.openapi.json');
const tsTypesPath = path.join(rootDir, 'types', 'executiveReport.ts');
const siblingPydanticPath = path.resolve(rootDir, '..', 'cso-incident-masivas-report', 'backend', 'schemas.py');

const isCheckOnly = process.argv.includes('--check');

if (!fs.existsSync(openApiPath)) {
  console.error(`[Contracts] ERROR: No se encuentra el contrato OpenAPI en ${openApiPath}`);
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
const schemas = spec.components?.schemas || {};

// 1. Verificar coherencia contra backend/schemas.py si el repositorio hermano está disponible
if (fs.existsSync(siblingPydanticPath)) {
  const pyContent = fs.readFileSync(siblingPydanticPath, 'utf-8');
  const requiredPydanticClasses = [
    'ExecutiveActionPointSchema',
    'ExecutiveTimelineEventSchema',
    'ExecutiveIncidentDataSchema',
    'ExecutiveReportRequestSchema',
    'ExecutiveReportResponseSchema',
    'ExecutiveReportStatusResponseSchema',
  ];

  for (const cls of requiredPydanticClasses) {
    if (!pyContent.includes(`class ${cls}`)) {
      console.error(`[Contracts] ERROR: Falta la clase Pydantic '${cls}' en ${siblingPydanticPath}`);
      process.exit(1);
    }
  }

  const requiredFields = ['incidentRef', 'confluenceUrl', 'asyncMode', 'downloadUrl', 'requestId', 'sizeBytes', 'slideCount'];
  for (const field of requiredFields) {
    if (!pyContent.includes(field)) {
      console.error(`[Contracts] ERROR: El campo '${field}' del contrato OpenAPI no figura en ${siblingPydanticPath}`);
      process.exit(1);
    }
  }
  console.log('✓ [Contracts] Esquema Pydantic (cso-incident-masivas-report/backend/schemas.py) verificado.');
}

// 2. Validar o generar types/executiveReport.ts a partir de contracts/executive-reports.openapi.json
const statusEnum = schemas.ExecutiveReportJobStatus?.enum || ['NOT_FOUND', 'PROCESSING', 'READY', 'FAILED'];
const actionProps = Object.keys(schemas.ExecutiveActionPointSchema?.properties || {});
const timelineProps = Object.keys(schemas.ExecutiveTimelineEventSchema?.properties || {});
const dataProps = Object.keys(schemas.ExecutiveIncidentDataSchema?.properties || {});
const reqProps = Object.keys(schemas.ExecutiveReportRequestSchema?.properties || {});
const resProps = Object.keys(schemas.ExecutiveReportResponseSchema?.properties || {});
const statusProps = Object.keys(schemas.ExecutiveReportStatusResponseSchema?.properties || {});

if (isCheckOnly) {
  if (!fs.existsSync(tsTypesPath)) {
    console.error(`[Contracts] ERROR: No existe ${tsTypesPath}`);
    process.exit(1);
  }
  const tsContent = fs.readFileSync(tsTypesPath, 'utf-8');
  const allExpectedFields = new Set([
    ...actionProps,
    ...timelineProps,
    ...dataProps,
    ...reqProps,
    ...resProps,
    ...statusProps,
    ...statusEnum,
  ]);
  const missing = [];
  for (const field of allExpectedFields) {
    if (!tsContent.includes(field)) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    console.error(`[Contracts] ERROR: Discrepancia de tipos en types/executiveReport.ts. Faltan: ${missing.join(', ')}`);
    console.error('Ejecuta "npm run generate:types" para sincronizar.');
    process.exit(1);
  }
  console.log('✓ [Contracts] Contrato OpenAPI <-> TypeScript (types/executiveReport.ts) 100% sincronizado.');
  process.exit(0);
}

const generatedTs = `/**
 * Contrato de tipos para la generación y consulta de Informes Ejecutivos PowerPoint (.pptx)
 * Alineado exactamente con el modelo Python ExecutiveIncidentData (Feature 010) y contracts/executive-reports.openapi.json (Fase 3.2).
 */

export interface ExecutiveActionPoint {
  painPoint: string;
  description: string;
  owner: string;
  forecast: string;
}

export interface ExecutiveTimelineEvent {
  time: string;
  event: string;
}

export interface ExecutiveIncidentData {
  incidentRef: string;
  title: string;
  startTime?: string;
  duration?: string;
  impactText?: string;
  businessImpact?: string;
  causeText?: string;
  solutionText?: string;
  sourceUrl?: string;
  description?: string;
  rawContent?: string;
  actionPoints?: ExecutiveActionPoint[];
  timelineEvents?: ExecutiveTimelineEvent[];
}

export type ExecutiveReportJobStatus = ${statusEnum.map((s) => `'${s}'`).join(' | ')};

export interface ExecutiveReportRequest {
  incidentRef: string;
  title?: string;
  confluenceUrl?: string;
  force?: boolean;
  asyncMode?: boolean;
  async_mode?: boolean;
  data?: ExecutiveIncidentData;
}

export interface ExecutiveReportResponse {
  success: boolean;
  status?: ExecutiveReportJobStatus;
  incidentRef: string;
  incident_ref?: string;
  filename?: string;
  downloadUrl?: string;
  download_url?: string;
  generatedAt?: string;
  generated_at?: string;
  sizeBytes?: number;
  size_bytes?: number;
  slideCount?: number;
  slide_count?: number;
  cached?: boolean;
  requestId?: string;
  request_id?: string;
  error?: string;
  details?: string;
}

export interface ExecutiveReportStatusResponse {
  exists: boolean;
  status?: ExecutiveReportJobStatus;
  incidentRef: string;
  incident_ref?: string;
  filename?: string;
  downloadUrl?: string;
  download_url?: string;
  sizeBytes?: number;
  size_bytes?: number;
  requestId?: string;
  request_id?: string;
  error?: string;
}
`;

fs.writeFileSync(tsTypesPath, generatedTs, 'utf-8');
console.log('✓ [Contracts] Regenerado types/executiveReport.ts desde contracts/executive-reports.openapi.json');
