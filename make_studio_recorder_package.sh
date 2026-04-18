#!/usr/bin/env bash
set -euo pipefail

PROJECT="studio-recorder"
OUT_ZIP="${PROJECT}-package.zip"
OUT_TAR="${PROJECT}-package.tar.gz"

rm -rf "${PROJECT}" "${OUT_ZIP}" "${OUT_TAR}"

mkdir -p \
  "${PROJECT}/.agents/contexts" \
  "${PROJECT}/.agents/rules" \
  "${PROJECT}/.agents/workflows" \
  "${PROJECT}/.agents/skills/media_capture" \
  "${PROJECT}/.agents/skills/audio_mixer" \
  "${PROJECT}/.agents/skills/canvas_compositor" \
  "${PROJECT}/.agents/skills/recorder_pipeline" \
  "${PROJECT}/.agents/skills/local_library_indexeddb" \
  "${PROJECT}/.agents/skills/editor_trim_overlays" \
  "${PROJECT}/.agents/skills/export_webm_mp4" \
  "${PROJECT}/.agents/skills/ui_set_controls" \
  "${PROJECT}/.agents/skills/hotkeys_manager" \
  "${PROJECT}/.agents/skills/device_enumeration" \
  "${PROJECT}/.agents/skills/mime_and_codec_fallback" \
  "${PROJECT}/.agents/skills/performance_quality_manager" \
  "${PROJECT}/.agents/skills/error_state_messaging" \
  "${PROJECT}/docs" \
  "${PROJECT}/project-code/web"

# -------------------------
# ROOT README
# -------------------------
cat <<'EOF' > "${PROJECT}/README.md"
# Studio Recorder (Web)

Herramienta web gratuita (100% client-side) para grabar capacitaciones con estética “streaming”:
- Pantalla + cámara (picture-in-picture configurable) + audio (mic + sistema/tab cuando sea posible)
- Guardado local (sin servidor)
- Editor simple (trim + overlays) en fases

## Objetivo MVP (Sprint 1)
Convertir el navegador en un “set de grabación” con configuración rápida e intuitiva:
- Composición por Canvas (preview = resultado)
- Grabación por MediaRecorder
- Descarga local WebM

## Stack sugerido
- Vite + React + TypeScript
- TailwindCSS
- IndexedDB (biblioteca local — Sprint 2)
- Web Audio API (mezcla)
- Canvas 2D (composición)
- MediaRecorder (grabación)
- (opcional) ffmpeg.wasm para export MP4 (Sprint 3)

## Importante (compatibilidad)
- El audio del sistema depende del navegador/OS/fuente compartida. La app debe degradar sin romper: si no hay system audio, grabar mic igualmente.
- MP4 nativo no está garantizado. WebM es el default.

## Documentación
- /docs: PRD, SRS, UX, arquitectura, seguridad, backlog y QA.
- /.agents: contextos, reglas, workflows y skills para Antigravity.

EOF

# -------------------------
# DOCS
# -------------------------
cat <<'EOF' > "${PROJECT}/docs/PRD.md"
# PRD — Studio Recorder

## 1. Problema
Muchas personas necesitan grabar capacitaciones con estética “streaming” (cámara sobre pantalla, formatos vertical/cuadrado, audio claro) sin saber usar software complejo ni tener equipos potentes.

## 2. Objetivo
Crear una app web gratuita que permita grabar pantalla + cámara + audio, con cámara reubicable y estilos (círculo/cuadrado/rounded), guardado local y edición simple.

## 3. Usuarios
- Creadores de cursos
- Profesores / capacitadores
- Equipos de soporte y onboarding
- Personas sin setup de grabación

## 4. Valor
- Baja barrera vs OBS
- Mejor presentación (look “set”)
- Sin instalación, sin cuentas, sin servidor

## 5. Alcance MVP (Sprint 1–2)
### Grabación (Sprint 1)
- Captura pantalla (monitor/ventana/pestaña)
- Captura cámara (selector de dispositivo)
- Cámara PiP arrastrable + snap (esquinas/tercios)
- Estilos cámara: circle / square / rounded
- Formatos: 16:9, 9:16, 1:1
- Audio: mic + sistema/tab cuando esté disponible
- Grabación: iniciar/pausar/detener
- Descarga local (WebM)

### Configuración rápida (Sprint 1)
- Panel lateral colapsable (hotkey)
- Volumen mic / volumen sistema
- Toggle cursor
- Toggle espejo cámara

### Biblioteca local (Sprint 2)
- Guardar grabaciones en IndexedDB
- Listar / reproducir / descargar / eliminar

## 6. Alcance futuro (Sprint 3+)
- Editor simple: trim + texto/logo
- Export MP4 opcional (ffmpeg.wasm)
- Presets de escenas, hotkeys ampliadas

