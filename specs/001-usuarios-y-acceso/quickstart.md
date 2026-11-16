# Guía de validación — 001 Usuarios y acceso

**Estado actual**: solo diseño. No existen aún backend, frontend, compose, scripts
npm ni tests de la aplicación. Los comandos siguientes son el contrato de ejecución
que deberá entregar la implementación después de `$speckit-tasks`; no se han
ejecutado ni se deben presentar como comandos disponibles hoy.
El ejemplo vacío de Contrataciones no sustituye esa implementación.

## Referencias y prerrequisitos

- [Plan](plan.md), [modelo](data-model.md), [contrato](contracts/openapi.json),
  [flujos de API](contracts/README.md) y [matriz de 53 escenarios](test-matrix.md).
- Node.js 24 LTS >=24.15, Docker con Compose y npm compatible.
- La futura implementación debe incluir manifiestos y lockfiles independientes
  en `tecnologia/backend` y `tecnologia/frontend`.
- El backend debe entregar `tecnologia/backend/Dockerfile` y `.dockerignore`
  (T001); construcción/arranque inicial en T023 después de existir T022 y repetición
  de la imagen final de las siete historias en T116. Son artefactos futuros.
- Entorno de validación aislado, con cuentas y correos ficticios; SMTP se captura
  en Mailpit, no se envía a personas. No usar credenciales de producción.
- Origen común HTTPS local `https://localhost:8443`, certificado local confiable
  y proxy a frontend/API. No desactivar Secure para hacer funcionar los tests.
- Catálogo de contraseñas de prueba determinista solo en modo de validación;
  producción debe usar el snapshot completo aprobado y no puede iniciar en modo fixture.

## 1. Preparación prevista

Desde la raíz del repositorio, una vez que existan los artefactos de implementación:

```powershell
npm --prefix tecnologia/backend ci
npm --prefix tecnologia/frontend ci
docker compose -f tecnologia/compose.yaml up -d postgres redis correo objetos
npm --prefix tecnologia/backend run dev:prepare -- --validation
npm --prefix tecnologia/backend run db:migrate
npm --prefix tecnologia/backend run storage:init
npm --prefix tecnologia/backend run security:catalog:prepare -- --fixture
npm --prefix tecnologia/backend run test:seed
```

`dev:prepare --validation` debe generar configuración local y claves efímeras
ignoradas por Git, preparar TLS local y comprobar dependencias sin tocar un entorno
productivo. Los seeds solo aceptan una DB de validación identificada; no borran
ni reinicializan datos reales. Ninguno de esos scripts se escribe en esta fase.

| Dependencia | Comprobación esperada |
|---|---|
| PostgreSQL 18 | Migraciones aplicadas, índice de correo único y tablas/constraints del modelo. |
| Redis | Disponible para la arquitectura; sin sesiones, permisos ni datos privados de 001. |
| Mailpit | SMTP local y bandeja/API de correos capturados para recuperar/verificar/avisar. |
| Garage/S3 compatible | Bucket privado de prueba preparado, sin exposición pública; solo referencias en DB. |
| Catálogo fixture | Manifiesto y checksum conocidos; caso común/comprometido y control permitido reproducibles. |
| TLS/proxy | Mismo origen HTTPS; certificado confiable; cookies conservan Secure y Path. |

## 2. Arranque previsto

En terminales independientes:

```powershell
npm --prefix tecnologia/backend run start:validation
npm --prefix tecnologia/frontend run dev -- --host 127.0.0.1
docker compose -f tecnologia/compose.yaml up -d proxy
```

El backend de validación escucha internamente en 3000 y Vite en 5173; el proxy
publica8443 y enruta `/api/v1` al backend. Estos puertos son configuración local,
no una obligación del despliegue real. Worker de correo dentro del mismo backend,
no proceso/cola Redis independiente.

```powershell
curl.exe --cacert tecnologia/.local/tls/ca.crt https://localhost:8443/api/v1/salud
```

Resultado esperado tras implementar:200 con estado disponible y sin secretos.
Preparación falla si PostgreSQL o el catálogo requerido no están listos; una caída
de Redis no hace fallar001. Un200 local no demuestra disponibilidad mensual EQ-02.

## 3. Controles automatizados previstos

