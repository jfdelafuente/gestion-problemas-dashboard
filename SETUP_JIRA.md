# Guía de Configuración - Jira Server / Data Center

Esta guía te ayuda a obtener las credenciales necesarias para conectar el dashboard con tu instancia de **Jira Server o Data Center** (no Jira Cloud — si tu Jira es `algo.atlassian.net`, esta guía no aplica; necesitarías adaptar `lib/jira.ts` para usar Basic Auth con un API token de `id.atlassian.com`).

## Paso 1: Obtener un Personal Access Token (PAT)

1. Entra en tu instancia de Jira (ej. `https://jiranext.tuempresa.com`)
2. Ve a tu perfil → **Personal Access Tokens** (normalmente en Configuración de cuenta / Seguridad)
3. Crea un token nuevo, dale un nombre descriptivo (ej. "Dashboard de Problemas")
4. **Copia el token** — solo se muestra una vez

⚠️ **Importante**: si lo pierdes, tendrás que crear uno nuevo y actualizar `.env.local`.

## Paso 2: Obtener el dominio de tu Jira

1. Abre tu instancia de Jira: `https://tu-jira.tuempresa.com`
2. El dominio es la parte sin `https://` ni rutas: `tu-jira.tuempresa.com`

## Paso 3: Obtener el Project Key

1. En Jira, ve a tu proyecto → **Project Settings** → **Details**, o
2. Mira la URL del proyecto: `https://tu-jira.tuempresa.com/projects/PROB/issues` → Project Key: `PROB`

## Paso 4: Configurar el dashboard

1. Copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Rellena los valores:
   ```
   NEXT_PUBLIC_JIRA_DOMAIN=tu-jira.tuempresa.com
   JIRA_API_TOKEN=tu-personal-access-token
   NEXT_PUBLIC_JIRA_PROJECT_KEY=PROB
   ```

## Paso 5: Iniciar el dashboard

```bash
npm run dev
```

Accede a http://localhost:3000

## Cómo se usa el token

`lib/jira.ts` envía el PAT como cabecera `Authorization: Bearer <token>` — no usa Basic Auth ni email, a diferencia de Jira Cloud. Si tu instancia usa certificados autofirmados, el cliente ya desactiva la verificación TLS (`rejectUnauthorized: false`) solo para las llamadas a Jira.

## Filtro de issues

Por defecto, el dashboard consulta (en `lib/jira.ts`, función `getIssuesByProject`):

```typescript
const jql = `project = ${PROJECT_KEY} AND "AP Área" = "+O IT"`;
```

Ajusta esa condición si tu proyecto no usa el campo personalizado "AP Área", o si quieres ver otro subconjunto de issues.

## Permisos en Jira

El usuario dueño del token necesita permiso para:
- Ver el proyecto y sus issues
- Ver los campos: Status, Priority, Created, Resolution Date, subtareas
- Ver los campos personalizados usados por el dashboard: Grupo Asignado, Grupos Involucrados, Grupo/s Resolutor/es, Tipo de Punto de Acción

## Solución de problemas

### "403 Forbidden"
- El `JIRA_API_TOKEN` no es un PAT válido para esta instancia, o ha expirado.
- Confirma que estás generando el token en tu Jira propio, no en `id.atlassian.com`.

### "404 Not Found" / sin datos
- El `NEXT_PUBLIC_JIRA_PROJECT_KEY` es incorrecto (distingue mayúsculas/minúsculas).
- No hay issues que cumplan el filtro JQL de `getIssuesByProject`.

### Certificado / TLS
- Si tu instancia usa un certificado autofirmado y sigues viendo errores de conexión, revisa que el dominio en `NEXT_PUBLIC_JIRA_DOMAIN` no incluya `https://` ni una ruta.
