# Dashboard de Problemas

KPIs principales de issues de tipo "problema" desde Jira Cloud.

## Características

- 📊 **KPIs Principales**:
  - Total de problemas abiertos vs cerrados
  - Distribución por estado (Abierto, En progreso, Cerrado)
  - Distribución por prioridad (Alta, Media, Baja)
  - Tendencia temporal (problemas creados/resueltos por día)

- 🎛️ **Filtros**:
  - Rango de fechas (7, 30, 90, 365 días)
  - Actualización automática cada hora

- 🎨 **Visualización**:
  - Gráficos interactivos con Recharts
  - Diseño responsive con Tailwind CSS
  - Interfaz limpia y moderna

## Requisitos

- Node.js 18+
- npm o yarn
- Credenciales de Jira Cloud

## Instalación

1. Clona el repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno en `.env.local`:
   ```
   NEXT_PUBLIC_JIRA_DOMAIN=your-domain.atlassian.net
   JIRA_API_TOKEN=your-api-token
   JIRA_EMAIL=your-email@company.com
   NEXT_PUBLIC_JIRA_PROJECT_KEY=YOUR-PROJECT-KEY
   ```

## Obtener credenciales de Jira

1. **API Token**:
   - Ve a https://id.atlassian.com/manage-profile/security/api-tokens
   - Crea un nuevo token
   - Copia el token

2. **Domain**:
   - URL de tu Jira: `https://your-domain.atlassian.net/`
   - El domain es: `your-domain.atlassian.net`

3. **Email**:
   - Tu email de cuenta de Atlassian

4. **Project Key**:
   - En Jira, ve a Project Settings
   - El Project Key está en la URL o en la página principal (ej: `PROJ`)

## Uso

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del Proyecto

```
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       └── route.ts           # API endpoint para datos del dashboard
│   ├── layout.tsx                 # Layout raíz
│   ├── page.tsx                   # Página principal del dashboard
│   └── globals.css                # Estilos globales
├── components/
│   ├── StatsCard.tsx              # Tarjeta de estadística
│   ├── StateAndPriorityChart.tsx  # Gráficos de estado y prioridad
│   ├── TimelineChart.tsx          # Gráfico de tendencia temporal
│   └── FilterBar.tsx              # Barra de filtros
├── lib/
│   └── jira.ts                    # Cliente y funciones de Jira
├── .env.local                     # Variables de entorno (NO commitear)
└── package.json
```

## Cómo funciona

1. El dashboard se carga automáticamente al abrir la página
2. El componente `page.tsx` llama al endpoint `/api/dashboard`
3. El endpoint llama a la función `getDashboardStats()` en `lib/jira.ts`
4. Esta función consulta los issues de Jira y calcula las estadísticas
5. Los datos se devuelven como JSON y se muestran en los gráficos

## Actualización de datos

- **Manual**: Botón "Actualizar" en la esquina superior derecha
- **Automática**: Cada hora (3600000 ms)

## Personalización

### Cambiar el tipo de issue

En `lib/jira.ts`, modifica la variable `issueTypeCondition`:

```typescript
const issueTypeCondition = `type = "Tarea"`; // Para tareas en lugar de problemas
```

### Cambiar colores

Los colores están definidos en los componentes de gráficos:
- `StateAndPriorityChart.tsx`: `stateColors` y `priorityColors`
- `StatsCard.tsx`: propiedad `color`

### Agregar más KPIs

1. Crea un nuevo componente en `components/`
2. Agrega la lógica en `lib/jira.ts`
3. Llámalo desde `page.tsx`

## Troubleshooting

### Error: "node" no se reconoce

En Windows, asegúrate que Node.js está instalado y en el PATH.

### Error: Unauthorized (401) de Jira

- Verifica que el API Token sea correcto
- Asegúrate que el email sea exactamente el de tu cuenta Atlassian
- El token debe ser reciente (pueden expirar)

### Sin datos en el dashboard

- Verifica que el Project Key sea correcto
- Asegúrate que hay issues de tipo "Problem" en tu proyecto
- Revisa la consola del navegador para mensajes de error

## Despliegue

### En Vercel (recomendado)

1. Sube el código a GitHub
2. Crea un proyecto en Vercel conectado a tu repo
3. Agrega las variables de entorno en Vercel Settings
4. Vercel desplegará automáticamente

### En tu servidor

```bash
npm run build
npm start
```

## Licencia

MIT
