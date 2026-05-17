# Arquitectura Actual

## Vision
Sitio estatico indexable con Astro y aplicacion cliente para el estudio en React. Todo el procesamiento multimedia sigue ocurriendo en el navegador.

## Capas
1) Sitio publico
- Astro
- Landing, privacidad y ayuda
- Metadatos SEO y sitemap

2) Studio App
- React + TypeScript
- Carga solo en `/studio`
- Sin SSR para APIs multimedia

3) Core multimedia
- `capture`: getDisplayMedia y getUserMedia
- `audio`: mezcla por Web Audio API
- `compositor`: Canvas 2D + captureStream
- `recorder`: MediaRecorder con fallback de mimeType

4) Capas futuras
4) Editor
- Timeline multipista inicial
- Importacion de video, audio, imagen y texto
- Export WebM

5) Storage
- IndexedDB para grabaciones y proyectos
- Borrado local total

6) Export
- WebM actual
- MP4 posterior y opcional

## Decisiones activas
- Formato default: WebM
- MP4: posterior y opcional
- No backend, no cuentas, no storage remoto
- Preview del studio = resultado final

## Deploy
- Salida estatica para hosting compatible con cPanel
- Recomendado configurar CSP y headers de endurecimiento en el hosting
