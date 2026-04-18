# Seguridad y Privacidad (MVP)

## Principio
Todo local. No se sube nada. Sin tracking invasivo.

## Permisos
- Pedir cámara/mic/pantalla solo cuando el usuario inicia setup.
- Mostrar claramente qué se está capturando.

## Datos almacenados (local)
- Grabaciones y metadata en IndexedDB (solo si usuario lo activa / Sprint 2).
- Botón “Borrar todo local” (hard delete).

## Protección UI
- Sanitizar texto de overlays (si se guarda y re-renderiza).
- No insertar HTML, solo texto plano.
- CSP recomendada para evitar inyección.

## Archivos
- Logo/texto: solo archivos locales del usuario.
- No se suben ni se procesan en servidor.

## Riesgos
- Audio sistema no disponible: evitar prometerlo como garantizado.
- Performance: limitar resolución/fps por defecto, avisar si hay drop.