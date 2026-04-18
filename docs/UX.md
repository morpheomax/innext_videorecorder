# UX — Pantallas, componentes y flujos

## Principios
- Configuración rápida, sin menús profundos
- Preview es “lo grabado”
- Estados claros: listo / grabando / pausado / error / guardado

## Pantalla A: SET (Grabación)
### Componentes
- A1 Preview principal (canvas)
- A2 Capa cámara (arrastrable, con handle)
- A3 Barra de control (Grabar/Pausar/Detener, timer, estado)
- A4 Selector formato (16:9, 9:16, 1:1)
- A5 Indicadores audio (mic / sistema)
- A6 Panel lateral (toggle)
  - fuente pantalla
  - cámara (dispositivo, espejo)
  - mic (dispositivo, gain)
  - audio sistema (toggle si disponible)
  - cursor on/off
  - estilo cámara (circle/square/rounded)
  - calidad (resolución/fps) [opcional v2]

### Interacciones clave
- Arrastrar cámara → snap visual
- Hotkeys:
  - Ctrl/Cmd+R: empezar/stop (configurable)
  - Space: pausar/reanudar
  - Tab: abrir/cerrar panel

## Pantalla B: Biblioteca local
- Lista con miniatura (si existe), fecha, duración, tamaño
- Botones: reproducir, descargar, eliminar
- “Borrar todo” (con confirmación)

## Pantalla C: Editor simple (Sprint 3)
- Player
- Recorte (in/out)
- Overlays:
  - Texto (contenido, tamaño, esquina)
  - Logo (upload local, esquina, opacidad)
- Export (WebM / MP4 opcional)

## Estados y mensajes
- Cargando permisos
- Permiso denegado: guía + reintentar
- Audio sistema no disponible: aviso no bloqueante
- Grabando: borde rojo + timer