# Despliegue en producción (infocodes.si.orange.es)

Guía para desplegar el **Dashboard de Gestión de Problemas** en `10.132.26.96:8081`
(`infocodes.si.orange.es`), un nginx compartido con otras aplicaciones que corre
como usuario `infocodes` (uid 2001), sin root ni systemd.

El despliegue está **totalmente automatizado desde Windows PowerShell** mediante [`scripts/deploy-production.ps1`](scripts/deploy-production.ps1) (y [`scripts/setup-ssh-key.ps1`](scripts/setup-ssh-key.ps1) para autenticación SSH sin contraseña). También se documenta más abajo el procedimiento manual en el servidor por si se necesita operar directamente en `infocodes`.

## Índice

1. [Despliegue en 1 Clic desde PowerShell (Método Recomendado)](#método-recomendado-despliegue-standalone-precompilado-y-automatización-en-1-clic)
   - [Configurar clave SSH sin contraseña (una sola vez)](#configurar-clave-ssh-sin-contraseña-una-sola-vez)
   - [Comandos de despliegue, verificación y rollback](#opción-rápida-despliegue-en-1-clic-desde-powershell-deploy-productionps1)
   - [Arquitectura de estado persistente (`/infocodes/var/`)](#arquitectura-de-estado-persistente-infocodesvar)
2. [Prerrequisitos del servidor](#1-prerrequisitos)
   - [Instalar Node.js si no está disponible](#instalar-nodejs-si-no-está-disponible)
3. [Resumen de la topología](#resumen-de-la-topología)
4. [Método Alternativo (Tradicional en servidor)](#método-alternativo-tradicional-compilación-directa-en-el-servidor)
5. [Aplicar el bloque de nginx](#9-aplicar-el-bloque-de-nginx)
6. [Rollback](#rollback)
7. [Solución de problemas](#solución-de-problemas)
8. [Refresco nocturno automático de la caché de Jira (Crontab)](#refresco-nocturno-automático-de-la-caché-de-jira-crontab)

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

### Instalar Node.js si no está disponible

El servidor no tenía Node.js instalado y **no hay salida directa a `nodejs.org`**:
el proxy corporativo (`http_proxy`/`https_proxy`, ver `env`) intercepta el TLS de
`nodejs.org` con un certificado propio de Orange no confiado por el sistema, así
que tanto `curl` como cualquier instalador que llame a `nodejs.org` fallan con
`SSL certificate problem: unable to get local issuer certificate` (código `000`).
No es un problema de red ni de DNS — `curl` a `github.com` funciona con normalidad.

La forma más simple de esquivarlo, sin tocar certificados en un servidor de
producción, es descargar el tarball en **otra máquina con salida a internet**
(tu puesto de desarrollo) y subirlo por `scp`:

1. En tu máquina de desarrollo, descarga la versión LTS deseada (≥ 20.9) y
   verifica su checksum contra `SHASUMS256.txt` de la misma versión:
   ```bash
   curl -sL https://nodejs.org/dist/v20.20.2/node-v20.20.2-linux-x64.tar.xz -o node-v20.20.2-linux-x64.tar.xz
   curl -sL https://nodejs.org/dist/v20.20.2/SHASUMS256.txt -o SHASUMS256.txt
   sha256sum node-v20.20.2-linux-x64.tar.xz   # compara con la línea correspondiente en SHASUMS256.txt
   ```
   (En Windows con `curl` del sistema, si aparece un error de revocación OCSP
   —`schannel: ... CRYPT_E_NO_REVOCATION_CHECK`—, añade `--ssl-revoke-best-effort`.)
2. Sube el tarball ya verificado al servidor:
   ```bash
   scp node-v20.20.2-linux-x64.tar.xz infocodes@10.132.26.96:/infocodes/
   ```
3. En el servidor, descomprímelo bajo su propia carpeta en `/infocodes` (mismo
   patrón que ya se usa para `sqlite3`) y añade el `bin` al `PATH`:
   ```bash
   cd /infocodes
   mkdir -p nodejs
   tar -xJf node-v20.20.2-linux-x64.tar.xz -C nodejs --strip-components=1
   rm node-v20.20.2-linux-x64.tar.xz
   echo 'export PATH="/infocodes/nodejs/bin:$PATH"' >> ~/.profile
   . ~/.profile
   node -v && npm -v
   ```
   El shell de `infocodes` es `ksh` (`echo $SHELL`), y su shell de login lee
   `~/.profile` — si el usuario que despliega usa otro shell, ajusta el fichero
   (`~/.bashrc`, `~/.bash_profile`, etc.).

Este `PATH` solo aplica a sesiones interactivas de login. El cron de
[persistencia tras reinicio](#persistencia-tras-un-reinicio-del-servidor) no
carga `~/.profile`, así que ahí hay que fijar el `PATH` explícitamente en la
propia línea de `@reboot` (ya contemplado más abajo).

## Resumen de la topología

- La app se sirve bajo **`/problemas`** (ej. `http://infocodes.si.orange.es:8081/problemas`).
- Next.js corre como proceso Node standalone (`server.js`) en el **puerto 3001**, gestionado autónomamente mediante `./start.sh`, `./stop.sh`, `./restart.sh` y `./status.sh` con PID file en `/infocodes/var/run/gestion-problemas.pid` (o alternativamente con pm2).
- nginx hace de proxy inverso de `/problemas` hacia `localhost:3001`, igual que ya hace con `/api` hacia el backend FastAPI en el `8000` (`cso-incident-masivas-report`, con PID file en `/infocodes/var/run/cso-backend.pid`).
- El portal `release-dashboard-application` escucha en `/infocodes/var/run/infocodes.sock` (o `/tmp/infocodes.sock`) y delega la generación de informes ejecutivos PPTX al motor único en `cso-incident-masivas-report` (`localhost:8000`).

---

## MÉTODO RECOMENDADO: Despliegue Standalone Precompilado y Automatización en 1 Clic

Debido a que el servidor de producción `infocodes` se encuentra tras un proxy corporativo restrictivo que bloquea o agota el tiempo de conexión a `registry.npmjs.org` (`npm error code ETIMEDOUT`), el método estándar es **precompilar y empaquetar en local** y desplegar el artefacto autónomo mediante `scripts/deploy-production.ps1`.

### Ventajas:
1. **Cero `npm ci` y cero `npm run build` en el servidor**: No requiere internet ni consume CPU/RAM de compilación en producción.
2. **Estado externo protegido (`/infocodes/var/`)**: La caché de Jira (`/infocodes/var/cache/problemas/`), los informes `.pptx` (`/infocodes/var/storage/executive_pptx/`), los snapshots de rollback (`/infocodes/var/backups/`) y los archivos `.env.local` se preservan intactos entre despliegues.
3. **Snapshot automático y Rollback en 5 segundos**: Antes de cada despliegue se guarda copia de la versión en ejecución en `/infocodes/var/backups/`.
4. **Despliegue en 1 Clic (~30 segundos)**: Un único comando compila, empaqueta, sube por `scp`, extrae por `ssh` (enviando el script por `stdin` a `bash` para evitar incompatibilidades con el shell de login `ksh`), reinicia los servicios y valida las sondas `/healthz` y `/readyz`.

### Configurar clave SSH sin contraseña (una sola vez)

Para desplegar sin introducir la contraseña de `infocodes` en cada paso:

```powershell
.\scripts\setup-ssh-key.ps1
```
*(Pide la contraseña una única vez para registrar `~/.ssh/id_ed25519.pub` en `~/.ssh/authorized_keys` del servidor con permisos `700`/`600`).*

### Opción Rápida: Despliegue en 1 Clic desde PowerShell (`deploy-production.ps1`)

Desde la raíz del proyecto en Windows PowerShell:

```powershell
# 1. Despliegue estándar del Frontend (compila, sube, hace backup, despliega y verifica):
.\scripts\deploy-production.ps1
# (o mediante npm: npm run deploy)

# 2. Despliegue conjunto Frontend + Backend CSO (actualiza también cso-incident-masivas-report en :8000):
.\scripts\deploy-production.ps1 -IncludeBackend

# 3. Despliegue rápido sin recompilar (usa dist/gestion-problemas-standalone.tar.gz ya generado):
.\scripts\deploy-production.ps1 -SkipBuild
# (o combinando con backend: .\scripts\deploy-production.ps1 -SkipBuild -IncludeBackend)

# 4. Reintentar extracción remota sin volver a subir por SCP (si el tar.gz ya está en /tmp/):
.\scripts\deploy-production.ps1 -SkipBuild -SkipUpload

# 5. Verificar únicamente estado y sondas HTTP (/healthz, /readyz y Nginx :8081) en ~4 segundos:
.\scripts\deploy-production.ps1 -VerifyOnly

# 6. ROLLBACK instantáneo (~1 segundo) a la release previa mediante symlink (./rollback.sh):
.\scripts\deploy-production.ps1 -Rollback
```

### Arquitectura de releases atómicas (`current -> releases/`) y estado persistente (`/infocodes/var/`)

Cada despliegue extrae el nuevo paquete en un directorio con marca temporal bajo `releases/` y cambia de forma atómica el enlace simbólico `current`, manteniendo las últimas **5 releases** listas para reversión instantánea (`./rollback.sh`) y el estado operativo fuera del árbol de código (`/infocodes/var/`):

```text
/infocodes/project/gestion-problemas-dashboard/
├── releases/
│   ├── 20261014_130000/        # Release previa (lista para rollback en 1s)
│   └── 20261014_154500/        # Release activa
├── shared/
│   └── .env.local              # Credenciales inmutables enlazadas por symlink
├── current -> releases/20261014_154500
└── start.sh / restart.sh / status.sh / rollback.sh

/infocodes/var/
├── cache/problemas/            # dashboard_stats.json (1.68 MB), jira_wiki_links.json (18.9 KB)
├── storage/executive_pptx/     # Presentaciones .pptx generadas (retención automática 14 días)
├── run/                        # gestion-problemas.pid (:3001), cso-backend.pid (:8000)
└── backups/                    # problemas-rollback.tar.gz, cso-backend-rollback/
```

---

### Procedimiento Paso a Paso (Manual):

#### 1. En tu máquina de desarrollo (o CI):
Genera el paquete standalone listo para producción:
```powershell
# En Windows PowerShell:
.\scripts\build-and-package.ps1

# O mediante npm:
$env:NEXT_PUBLIC_BASE_PATH="/problemas"
npm run build:standalone
npm run package
```
Esto genera el archivo comprimido `dist/gestion-problemas-standalone.tar.gz`.

#### 2. Sube el tarball al servidor mediante SCP:
```bash
scp dist/gestion-problemas-standalone.tar.gz infocodes@10.132.26.96:/tmp/gestion-problemas-standalone.tar.gz
```

#### 3. En el servidor `infocodes`:
```bash
cd /infocodes/project/gestion-problemas-dashboard
tar -xzf /tmp/gestion-problemas-standalone.tar.gz
rm -f /tmp/gestion-problemas-standalone.tar.gz
chmod +x *.sh

# Opción A (Recomendada y 100% autónoma, sin PM2 ni internet):
./restart.sh    # o ./start.sh para iniciar
./status.sh     # verificar PID en /infocodes/var/run/gestion-problemas.pid y logs

# Opción B (Si PM2 está instalado globalmente en el sistema - NO uses npx):
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save
```
¡Listo! La aplicación arranca directamente en el puerto 3001 con todas las dependencias y la caché persistente en `/infocodes/var/cache/problemas/`.

---

## MÉTODO ALTERNATIVO (Tradicional): Compilación directa en el servidor

> ⚠️ **Atención**: Este método requiere conexión a `registry.npmjs.org` para `npm ci`. Si falla con `ETIMEDOUT`, utiliza el [Método Recomendado Standalone](#método-recomendado-despliegue-standalone-precompilado-cero-red-y-cero-compilación-en-servidor).

### 3. Copiar el código al servidor

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
no requiere privilegios de root, cada usuario gestiona su propio crontab).
El servidor comparte el crontab con otras apps: para no arriesgarte a perder
líneas existentes con un editor interactivo, añade la nueva al final así:

```bash
crontab -l > /tmp/mycron
echo '@reboot cd /infocodes/project/gestion-problemas-dashboard && PATH=/infocodes/nodejs/bin:$PATH npx pm2 resurrect' >> /tmp/mycron
crontab /tmp/mycron
rm /tmp/mycron
crontab -l   # confirma que se añadió sin tocar el resto
```

El `PATH=/infocodes/nodejs/bin:$PATH` explícito en la propia línea es
necesario porque los trabajos de `@reboot` no cargan `~/.profile`: sin él,
`npx`/`pm2` no se encontrarían al arrancar el servidor. Esto restaura los
procesos guardados con `pm2 save` cuando el servidor arranque, sin necesitar
systemd.

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
curl -s -o /dev/null -w "%{http_code}\n" http://10.132.26.96:8081/problemas
npx pm2 status
npx pm2 logs gestion-problemas-dashboard --lines 50
```

Desde un navegador: `http://infocodes.si.orange.es:8081/problemas`.

## Redespliegues posteriores

Node.js, el `PATH` en `~/.profile`, el bloque de nginx y la entrada de
crontab son de **una sola vez** — no hace falta repetirlos en cada
redespliegue, solo la primera vez que se instala la app en un servidor nuevo.

Checklist para actualizar la app ya desplegada:

1. **Conecta por SSH como `infocodes`** y ve al proyecto:
   ```bash
   cd /infocodes/project/gestion-problemas-dashboard
   ```
2. **Comprueba que no hay cambios locales sin commitear** en el servidor
   (no debería haberlos — el servidor no es donde se edita código — pero
   evita pisar algo por error):
   ```bash
   git status
   ```
3. **Trae el código nuevo**:
   ```bash
   git pull
   ```
4. **Instala dependencias** (solo hace falta si cambió `package.json` /
   `package-lock.json`, pero `npm ci` es rápido y seguro repetirlo siempre):
   ```bash
   npm ci
   ```
5. **Revisa que `NODE_ENV` no esté fijado** en la sesión antes de compilar
   (un `NODE_ENV=development` persistente rompe `next build` con un error de
   prerenderizado ilegible — ver [Solución de problemas](#npm-run-build-falla-con-un-error-de-prerenderizado-ilegible)):
   ```bash
   echo "NODE_ENV=[$NODE_ENV]"   # debe salir vacío; si no, `unset NODE_ENV`
   ```
6. **Compila**:
   ```bash
   npm run build
   ```
7. **Reinicia el proceso de pm2** (no hace falta `pm2 start` de nuevo, ya
   está registrado):
   ```bash
   npx pm2 restart gestion-problemas-dashboard
   ```
8. **Verifica**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/problemas   # 200
   npx pm2 status
   npx pm2 logs gestion-problemas-dashboard --lines 30
   ```
   y confirma visualmente en `http://infocodes.si.orange.es:8081/problemas`.

De un tirón:

```bash
cd /infocodes/project/gestion-problemas-dashboard
git status
git pull
npm ci
unset NODE_ENV
npm run build
npx pm2 restart gestion-problemas-dashboard
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/problemas
```

**Cuándo sí hace falta tocar algo más:**
- Si cambia `NEXT_PUBLIC_BASE_PATH` (la ruta pública): hay que actualizar
  `.env.production.local` y recompilar — el valor queda incrustado en el
  JavaScript del cliente en tiempo de build, reiniciar pm2 no basta.
- Si cambia el puerto de la app o se añade una ruta nueva: repetir el
  [paso 9](#9-aplicar-el-bloque-de-nginx) (editar `nginx.conf`, probar con
  `-t` y recargar con `-s reload`).
- Si rota el PAT de Jira: actualizar `JIRA_API_TOKEN` en `.env.local` y
  reiniciar pm2 (no hace falta recompilar, son variables de servidor, no de
  cliente).
- Si se cambia de servidor o se reinstala desde cero: repetir todo el
  documento desde el [paso 1](#1-prerrequisitos), incluida la instalación de
  Node.js.

## Rollback

### Opción 1 (Recomendada): Rollback instantáneo en 1 Clic (~5 segundos)

Cada vez que ejecutas `.\scripts\deploy-production.ps1`, el servidor guarda automáticamente una copia exacta de la versión anterior en `/infocodes/var/backups/problemas-rollback.tar.gz` (y `/infocodes/var/backups/cso-backend-rollback.tar.gz` si usaste `-IncludeBackend`).

Para volver inmediatamente a la versión previa desde Windows PowerShell:

```powershell
# Revertir solo el Frontend (Dashboard :3001):
.\scripts\deploy-production.ps1 -Rollback

# Revertir Frontend (:3001) + Backend CSO (:8000):
.\scripts\deploy-production.ps1 -Rollback -IncludeBackend
```

### Opción 2 (Manual desde Git si usaste el método tradicional):

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

Despliegue inicial completo, de un tirón (asumiendo Node.js ya instalado —
ver [más arriba](#instalar-nodejs-si-no-está-disponible) si no—, y `.env.local`
y `.env.production.local` ya creados):

```bash
mkdir -p /infocodes/project/gestion-problemas-dashboard
cd /infocodes/project/gestion-problemas-dashboard
git clone <url-del-repo> .
npm ci
npm run build
npx pm2 start ecosystem.config.js
npx pm2 save
crontab -l > /tmp/mycron
echo '@reboot cd /infocodes/project/gestion-problemas-dashboard && PATH=/infocodes/nodejs/bin:$PATH npx pm2 resurrect' >> /tmp/mycron
crontab /tmp/mycron && rm /tmp/mycron
diff /infocodes/nginx/conf/nginx.conf ./nginx.conf   # revisar antes de copiar
cp ./nginx.conf /infocodes/nginx/conf/nginx.conf
/infocodes/nginx/sbin/nginx -t -c /infocodes/nginx/conf/nginx.conf
/infocodes/nginx/sbin/nginx -s reload -c /infocodes/nginx/conf/nginx.conf
curl -s -o /dev/null -w "%{http_code}\n" http://10.132.26.96:8081/problemas
```

Redespliegue tras un cambio de código (checklist completo en
[Redespliegues posteriores](#redespliegues-posteriores)):

```bash
cd /infocodes/project/gestion-problemas-dashboard
git status
git pull
npm ci
unset NODE_ENV
npm run build
npx pm2 restart gestion-problemas-dashboard
```

## Refresco nocturno automático de la caché de Jira (Crontab)

Para mantener los datos y enlaces de Confluence siempre al día sin sobrecargar el servicio en horario laboral (y actuar como *watchdog* si el servicio se detuviera), el proyecto incluye el script [`refresh-cache.sh`](refresh-cache.sh).

El script realiza:
1. Comprobación del PID en `/infocodes/var/run/gestion-problemas.pid` (si está caído lo levanta automáticamente con `./start.sh`).
2. Petición a `http://127.0.0.1:3001/problemas/api/dashboard?refresh=true` con timeout de 300s.
3. Actualización simultánea en memoria y en el directorio persistente `/infocodes/var/cache/problemas/` (`dashboard_stats.json` y `jira_wiki_links.json`).
4. Registro de trazas con tiempos de respuesta en `cron.log`.

### Configuración en Crontab (todos los días a las 04:00 AM)

En la terminal del servidor:

```bash
chmod +x /infocodes/project/gestion-problemas-dashboard/refresh-cache.sh

# Añadir al crontab del usuario infocodes:
crontab -l 2>/dev/null > /tmp/current_cron
echo "0 4 * * * /infocodes/project/gestion-problemas-dashboard/refresh-cache.sh >/dev/null 2>&1" >> /tmp/current_cron
crontab /tmp/current_cron
rm -f /tmp/current_cron
```

Para verificar las tareas programadas:
```bash
crontab -l
```

Para consultar el historial de ejecuciones:
```bash
cat /infocodes/project/gestion-problemas-dashboard/cron.log
```