## 7. No alcance (por ahora)
- Streaming en vivo RTMP
- Subida a servidor / cuentas / cloud
- Timeline avanzada multipista

## 8. Métricas de éxito
- Usuario logra grabar y descargar en < 3 minutos desde entrar
- Grabación estable 10–30 min en Chrome/Edge
- La UI explica claramente cuando no hay audio del sistema

## 9. Riesgos principales
- Captura de audio del sistema depende de navegador/OS
- Consumo de CPU al componer en canvas
- Limitaciones de formatos y codecs
EOF

cat <<'EOF' > "${PROJECT}/docs/SRS.md"
# SRS — Especificación Técnica (MVP)

## 1. Requisitos funcionales

### RF-01 Captura de pantalla
- Elegir fuente: monitor/ventana/pestaña.
- Mostrar preview en el “Set”.

### RF-02 Captura de cámara
- Selección de dispositivo.
- Overlay PiP sobre el video base.
- Soporta espejo (mirror).

### RF-03 Reubicación y estilo de cámara
- Drag & drop dentro del canvas.
- Snap a esquinas/tercios.
- Formas: círculo, cuadrado, rounded.
- Borde/sombra simples (opcional).

### RF-04 Audio
- Mic configurable (dispositivo + ganancia).
- Audio de sistema/tab si el stream lo incluye.
- Mezcla final: una pista de audio.

### RF-05 Grabación
- Iniciar / Pausar / Reanudar / Detener.
- Al detener: archivo descargable WebM.
- Sprint 2: guardar en biblioteca local.

### RF-06 Biblioteca local (Sprint 2)
- Lista con metadata: fecha, duración, formato, tamaño.
- Reproducir, descargar, eliminar.

### RF-07 Editor simple (Sprint 3)
- Trim in/out.
- Overlays: texto y logo.
- Export WebM (rápido).
- Export MP4 opcional (ffmpeg.wasm).

## 2. Requisitos no funcionales
- RNF-01: 100% client-side, sin backend.
- RNF-02: Máximo 3 pasos para grabar.
- RNF-03: Privacidad: no enviar datos.
- RNF-04: Performance: preview fluido (meta 24–30 FPS).
- RNF-05: Accesibilidad básica (labels, foco, teclas).

## 3. Compatibilidad
- Target: Chrome/Edge desktop.
- Secundario: Firefox con limitaciones.
- Móvil: no prioridad en MVP.

## 4. Criterios de aceptación (Sprint 1)
- CA-01: Graba pantalla + cámara + mic y descarga WebM reproducible.
- CA-02: Cámara se mueve y aplica máscara (mínimo circle y square).
- CA-03: Presets 16:9 y 9:16 funcionan; 1:1 opcional Sprint 1 o 2.
- CA-04: No hay llamadas de red para guardar contenido.
- CA-05: Si no hay audio sistema disponible, UI explica y sigue grabando mic.

## 5. Mensajes de error esperables
- Permisos denegados: guía + reintentar.
- Dispositivo no disponible: fallback.
- Mime no soportado: fallback.
- CPU alto: sugerir bajar calidad.
EOF

cat <<'EOF' > "${PROJECT}/docs/UX.md"
# UX — Pantallas, componentes y flujos

## Principios
- Configuración rápida, sin menús profundos
- Preview es “lo grabado”
- Estados claros: listo / grabando / pausado / error / guardado

## Pantalla A: SET (Grabación)
### Componentes
- A1 Preview principal (canvas)
- A2 Overlay cámara (arrastrable, con handle)
- A3 Barra de control (Grabar/Pausar/Detener, timer, estado)
- A4 Selector formato (16:9, 9:16, 1:1)
- A5 Indicadores audio (mic / sistema)
- A6 Panel lateral (toggle + hotkey)
  - fuente pantalla
  - cámara (dispositivo, espejo)
  - mic (dispositivo, ganancia)
  - audio sistema (toggle si disponible)
  - cursor on/off
  - estilo cámara (circle/square/rounded)
  - calidad (presets) [opcional v2]

### Interacciones clave
- Arrastrar cámara → snap visual
- Hotkeys sugeridas:
  - Space: pausar/reanudar
  - Ctrl/Cmd+Shift+R: iniciar/detener (evita chocar con refresh)
  - Ctrl/Cmd+B: abrir/cerrar panel

## Pantalla B: Biblioteca local (Sprint 2)
- Lista: miniatura opcional, fecha, duración, tamaño
- Acciones: reproducir, descargar, eliminar
- “Borrar todo” con confirmación

## Pantalla C: Editor simple (Sprint 3)
- Player + trim in/out
- Overlays: texto y logo (posición y opacidad)
- Export WebM / MP4 (opcional)

