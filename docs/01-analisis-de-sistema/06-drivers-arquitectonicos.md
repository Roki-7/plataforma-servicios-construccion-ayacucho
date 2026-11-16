# Drivers arquitectónicos

Los drivers arquitectónicos son los requisitos, atributos de calidad y restricciones que influyen de manera importante en la organización del sistema.

Ayudan a definir los componentes, sus responsabilidades, las dependencias y la comunicación con servicios externos. Las soluciones para atenderlos se justificarán en las decisiones arquitectónicas.

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | **Atender el crecimiento de usuarios y operaciones.** La plataforma debe permitir aumentar la cantidad de usuarios, servicios, solicitudes y contrataciones. | AC03 – Escalabilidad. | Influye en la organización de los componentes, el almacenamiento y la forma de ampliar los recursos cuando aumente la demanda. |
| DA02 | **Mantener búsquedas y consultas rápidas.** La plataforma debe responder adecuadamente cuando varios usuarios buscan servicios, consultan perfiles o comparan cotizaciones. | AC01 – Rendimiento; RF09, RF10 y RF19. | Influye en el diseño de las consultas, la organización de los datos y la cantidad de información enviada en cada respuesta. |
| DA03 | **Proteger cuentas, documentos y operaciones.** Cada usuario debe acceder únicamente a la información y acciones que le corresponden. | AC04 – Seguridad; RF04; RC09 – Protección de credenciales; RC14 – Tratamiento de datos personales. | Influye en la autenticación, los permisos, el acceso a documentos y la separación entre información pública y privada. |
| DA04 | **Evitar contrataciones duplicadas y cambios no aceptados.** Las acciones simultáneas o repetidas no deben crear dos contrataciones activas para una solicitud ni modificar las condiciones sin la aceptación correspondiente. | AC09 – Integridad de la información; RF20, RF21, RF23 y RF25. | Influye en el control de operaciones simultáneas, el guardado de datos y la conservación de versiones y confirmaciones. |
| DA05 | **Mantener las funciones independientes ante fallas externas.** Si falla la IA, las notificaciones o los mapas, deben continuar las operaciones que no necesitan esos servicios. | AC08 – Resiliencia; AC02 – Disponibilidad; RF11 y RF35; RC08 – Condiciones de servicios externos. | Influye en la separación de las integraciones, el manejo de errores y los reintentos, evitando que una falla secundaria detenga el proceso principal o duplique registros. |
| DA06 | **Permitir sustituir el servicio de IA sin cambiar las reglas del negocio.** Un cambio de proveedor no debe obligar a modificar las reglas de búsqueda y contratación. | AC05 – Mantenibilidad; RF11; RC08 – Condiciones de servicios externos. | Influye en cómo se conecta la IA, cómo se validan sus respuestas y cómo se separa la interpretación de necesidades de la consulta de prestadores registrados. |
| DA07 | **Comunicar la aplicación web y el backend mediante una API REST.** La interfaz y las funciones del servidor deben intercambiar información mediante este mecanismo. | RC06 – Comunicación mediante API REST. | Condiciona la separación entre interfaz y backend, la estructura de las solicitudes y respuestas y la forma de comunicar errores. |
| DA08 | **Facilitar cambios y ampliaciones.** Deben poder corregirse funciones e incorporarse capacidades futuras, como el cobro por servicios de la plataforma, sin afectar innecesariamente otras partes. | AC05 – Mantenibilidad; RC11 – Cobro de la plataforma en una etapa futura. | Influye en la división por responsabilidades, los límites entre componentes y el control de sus dependencias. |
| DA09 | **Adaptar la contratación a servicios rápidos y obras grandes.** Una reparación pequeña debe requerir pocos pasos, mientras una obra puede necesitar documentos, etapas y avances. | AC06 – Usabilidad; RF20, RF24 y RF27. | Influye en la organización del proceso y sus datos, permitiendo utilizar documentos y seguimiento por etapas únicamente cuando el trabajo lo requiera. |
| DA10 | **Permitir el uso desde distintos dispositivos.** Las tareas principales deben poder realizarse desde celulares, tabletas, computadoras y laptops. | AC07 – Adaptabilidad; RC01 – Aplicación web responsive. | Influye en la organización de la interfaz, la navegación, los formularios y la presentación de información en diferentes pantallas. |
| DA11 | **Conservar documentos, evidencias e historial con accesos diferenciados.** Las partes necesitan consultar sus acuerdos y avances, mientras la administración debe poder revisar las acciones administrativas autorizadas. | RF23, RF24, RF25, RF27, RF36 y RF45; AC04 – Seguridad; AC09 – Integridad de la información. | Influye en el almacenamiento de archivos y versiones, la identificación de responsables y fechas y la separación de permisos entre el historial del trabajo y la auditoría administrativa. |

## Priorización de los drivers

Los drivers se priorizan con un árbol de utilidad, como en el método ATAM. Cada driver se califica según su **importancia para el negocio** y su **dificultad técnica**: Alta (A), Media (M) o Baja (B). Los drivers con importancia y dificultad altas son los que más condicionan la arquitectura y se atienden primero.

| Prioridad | ID | Driver | Importancia | Dificultad | Escenario de calidad |
|---|---|---|---|---|---|
| 1 | DA04 | Evitar contrataciones duplicadas y cambios no aceptados | A | A | EQ-09 |
| 2 | DA03 | Proteger cuentas, documentos y operaciones | A | M | EQ-04 |
| 3 | DA09 | Adaptar la contratación a servicios rápidos y obras grandes | A | M | EQ-06 |
| 4 | DA11 | Conservar documentos, evidencias e historial con accesos diferenciados | A | M | EQ-04, EQ-09 |
| 5 | DA05 | Mantener las funciones independientes ante fallas externas | M | M | EQ-02, EQ-08 |
| 6 | DA02 | Mantener búsquedas y consultas rápidas | M | M | EQ-01 |
| 7 | DA01 | Atender el crecimiento de usuarios y operaciones | M | M | EQ-03 |
| 8 | DA08 | Facilitar cambios y ampliaciones | M | M | EQ-05 |
| 9 | DA07 | Comunicar la aplicación web y el backend mediante una API REST | A | B | — |
| 10 | DA10 | Permitir el uso desde distintos dispositivos | A | B | EQ-07 |
| 11 | DA06 | Permitir sustituir el servicio de IA sin cambiar las reglas del negocio | M | B | EQ-05 |

DA07 y DA10 son importantes, pero su dificultad es baja: provienen de restricciones del proyecto (RC06 y RC01) y tienen soluciones conocidas. DA04 es el driver principal: de él dependen la elección del monolito modular, la base de datos relacional y los controles de concurrencia e idempotencia.

