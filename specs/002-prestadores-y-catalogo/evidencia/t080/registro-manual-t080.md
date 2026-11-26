# T080 · Registro de recorridos manuales (EQ-07 / PR07)

Rellene este archivo a mano. Las capturas van en `computadora\capturas\` y `celular\capturas\`, con el nombre `R<n>-<ancho>px-<paso>.png`
(por ejemplo `R3-390px-filtros.png`). Para cada recorrido marque **PASÓ**, **FALLÓ** o **NO APLICA** y escriba en «Observaciones» lo que vio.
Si algo falla, anote qué hizo, qué esperaba, qué ocurrió y el nombre de la captura. No corrija nada hasta terminar los recorridos.

## 1. Dispositivos

| Dato | Computadora | Celular |
|---|---|---|
| Fecha y hora | 2026-11-25 (hora no registrada) — informado | |
| Modelo del equipo | PENDIENTE (laptop física, Windows) | |
| Sistema operativo y versión | Windows 11 (informado; compilación no registrada) | |
| Navegador y versión (menú «Acerca de») | Opera GX 140.0.6074.48 (informado) | |
| Ancho de pantalla en píxeles CSS (vea «Cómo obtener el ancho») | PENDIENTE (`innerWidth` sin medir) | |
| Orientación (celular) | | vertical / horizontal |
| Dirección usada | https://localhost:8444 | https://IP-DEL-PC:8445 |
| Candado/certificado válido sin avisos | PENDIENTE de confirmar (informado: carga correctamente) | sí / no |
| ¿Zoom o tamaño de texto distinto del predeterminado? | | |

Cómo obtener el ancho: en el navegador del equipo abra la página, pulse `F12`, pestaña Consola, escriba `innerWidth` y Enter (computadora).
En el celular use la captura del recorrido R1: anote el ancho de la captura en píxeles dividido por el factor de densidad (por ejemplo 1170 px / 3 = 390),
o consulte el ancho CSS de su modelo (valor «viewport» publicado por el fabricante). Registre cuál método usó.

## 2. Recorridos (marque cada uno en cada dispositivo)

| Id | Recorrido | Computadora | Celular | Observaciones y capturas |
|---|---|---|---|---|
| R1 | Visitante: abrir la búsqueda y ver resultados | OBSERVADO (sin capturas) |  | Búsqueda correcta. Falta ancho `innerWidth` y captura `R1-<ancho>px-inicio.png`. |
| R2 | Visitante: aplicar filtros (categoría, zona, disponibilidad), paginar y provocar «sin coincidencias» | OBSERVADO (sin capturas) |  | Filtros, «sin coincidencias» y «Quitar filtros»; Construcción › Albañilería = 4 servicios; teclado y foco. Zona/disponibilidad/paginación no detallados. |
| R3 | Visitante: abrir un servicio y el perfil del prestador (avisos de calificaciones y verificaciones) | OBSERVADO (sin capturas) |  | Detalle y perfiles públicos correctos; avisos presentes. Falta confirmar ausencia de datos privados y estrellas/insignias. |
| R4 | Titular: crear cuenta o iniciar sesión y completar el perfil profesional | OBSERVADO (sin capturas) |  | Validaciones del registro correctas; perfil profesional guardado. Nombre `1234` aceptado = conforme a la regla vigente (mejora futura, no bloquea). |
| R5 | Titular: agregar un trabajo anterior con una foto y comprobar que se ve | OBSERVADO (sin capturas) |  | Trabajos anteriores creados; fotografías agregadas y eliminadas. Falta confirmar que la foto se veía en el perfil público. |
| R6 | Titular: publicar, editar, pausar, reactivar y retirar un servicio | OBSERVADO; estado final corroborado en la base |  | Servicio ficticio de pintura: publicado, editado, pausado (oculto en público), reactivado (reaparece) y retirado. Base de validación: «Pintura de interiores - Prueba T080 editado», RETIRADO, versión 5; 4 servicios públicos. |
| R7 | Errores: dejar campos vacíos al guardar y leer los mensajes | OBSERVADO parcial (sin capturas) |  | Mensajes junto a los campos obligatorios del servicio y del registro. No informado: perfil profesional ni foco al primer error. |
| R8 | Teclado (computadora): hacer R2 y R6 sin ratón (Tab, Mayús+Tab, Enter, Espacio, flechas) | OBSERVADO parcial (sin capturas) | no aplica | Operación con Tab y Enter confirmada (R2 con foco visible). Falta confirmar R6 completo con teclado, foco visible, orden lógico y sin trampas. |
| R9 | Lectura: ¿el texto se lee sin acercar, sin cortes ni controles superpuestos, sin desplazamiento horizontal? | OBSERVADO (sin capturas) |  | Zoom 150 %, 200 % y 300 % sin superposiciones visibles en las capturas. No informado: desplazamiento horizontal. |

## 3. Criterios para marcar PASÓ

- La acción se completa sin ayuda y el resultado es el esperado.
- No hay desplazamiento horizontal de la página, texto cortado ni botones tapados o fuera de pantalla.
- Cada botón y campo se puede pulsar o enfocar con comodidad y tiene un nombre claro.
- Los avisos y errores aparecen junto a lo que los causa y se pueden leer.
- En computadora, el foco de teclado siempre se ve y avanza en un orden lógico; nunca queda atrapado.

## 4. Incidencias

| Id | Dispositivo | Recorrido | Qué hizo | Esperado | Ocurrió | Captura |
|---|---|---|---|---|---|---|
| | | | | | | |

## 5. Conclusión de la persona que probó

- Computadora: PASÓ / FALLÓ con incidencias
- Celular: PASÓ / FALLÓ con incidencias
- Nombre y fecha:

## 6. Sesión informada: laptop física con Opera (2026-11-25) — NO sustituye evidencia

Fuente: relato de la persona responsable. **Las capturas se compartieron en otra conversación (ChatGPT) y todavía no están en este repositorio**: `computadora\capturas\` y `celular\capturas\` siguen vacías (0 archivos al registrar esto). Hasta que los archivos existan y se verifiquen, ningún recorrido se marca **PASÓ** y T080 sigue `[ ]`.

| Recorrido | Informado como comprobado | Pendiente |
|---|---|---|
| R1 | Carga; sin cortes ni superposiciones | Captura, `innerWidth`, versión de Opera, modelo, candado |
| R2 | Categoría › subcategoría sin coincidencias y «Quitar filtros»; «Construcción › Albañilería» con 4 servicios; teclado (Tab, flechas, Enter); foco visible; sin problemas de distribución | Zona y disponibilidad, filtros combinados, paginación; capturas `R2-<ancho>px-filtros/-sin-coincidencias/-paginacion.png` |
| R3 | Detalle, perfil con experiencia, zona, disponibilidad y servicios; avisos de calificaciones y verificaciones; Alt+←; Tab y Enter | Confirmar ausencia de correo, documento, dirección exacta, estrellas e insignias; capturas `R3-<ancho>px-servicio/-perfil/-avisos.png` |
| R4 | Formulario; errores con envío vacío (nombre, correo, contraseña, perfil, privacidad); correo inválido, contraseña corta, confirmación distinta, teléfono con letras | Registro correcto + correo en `http://127.0.0.1:8026` + sesión + perfil profesional guardado; capturas `R4-<ancho>px-registro/-perfil-guardado.png` y `R7-<ancho>px-errores.png` |
| R5, R6, R8 formal, R9 | No informados | Todo |
| Android físico | No realizado | R1 a R7 y R9 |