## Estados y mensajes
- “Solicitando permisos…”
- “Permiso denegado” + Reintentar
- “Audio del sistema no disponible” (no bloqueante)
- Grabando: borde rojo + timer
EOF

cat <<'EOF' > "${PROJECT}/docs/ARCH.md"
# Arquitectura — Opción B (recomendada)

## Visión
SPA estática. Todo se procesa en el navegador.

## Módulos
1) Capture
- getDisplayMedia: pantalla (y audio si está disponible)
- getUserMedia: cámara y mic

2) AudioMixer (Web Audio API)
- MediaStreamSource por fuente
- GainNode por fuente
- MediaStreamDestination -> 1 track final

3) CanvasCompositor
- Canvas 2D
- Base: pantalla
- Overlay: cámara con máscara y posición
- canvas.captureStream(fps)

4) RecorderPipeline
- Ensambla stream final:
  - video track: canvasStream
  - audio track: mixer destination
- MediaRecorder con fallback de mime

5) LocalLibrary (Sprint 2)
- IndexedDB: recordings + settings + projects

6) Editor + Export (Sprint 3)
- Trim + overlays
- Export WebM
- Export MP4 opcional con ffmpeg.wasm (worker si aplica)

## Decisiones
- Default WebM
- MP4 opcional (no prometer soporte nativo)
- No backend

## Deploy
- Hosting estático Apache/Nginx/cPanel
- Headers recomendados: CSP; y si se usa ffmpeg.wasm avanzado, considerar COOP/COEP.
EOF

cat <<'EOF' > "${PROJECT}/docs/SECURITY.md"
# Seguridad y Privacidad (MVP)

## Principio
Todo local. Sin servidor. Sin cuentas.

## Permisos
- Pedir pantalla/cámara/mic solo cuando el usuario inicia.
- Mostrar claramente qué se está capturando.

## Datos almacenados
- Sprint 1: por defecto descarga directa (sin persistencia obligatoria).
- Sprint 2: biblioteca local en IndexedDB (opcional y con “borrar todo”).

## Protección UI
- Overlays de texto: almacenar y renderizar como texto plano (no HTML).
- Configurar CSP en deploy estático.

## Riesgos
- Audio sistema no disponible -> comunicación transparente.
- Performance -> presets de calidad y límites.
EOF

cat <<'EOF' > "${PROJECT}/docs/BACKLOG_SPRINT_1.md"
# Backlog — Sprint 1 (Set + Grabación WebM)

## HU-01 Seleccionar pantalla para preview y grabar
- T1: UI botón “Elegir pantalla”
- T2: getDisplayMedia + manejo de errores
- CA: Preview muestra fuente seleccionada

## HU-02 Activar cámara y verla sobre la pantalla
- T1: getUserMedia video + selector de dispositivo
- T2: Render cámara como overlay en compositor
- CA: cámara visible en preview

## HU-03 Mover cámara para que no estorbe
- T1: Drag & drop con límites
- T2: Snap a esquinas/tercios
- CA: posición persiste durante la grabación

## HU-04 Estilo de cámara (circle/square/rounded)
- T1: máscara circle y square
- T2: rounded opcional
- CA: estilo se ve en preview y grabación

## HU-05 Grabar audio (mic y sistema si existe) y descargar
- T1: getUserMedia audio mic
- T2: detectar audio track en display stream (si existe)
- T3: mezclar con Web Audio API
- T4: MediaRecorder con fallback mime
- CA: WebM descargable con audio (mínimo mic)

## HU-06 Presets 16:9 y 9:16
- T1: canvas size por preset
- T2: escalado correcto de pantalla/cámara
- CA: export respeta aspecto
EOF

cat <<'EOF' > "${PROJECT}/docs/QA_TEST_MATRIX.md"
# QA — Matriz de pruebas manuales (MVP)

## Navegadores
- Chrome (latest)
- Edge (latest)
- Firefox (secundario)

## Casos
1) Permisos OK
- Pantalla + cámara + mic -> grabar 30s -> descargar -> reproducir

2) Permisos denegados
- Denegar uno -> mensaje claro -> reintentar

3) Audio sistema disponible/no disponible
- Si hay track: validar mezcla
- Si no: validar aviso no bloqueante y mic OK

4) Drag cámara
- mover a esquinas y tercios -> snap -> no sale del área

5) Presets
- 16:9 / 9:16 -> grabar 10s -> validar aspecto

6) Fallback mime
- Forzar mime no soportado -> fallback -> archivo reproducible
EOF

cat <<'EOF' > "${PROJECT}/docs/DEV_SETUP.md"
# Setup de desarrollo (Vite + React + TS + Tailwind)

## Crear app (sugerido)
Desde `project-code/web`:

```bash
npm create vite@latest . -- --template react-ts
npm i
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p