```powershell
npm --prefix tecnologia/backend run lint
npm --prefix tecnologia/frontend run lint
npm --prefix tecnologia/backend run typecheck
npm --prefix tecnologia/frontend run typecheck
npm --prefix tecnologia/backend run build
npm --prefix tecnologia/frontend run build
npm --prefix tecnologia/backend run test:unit
npm --prefix tecnologia/backend run test:integration -- --runInBand
npm --prefix tecnologia/backend run test:contract
npm --prefix tecnologia/backend run test:architecture
npm --prefix tecnologia/frontend run test:unit
npm --prefix tecnologia/frontend run test:e2e
npm --prefix tecnologia/backend run test:coverage:001
```

Integración usa PostgreSQL real, no SQLite ni repositorios de memoria para
unicidad/locks/revocación. Contrato lee el OpenAPI versionado de esta funcionalidad.
Playwright usa backend real, Mailpit y datos aislados en 360/768/1366 px y
Chromium/Firefox/WebKit. Registrar nombres y versiones de navegadores.

`test:coverage:001` debe contrastar los CA implementados/ejecutados con los 53 IDs
de spec y matriz; falla por ID sin prueba o por resultado fallido. No confundir
declarar cobertura con aprobar escenarios. Guardar JUnit/HTML, commit, entorno
y versión del corpus. Los scripts y reportes son futuros; hoy no existen.

Después de preparar DB/corpus y de disponer del entrypoint compilado, T023 debe
entregar esta comprobación adicional, también repetida por CI en T116:

```powershell
npm --prefix tecnologia/backend run test:container
```

El script futuro construye la imagen Linux multietapa desde el Dockerfile de
T001 y la arranca con dependencias y configuración aisladas. Verifica usuario
sin privilegios, carga de Argon2 nativo, salud 200 con dependencias listas y
503 al configurar DB/corpus no disponibles en instancias separadas de prueba,
sin detener los servicios usados por otras suites. Configuración/corpus de
validación se montan fuera de las capas; producción rechaza fixture. No publicar
puertos ni usar credenciales reales; limpiar únicamente contenedores efímeros
creados por esta prueba y conservar digest de imagen/entorno/resultados sanitizados.
En T116 comprobar además el worker del mismo backend y un recorrido de correo
capturado en Mailpit con las historias integradas. La receta puede prepararse en
T001; no afirmar construcción/arranque funcionales antes de T022/T023.

Los cierres de US3 (T062) y US5 (T076) validan sus suites sin esperar entre sí.
US5 dispone de la proyección compartible de T069; US4 la integra y verifica
transversalmente en T082. En el cierre global T110 añade regresión conjunta de
recuperación/edición de perfil, con dependencias explícitas de T062 y T076,
conservando los 53 CA originales y la revocación de accesos tras reset.

## 4. Recorridos de validación de extremo a extremo

| Paso | Acción con datos ficticios | Resultado esperado |
|---|---|---|
| Registro | Cliente, prestador y ambos; con y sin opcionales, y foto válida opcional | Una cuenta por correo, perfiles elegidos, privacidad registrada, sin administrador. |
| Duplicado | Repetir correo cambiando mayúsculas y con concurrencia | No duplicación; conflicto controlado. |
| Acceso | Correo y contraseña íntegra; variantes de mayúsculas | Misma cuenta; acceso propio, cookie HttpOnly/Secure y Bearer solo en memoria. |
| Perfil | Editar nombre, teléfono, distrito/foto y actualizar con versión vieja | Valores válidos persistidos; obsoleto409; datos ajenos no visibles. |
| Perfil faltante | Confirmar adición desde cuenta con un solo perfil | Misma identidad/datos; sin verificación RF07 ni inserción de RF06. |
| Correo | Pedir cambio con recencia válida, abrir Mailpit y verificar destino | Anterior sigue hasta confirmar; luego mismo UUID y nuevo correo de acceso. |
| Contraseña | Flujo específico con actual correcta y nueva confirmada | Nueva autentica; anterior no; PATCH no permite cambio directo. |
| Recuperación | Solicitar con correo existente e inexistente | Exactamente el mensaje genérico aprobado; correo solo para el existente. |
| Reset | Presentar token válido con nueva confirmada, manteniendo varias sesiones abiertas | Un cambio, todas las sesiones/enlaces anteriores inválidos, aviso y nuevo login exigido. |
| Replay | Reenviar reset con misma clave/datos y luego con clave distinta | Primero resultado anterior sin efectos; después rechazo de enlace usado. |
| Cierre | Reutilizar Bearer y renovación después de cerrar | Ambos rechazados inmediatamente. |

