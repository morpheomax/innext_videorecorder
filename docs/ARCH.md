# Arquitectura — Opción B (recomendada)

## Visión
App web estática (SPA). Todo se procesa en el navegador.

## Módulos
1) Capture
- getDisplayMedia: pantalla
- getUserMedia: cámara y mic

2) AudioMixer (Web Audio API)
- AudioContext
- MediaStreamSource para mic y para system/tab si existe
- GainNode por fuente
- MediaStreamDestination para track final

3) CanvasCompositor
- Canvas 2D
- Dibuja pantalla como base
- Dibuja cámara con máscara (circle/square/rounded)
- canvas.captureStream(fps) genera stream final de video

4) RecorderPipeline
- Combina:
  - videoTrack del canvasStream
  - audioTrack del mixerDestination.stream
- MediaRecorder para grabar a chunks

5) LocalLibrary (IndexedDB)
- recordings + projects + settings

6) Editor (Sprint 3)
- Trim + overlays
- Exporter (WebM directo / MP4 opcional)

## Decisiones
- Formato default: WebM
- MP4: solo si browser soporta o por export con ffmpeg.wasm
- No backend, no cuentas, no storage remoto

## Deploy
- Publicación como estático en Apache/Nginx/cPanel
- Recomendado: headers CSP + COOP/COEP si luego se usa ffmpeg.wasm con cross-origin isolation