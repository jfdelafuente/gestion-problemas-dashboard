# Guía de Configuración - Jira Cloud

Esta guía te ayudará a obtener las credenciales necesarias para conectar el dashboard con tu proyecto de Jira Cloud.

## Paso 1: Obtener el API Token

1. Ve a https://id.atlassian.com/manage-profile/security/api-tokens
2. Haz clic en **"Create API token"**
3. Dale un nombre descriptivo (ej: "Dashboard de Problemas")
4. Haz clic en **"Create"**
5. **Copia el token** (aparece en un cuadro) y guárdalo en un lugar seguro

⚠️ **Importante**: El token solo se muestra una vez. Si lo pierdes, debes crear uno nuevo.

## Paso 2: Obtener tu Dominio de Jira

1. Abre tu instancia de Jira Cloud: `https://tu-empresa.atlassian.net`
2. Tu dominio es: `tu-empresa.atlassian.net`

Ejemplo:
- URL completa: `https://acme-corp.atlassian.net/projects/PROB`
- Dominio: `acme-corp.atlassian.net`

## Paso 3: Obtener tu Email

Tu email es el que usas para acceder a Atlassian Cloud.

## Paso 4: Obtener el Project Key

1. En Jira, ve a tu proyecto
2. Haz clic en **"Project Settings"** (en el menú izquierdo)
3. Ve a **"Details"**
4. Verás el **"Project key"** (ej: `PROB`, `INFRA`, etc.)

Alternativa: Mira la URL de tu proyecto. Ejemplo:
- URL: `https://company.atlassian.net/projects/PROB/issues`
- Project Key: `PROB`

## Paso 5: Configurar el Dashboard

1. En el directorio raíz del proyecto, copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edita `.env.local` y reemplaza los valores:
   ```
   NEXT_PUBLIC_JIRA_DOMAIN=tu-empresa.atlassian.net
   JIRA_API_TOKEN=tu-token-aqui
   JIRA_EMAIL=tu-email@company.com
   NEXT_PUBLIC_JIRA_PROJECT_KEY=PROB
   ```

3. Guarda el archivo

## Paso 6: Iniciar el Dashboard

```bash
npm run dev
```

Accede a http://localhost:3000

## Verificación

Si ves el dashboard cargando correctamente, con datos de tu proyecto, ¡está todo configurado!

Si ves un error como "Unauthorized (401)", verifica:
- [ ] El API Token es correcto
- [ ] El email es exactamente el de tu cuenta Atlassian
- [ ] El dominio es correcto (sin `https://` ni rutas extras)
- [ ] El Project Key es correcto

## Seguridad

⚠️ **IMPORTANTE**:
- **Nunca** hagas commit de `.env.local` a Git
- El archivo `.gitignore` ya incluye `.env*`
- El API token en `.env.local` está protegido localmente

Si accidentalmente subiste el token a Git:
1. Ve a https://id.atlassian.com/manage-profile/security/api-tokens
2. Elimina el token comprometido
3. Crea uno nuevo
4. Actualiza `.env.local`

## Cambiar Tipos de Issue

Por defecto, el dashboard muestra issues de tipo **"Problem"**.

Para cambiar el tipo:

1. Abre `lib/jira.ts`
2. Encuentra la línea:
   ```typescript
   const issueTypeCondition = `type = Problem`;
   ```
3. Cámbiala según lo que necesites:
   ```typescript
   const issueTypeCondition = `type = Task`;           // Para tareas
   const issueTypeCondition = `type = Bug`;            // Para bugs
   const issueTypeCondition = `type = "Epic"`;         // Para épicas
   const issueTypeCondition = `type IN (Bug, Task)`;   // Para múltiples tipos
   ```

## Permisos en Jira

Asegúrate de que tu usuario en Jira tiene permisos para:
- Ver el proyecto
- Ver issues del proyecto
- Ver campos: Status, Priority, Created, Updated, Resolution Date

Estos son permisos estándar en la mayoría de proyectos.

## Solución de Problemas

### "401 Unauthorized"
- Verifica el email y token en `.env.local`
- El token debe ser reciente (pueden expirar)

### "404 Not Found"
- Verifica que el Project Key es correcto
- El project key diferencia mayúsculas y minúsculas

### "No data shown"
- Verifica que hay issues de tipo "Problem" en tu proyecto
- Abre la consola del navegador (F12) para ver mensajes de error

### "CORS Error"
- Esto no debería pasar, pero si ocurre, contacta al administrador del servidor

## Próximos Pasos

Una vez configurado:
- El dashboard se actualiza cada hora automáticamente
- Puedes hacer clic en "Actualizar" para forzar una actualización
- Usa los filtros para ver diferentes períodos

¡Disfruta tu dashboard!
