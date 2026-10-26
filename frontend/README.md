# M-Team Frontend

Aplicación web de M-Team Gimnasio desarrollada con React, Vite y TypeScript.

## Configuración local

1. Copiar `.env.example` como `.env`.
2. Verificar que `VITE_API_URL` apunte al backend, por defecto `http://localhost:3000/api`.
3. Instalar dependencias con `npm.cmd install` en Windows PowerShell.
4. Iniciar la aplicación con `npm.cmd run dev`.

El archivo `.env` no debe versionarse. Las variables con prefijo `VITE_` son públicas en el navegador y nunca deben contener secretos.

El frontend se comunica exclusivamente con la API REST. No debe configurarse con
URLs de PostgreSQL, claves privadas de Supabase ni credenciales de Storage.

## Scripts

- `npm.cmd run dev`: inicia el entorno local.
- `npm.cmd run build`: valida TypeScript y genera la aplicación.
- `npm.cmd run lint`: ejecuta las reglas de calidad.
- `npm.cmd test`: ejecuta las pruebas automatizadas.
- `npm.cmd run test:e2e`: ejecuta los flujos de navegador con Playwright. En Windows usa Microsoft Edge; en otros sistemas necesita Chromium instalado con `npx playwright install chromium`.

Las pruebas E2E de autenticación, acreditación de pagos, consulta de eventos y lectura de notificaciones simulan las respuestas de la API y bloquean cualquier otra llamada de red. La prueba de acceso QR también simula el permiso de cámara denegado. No necesitan cuentas reales, el backend ni Supabase, y no modifican datos. Validan recorridos de la interfaz (los de notificaciones usan una API falsa con estado, `e2e/support/fake-notifications-api.ts`, que respeta el contrato real); no demuestran que el backend ni la base de datos funcionen.

