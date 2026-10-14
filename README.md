# Escritura Creativa

Un estudio editorial en español para cartas, poemas y textos. Next.js 16, React, TypeScript, Tailwind 4, Tiptap y Supabase. Hosting preparado para Vercel.

## Inicio local

Requisitos: Node.js 22.20 o posterior, npm y un proyecto Supabase para las funciones compartidas.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abre <http://127.0.0.1:3000>. Sin credenciales, la portada, los 16 recursos iniciales y `/studio/preview` funcionan. El editor de prueba guarda un texto **solo en localStorage de ese navegador**. No simula cuentas, archivos remotos ni publicaciones. No cierres el navegador antes de que aparezca «Guardado en este navegador».

## Conectar Supabase

1. Crea un proyecto Supabase. Usa la CLI instalada en el proyecto: `npx supabase login`, `npx supabase link --project-ref TU_REFERENCIA` y `npx supabase db push --include-seed`. Así quedan registradas las migraciones que aplicará posteriormente CI/CD. Las migraciones se ejecutan una sola vez; el seed puede repetirse. Si ya ejecutaste el SQL manualmente, revisa `npx supabase migration list` y concilia el historial antes de activar el despliegue; no vuelvas a ejecutar las migraciones iniciales sobre tablas existentes.
2. Copia la URL del proyecto y su publishable key en `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Una legacy anon key también funciona en esa variable.
3. Configura `SUPABASE_SERVICE_ROLE_KEY` con la service role key del proyecto, **solo del lado servidor**. Nunca pongas esta clave en una variable `NEXT_PUBLIC_*`, repositorio, captura o mensaje. Se usa para resolver enlaces por su hash y entregar archivos tras comprobar acceso.
4. En Auth → URL Configuration, configura Site URL y los redirects permitidos: `http://127.0.0.1:3000/auth/callback`, `http://localhost:3000/auth/callback` y, al desplegar, `https://TU-DOMINIO/auth/callback`. Deja habilitado el proveedor Email y los registros. El acceso usa enlaces por correo, abiertos en el mismo navegador que los solicitó, mediante PKCE.
5. Configura `NEXT_PUBLIC_SITE_URL` con el origen exacto usado para compartir, por ejemplo `http://127.0.0.1:3000`. Reinicia Next.js tras cambiar variables.
6. Para correo de acceso en producción, configura tu proveedor SMTP en Supabase. El servicio de correo de prueba de Supabase puede restringir destinatarios y frecuencia. Esta aplicación no envía correos de invitación ni novedades.
7. Los buckets `personal` y `community` son **privados** y los crea la migración. No añadas políticas públicas ni marques `personal` como público. Los archivos se sirven por rutas verificadas; los clientes no pueden enumerar los buckets ni subir directamente.
8. La migración habilita Realtime en `publications`. No habilites Realtime para los borradores. Las lecturas tienen también una comprobación cada 15 segundos y al volver a la pestaña, para detectar revocaciones y nuevas entradas.

Para designar un administrador, ejecuta en SQL Editor:

```sql
insert into public.admins(user_id) values ('UUID_DE_LA_CUENTA');
```

La ruta `/admin` aparece para administradores. Ocultar un recurso lo retira del catálogo y conserva los archivos usados. Ocultar un texto lo retira del muro y bloquea su republicación pública. Su lectura mediante permisos ya concedidos continúa disponible. Para levantar un bloqueo tras revisión, elimina la fila correspondiente de `public.blocked_publications` en SQL Editor.

## Cómo se comparte

### Acceso y cuentas

El formulario ofrece registro con nombre de usuario, correo y contraseña; acceso con usuario o correo y contraseña; enlaces por correo; y Google. El correo se mantiene privado: la resolución de un nombre de usuario se realiza en el servidor. El acceso con contraseña requiere que la cuenta haya confirmado su correo cuando esa opción está habilitada en Supabase. La cuenta que ya usa enlaces por correo puede establecer una contraseña en **Mi perfil → Contraseña de acceso**, manteniendo sus textos y permisos. Recuperar acceso envía un enlace que abre ese formulario. Conserva habilitados Email y los registros; habilita confirmación de correo en producción y configura SMTP.