Los enlaces se abren como pantalla sin mutación por GET; el cliente conserva el
token solo en memoria tras limpiar el fragmento. No usar herramientas de captura
que publiquen secretos. Registrar solo IDs de casos y resultados sanitizados.

## 5. Límites y fallas sin esperar minutos reales

Ejecutar tests con `Reloj` inyectado solo por composición de validación; no crear
endpoints productivos para mover el tiempo ni aceptar fechas de autenticación del cliente.

| Regla | Instantes/casos mínimos | Resultado |
|---|---|---|
| Autenticación reciente | 299.999,300,300.001 s y sin marca | Admitir, admitir, pedir contraseña, pedir contraseña. |
| Renovación/actividad | Solicitud posterior a 300 s pese a actividad y refresh | No reiniciar recencia; comprobar servidor. |
| Recuperación | 1799.999,1800,1800.001 s | Válido, vencido, vencido. |
| Acceso y bloqueo | 899.999,900,900.001 s | Expiración o fin de espera en el límite documentado. |
| Renovación absoluta | Instante anterior a 7 d y a 7 d | Renovar antes, rechazar al límite; no deslizarlo. |
| Contraseña | 14,15,128,129 puntos de código; espacios y Unicode multibyte | Aplicar15–128 completos sin corte ni requisitos de mezcla. |
| Sesiones/recovery races | Reset/reset, reset/login y reset/refresh con barreras | Ningún acceso con credencial anterior después del commit. |
| Correo en uso | Dos confirmaciones para el mismo destino | Solo una; otra409 y correo anterior intacto. |

Simular fallas SMTP, worker después de entregar, DB entre escrituras y Redis fuera
de servicio. Esperado: no efectos parciales ni bypass, aviso reintentable sin revertir
reset, ningún token en logs, ningún acceso dependiente de Redis.
Comprobar CSRF/origen, fotos ajenas, tamaño/contenido de imágenes y limpieza de objetos.

T113 debe comprobar también los rechazos de transporte de OpenAPI 1.0.1:

| Caso negativo aislado | Resultado previsto |
|---|---|
| Cuerpo >65536 bytes ordinarios, incluidos GET/cierre/refresh con cuerpo inesperado | 413 CUERPO_DEMASIADO_GRANDE |
| Registro con fotografía o carga >14000000 bytes de transporte | 413 CUERPO_DEMASIADO_GRANDE |
| Foto decodificada >10000000 bytes, dentro del transporte admitido | 413 ARCHIVO_DEMASIADO_GRANDE |
| Cuerpo no vacío en operación sin requestBody, dentro del límite | 400 DATOS_INVALIDOS |
| Origin ausente en cualquiera de las 13 mutaciones | 400 CABECERA_REQUERIDA |
| Origin malformado / origen válido ajeno | 400 DATOS_INVALIDOS / 403 ORIGEN_NO_ADMITIDO |
| UUID/token malformados, JSON o MIME/codificación no admitidos | 400 DATOS_INVALIDOS |
| Credencial ausente/inválida / CSRF ausente/incorrecto | 401 según credencial / 403 CSRF_NO_VALIDO |

Usar peticiones válidas de control, modificar una sola condición y comprobar el
límite exacto/exceso de un byte, estado protegido intacto y código permitido por
el HTTP. GET no exige Origin. Los demás 404/409/422/429/503 se rigen por la tabla
de rechazos de `contracts/README.md`; token de formato correcto pero vencido/usado
se rechaza semánticamente con 422, conservando la excepción de replay exacto acordada.

## 6. Criterio de aceptación y límites

Revisar53/53 CA y controles X-01–X-08 de [matriz](test-matrix.md), además de PR04,
PR07, PR12, PR13, PR14 y salud PR02 aplicables. Ejecutar lint, types y build en CI.
La revisión humana compara los resultados con spec y constitución antes de cerrar.

No ejecutar aquí pruebas de contratación ni interpretar las metas EQ-01/EQ-06
como SLA de registro. k6 se usará para caracterizar hashing/sesiones sin prometer
capacidad no medida. Correo real por SES y objetos de producción requieren
configuración del despliegue; esta guía local no realiza esa configuración.
