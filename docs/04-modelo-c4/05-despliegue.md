# Diagrama de despliegue

> **Proyecto:** Plataforma web para la búsqueda y contratación de servicios de construcción civil en Ayacucho.  
> **Modelo:** C4 · vista complementaria de despliegue.  
> **Estado:** entorno de producción propuesto; el proveedor de nube se elegirá al implementar.

## 1. Objetivo

Mostrar en qué nodos se ejecutan los contenedores del nivel 2 y cómo llega una nueva versión a producción.

## 2. Diagrama

![Despliegue de la plataforma](../../img/despliegue.png)

[Editar en Draw.io](../../img/fuentes-svg/despliegue.drawio) · [Versión SVG](../../img/fuentes-svg/despliegue.svg)

## 3. Nodos

| Nodo | Qué se ejecuta | Motivo |
|---|---|---|
| Dispositivo del usuario | Navegador web en celular, tableta o computadora. | La aplicación es responsive (RC01). |
| CDN · hosting estático | Archivos de la aplicación web generados por Vite. | Entrega rápida y económica de archivos que no cambian. |
| Servidor en la nube · Docker | API de la plataforma y proceso de avisos, desde la misma imagen. | Un solo despliegue del monolito modular (ADR-001). La API puede tener varias réplicas detrás de un proxy HTTPS. |
| Servicios gestionados | PostgreSQL, Redis y almacenamiento de objetos. | Respaldos y mantenimiento a cargo del proveedor. En la 002: PostgreSQL es la fuente de verdad y lleva la auditoría y la revisión durable; Redis es una caché de lectura con respaldo en PostgreSQL; el almacenamiento de objetos guarda las fotografías en un **bucket privado** de acceso exclusivo del backend. |
| GitHub | Repositorio, GitHub Actions y registro de imágenes. | Cada cambio ejecuta las pruebas y construye la imagen antes de desplegarse. |

## 4. Comunicación

| Origen | Destino | Protocolo | Observación |
|---|---|---|---|
| Navegador | CDN | HTTPS | Descarga la aplicación web. |
| Navegador | API | HTTPS con JSON | API REST (RC06). |
| API | PostgreSQL · Redis · objetos | SQL · Redis · HTTPS | Red privada del proveedor. Redis tiene tiempo de espera acotado y, si falla, la API consulta PostgreSQL. |
| API | IA y mapas | HTTPS | Tiempo límite de 8 s y alternativa manual (ADR-007). |
| Proceso de avisos | Notificaciones | HTTPS | Reintentos a 1, 5, 15, 60 y 240 minutos (ADR-009). |

### Entorno de validación local de la 002

Para la validación se usa un despliegue local equivalente: un proxy HTTPS con una CA local (`https://localhost:8444`) delante de la API y de la interfaz, PostgreSQL 18, Redis, un almacenamiento de objetos compatible con S3 (Garage) con bucket privado y un buzón de correo de pruebas. Admite varias réplicas de la API detrás del proxy y un procedimiento de respaldo y restauración coordinados (base de datos y objetos) que se ensayó en un proyecto aislado. No es el entorno de producción.

Las credenciales de la base de datos y de los proveedores se configuran como variables de entorno del servidor; nunca se guardan en el repositorio ni llegan al navegador (RC09).

---

[Índice del proyecto](../../README.md) · [Nivel 4](04-nivel4-codigo.md)
