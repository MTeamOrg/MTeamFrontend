# Contrato pendiente: certificados médicos

La rama `develop` no expone todavía endpoints para cargar, listar o revisar certificados médicos. El frontend queda preparado contra este contrato y mostrará los estados reales de carga, error y lista vacía hasta que el backend lo implemente.

Todos los endpoints requieren el token Bearer de la sesión. Las URLs de archivos deben ser autorizadas por el backend, tener una duración controlada y no exponer documentos médicos públicamente.

## Socio

`GET /medical-certificates/me`

```json
{
  "current": {
    "id": "certificate-id",
    "fileName": "apto-medico.pdf",
    "fileUrl": "https://signed.example/file",
    "status": "APPROVED",
    "uploadedAt": "2026-09-01T12:00:00Z",
    "reviewedAt": "2026-09-02T12:00:00Z",
    "reviewComment": null
  },
  "history": [],
  "initialPeriod": {
    "status": "COMPLETED",
    "startsAt": "2026-07-12T00:00:00Z",
    "endsAt": "2026-08-01T00:00:00Z",
    "daysRemaining": 0
  }
}
```

`initialPeriod` es opcional. Si no existe, el frontend no muestra el bloque de período inicial.

`POST /medical-certificates/me`

- Content-Type: `multipart/form-data`
- Campo requerido: `file`
- Tipos aceptados: `application/pdf`, `image/jpeg`, `image/png`
- Tamaño máximo: 5 MB
- Respuesta: un `MedicalCertificate` con la misma forma de `current`.

## Administrador

`GET /admin/medical-certificates?search=&status=&from=&to=&page=1&limit=20`

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "metrics": {
    "pending": 0,
    "approved": 0,
    "rejected": 0,
    "initialPeriod": 0
  }
}
```

`metrics` es opcional. Si no se entrega, el frontend no calcula conteos sobre la página parcial ni muestra métricas inventadas.

Cada item debe incluir `member` (`id`, `firstName`, `lastName`, `documentNumber`), `membership` (`status`, `expiresAt`) y, cuando corresponda, `initialPeriod`.

`GET /admin/medical-certificates/:id`

Devuelve un item completo con los campos anteriores.

`POST /admin/medical-certificates/:id/approve`

Aprueba el certificado y devuelve el item actualizado.

`POST /admin/medical-certificates/:id/reject`

```json
{ "reviewComment": "La imagen está cortada; por favor subí el certificado completo." }
```

`reviewComment` es obligatorio y no puede ser blanco. El backend debe validar también esta regla y verificar que el usuario administrador tenga permisos de revisión.
