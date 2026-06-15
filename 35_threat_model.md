# Threat Model (STRIDE) - Mi Despensa

Modelado de amenazas sobre los flujos de datos e integraciones de la plataforma utilizando la metodología STRIDE.

---

## 1. Análisis de Amenazas STRIDE

### 1.1. Spoofing (Suplantación de Identidad)
*   **Amenaza:** Un atacante intercepta o intercepta un Magic Link enviado por e-mail para ingresar como un usuario legítimo.
*   **Mitigación:** Los tokens de Magic Links generados por el Worker tendrán una validez máxima de **10 minutos**, serán de **un solo uso** e irán enlazados criptográficamente al agente de usuario (*User-Agent*) que los solicitó.

### 1.2. Tampering (Alteración de Datos)
*   **Amenaza:** Alteración del payload del inventario en IndexedDB local enviando comandos con cantidades negativas (`-100` unidades) para desbordar o corromper el stock en base de datos D1.
*   **Mitigación:** Validación estricta de esquemas y tipos en el Edge (Cloudflare Worker) utilizando librerías ligeras como Zod antes de ejecutar sentencias SQL. Las cantidades e incrementos deben ser estrictamente positivos en el backend.

### 1.3. Information Disclosure (Divulgación de Información)
*   **Amenaza:** Fuga de datos de compras e historiales financieros de un Hogar hacia otro por vulnerabilidades lógicas (IDOR).
*   **Mitigación:** Validación obligatoria en las consultas SQL: `WHERE hogar_id = ?` inyectado directamente desde el contexto seguro del token JWT de sesión verificado por el Worker, impidiendo consultas arbitrarias.

---

## 2. Alineación con OWASP Top 10 (2021)
*   **A01: Broken Access Control:** Mitigado mediante el aislamiento estricto de bases de datos por Tenant y control estricto de roles.
*   **A03: Injection:** SQL Injection en D1 se elimina utilizando exclusivamente sentencias preparadas (*Prepared Statements*) y consultas parametrizadas mediante el driver nativo de Cloudflare D1.