Para Google, crea un OAuth Client de tipo **Web application** en Google Cloud/Google Auth Platform. Configura los orígenes de la app y la URI de retorno que muestra **Supabase → Authentication → Sign In / Providers → Google** (`https://TU_REFERENCIA.supabase.co/auth/v1/callback`). Guarda Client ID y Client Secret en ese proveedor y habilítalo. La URL de retorno de la app sigue siendo `https://TU_DOMINIO/auth/callback`; añade también `https://TU_DOMINIO/auth/callback?next=/settings` a los redirects permitidos para recuperación. No coloques el Google Client Secret en variables públicas o en el repositorio. Supabase administra el enlace de identidades; prueba el acceso con el mismo correo antes de abrir registros generales.

En Google Auth Platform configura Branding, Audience y los permisos `openid`, correo y perfil. Si la audiencia externa está en Testing, añade los usuarios de prueba; antes de permitir el acceso general, publica la aplicación para esa audiencia. Para este proyecto, el origen es `https://escritura-creativa-esrt.vercel.app`, la devolución de Google a Supabase es `https://lrxymsbjnxqypvrmbuzw.supabase.co/auth/v1/callback` y el retorno permitido de Supabase a la aplicación es `https://escritura-creativa-esrt.vercel.app/auth/callback`. Confirma la URL de Supabase en el proveedor Google del dashboard si cambias de proyecto.

La migración `202610130002_auth.sql` permite elegir el nombre de usuario al registrarse y añade un límite persistente de 30 solicitudes de contraseña, registro o recuperación por dirección de origen y ventana de 15 minutos. El contador solo se puede invocar desde el servidor; las contraseñas las gestiona Supabase Auth, no las tablas de perfiles.

### Redes personales y lectura por enlace

Los enlaces `/s/TOKEN` usan una vista de lectura sin navegación del estudio: el papel llena el ancho y al menos la altura de la ventana. Se mantienen la impresión, el control de accesos y la detección de revocaciones.

En **Publicar y compartir → Imagen**, pulsa **Preparar imágenes** para exportar el borrador guardado en PNG sin compresión con pérdida, a 2160 × 2700 píxeles, hasta diez imágenes. No es necesario publicar el escrito. El navegador usa el mismo componente `Letter` que la lectura, conservando papel, fecha, fuentes, firma, formato y fotografías. Cada página reserva márgenes superiores e inferiores y evita dividir líneas o fotografías. La captura se hace página a página para limitar el uso de memoria en móvil. La miniatura puede abrirse a tamaño completo; también puedes descargar, compartir las imágenes o copiar el texto. La exportación no crea ni actualiza una publicación y no cambia sus accesos.

La selección de destino y la publicación se confirman dentro de Instagram, Facebook o la aplicación elegida. No se solicitan credenciales de redes ni se anuncia una conexión que no existe. La Web Share API requiere HTTPS y sus destinos dependen del navegador, sistema y aplicaciones instaladas; la descarga/copia está disponible como alternativa. La API de publicación automática de Meta admite Páginas de Facebook e Instagram profesional, pero no reemplaza este flujo para cuentas personales. Revocar una URL no retira imágenes o textos ya copiados a redes.

El navegador carga e incluye las fuentes y las imágenes autorizadas antes de capturar el diseño; los recursos comunitarios y las fotografías personales se resuelven por las mismas rutas protegidas de la lectura. No se requiere instalar fuentes en Vercel ni configurar Instagram. La captura usa `html-to-image`, cargado solo al exportar, y limita el tamaño a diez tarjetas antes de crear el canvas.

### Compartir una lista de escritos

1. En **Mi estudio**, crea un cuaderno y selecciona ese cuaderno en el campo **Cuaderno** de cada texto que quieras incluir.
2. Publica una **versión de lectura** de cada texto, dejando desmarcado **Mostrar también en el muro público**.
3. Filtra el estudio por ese cuaderno y pulsa **Compartir cuaderno → Crear enlace**.
4. Copia o comparte el enlace. Permite leer las entradas publicadas actuales y futuras del cuaderno sin acceder a los borradores; puedes revocarlo desde el mismo panel.

La sección **Personas concretas** se retiró del panel de compartir. Los accesos por correo concedidos anteriormente se conservan por compatibilidad. El cuaderno tiene un autor; sus lectores pueden leerlo. Un espacio donde ambos aporten escritos sería una función adicional.

Desde cada tarjeta del estudio también puedes pulsar **Mover**, elegir un cuaderno de destino o **Sin cuaderno**, y confirmar con **Mover escrito**. El movimiento conserva el contenido y comprueba la revisión para evitar sobrescribir cambios de otra pestaña. Si ya existe una versión publicada, cambia inmediatamente su pertenencia al cuaderno y el acceso concedido por ese cuaderno; no publica cambios del borrador. Los permisos directos del texto y su presencia voluntaria en el muro siguen sus propias reglas.

