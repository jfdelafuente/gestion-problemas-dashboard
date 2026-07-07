# Despliegue en producción (infocodes.si.orange.es)

Guía para desplegar el **Dashboard de Gestión de Problemas** en `10.132.68.85:8081`
(`infocodes.si.orange.es`), un nginx compartido con otras aplicaciones que corre
como usuario `infocodes` (uid 2001), sin root ni systemd.

Todos los comandos de este documento se ejecutan **en el servidor**, conectado
como el usuario `infocodes`. No hay ningún paso automatizable desde fuera del
servidor: no hay acceso SSH configurado desde este entorno de desarrollo.

## Índice

1. [Prerrequisitos](#1-prerrequisitos)
2. [Resumen de la topología](#resumen-de-la-topología)
3. [Copiar el código al servidor](#3-copiar-el-código-al-servidor)
4. [Instalar dependencias](#4-instalar-dependencias)
5. [Configurar credenciales de Jira](#5-configurar-credenciales-de-jira-producción)
6. [Configurar el subpath `/problemas`](#6-configurar-el-subpath-problemas)
7. [Compilar](#7-compilar)
8. [Arrancar con pm2](#8-arrancar-con-pm2)
9. [Aplicar el bloque de nginx](#9-aplicar-el-bloque-de-nginx)
10. [Verificar](#10-verificar)
11. [Redespliegues posteriores](#redespliegues-posteriores)
12. [Rollback](#rollback)
13. [Notas](#notas)
14. [Solución de problemas](#solución-de-problemas)
15. [Referencia rápida](#referencia-rápida)

## 1. Prerrequisitos

- Acceso SSH al servidor como el usuario `infocodes` (uid 2001). Sin root, sin systemd.
- Node.js **≥ 20.9** y npm disponibles en el `PATH` de ese usuario (`node -v`).
- Acceso de red desde el servidor a `jiranext.masorange.es` (verificar en el
  [paso 5](#5-configurar-credenciales-de-jira-producción); es un requisito del
  propio servidor, independiente de la conectividad desde tu puesto de desarrollo).
- Un Personal Access Token (PAT) de Jira válido para producción — ver
  [SETUP_JIRA.md](SETUP_JIRA.md) para cómo generarlo.
- Acceso de escritura a `/infocodes/project/` y permiso para recargar nginx
  (`/infocodes/nginx/sbin/nginx -s reload`), ambos ya cubiertos por ser
  propietario del árbol `/infocodes`.
- El puerto **3001** libre en el servidor (ver aviso en la topología abajo).

## Resumen de la topología

- La app se sirve bajo **`/problemas`** (ej. `http://infocodes.si.orange.es:8081/problemas`).
- Next.js corre como proceso Node normal (`next start`) en el **puerto 3001**,
  gestionado con **pm2 en modo usuario** (sin `pm2 startup`, que requiere root/systemd).
- nginx hace de proxy inverso de `/problemas` hacia `localhost:3001`, igual que
  ya hace con `/api` hacia el backend FastAPI en el `8000`.
- El puerto 8000 ya está en uso (FastAPI de `cso-incident-masivas-report`) — por
  eso el 3001. **Verifica que el 3001 esté libre antes de arrancar** (`ss -ltnp | grep 3001` o `netstat -ltnp | grep 3001`).

## 3. Copiar el código al servidor

```bash
# Ejemplo con git; usa el método que ya uséis para el resto de apps de /infocodes/project
mkdir -p /infocodes/project/gestion-problemas-dashboard
cd /infocodes/project/gestion-problemas-dashboard
git clone <url-del-repo> .
```

## 4. Instalar dependencias

```bash
cd /infocodes/project/gestion-problemas-dashboard
npm ci
```

Esto instala también `pm2` como dependencia local del proyecto (no hace falta
instalarlo global ni con root). Se invoca siempre como `npx pm2 ...` o
`./node_modules/.bin/pm2 ...`.

## 5. Configurar credenciales de Jira (producción)

Crea `.env.local` en la raíz del proyecto — **no está en el repo, hay que
crearlo a mano en cada entorno** (ver [SETUP_JIRA.md](SETUP_JIRA.md) para cómo
obtener un Personal Access Token):

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_JIRA_DOMAIN=jiranext.masorange.es
JIRA_API_TOKEN=<PAT-de-produccion>
NEXT_PUBLIC_JIRA_PROJECT_KEY=PROB
EOF
```

Confirma desde el propio servidor que hay conectividad a `jiranext.masorange.es`
(distinto de la conectividad desde un puesto de desarrollo):

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://jiranext.masorange.es/rest/api/2/myself
```

## 6. Configurar el subpath `/problemas`

Crea `.env.production.local` (Next.js lo carga automáticamente al hacer
`next build` / `next start` en producción):

```bash
cat > .env.production.local <<'EOF'
NEXT_PUBLIC_BASE_PATH=/problemas
EOF
```

## 7. Compilar

```bash
npm run build
```

Verifica que la ruta `/` no aparezca como servida (el build queda "montado"
bajo `/problemas` a nivel de servidor, no de rutas internas — es normal que
la tabla de rutas del build siga mostrando `/`).

## 8. Arrancar con pm2

El repo ya incluye `ecosystem.config.js` (puerto 3001, `NODE_ENV=production`,
`NEXT_PUBLIC_BASE_PATH=/problemas`):

```bash
npx pm2 start ecosystem.config.js
npx pm2 save
```

Comprueba que responde localmente antes de tocar nginx:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/problemas   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/            # 404 (esperado, es el basePath)
```

### Persistencia tras un reinicio del servidor

Sin root no se puede usar `pm2 startup` (genera una unidad systemd). En su
lugar, añade una entrada al **crontab del propio usuario `infocodes`** (esto
no requiere privilegios de root, cada usuario gestiona su propio crontab):

```bash
crontab -e
# añade la línea:
@reboot cd /infocodes/project/gestion-problemas-dashboard && /usr/bin/env npx pm2 resurrect
```

Esto restaura los procesos guardados con `pm2 save` cuando el servidor
arranque, sin necesitar systemd.

## 9. Aplicar el bloque de nginx

Este repo trackea `nginx.conf` como la config completa y actualizada del
servidor compartido. Contiene un bloque nuevo `location /problemas` (y su
`upstream gestion_problemas_backend`) que aún no existe en el nginx real.

**No sobrescribas `/infocodes/nginx/conf/nginx.conf` a ciegas** — compara antes
de aplicar, por si el archivo real del servidor ha cambiado desde que se copió
a este repo:

```bash
diff /infocodes/nginx/conf/nginx.conf /infocodes/project/gestion-problemas-dashboard/nginx.conf
```

Si el único cambio son el `upstream gestion_problemas_backend` y el
`location /problemas` añadidos por este despliegue, copia el archivo:

```bash
cp /infocodes/project/gestion-problemas-dashboard/nginx.conf /infocodes/nginx/conf/nginx.conf
```

Si hay más diferencias (otra app ha tocado el archivo entretanto), aplica solo
el bloque nuevo a mano en vez de sobrescribir.

Prueba la config **antes** de recargar:

```bash
/infocodes/nginx/sbin/nginx -t -c /infocodes/nginx/conf/nginx.conf
```

Si el test es correcto, recarga (sin downtime, no reinicia conexiones activas):

```bash
/infocodes/nginx/sbin/nginx -s reload -c /infocodes/nginx/conf/nginx.conf
```

## 10. Verificar

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://10.132.68.85:8081/problemas
npx pm2 status
npx pm2 logs gestion-problemas-dashboard --lines 50
```

Desde un navegador: `http://infocodes.si.orange.es:8081/problemas`.

## Redespliegues posteriores

```bash
cd /infocodes/project/gestion-problemas-dashboard
git pull
npm ci
npm run build
npx pm2 restart gestion-problemas-dashboard
```

El bloque de nginx no cambia entre redespliegues salvo que cambie el puerto o
la ruta — no hace falta repetir el [paso 9](#9-aplicar-el-bloque-de-nginx).

## Rollback

pm2 no versiona builds anteriores. Antes de un cambio grande, anota el commit
actual (`git rev-parse HEAD`) para poder volver atrás:

```bash
git checkout <commit-anterior>
npm ci
npm run build
npx pm2 restart gestion-problemas-dashboard
```

## Notas

- El puerto 3001 es una elección de esta guía, no un requisito de Next.js —
  cámbialo en `ecosystem.config.js` y en el `upstream` de `nginx.conf` si ya
  está en uso por otra cosa en ese servidor.
- `NEXT_PUBLIC_BASE_PATH` se hornea en el JavaScript del cliente en tiempo de
  build: si cambia la ruta pública, hay que repetir `npm run build`.

## Solución de problemas

### `npm run build` falla con un error de prerenderizado ilegible

Comprueba que `NODE_ENV` no esté ya fijado en el entorno del usuario
`infocodes` antes del build (`echo $NODE_ENV`). Un `NODE_ENV=development`
persistente en el shell confunde a `next build`, que espera controlarlo él
mismo durante la compilación de producción:

```bash
unset NODE_ENV
npm run build
```

### `EADDRINUSE` al arrancar con pm2

El puerto 3001 ya está ocupado. Compruébalo y, si hace falta, cambia el
puerto tanto en `ecosystem.config.js` (`args: 'start -p ####'`) como en el
`upstream gestion_problemas_backend` de `nginx.conf`:

```bash
ss -ltnp | grep 3001   # o: netstat -ltnp | grep 3001
```

### `nginx -t` falla tras aplicar el bloque `/problemas`

Revisa que no haya quedado una llave `{`/`}` descuadrada al fusionar el
bloque a mano (si no copiaste `nginx.conf` completo). El mensaje de error de
`nginx -t` indica el número de línea del fichero real en el servidor.

### La app responde 502/504 en `/problemas`

El proceso de pm2 no está arriba o no escucha en el puerto esperado:

```bash
npx pm2 status
npx pm2 logs gestion-problemas-dashboard --lines 100
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/problemas
```

### El dashboard carga pero no muestra datos / da error de Jira

- Confirma que `.env.local` tiene `JIRA_API_TOKEN` con un PAT vigente (no un
  password ni un token de `id.atlassian.com` — ver [SETUP_JIRA.md](SETUP_JIRA.md)).
- Confirma conectividad desde el servidor a `jiranext.masorange.es` (paso 5).
- Revisa `npx pm2 logs gestion-problemas-dashboard` para ver el error concreto
  devuelto por Jira (403, 404, timeout...).

### Los estilos o el logo no cargan (solo se ve HTML sin formato)

Casi siempre significa que `NEXT_PUBLIC_BASE_PATH` no estaba fijado (o no
coincide con la ruta real) en el momento del `npm run build`. Hay que
**recompilar**, no basta con reiniciar pm2, porque el valor queda incrustado
en los assets generados:

```bash
cat .env.production.local   # debe decir NEXT_PUBLIC_BASE_PATH=/problemas
npm run build
npx pm2 restart gestion-problemas-dashboard
```

## Referencia rápida

Despliegue inicial completo, de un tirón (asumiendo `.env.local` y
`.env.production.local` ya creados):

```bash
mkdir -p /infocodes/project/gestion-problemas-dashboard
cd /infocodes/project/gestion-problemas-dashboard
git clone <url-del-repo> .
npm ci
npm run build
npx pm2 start ecosystem.config.js
npx pm2 save
diff /infocodes/nginx/conf/nginx.conf ./nginx.conf   # revisar antes de copiar
cp ./nginx.conf /infocodes/nginx/conf/nginx.conf
/infocodes/nginx/sbin/nginx -t -c /infocodes/nginx/conf/nginx.conf
/infocodes/nginx/sbin/nginx -s reload -c /infocodes/nginx/conf/nginx.conf
curl -s -o /dev/null -w "%{http_code}\n" http://10.132.68.85:8081/problemas
```

Redespliegue tras un cambio de código:

```bash
cd /infocodes/project/gestion-problemas-dashboard
git pull
npm ci
npm run build
npx pm2 restart gestion-problemas-dashboard
```
