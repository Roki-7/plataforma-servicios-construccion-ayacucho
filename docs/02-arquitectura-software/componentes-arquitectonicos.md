# Componentes arquitectónicos

![Componentes arquitectónicos de la plataforma de construcción civil](../../img/componentes-arquitectonicos.png)

[Archivo editable en Draw.io](../../img/fuentes-svg/componentes-arquitectonicos.drawio) · [Versión SVG](../../img/fuentes-svg/componentes-arquitectonicos.svg)

La plataforma incluye una aplicación web responsive y un backend con API REST, diez módulos de negocio, repositorios y adaptadores. La base de datos relacional y los archivos son recursos utilizados por el backend; no son módulos de negocio.

Los diez módulos se agrupan en tres áreas de negocio: **Oferta** (Usuarios y acceso, Prestadores, Catálogo y búsqueda), **Contratación** (Solicitudes y visitas, Cotizaciones, Contrataciones y acuerdos, Seguimiento y pagos registrados, Calificaciones) y **Soporte** (Notificaciones, Administración e incidencias). Las áreas ordenan la lectura; cada módulo sigue siendo independiente.

Los módulos se comunican mediante operaciones públicas. Las flechas de esta vista representan llamadas durante la ejecución. La pasarela de pagos se muestra como ampliación futura para cobrar planes o servicios de la plataforma; los trabajos se pagan directamente al prestador.

El módulo Contrataciones y acuerdos es el único que cambia el estado de una contratación. Seguimiento y pagos registrados guarda avances y pagos y solicita esas transiciones mediante la API pública de Contrataciones. Calificaciones consulta a Contrataciones si el trabajo está finalizado. Cotizaciones registra si cada propuesta quedó seleccionada o no seleccionada cuando Contrataciones se lo indica.