### Observación de R4: «Nombre para mostrar» acepta `1234`

- **Regla vigente (001, enmienda de 2026-11-25, FR-033):** obligatorio, hasta 200 caracteres, sin caracteres de control y bien formado. El contrato y el servidor no exigen letras, y la ayuda de la 001 dice que admite personas y empresas. Por tanto `1234` es **conforme a lo especificado**: no es un defecto de implementación.
- **Es una laguna de producto:** permite nombres sin ningún significado (`1234`, `---`, `...`, `&&`).
- **Recomendación (no aplicada):** exigir **al menos una letra Unicode** (`\p{L}`), sin otras restricciones. Seguirían siendo válidos «Constructora 3 Hermanos», «A1 Construcciones», «3M Ayacucho», «Ñawpa Wasi», «Q'ero», «José Quispe-Huamán», «Pérez & Hijos S.A.C.» y nombres con tildes, ñ, apóstrofo y comilla tipográfica. Se rechazarían los nombres sin letras. Mensaje propuesto: «Ingrese un nombre que contenga al menos una letra.» Sin restringir dígitos ni signos, ni imponer un mínimo de caracteres.
- **Alcance:** nombre del registro y de «Editar mi perfil», en servidor y navegador. Habría que hacerla como enmienda controlada de la 001 (FR-033, CA-PER-09, contrato, pruebas, regresión) y decidir si los nombres existentes sin letra se revalidan solo cuando el titular los cambie, como en la enmienda anterior. **No se ha modificado ninguna regla.**

