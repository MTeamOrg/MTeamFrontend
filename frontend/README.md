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

## Módulo de autenticación

El módulo implementa registro, inicio y cierre de sesión, persistencia opcional de la sesión, cambio obligatorio de contraseña temporal y protección de rutas. La comunicación HTTP está centralizada en `src/service/api-client.ts` y utiliza la estructura de errores definida por el backend: `code`, `message` y `details`.

Rutas disponibles:

- `/crear-cuenta`
- `/iniciar-sesion`
- `/cambiar-contrasena`
- `/inicio` (pantalla temporal protegida hasta implementar los dashboards)

## Integración disponible

La integración usa las rutas efectivamente implementadas en el backend para:

- autenticación, cierre de sesión y consulta de identidad;
- perfil propio;
- usuarios administrativos y socios;
- valor e historial de la cuota;
- acreditación, consulta y anulación de pagos;
- sedes públicas y administración de sedes;
- directorio público de entrenadores.

El cronograma semanal y su copia no se conectan en esta rama. Los módulos de
dashboard, aptos médicos, acceso QR, eventos, novedades y notificaciones se
muestran como pendientes porque sus APIs todavía no forman parte del alcance de
integración acordado. No se usan datos simulados como reemplazo cuando falta un
endpoint o el backend no está disponible.