Referencias: [contraseñas en Supabase](https://supabase.com/docs/guides/auth/passwords), [Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google) y [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

En **Mi perfil**, el nombre de usuario público es editable y único: 3–40 caracteres en minúsculas, números, guiones o guiones bajos. La dirección se muestra antes de guardar; cambiarla no cambia el UUID ni los textos, pero los enlaces al perfil anterior dejarán de resolver.

Puedes subir un avatar propio JPEG, PNG o WebP de hasta 4 MB. El servidor verifica y decodifica la imagen (máximo 24 megapíxeles), aplica su orientación, recorta al centro a un máximo de 512 × 512, elimina metadatos y la convierte a WebP con calidad 78. El archivo resultante pesa como máximo 256 KB. Se conserva en el bucket privado `avatars`; se puede previsualizar como propietario y pasa a lectura pública cuando guardas el perfil. No se publica en el catálogo de recursos. Se puede volver a la inicial o elegir una imagen comunitaria.

La migración `202610130001_avatars.sql` crea el almacenamiento y valida también en PostgreSQL que el avatar propio pertenezca a la cuenta. Aplica las migraciones antes de desplegar el nuevo código; el workflow de producción ya sigue ese orden.

- Borradores en `documents`, accesibles únicamente por el autor. La lectura usa una copia en `publications`, actualizada explícitamente.
- Publicar crea una versión de lectura; marcar «Mostrar también en el muro público» permite su descubrimiento público. Actualizar el borrador nunca actualiza automáticamente esa copia.
- Los accesos por correo dan lectura a una cuenta con ese correo verificado. Compartir un cuaderno concede acceso a entradas publicadas actuales y futuras. No enviamos una invitación por correo: el destinatario entra en la aplicación y abre «Compartido conmigo».
- Cada enlace tiene un token aleatorio de 256 bits. El autor puede volver a ver y copiar sus enlaces activos desde **Publicar y compartir**; los tokens permanecen protegidos por las políticas RLS de propietario. Las solicitudes anónimas se resuelven en el servidor por SHA-256. La migración `202610130003_recoverable_links.sql` permite guardar los tokens; al abrir el estudio se asigna una dirección recuperable a los enlaces antiguos que solo guardaban el hash, conservando el acceso por sus direcciones originales. Revocar el enlace desactiva ambas direcciones.
- Revocar un enlace impide solicitudes posteriores con ese enlace. Si un texto sigue público o el visitante conserva otro permiso, podrá leerlo por ese otro acceso. Retirar la publicación impide su lectura hasta publicar de nuevo.
- Las imágenes personales solo se entregan al autor o a un lector autorizado si están incluidas en la versión publicada. Añadir una imagen al borrador no la comparte. Duplicar copia las imágenes para que el nuevo texto sea independiente.
- Una imagen personal nunca pasa al catálogo por sí sola. Los aportes comunitarios son un flujo separado con autoría, procedencia, licencia y confirmación de permiso.
- Las cuentas cierran sesión desde Ajustes; se borran las recuperaciones locales de esa cuenta en ese navegador. Las recuperaciones pendientes pueden descargarse desde el editor antes de descartar una versión.

## Archivos, recursos y límites

El editor permite formato, listas, citas, enlaces HTTP(S), imágenes descritas y alineación. Papeles iniciales en CSS y ocho fuentes locales de Fontsource con caracteres españoles. Las licencias originales están en los paquetes de cada fuente, y el catálogo registra licencia y procedencia.

Imágenes JPEG, PNG y WebP hasta 10 MB; el servidor verifica firma, decodifica con Sharp, limita a 24 megapíxeles, elimina metadatos y almacena WebP. Fuentes WOFF2 hasta 2 MB con validación de cabecera y tamaño descomprimido máximo de 20 MB. No admite SVG, HTML ni fuentes de otros formatos. Límite de 30 cargas por cuenta y hora y 10 reportes por hora. Los recursos no se borran al ocultarlos.

Contenido estructurado hasta 500 KB, máximo 10.000 nodos y profundidad 20. El renderizador usa elementos React y genera URLs de imágenes desde identificadores internos, nunca HTML crudo. Los cambios de borrador usan un número de revisión para rechazar escrituras obsoletas; tras un conflicto el autor debe elegir versión. Una recuperación local se ofrece antes de reemplazar el contenido guardado.

## PDF

«PDF» abre la impresión del navegador. Elige «Guardar como PDF» y habilita **Gráficos de fondo** para incluir el papel. Usa A4, escala 100 % y desactiva encabezados y pies del navegador. Editor, lector e impresión usan el mismo renderizador para la vista de lectura. Las cartas largas fluyen en páginas y las imágenes conservan proporciones. No depende de Tiptap Cloud ni de un servicio PDF de pago.

## Verificación

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Las pruebas de navegador verifican escritorio y móvil, caracteres españoles, recursos iniciales, persistencia tras recarga, uso con teclado, desconexión, aplicación de recursos y exportación A4 de cartas largas con imágenes. No necesitan Supabase. `npm test` también ejecuta las migraciones y las políticas RLS en PostgreSQL embebido (PGlite), con el contexto de autenticación modelado; esto comprueba el SQL sin sustituir las pruebas contra Supabase real. En Windows, un sandbox que impida `realpath` puede requerir ejecutar las comprobaciones con permisos normales del usuario.

Las pruebas de permisos utilizan un **proyecto Supabase de pruebas separado**, con las mismas migraciones. Configura en `.env.local` las tres variables `INTEGRATION_SUPABASE_*` de `.env.example` y ejecuta:

```powershell
npm run test:integration
```

La suite crea y elimina tres cuentas de prueba y sus registros. Comprueba aislamiento de borradores, destinatarios, publicación explícita, revocación, intentos de permisos falsificados, conflictos de revisión y buckets privados. Sin esas variables se marca como omitida; esa omisión no verifica los permisos reales.

## Desplegar en Vercel

1. En tu cuenta de Vercel, elige **Add New → Project** e importa `DavidValenciaX/escritura_creativa` desde GitHub. Selecciona el equipo `davidvalenciaxs-projects`, preset Next.js y raíz del repositorio. Instalación: `npm ci`; build: `npm run build`. La importación inicial puede generar su primer despliegue; configura las variables antes de confirmarla.
2. Añade las cuatro variables de aplicación de `.env.example` a **Production**. La clave secreta de Supabase permanece en `SUPABASE_SERVICE_ROLE_KEY`, nunca en una variable pública. Usa un Supabase separado si posteriormente habilitas Preview. No añadas variables de integración a Vercel.
3. Establece `NEXT_PUBLIC_SITE_URL` con el dominio definitivo. Añádelo a las URLs de Auth de Supabase y vuelve a desplegar.
4. Comprueba con dos cuentas reales: carta privada, publicación por destinatario, imagen de borrador inaccesible, enlace anónimo y revocación; después un aporte y su moderación.

La aplicación se aloja en tu cuenta de Vercel. Supabase aloja PostgreSQL, Auth y Storage; no publica esta aplicación Next.js. El workflow descrito abajo coordina ambos servicios. `vercel.json` desactiva los despliegues automáticos de la integración Git para que cada push no publique una segunda entrega antes de terminar las pruebas y las migraciones. No se generan previews automáticas con esta configuración. No cambies `git.deploymentEnabled` a `true` mientras uses el workflow de producción.

## GitHub Actions: CI/CD

Los archivos `.github/workflows/ci.yml` y `.github/workflows/deploy.yml` ya incluyen:

- En pull requests: TypeScript, pruebas unitarias y SQL en PGlite, build y Playwright en escritorio y móvil. Se guardan los diagnósticos del navegador si falla.
- En un job independiente: Supabase efímero con Docker en el runner, migraciones y seed del repositorio, y pruebas reales de Auth, PostgreSQL y Storage. No usa tu proyecto alojado ni necesita sus secretos.
- En cada push a `main`: las mismas comprobaciones; después, si está activado el despliegue, build con las variables de Vercel, migraciones pendientes y catálogo en Supabase, y publicación de ese build en Vercel. Un fallo detiene los pasos siguientes. También se puede ejecutar desde Actions → Producción → Run workflow, seleccionando `main`.

### Configuración inicial

Primero importa el proyecto en Vercel y configura sus variables de aplicación. Después, en GitHub → **Settings → Secrets and variables → Actions**, añade estos **Repository secrets**:

| Secreto | Procedencia |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Token personal de tu cuenta Supabase, en Account → Access Tokens. No es la publishable key ni la service role key. |
| `SUPABASE_DB_PASSWORD` | Contraseña de PostgreSQL del proyecto de producción. No es tu contraseña de acceso a Supabase. |
| `VERCEL_TOKEN` | Token de tu cuenta Vercel con acceso al equipo del proyecto, desde Account Settings → Tokens. |

En la pestaña **Variables**, añade estas **Repository variables**:

| Variable | Valor |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Referencia del proyecto de producción, visible en su URL o en `supabase/.temp/project-ref`. |
| `VERCEL_ORG_ID` | Team ID de `davidvalenciaxs-projects`, desde los ajustes del equipo. |
| `VERCEL_PROJECT_ID` | Project ID del proyecto importado, desde Project Settings → General. |
| `ENABLE_PRODUCTION_DEPLOY` | `true` cuando hayas terminado toda la configuración. Ausente o con otro valor, solo se ejecutan las comprobaciones. |

En GitHub → **Settings → Environments**, crea `production` y limita las ramas de despliegue a `main`. Puedes añadir revisores si quieres aprobación humana para cada entrega; sin revisores, el flujo será automático después de las pruebas. El indicador `ENABLE_PRODUCTION_DEPLOY` debe ser una variable del repositorio, porque se evalúa antes de entrar al environment.

No necesitas copiar las claves de aplicación a GitHub: `vercel pull` descarga las variables de Production para construir la entrega. Se ignora `.vercel/` para evitar subirlas. Conserva los secretos en las interfaces de cada proveedor, nunca en los YAML ni en commits.

Sube estos archivos al repositorio. El primer push ejecutará las comprobaciones y omitirá el job de despliegue hasta que actives la variable. Con el proyecto y los secretos configurados, activa `ENABLE_PRODUCTION_DEPLOY=true` y ejecuta **Producción** manualmente para la primera entrega coordinada. A partir de entonces, cada push a `main` lo repetirá automáticamente. Configura protección de `main` con las comprobaciones de ambos jobs de CI antes de permitir merges.

Las migraciones aplicadas no se revierten automáticamente si después falla Vercel. Para cambios de esquema, mantén compatibilidad con la versión de la aplicación que sigue publicada y usa una migración posterior para retirar campos antiguos.

Documentación: [Supabase y GitHub Actions](https://supabase.com/docs/guides/deployment/managing-environments), [Vercel con GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) y [control de despliegues Git de Vercel](https://vercel.com/docs/project-configuration/git-configuration).

## Supabase CLI y MCP en Windows

La CLI está instalada como dependencia de desarrollo y fijada por `package-lock.json`. No requiere Scoop ni instalación global. Ejecuta estos comandos desde la carpeta del proyecto:

```powershell
npx supabase --version
npm run supabase -- --version
npx supabase migration list
```

`--version` se escribe junto. `supabase --version` sin `npx` solo funciona si hay una instalación global en PATH. No uses `npm install -g supabase`; utiliza la dependencia local. Docker se necesita para `npx supabase start`, que arranca un backend local, pero no para usar la CLI con el proyecto alojado.

`npm run dev` inicia **Next.js en tu computador**; no es un comando del dashboard Supabase. Si ya está corriendo, presiona Ctrl+C en esa terminal y vuelve a ejecutar `npm run dev`. Abre `http://127.0.0.1:3000`, solicita el enlace de acceso por correo y ábrelo en el mismo navegador. Reinicia el servidor cuando cambies `.env.local`.

El MCP oficial remoto se configura en Codex, separado de la CLI y de CI/CD. Para otro equipo:

```powershell
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=TU_REFERENCIA&read_only=true"
codex mcp login supabase
codex mcp list
```

Completa la autorización de tu cuenta en el navegador. La configuración se guarda en el perfil local de Codex, no en GitHub. Con `project_ref` queda limitada a ese proyecto y `read_only=true` permite inspección sin modificar su base de datos. Las migraciones de producción se aplican mediante la CLI o el workflow. Si acabas de agregar el servidor, reinicia Codex para cargar sus herramientas en una nueva sesión. No se instala ningún servidor MCP dentro de la aplicación Next.js.

Documentación: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [MCP de Supabase](https://supabase.com/docs/guides/ai-tools/mcp) y [MCP en Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Estructura

- `src/app`: páginas, autenticación y API de operaciones/archivos.
- `src/components`: estudio, editor, lector, biblioteca, perfiles y moderación.
- `src/lib`: modelos, validación, acceso y clientes Supabase.
- `supabase`: esquema, políticas RLS, operaciones atómicas y catálogo inicial.
- `tests`: pruebas unitarias, de navegador y de integración con Supabase.

No incluye comentarios, seguidores, edición colaborativa, mensajería, pagos o generación con IA.
