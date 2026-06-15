# Compliance Traceability Matrix - Mi Despensa

Trazabilidad bidireccional entre los requisitos regulatorios, riesgos identificados, controles de seguridad del Edge y evidencias de auditoría automatizadas.

---

## 1. Matriz de Trazabilidad Cruzada

| Origen Regulatorio | Requisito / Cláusula | Riesgo Asociado | Control Aplicado | Evidencia Verificable | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ley 18.331 (UY)** | Art 9 (Seguridad de Datos) | Fuga accidental de datos en D1 | **CS-03:** Aislamiento lógico de consultas SQL por ID de Hogar. | Código de backend (Worker) con test de integración que intente acceder cruzado. | Security Lead |
| **GDPR (EU)** | Art 25 (Privacy by Design) | Exposición directa de PII (e-mails) | **CS-01:** Desacoplamiento y hash SHA-256 de e-mails para IDs. | DDL del esquema de D1 donde la tabla de consumo no contiene e-mails. | Lead Architect |
| **ISO/IEC 27001** | A.8.20 (Seguridad en Redes) | Interceptación de datos en tránsito | **CS-04:** TLS 1.3 forzoso y Security Headers restrictivos en Cloudflare. | Reporte SSL Labs A+ y SecurityHeaders A+ de la API en producción. | Security Lead |
| **ISO/IEC 27701** | 7.3.2 (Consentimiento Titular) | Procesamiento no autorizado | **CS-06:** Flujo de aceptación de T&C y política de privacidad en registro. | Registro con marca de tiempo y versión de aceptación en D1 por Hogar. | Product Lead |