La verificación real de las notificaciones (`e2e/real-backend`) se omite si no se definen `E2E_REAL_API_URL` y `E2E_REAL_FIXTURE`; ver [Notificaciones contra el backend real](#notificaciones-contra-el-backend-real).

## Módulo de autenticación

El módulo implementa registro, inicio y cierre de sesión, persistencia opcional de la sesión, cambio obligatorio de contraseña temporal y protección de rutas. La comunicación HTTP está centralizada en `src/service/api-client.ts` y utiliza la estructura de errores definida por el backend: `code`, `message` y `details`.

Rutas disponibles:

- `/crear-cuenta`
- `/iniciar-sesion`
- `/cambiar-contrasena`
- `/inicio` (redirige al inicio protegido según el rol)

## Integración disponible

La integración usa las rutas efectivamente implementadas en el backend para:

- autenticación, cierre de sesión y consulta de identidad;
- perfil propio;
- usuarios administrativos y socios;
- valor e historial de la cuota;
- acreditación, consulta y anulación de pagos;
- sedes públicas y administración de sedes;
- directorio público de entrenadores;
- cronograma semanal, copia de semanas y administración de clases;
- carga, consulta, revisión y acceso temporal a certificados médicos;
- escaneo real de cámara para socios y entrenadores y envío del token QR fijo a
  `POST /access-attempts`, con visualización del resultado devuelto por la API.

Los dashboards consumen las métricas disponibles y mantienen estados de carga,
error o no disponibilidad cuando falta información agregada. Los módulos de
eventos, novedades, historial de accesos y período
inicial del panel administrativo se muestran como pendientes porque sus APIs
todavía no forman parte del alcance de integración acordado. No se usan datos
simulados como reemplazo cuando falta un endpoint o el backend no está disponible.

## Notificaciones

Socios y entrenadores consultan sus avisos internos en `/socio/notificaciones` y `/entrenador/notificaciones` (el administrador no tiene bandeja). La pantalla usa:

- `GET /notifications` (paginado de a 20, más reciente primero), `PATCH /notifications/:id/read-status` y `PATCH /notifications/read-status`.
- El total de no leídas de la cuenta (`unreadCount` de la respuesta) decide si "Marcar todas como leídas" está disponible, aunque las no leídas estén en otras páginas. Si el backend no envía `unreadCount`, se consulta el total con `isRead=false`.
- Un contador junto a "Notificaciones" en el menú lateral y, en celular, una campana con el mismo contador en la barra superior: la barra inferior solo tiene cinco pestañas, por lo que la campana es el acceso desde el teléfono.
- Actualización con la aplicación abierta: el contador y la lista se consultan cada minuto mientras la pestaña está visible y al volver a ella, sin reemplazar la lista por un estado de carga. No hay WebSockets.
- Aislamiento por cuenta: el contador vive en un proveedor con `key` por usuario, no se guarda en el navegador y desaparece al cerrar sesión o cambiar de cuenta.
- Las fechas se muestran siempre en horario de Argentina (`America/Argentina/Buenos_Aires`), con el formato `dd/mm/aaaa HH:mm` (reloj de 24 horas y año de cuatro dígitos), el mismo con el que el backend escribe las fechas dentro del texto de cada aviso.
- Abrir un aviso (**Ver detalle**) lo marca como leído y muestra cuándo llegó y cuándo se leyó, como describe el diagrama de secuencia "Consulta de notificaciones"; el botón explícito **Marcar como leída** se conserva. Solo un detalle queda abierto a la vez y los controles se alcanzan con el teclado (`aria-expanded`).
- Leer no reconstruye la lista: el resultado se muestra al instante, la respuesta del servidor lo confirma en segundo plano y el lector conserva su posición en la página y el foco sobre el aviso (importante en el celular, con 20 avisos por página).

### Notificaciones contra el backend real

La suite también incluye `e2e/real-backend/admin-lists.real.spec.ts`: recorre desde el navegador las bandejas administrativas de accesos y aptos, combina filtros y comprueba que se muestran filas persistidas en PostgreSQL. Sus datos se insertan y limpian en la base local descartable indicada por el fixture; las utilidades rechazan conexiones que no sean locales y cuyo nombre no incluya `test`.

`e2e/real-backend/notifications.real.spec.ts` ejecuta el navegador contra el backend real y una base PostgreSQL local **descartable** (nada simulado). El administrador dispara los eventos reales (desde sus pantallas: cancelar un evento, rechazar un apto y cambiar el valor de la cuota; por API: las clases), y cada usuario lee sus avisos en la interfaz, en escritorio y en celular. El spec comprueba con SQL de solo lectura lo que quedó guardado (`read_at`, conteos y claves de deduplicación): usa el `pg` de la carpeta del backend indicada en el archivo de fixture y solo acepta una base local con `test` en el nombre. Además de lo anterior cubre: abrir un aviso con el mouse y con el teclado, el vencimiento de la cuota **en vivo** (un socio que permanece en su panel recibe el aviso al entrar en los 5 días y otro al vencer, sin recargar ni abrir la bandeja, y sin duplicados desde otro dispositivo), un pago nuevo y su anulación, la aprobación de un apto y la copia de una semana con tres pedidos simultáneos. Para preparar los estados que dependen del reloj (un pago que vence a los pocos segundos) o que las pantallas no pueden crear (un apto pendiente nuevo) usa `openDatabaseWriter`, con la misma guarda que la sonda de solo lectura (base local con `test` en el nombre); lo que la aplicación hace con esos estados se comprueba siempre por las pantallas y con SQL de solo lectura. El caso del vencimiento en vivo espera unos 25 segundos de reloj real. Los casos comparten estado y corren en orden, así que hay que volver a ejecutar el seed antes de repetirlos.

1. Base local de pruebas (el nombre debe contener `test`; nunca apuntar a Supabase ni a una base compartida):

   ```powershell
   docker run -d --name mteam-test-pg -e POSTGRES_USER=mteam -e POSTGRES_PASSWORD=mteam_test_password -e POSTGRES_DB=mteam_test -p 127.0.0.1:54329:5432 postgres:17-alpine
   ```

2. Backend (repositorio `MTeamBackend`, carpeta `backend/`, rama `develop` con las notificaciones integradas):

   ```powershell
   $env:DATABASE_URL = "postgresql://mteam:mteam_test_password@localhost:54329/mteam_test"
   $env:DIRECT_URL = $env:DATABASE_URL
   $env:NOTIFICATION_TEST_DATABASE_URL = $env:DATABASE_URL
   $env:JWT_SECRET = "solo-para-pruebas-locales"
   $env:CORS_ORIGIN = "http://127.0.0.1:4173"
   $env:PORT = "3100"; $env:NODE_ENV = "test"; $env:APP_ENV = "test"
   npm.cmd ci
   npm.cmd run prisma:migrate:deploy
   npm.cmd run seed:e2e:notifications -- --out "$env:TEMP\mteam-e2e-fixture.json"
   npm.cmd run build
   node dist/index.js
   ```

3. Frontend (otra terminal, en `frontend/`):

   ```powershell
   $env:E2E_REAL_API_URL = "http://127.0.0.1:3100/api"
   $env:E2E_REAL_FIXTURE = "$env:TEMP\mteam-e2e-fixture.json"
   npm.cmd run test:e2e -- e2e/real-backend
   ```

El script de siembra rechaza cualquier base que no sea `localhost` con `test` en el nombre y solo elimina las filas que él mismo creó (cuentas `@e2e.m-team.test`). Vuelva a ejecutarlo antes de repetir la prueba.
