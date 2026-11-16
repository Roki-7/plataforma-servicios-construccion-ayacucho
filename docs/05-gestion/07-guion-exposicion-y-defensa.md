# Guion de exposición (12 minutos) y preguntas de defensa

## 1. Guion de 12 minutos

| Minuto | Tema | Qué mostrar |
|---|---|---|
| 0–1 | Problema | Cómo se busca hoy un maestro de obra en Ayacucho: recomendaciones, sin comparar precios ni dejar acuerdos por escrito. |
| 1–2 | Solución y actores | Cliente, prestador y administrador; ciclo buscar → solicitar → cotizar → contratar → seguir → cerrar. |
| 2–4 | Análisis | 28 HU, 45 RF priorizados con MoSCoW, 9 atributos de calidad y 11 drivers. DA04 es el principal. |
| 4–6 | Arquitectura | Monolito modular de 10 módulos con Clean Architecture; diagrama de estilo y de anillos. |
| 6–8 | Modelo C4 | Contexto, contenedores, componentes y la secuencia de AceptarPropuesta. |
| 8–9 | Integridad | Índice único parcial, idempotencia, bloqueo optimista y patrón Outbox. |
| 9–11 | SDD con Spec Kit | Constitución, una especificación, su plan, sus tareas y su código. |
| 11–12 | Cierre | MVP, evolución futura y lo que no se promete. |

## 2. Preguntas probables de defensa

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué monolito modular y no microservicios? | Aceptar una cotización cambia varios módulos a la vez; en un monolito es una transacción local. Con microservicios necesitaríamos sagas y más infraestructura sin una necesidad medida (ADR-001). |
| ¿Cuántos módulos hay y cuáles son? | Diez: Usuarios y acceso, Prestadores, Catálogo y búsqueda, Solicitudes y visitas, Cotizaciones, Contrataciones y acuerdos, Seguimiento y pagos registrados, Calificaciones, Notificaciones, y Administración e incidencias. |
| ¿Qué pasa si se cae la IA? | Cada llamada tiene un tiempo límite de 8 s; si falla, se ofrece la búsqueda por filtros (Fallback). Ante fallas repetidas se suspenden las llamadas un tiempo (Circuit Breaker). |
| ¿Cómo evitan dos contrataciones para la misma solicitud? | Transacción, índice único parcial en PostgreSQL, versión esperada y clave de idempotencia (DA04, EQ-09). |
| ¿Cómo se comunica el frontend con el backend? | Solo mediante una API REST bajo `/api/v1` con JSON (RC06, ADR-003). |
| ¿Cómo se integran los sistemas externos? | Mediante puertos y adaptadores: cambiar de proveedor no modifica los casos de uso (ADR-007). |
| ¿Qué pasa si falla una notificación? | El aviso se guarda en la misma transacción y se envía después con reintentos; la contratación no se deshace (Outbox, ADR-009). |
| ¿La plataforma cobra el trabajo? | No. El cliente paga directamente al prestador; la plataforma solo registra los pagos declarados (RC10). |
| ¿Cómo se mide el rendimiento? | Con k6: el 95 % de las búsquedas debe responder en 2 s o menos (EQ-01). |
| ¿Qué es SDD y por qué Spec Kit? | Especificar antes de programar. Spec Kit deja la constitución, la especificación, el plan y las tareas de cada funcionalidad como evidencia. |

## 3. Preguntas de trazabilidad para ensayar

- ¿De qué requisito sale el índice único parcial? → RF21 → AC09 → DA04 → ADR-005 → módulo Contrataciones → PR09.
- ¿Qué prueba demuestra que la IA es reemplazable? → RF11 → AC05 → DA06 → ADR-007 → adaptador de IA → PR05.
- ¿Por qué existe el proceso de avisos? → RF35 → AC08 → DA05 → ADR-009 → módulo Notificaciones → PR15.

---

[Índice del proyecto](../../README.md)
