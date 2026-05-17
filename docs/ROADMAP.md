# Roadmap de Implementacion

## Stack decidido
- Astro
- React
- TypeScript
- Tailwind CSS

## Objetivo del producto
Construir un estudio web de grabacion y edicion tipo streaming, sin registro y 100% local, para grabar pantalla + camara + audio y luego editar el resultado en un entorno multipista.

## Sprint 1
- Base del sitio en Astro
- Paginas publicas SEO
- Ruta `/studio`
- Captura de pantalla
- Captura de camara
- Captura de microfono
- Audio de sistema cuando exista
- Compositor canvas con preview real
- Formatos 16:9, 9:16 y 1:1
- Camara circular, cuadrada o vertical
- Borde personalizable
- Posiciones rapidas de camara por botones y hotkeys
- Grabacion local WebM

## Sprint 2
- Entrada directa al editor al terminar de grabar
- Timeline multipista
- Pistas de video, audio, imagen y texto
- Trim y reordenamiento de clips
- Volumen, mute y duplicado
- Importacion de medios externos
- Export WebM desde editor

Estado:
- implementado en base funcional
- pendiente pulido fino del timeline y guardado local de proyectos

## Sprint 3
- Biblioteca local con IndexedDB
- Guardado de proyectos
- Borrado local total
- Pulido UX y performance
- Hardening para sesiones reales de tutoriales

Estado:
- biblioteca local implementada
- guardado y carga de proyectos implementados
- borrado local total implementado
- pendientes mejoras de performance y refinamiento de UX

## Restricciones permanentes
- Sin backend
- Sin cuentas
- Sin subir archivos a terceros
- Privacidad total del usuario
- Deploy estatico compatible con cPanel
