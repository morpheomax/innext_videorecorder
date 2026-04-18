# SRS — Especificación Técnica (MVP)

## 1. Requisitos funcionales

### RF-01 Captura de pantalla
- El usuario puede elegir fuente: monitor/ventana/pestaña.
- Debe mostrar preview en el “Set”.

### RF-02 Captura de cámara
- Selección de dispositivo (si hay múltiples).
- Preview como capa PiP sobre el video base.
- Soporta espejo (mirror).

### RF-03 Reubicación y estilo de cámara
- Drag & drop de la cámara dentro del canvas.
- Snap a esquinas/tercios.
- Formas: círculo, cuadrado, rounded.
- Borde y sombra simples (opcional MVP: 1 estilo base).

### RF-04 Audio
- Micrófono configurable (dispositivo + ganancia).
- Audio de sistema/tab si el stream lo incluye.
- Mezcla final en una sola pista de audio.

### RF-05 Grabación
- Iniciar / Pausar / Reanudar / Detener.
- Al detener, se genera archivo descargable (WebM).
- (Sprint 2) Se guarda en biblioteca local.

### RF-06 Biblioteca local (Sprint 2)
- Lista de grabaciones con metadata (fecha, duración, formato, tamaño).
- Reproducir, descargar, eliminar.

### RF-07 Editor simple (Sprint 3)
- Trim in/out.
- Overlays: texto y logo (PNG/SVG).
- Exportar WebM (rápido).
- Export MP4 opcional (ffmpeg.wasm).

## 2. Requisitos no funcionales
- RNF-01: 100% client-side, sin backend.
- RNF-02: UX de baja fricción: máximo 3 pasos para grabar.
- RNF-03: Privacidad: no enviar datos a terceros.
- RNF-04: Performance: preview fluido (meta: 24–30 FPS en equipos promedio).
- RNF-05: Accesibilidad básica: foco visible, labels, atajos no bloqueantes.

## 3. Compatibilidad
- Target principal: Chrome/Edge desktop.
- Soporte secundario: Firefox (con limitaciones posibles en audio/some codecs).
- Móvil: no es prioridad MVP (pero UI responsive).

## 4. Criterios de aceptación (MVP)
- CA-01: Puede grabar pantalla + cámara + mic y descargar WebM.
- CA-02: Cámara se puede mover y cambiar forma (mínimo círculo y cuadrado).
- CA-03: Formatos 16:9 y 9:16 funcionando (1:1 opcional Sprint 1 o 2).
- CA-04: No hay llamadas de red para guardar contenido.
- CA-05: Si no hay audio del sistema disponible, UI explica y sigue grabando mic.

## 5. Errores esperables y mensajes
- Permisos denegados (pantalla/cámara/mic): mostrar explicación y botón reintentar.
- Dispositivo no disponible: fallback al siguiente dispositivo.
- MediaRecorder no soporta mime: fallback a otro mime.
- Canvas/CPU alto: sugerir bajar resolución o fps.