## 7. Consolidación de la sesión de laptop (Opera GX 140.0.6074.48, Windows 11, 2026-11-25)

**Estado:** observaciones manuales informadas por la persona responsable para R1 a R9. **Las capturas no están en el repositorio** (`computadora\capturas\` = 0 archivos, `celular\capturas\` = 0): se compartieron en otra conversación y deben copiarse. Hasta entonces son observaciones, no evidencia, y ningún recorrido figura como PASÓ.

**Corroboración independiente (solo lectura de la base de validación, sin cambios):** existe el servicio «Pintura de interiores - Prueba T080 editado» en estado RETIRADO, versión 5; hay 4 servicios PUBLICADOS visibles en la API pública (el retirado no aparece); hoy se registran 1 perfil profesional, 3 trabajos y 3 fotografías en la base. Es coherente con R5 y R6; no sustituye capturas.

**Criterios específicos todavía no demostrados (solo confirmaciones breves, no repeticiones):**
1. Ancho CSS (`innerWidth`) y modelo de la laptop (datos de PR07).
2. R3: que no aparecen correo, documento, dirección exacta ni estrellas o insignias.
3. R5: que la foto se veía en el perfil público.
4. R7: errores en el perfil profesional y que el foco va al primer error.
5. R8: que R6 completo se hizo con teclado, con foco visible, orden lógico y sin quedar atrapado.
6. R9: que no hubo desplazamiento horizontal con zoom 150–300 %.
7. Las capturas, copiadas al directorio y verificadas por nombre.
Mejora futura que no bloquea: nombre `1234` aceptado (sección 6).

**Pendiente para cerrar T080:** Android físico (R1, R2, R3, R5, R6, R7 y R9, con datos del dispositivo y capturas) y la documentación de PR07 en `implementation-status.md`.

## 8. Conformidad y decisión de la persona responsable (2026-11-25)

- Conformidad con el funcionamiento observado de la plataforma en las funciones probadas en la laptop (Opera GX 140.0.6074.48, Windows 11).
- Decisión de **no realizar más pruebas manuales por ahora**.
- **Samsung Galaxy A32 físico: pruebas NO ejecutadas** (columna «Celular» sin resultados). No se preparó acceso por red local ni se cambió firewall, certificados o red.
- Esta conformidad es aceptación funcional informada; no sustituye la evidencia exigida por T080. **T080 permanece pendiente.** Informe: `informe-t080-usabilidad-accesibilidad.md`.

## 9. Cierre administrativo por excepción (2026-11-25)

El responsable del producto autorizó expresamente cerrar T080 por excepción documentada. Es un cierre **administrativo**, no una aprobación técnica completa: el celular físico no se ejecutó, las capturas manuales no se incorporaron y los recorridos de la sección 2 permanecen como observaciones. Ver la sección 10 del informe.
