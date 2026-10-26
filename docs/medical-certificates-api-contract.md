# Contrato actual: certificados médicos

Este documento refleja las rutas expuestas por `develop` en `MTeamBackend`. El frontend no asume que el listado o el detalle incluyan `fileName` o `fileUrl`: el acceso al documento se obtiene bajo demanda mediante una URL firmada y temporal.

Todos los endpoints requieren el token Bearer de la sesión.

## Socio

`GET /members/me/medical-certificates?page=1&limit=20`

```json
{
  "items": [
    {
      "id": "certificate-id",
      "memberId": "member-id",
      "status": "APPROVED",
      "uploadedAt": "2026-09-01T12:00:00.000Z",
      "reviewedAt": "2026-09-02T12:00:00.000Z",
      "reviewComment": null,
      "member": {
        "id": "member-id",
        "firstName": "Ana",
        "lastName": "Pérez",
        "documentNumber": "123",
        "email": "ana@example.com"
      },
      "reviewedBy": { "id": "admin-id", "firstName": "Lara", "lastName": "Admin" }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "initialMedicalCertificatePeriod": {
    "startsAt": "2026-09-01T12:00:00.000Z",
    "expiresAt": "2026-09-21T12:00:00.000Z",
    "daysRemaining": 6,
    "isActive": true
  }
}
```

`startsAt` y `expiresAt` pueden ser `null` cuando no existe un período inicial. El frontend muestra ese dato como no informado y no inventa una fecha.

`POST /members/me/medical-certificates`

- Content-Type: `multipart/form-data`
- Campo requerido: `file`
- Tipos aceptados por la interfaz: PDF, JPG y PNG, hasta 5 MB.
- Respuesta `201`: un certificado con la misma forma de un elemento de `items`.

## Administrador

`GET /medical-certificates?search=&status=&from=&to=&page=1&limit=20`

La respuesta es una página con `items`, `page`, `limit` y `total`. Los filtros `from` y `to` se envían como fecha-hora ISO con zona horaria. No hay métricas agregadas en esta respuesta.

`GET /medical-certificates/:certificateId`

Devuelve un certificado con los campos de un elemento de `items`. No entrega una URL pública ni el nombre del archivo.

`GET /medical-certificates/:certificateId/file`

```json
{ "signedUrl": "https://signed.example/file", "expiresIn": 300 }
```

El frontend solicita esta respuesta al abrir el documento y usa `signedUrl` sin persistirla como URL del certificado.

`PATCH /medical-certificates/:certificateId/review`

Para aprobar:

```json
{ "status": "APPROVED" }
```

Para rechazar:

```json
{ "status": "REJECTED", "reviewComment": "Falta la firma." }
```

El motivo de rechazo es obligatorio y no puede ser blanco.
