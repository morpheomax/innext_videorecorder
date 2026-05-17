# Studio Recorder

Estudio web de grabacion y edicion orientado a tutoriales estilo streaming.

Principios del proyecto:
- libre y sin registro
- 100% client-side
- sin backend ni cuentas
- privacidad total del contenido
- flujo rapido para grabar pantalla + camara + audio

## Stack actual

- `Astro` para sitio publico y SEO
- `React + TypeScript` para la herramienta `/studio`
- `Tailwind CSS` para estilos
- `Canvas 2D`, `Web Audio API`, `MediaRecorder` y luego `IndexedDB`

## Estado actual

Implementado en esta etapa:
- sitio base compatible con hosting estatico y `cPanel`
- landing SEO
- pagina de privacidad y ayuda
- estudio `/studio`
- captura de pantalla
- captura de camara y microfono
- mezcla de audio de microfono y sistema cuando existe
- compositor canvas con preview real
- camara con forma `circle`, `square` o `vertical`
- color de borde
- posiciones rapidas por botones y hotkeys
- grabacion local `WebM`
- apertura directa al editor al terminar de grabar
- timeline multipista inicial
- importacion de video, audio e imagenes
- overlays de texto
- trim, reordenamiento, duplicado, mute y volumen por clip
- export `WebM` desde editor
- biblioteca local con `IndexedDB`
- guardado automatico de grabaciones en el navegador
- apertura de grabaciones guardadas en el editor
- guardado y carga de proyectos locales
- borrado local total

En siguientes etapas:
- overlays y composicion visual mas avanzados
- export mas robusto y MP4 opcional
- refinamiento de timeline y biblioteca

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

La salida queda en `dist/` y se puede subir a un hosting estatico tradicional.

## Respaldo del prototipo anterior

El prototipo estatico original fue conservado en:

```text
legacy/static-prototype-20260517/
```

## Estructura principal

```text
src/
  components/
  core/
  layouts/
  pages/
  styles/
docs/
legacy/
```
