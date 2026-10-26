# Qase en frontend

Vitest reporta pruebas unitarias/componentes y Playwright reporta E2E. Ambos reporters solo se activan al definir `QASE_MODE=testops`; sin esa variable el flujo de tests habitual no envía datos.

En GitHub, en **Settings → Secrets and variables → Actions**, configura:

- Secret `QASE_TESTOPS_API_TOKEN` con un App Token de Qase.
- Variable `QASE_TESTOPS_PROJECT` con el código del proyecto Qase (puede ser el mismo del backend).

El workflow de análisis registra unitarias/componentes; `frontend-e2e.yml` registra E2E. Las pruebas E2E existentes simulan la API; no deben apuntarse a staging con escrituras. La cobertura de código se mantiene separada en Sonar y no la calcula Qase.

Para enviar una ejecución local desde PowerShell, exporta esas variables y ejecuta:

```powershell
$env:QASE_MODE = "testops"
$env:QASE_TESTOPS_API_TOKEN = "<token-local>"
$env:QASE_TESTOPS_PROJECT = "<codigo-del-proyecto>"
npm run test
npm run test:e2e
```

Los títulos de ejecución pueden distinguirse con `QASE_TESTOPS_RUN_TITLE`. Para asociar una prueba con un caso manual ya creado, anotá el ID Qase en el test con el helper del reporter; no agregues IDs ficticios.
