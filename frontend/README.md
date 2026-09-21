# M-Team Frontend

Aplicación web de M-Team Gimnasio desarrollada con React, Vite y TypeScript.

## Configuración local

1. Copiar `.env.example` como `.env`.
2. Verificar que `VITE_API_URL` apunte al backend, por defecto `http://localhost:3000/api`.
3. Instalar dependencias con `npm.cmd install` en Windows PowerShell.
4. Iniciar la aplicación con `npm.cmd run dev`.

El archivo `.env` no debe versionarse. Las variables con prefijo `VITE_` son públicas en el navegador y nunca deben contener secretos.

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
