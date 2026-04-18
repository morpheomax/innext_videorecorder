# QA — Matriz de pruebas manuales (MVP)

## Navegadores
- Chrome (latest)
- Edge (latest)
- Firefox (secundario)

## Casos
1) Permisos OK
- Seleccionar pantalla, cámara, mic → grabar 30s → descargar → reproducir

2) Permisos denegados
- Denegar mic/cámara/pantalla → app muestra mensaje y reintentar

3) Audio sistema disponible/no disponible
- Si display stream trae audio track, mezclar y validar
- Si no trae, UI avisa pero sigue con mic

4) Drag cámara
- Mover a cada esquina, verificar snap
- Verificar que no sale del área

5) Presets
- 16:9 / 9:16: grabar 10s cada uno
- Verificar dimensiones y encuadre

6) Fallback mimeType
- Forzar navegador sin VP9/cierto mime → confirmar fallback funciona