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

1. Crea un proyecto Supabase. Ejecuta **en orden** los cuatro archivos de `supabase/migrations/` en SQL Editor. Ejecuta después `supabase/seed.sql`. Alternativamente, usa Supabase CLI: `supabase link --project-ref TU_REFERENCIA` y `supabase db push`; ejecuta el seed por separado. Las migraciones se ejecutan una sola vez; el seed puede repetirse.
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

- Borradores en `documents`, accesibles únicamente por el autor. La lectura usa una copia en `publications`, actualizada explícitamente.
- Publicar crea una versión de lectura; marcar «Mostrar también en el muro público» permite su descubrimiento público. Actualizar el borrador nunca actualiza automáticamente esa copia.
- Los accesos por correo dan lectura a una cuenta con ese correo verificado. Compartir un cuaderno concede acceso a entradas publicadas actuales y futuras. No enviamos una invitación por correo: el destinatario entra en la aplicación y abre «Compartido conmigo».
- Cada enlace tiene un token aleatorio de 256 bits. Se almacena únicamente SHA-256 y se muestra la URL al crearlo. Cópiala entonces; para regenerar, revoca el enlace anterior y crea otro.
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

1. Sube este proyecto a un repositorio e impórtalo en Vercel con el preset Next.js. Directorio raíz: esta carpeta. Instalación: `npm ci`; build: `npm run build`.
2. Añade las cuatro variables de aplicación de `.env.example` a Production y Preview. Usa un Supabase separado para pruebas si vas a permitir cambios desde previews. No añadas variables de integración a Vercel.
3. Establece `NEXT_PUBLIC_SITE_URL` con el dominio definitivo. Añádelo a las URLs de Auth de Supabase y vuelve a desplegar.
4. Comprueba con dos cuentas reales: carta privada, publicación por destinatario, imagen de borrador inaccesible, enlace anónimo y revocación; después un aporte y su moderación.

El repositorio incluye configuración y migraciones; no crea ni despliega cuentas de proveedor automáticamente. Sin credenciales no se pueden verificar la entrega de correo, permisos reales, Realtime o la publicación en Vercel.

## Estructura

- `src/app`: páginas, autenticación y API de operaciones/archivos.
- `src/components`: estudio, editor, lector, biblioteca, perfiles y moderación.
- `src/lib`: modelos, validación, acceso y clientes Supabase.
- `supabase`: esquema, políticas RLS, operaciones atómicas y catálogo inicial.
- `tests`: pruebas unitarias, de navegador y de integración con Supabase.

No incluye comentarios, seguidores, edición colaborativa, mensajería, pagos o generación con IA.
