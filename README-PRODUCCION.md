# Ruta Clara de Casi40Tech

Aplicación SaaS de educación y registro para ayudar a las personas a organizar información sobre su salud metabólica, preparar una conversación profesional y elegir un siguiente paso seguro.

## Estado incluido en este paquete

Esta versión integra el estado de la aplicación en `useRutaCloudState.ts`. El hook central sincroniza sesiones, mediciones, planes, las 18 tareas de los seis pilares y la gamificación con Supabase.

La gamificación utiliza estas reglas:

| Acción | Puntos |
|---|---:|
| Completar una tarea de pilar | 50 |
| Completar las tres tareas de un pilar | 100 de bonus |
| Nivel Exploradora | 0 puntos |
| Nivel En Camino | 300 puntos |
| Nivel Clara | 900 puntos |

La racha se calcula con la fecha del calendario de **Colombia (`America/Bogota`)**, no con la fecha UTC del servidor. Esto evita errores alrededor de la medianoche.

## Requisitos

- Node.js 20 o superior.
- pnpm 10 o npm equivalente.
- Proyecto Supabase configurado.
- Para recibir eventos de Hotmart, un runtime Node.js que mantenga disponible el endpoint `/api/webhooks/hotmart`. Una exportación puramente estática de Hostinger no puede ejecutar ese endpoint.

## Configuración local y producción

1. Copia `.env.example` a `.env`.
2. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con las variables públicas del proyecto Supabase.
3. Configura en el servidor, nunca en el navegador, `SUPABASE_DATABASE_URL`, `HOTMART_HOTTOK`, `HOTMART_PRODUCT_ID` y `JWT_SECRET`.
4. No subas `.env` a GitHub. El archivo `.env.example` solo contiene marcadores y no contiene secretos reales.

Instala y valida:

```bash
pnpm install
pnpm check
pnpm test
```

Para generar la aplicación de producción:

```bash
pnpm build
pnpm start
```

El build genera la aplicación web en `dist/public` y el servidor Node compilado en `dist/index.js`.

## Migraciones Supabase

Aplica las migraciones en este orden desde un entorno seguro con `SUPABASE_DATABASE_URL`:

```bash
pnpm tsx scripts/apply-supabase-migration.ts supabase/migrations/20260910_ruta_clara_saas.sql
pnpm tsx scripts/apply-supabase-migration.ts supabase/migrations/20260911_add_subscriptions.sql
pnpm tsx scripts/apply-supabase-migration.ts supabase/migrations/20260911_hotmart_webhook.sql
pnpm tsx scripts/apply-supabase-migration.ts supabase/migrations/20260922_ruta_pilares_progreso.sql
```

La migración de pilares crea `public.ruta_pilares_progreso`, su restricción única por usuario/pilar/tarea, índices, trigger de `updated_at` y políticas RLS. Cada usuario solo puede consultar y modificar sus propias filas.

## Supabase Auth

En Supabase Auth configura:

- Site URL: `https://ruta-clara.casi40tech.lat`
- Redirect URL: `https://ruta-clara.casi40tech.lat/**`
- Proveedor Google habilitado con el callback de Supabase indicado por el panel del proyecto.
- Email/password habilitado.

La app soporta registro, login por email, login con Google, recuperación de contraseña y persistencia de sesión mediante IndexedDB.

## GitHub

Crea el repositorio `app-ruta-clara` y sube el contenido del proyecto sin incluir secretos:

```bash
git init
git add .
git commit -m "Ruta Clara production"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/app-ruta-clara.git
git push -u origin main
```

Configura las variables de entorno en GitHub Actions, Hostinger o el runtime que ejecute el servidor. No copies valores reales al repositorio.

## Hostinger y dominio

Si Hostinger ejecuta Node.js:

1. Conecta el repositorio `app-ruta-clara`.
2. Usa `pnpm install --frozen-lockfile` como instalación.
3. Usa `pnpm build` como build.
4. Usa `pnpm start` como comando de inicio.
5. Define las variables de `.env.example` en el panel privado de Hostinger.
6. Apunta `ruta-clara.casi40tech.lat` al servicio de Hostinger.
7. Verifica que el proceso Node atienda `/api/webhooks/hotmart`.
8. Activa HTTPS antes de registrar el webhook en Hotmart.

Si el plan de Hostinger solo permite archivos estáticos, puede servir el frontend compilado y la autenticación directa de Supabase, pero no podrá recibir el webhook Hotmart. En ese caso, mantén el servidor Node en un servicio compatible y usa el mismo dominio o un proxy inverso.

## Hotmart

Configura en Hotmart el webhook:

```text
https://ruta-clara.casi40tech.lat/api/webhooks/hotmart
```

El servidor valida el encabezado `X-HOTMART-HOTTOK`, comprueba el producto permitido y procesa los eventos de compra, cancelación, reembolso y chargeback según la implementación incluida en `server/hotmartWebhook.ts`.

## Archivos principales

- `client/src/hooks/useRutaCloudState.ts`: estado central de sesiones, pilares y gamificación.
- `client/src/hooks/pillarGamification.ts`: niveles, fecha Colombia y cálculo de racha.
- `client/src/contexts/SupabaseAuthContext.tsx`: email, Google, recuperación y sesión.
- `supabase/migrations/20260922_ruta_pilares_progreso.sql`: tabla y RLS del progreso.
- `server/hotmartWebhook.ts`: endpoint y validación Hotmart.
- `.env.example`: plantilla de configuración sin secretos.

> Ruta Clara es una herramienta informativa y educativa. No sustituye la valoración, diagnóstico ni tratamiento de un profesional de salud.
