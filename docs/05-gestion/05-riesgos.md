# Matriz de riesgos

Probabilidad e impacto: Alta (A), Media (M) o Baja (B).

| ID | Riesgo | Prob. | Impacto | Mitigación | Tipo de respuesta |
|---|---|---|---|---|---|
| R01 | Dos clientes o dos pestañas aceptan cotizaciones a la vez y se crean dos contrataciones activas | M | A | Transacción, índice único parcial, versión esperada e idempotencia (ADR-005) | Reducido por diseño; se verifica con PR09 |
| R02 | Un usuario consulta o modifica información de otro | M | A | Permisos por rol y participación en cada caso de uso (ADR-006) | Requiere pruebas: PR04 |
| R03 | El proveedor de IA falla o cambia sus condiciones | M | M | Adaptador reemplazable, tiempo límite de 8 s y búsqueda por filtros (ADR-007, ADR-008) | Reducido por diseño; PR05 y PR08 |
| R04 | El proveedor de notificaciones falla | M | M | Avisos pendientes con reintentos; la operación no se deshace (ADR-009) | Reducido por diseño; PR15 |
| R05 | Las búsquedas se vuelven lentas al crecer los datos | M | M | Índices, paginación y caché (ADR-010) | Requiere monitoreo: PR01 |
| R06 | Prestadores con poca experiencia digital no completan su perfil | A | M | Formularios cortos, ayuda contextual y plan de adopción ([08](08-adopcion-y-capacitacion.md)) | Requiere validación con usuarios |
| R07 | Filtración de credenciales de proveedores | B | A | Variables de entorno, `.env` ignorado por Git y revisión antes de cada pull request (RC09) | Reducido por diseño |
| R08 | Incumplir la Ley N.º 29733 al tratar datos personales | B | A | Consentimiento, datos mínimos y perfil público sin datos privados (RC14) | Reducido por diseño |
| R09 | El tiempo del curso no alcanza para todas las funcionalidades | A | M | Priorización MoSCoW y líneas de corte ([02](02-backlog-y-sprints.md#3-líneas-de-corte)) | Plan de contingencia |
| R10 | El asistente de IA genera código que no respeta la arquitectura | M | M | Constitución, pruebas de arquitectura (PR12) y revisión de cada pull request | Requiere pruebas y revisión |
| R11 | Un desacuerdo entre cliente y prestador sobre pagos directos | M | M | Registro de pagos declarados y confirmados, con historial (RC10) | Reducido por diseño; la plataforma no procesa dinero |

## Riesgos reducidos por diseño frente a riesgos que requieren pruebas o monitoreo

- **Reducidos por diseño:** R01, R03, R04, R07, R08 y R11. La arquitectura ya incluye la solución; las pruebas confirman que funciona.
- **Requieren pruebas o monitoreo continuo:** R02, R05, R06 y R10. Dependen de la implementación y del uso real.
- **Riesgo del proyecto:** R09, que se gestiona con el backlog y las líneas de corte.

---

[Índice del proyecto](../../README.md)
