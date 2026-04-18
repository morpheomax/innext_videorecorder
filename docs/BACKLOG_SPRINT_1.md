# Backlog — Sprint 1 (Set + Grabación WebM)

## HU-01 Como usuario quiero seleccionar pantalla para ver preview y grabar
- T1: UI botón “Elegir pantalla”
- T2: Implementar getDisplayMedia + manejo de errores
- CA: Preview muestra la fuente seleccionada

## HU-02 Como usuario quiero activar cámara y verla sobre la pantalla
- T1: getUserMedia video
- T2: Render cámara como capa PiP en compositor
- CA: cámara visible y usable

## HU-03 Como usuario quiero mover la cámara para que no estorbe
- T1: Drag & drop con constraints dentro del canvas
- T2: Snap a esquinas/tercios
- CA: la posición persiste mientras grabo

## HU-04 Como usuario quiero estilo de cámara (circle/square/rounded)
- T1: Implementar máscara circle y square (rounded opcional)
- CA: se refleja en preview y grabación

## HU-05 Como usuario quiero grabar mic (y sistema si está) y descargar
- T1: getUserMedia audio (mic)
- T2: Detectar audio track en display stream (si existe)
- T3: Mezcla Web Audio API y entrega track final
- T4: MediaRecorder con fallback de mimeType
- CA: archivo WebM descargable con audio (al menos mic)

## HU-06 Como usuario quiero presets 16:9 y 9:16
- T1: Ajustar canvas size por preset
- T2: Ajustar escalado de pantalla y cámara
- CA: export respeta el aspecto