# Validación de Ruta Clara de Casi40Tech

Fecha: 10 de septiembre de 2026.

## Compilación y calidad

- `pnpm check`: aprobado sin errores TypeScript.
- `pnpm build`: aprobado.
- `pnpm test`: **5 archivos y 14 pruebas aprobadas**.
- No se encontraron usos de `localStorage` en `client`, `server` ni `shared`.
- No se usa el nombre descartado Consulta Lista.

## Validación visual

- Capturas completas en escritorio a 1440 × 1000 y móvil a 390 × 844: aprobadas.
- La navegación superior funciona en escritorio y la navegación inferior persistente se muestra en móvil.
- La aplicación usa tarjetas, formularios, estados activos, salidas visuales, progreso e historial para conservar una experiencia app-first.
- La paleta mantiene los tokens Casi40Tech: negro `#17191F`, verde principal `#2E8B57` y acento `#25D366`.

## Autenticación Supabase

- Toda la aplicación está protegida por un `AuthGate`: sin sesión solo se muestran Registro, Login, Google Login y Recuperar contraseña.
- Registro por nombre, correo y contraseña implementado con Supabase Auth.
- Login por correo y contraseña verificado en navegador con un usuario temporal confirmado.
- El botón **Continuar con Google** fue probado después de habilitar el proveedor: llegó correctamente a Google Accounts para el proyecto Supabase, sin el error `redirect_uri_mismatch`.
- Recuperación y actualización de contraseña implementadas con el flujo PKCE de Supabase.
- **Recuérdame** guarda el refresh token en IndexedDB y aplica una política de 30 días. Sin marcarlo, la política es de 24 horas. Ambas duraciones tienen pruebas unitarias.
- El botón **Cerrar sesión** fue probado y vuelve a bloquear la aplicación.

## Base de datos y RLS

La migración PostgreSQL fue aplicada al proyecto real de Supabase. Se verificaron estas tablas:

| Tabla | Propósito | Seguridad |
|---|---|---|
| `users` | Perfil asociado a `auth.users` | RLS por `auth.uid()` |
| `sesiones_ruta` | Estado completo de los seis pasos, resumen y progreso | RLS por `user_id` |
| `mediciones` | Contexto de cada medición vinculada a una sesión | RLS por `user_id` |
| `planes` | Acción elegida, días y estado | RLS por `user_id` |

Las políticas fueron probadas con dos usuarios distintos: el usuario B no pudo leer ni modificar la sesión del usuario A. El borrado integral mediante `delete_my_account()` también fue probado; eliminó el usuario de Auth y sus filas relacionadas por cascada.

## Persistencia e historial

- Se completó una sesión real desde el navegador hasta **6 de 6 pasos y 100%**.
- La sesión se verificó directamente en Supabase como `progreso: 100` y `completada: true`.
- La medición se verificó con valor `112 mg/dL` y origen `Laboratorio`.
- El plan se verificó como `completado`, con hábito `bebida` y día `L`.
- Después de recargar, la app conservó el login y restauró desde Supabase el motivo, la selección de ruta y el progreso.
- **Mi ruta** muestra historial, fecha, progreso y opciones para retomar o crear una ruta.
- Los usuarios temporales de prueba fueron eliminados al finalizar.

## Seguridad y límites del producto

- Las tablas usan RLS para aislar registros por `user_id`.
- El cliente público usa solo la anon key; la service role permanece únicamente como secreto de desarrollo y pruebas.
- La app declara que no diagnostica, no interpreta resultados individuales, no prescribe y no promete curas.
- El footer conserva el aviso: **Esta app prepara. Un profesional evalúa.**
- **Borrar mis datos** exige confirmación y elimina cuenta, sesiones, mediciones y planes de Supabase.
