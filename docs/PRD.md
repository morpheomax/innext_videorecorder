# PRD — Studio Recorder

## 1. Problema
Muchas personas necesitan grabar capacitaciones con estética “streaming” (cámara sobre pantalla, formatos vertical/cuadrado, audio claro) sin saber usar software complejo ni tener buen hardware.

## 2. Objetivo
Crear una app web gratuita que permita grabar pantalla + cámara + audio, con cámara reubicable y estilos (círculo/cuadrado/rounded), guardado local y edición simple.

## 3. Usuarios
- Creadores de cursos
- Profesores / capacitadores internos
- Equipos de soporte y onboarding

## 4. Valor
- Reduce barrera técnica frente a OBS
- Mejora la presentación (look “set”)
- Sin instalación, sin servidor, sin cuentas

## 5. Alcance MVP (Sprint 1–2)
### Grabación
- Captura pantalla (monitor/ventana/pestaña)
- Captura cámara (selector de dispositivo)
- Cámara PiP arrastrable + snap (esquinas/tercios)
- Estilos cámara: circle / square / rounded
- Formatos: 16:9, 9:16, 1:1
- Audio: mic + sistema/tab cuando esté disponible
- Grabación: iniciar/pausar/detener
- Descarga local (WebM)

### Configuración rápida
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
- Presets de escenas y hotkeys ampliadas

## 7. No alcance (por ahora)
- Streaming en vivo RTMP
- Subida a servidor / cuentas / cloud
- Edición avanzada (timeline multipista)

## 8. Métricas de éxito
- Usuario logra grabar y descargar en < 3 minutos desde entrar
- Grabación sin cortes en sesiones típicas (10–30 min) en Chrome/Edge
- 80% de testers entienden configuración sin tutorial

## 9. Riesgos principales
- Captura de audio del sistema depende de navegador/OS
- Consumo de CPU al componer video en canvas
- Limitaciones de formatos (MP4 no garantizado nativo)  