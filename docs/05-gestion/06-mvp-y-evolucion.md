# MVP y evolución futura

## 1. Alcance del MVP

El MVP permite completar el ciclo principal de la plataforma: **buscar → solicitar → cotizar → contratar → dar seguimiento → cerrar**.

| Funcionalidad | Qué permite |
|---|---|
| 001 Usuarios y acceso | Crear cuentas de cliente y prestador, iniciar sesión, recuperar el acceso y gestionar el perfil. |
| 002 Prestadores y catálogo | Presentar al prestador, publicar servicios, buscar por categoría, especialidad, distrito y disponibilidad declarada, y gestionar categorías. **El filtro por calificación depende de las calificaciones de la 011** y no forma parte de la 002; mientras tanto el perfil público muestra «Calificaciones aún no disponibles». |
| 003 Solicitudes y cotizaciones | Registrar solicitudes dirigidas o publicadas, enviar cotizaciones y compararlas. |
| 004 Contratación | Aceptar una cotización con una sola contratación activa por solicitud y la confirmación del prestador. |
| 005 Seguimiento y cierre | Comunicar la finalización, atender observaciones y dar conformidad. |
| 006 Notificaciones | Avisar a cada parte sin que una falla de envío deshaga la operación. |

Cobertura inicial: distritos de Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray (RC03).

## 2. Evolución futura

| Etapa | Mejora | Requisitos |
|---|---|---|
| Corto plazo | Asistente de IA para describir la necesidad con palabras cotidianas | RF11 |
| Corto plazo | Contacto por llamada o WhatsApp y visitas técnicas | RF15, RF16 |
| Mediano plazo | Resumen y documento de contratación descargables; cambios de condiciones | RF23–RF25 |
| Mediano plazo | Avances con fotos y registro de pagos directos | RF27–RF29 |
| Mediano plazo | Cancelaciones, calificaciones e historial | RF33, RF34, RF36 |
| Mediano plazo | Verificación de prestadores, moderación, incidencias y reportes | RF07, RF37, RF38, RF40–RF45 |
| Mediano plazo | Módulo de administración: debe definir un procedimiento seguro para crear cuentas administrativas (fuera del registro público), su autenticación reforzada y su panel. 001 no las incluye | HU25–HU28, RF04, RF39–RF45 |
| Largo plazo | Cobro de planes o servicios de la plataforma mediante una pasarela de pagos | RC11 |
| Largo plazo | Ampliación a otras provincias de Ayacucho y a otras regiones | RC03 |
| Largo plazo | Aplicación móvil nativa, si el uso lo justifica | — |
| Largo plazo | Extraer un módulo como servicio independiente si su carga lo exige | ADR-001 |

## 3. Lo que no se promete

- La plataforma **no procesa ni garantiza pagos** del trabajo: el cliente paga directamente al prestador (RC10).
- La plataforma **no es responsable de la ejecución** del trabajo ni de su calidad técnica (RC12).
- La plataforma **no lee** las conversaciones por llamada o WhatsApp (RC13).
- La disponibilidad del prestador es **declarada**, no una reserva garantizada (RF06).
- Las metas de calidad son **propuestas** hasta que se midan en un despliegue real. EQ-01 y EQ-03 de la 002 se midieron en un entorno de validación local con datos ficticios (T082 y T083): orientan, pero no equivalen a una medición en producción.
- La verificación de prestadores (RF07) y el panel administrativo pertenecen a la 012; la 002 solo incluye la gestión de categorías (RF39).

---

[Índice del proyecto](../../README.md)
