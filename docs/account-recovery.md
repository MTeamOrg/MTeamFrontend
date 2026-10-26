# Recuperación de cuenta — USR-04

Amplía USR-04 del alcance del repositorio M-Team, que actualmente describe recuperación administrativa. Ese mecanismo y ADM-04 permanecen disponibles. El backend contiene la configuración, migración y decisiones de seguridad en `backend/docs/account-recovery.md`.

## Prueba local

1. En backend configurar `FRONTEND_PUBLIC_URL=http://localhost:5173`, `RESEND_API_KEY` y `MAIL_FROM` con un remitente habilitado. Aplicar la migración preparada solo en una base local, siguiendo la documentación del backend, e iniciar con `npm run dev`.
2. En frontend usar `VITE_API_URL=http://localhost:3000/api` según `.env.example` e iniciar con `npm run dev`.
3. En /iniciar-sesion seleccionar “¿Olvidaste tu contraseña?”, ingresar el correo y enviar. Solo se muestra confirmación cuando la API acepta la solicitud; los fallos permiten reintentar. El reenvío se habilita después de un minuto.
4. Abrir el enlace del correo, elegir y confirmar una contraseña de 8–72 caracteres. La ruta pública es `/restablecer-contrasena#token=...`. El token no contiene datos personales y no viaja en la petición de la página ni en Referer. Se elimina de la URL al completar el cambio.
5. Iniciar sesión con la nueva contraseña. Un enlace vencido, inválido o utilizado ofrece solicitar otro.

No se requieren variables nuevas del frontend. No poner credenciales de correo en variables VITE_. En hosting configurar el fallback de SPA para `/restablecer-contrasena`. El cambio no inicia sesión automáticamente ni modifica el manejo existente de JWT.

## Verificación

`npm test`, `npm run lint`, `npm run build` (incluye typecheck) y `npm run test:e2e -- e2e/account-recovery.spec.ts`. Las pruebas usan API simulada, no envían correos. La validación de entrega real necesita una cuenta Resend y las variables del backend.
