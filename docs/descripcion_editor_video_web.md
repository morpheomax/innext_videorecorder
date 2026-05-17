# Descripción profesional para un editor de video gratuito en la web

**Fecha:** 17 de mayo de 2026  
**Objetivo del documento:** describir la estructura, experiencia de usuario, interfaz y funciones principales de un editor de video web gratuito, tomando como referencia patrones usados en editores profesionales y simplificándolos para una primera versión viable.

---

## 1. Qué se busca construir

Se busca construir un **editor de video gratuito en la web** con una interfaz clara, visual y funcional, capaz de permitir a usuarios no expertos editar videos desde el navegador sin instalar software.

La interfaz debe inspirarse en editores profesionales como Adobe Premiere Pro, DaVinci Resolve, Final Cut Pro, Clipchamp, CapCut o Canva, pero sin replicar toda su complejidad. La meta no es crear una herramienta intimidante, sino una experiencia potente, ordenada y fácil de entender.

---

## 2. Supuestos de diseño

Para este documento se asume que el editor será:

- Un editor de video basado en navegador.
- Gratuito o con una versión gratuita.
- Orientado a creadores de contenido, equipos pequeños, emprendedores, profesores, marketers y usuarios generales.
- Basado en una línea de tiempo no lineal.
- Capaz de editar video, audio, texto, imágenes, subtítulos y elementos gráficos.
- Diseñado para formatos comunes como 16:9, 9:16, 1:1 y 4:5.
- Más simple que un software profesional completo, pero suficientemente robusto para flujos reales de edición.

---

## 3. Referentes de editores profesionales

Los editores profesionales suelen organizarse con una lógica de **paneles funcionales**. Aunque cada herramienta tiene su propio estilo, casi todas comparten una estructura base:

- Biblioteca de medios.
- Previsualizador del video.
- Línea de tiempo.
- Herramientas de edición.
- Panel de propiedades o inspector.
- Barra superior con acciones del proyecto.
- Paneles laterales con recursos, efectos, texto, audio y transiciones.

### Adobe Premiere Pro

Premiere Pro organiza su interfaz mediante espacios de trabajo o *workspaces*. Cada espacio agrupa paneles según la tarea: edición, color, audio, gráficos, efectos, etc.

Patrones relevantes:

- Panel de proyecto para medios.
- Program Monitor para previsualización.
- Timeline para edición.
- Paneles de efectos y propiedades.
- Herramientas de selección, corte, recorte, mover, copiar y pegar.

Referencia: https://helpx.adobe.com/au/premiere-pro/using/workspaces.html

### DaVinci Resolve

DaVinci Resolve organiza el flujo por páginas:

- Media.
- Cut.
- Edit.
- Fusion.
- Color.
- Fairlight.
- Deliver.

Este enfoque separa el proceso por etapas: importar, cortar, editar, componer, corregir color, mezclar audio y exportar.

Patrones relevantes:

- Media Pool para organizar archivos.
- Timeline multicapa.
- Inspector contextual.
- Herramientas avanzadas de recorte.
- Controles de color, audio y exportación.

Referencia: https://www.blackmagicdesign.com/products/davinciresolve

### Final Cut Pro

Final Cut Pro mantiene una estructura clara:

- Browser para explorar medios.
- Viewer para reproducir clips o proyectos.
- Timeline para organizar la edición.
- Inspector para modificar propiedades.

Patrones relevantes:

- Visor siempre visible.
- Línea de tiempo como centro de edición.
- Biblioteca de medios clara.
- Metadatos y organización visual de clips.

Referencia: https://support.apple.com/guide/final-cut-pro/final-cut-pro-interface-ver92bd100a/mac

### Clipchamp

Clipchamp es una referencia útil porque funciona en navegador. Está más orientado a usuarios generales y creadores de contenido.

Patrones relevantes:

- Editor simplificado.
- Grabación de pantalla y cámara.
- Plantillas.
- Audio, texto, efectos y recursos accesibles desde panel lateral.
- Exportación sencilla.

Referencia: https://clipchamp.com/en/

---

## 4. Principio central de distribución de pantalla

Para un editor web gratuito, la mejor distribución inicial es:

- **Izquierda:** medios, recursos y herramientas de creación.
- **Centro superior:** previsualizador del video.
- **Derecha:** inspector o panel de propiedades.
- **Parte inferior:** línea de tiempo.
- **Parte superior:** barra global del proyecto.

Esta distribución es familiar para usuarios que han visto editores profesionales, pero sigue siendo comprensible para principiantes.

---

## 5. Layout principal recomendado

```text
┌────────────────────────────────────────────────────────────────────┐
│ Barra superior: nombre proyecto | deshacer | rehacer | guardar | exportar │
├───────────────┬────────────────────────────────────┬───────────────┤
│ Menú lateral  │ Previsualizador del video          │ Inspector     │
│               │                                    │ propiedades   │
│ Medios        │ [Canvas / Preview]                 │               │
│ Audio         │                                    │ Transformar   │
│ Texto         │ Controles de reproducción          │ Tamaño        │
│ Transiciones  │ Play | atrás | adelante | tiempo   │ Posición      │
│ Efectos       │                                    │ Opacidad      │
│ Subtítulos    │                                    │ Velocidad     │
├───────────────┴────────────────────────────────────┴───────────────┤
│ Barra de herramientas de timeline: seleccionar | cortar | dividir | zoom │
├────────────────────────────────────────────────────────────────────┤
│ Línea de tiempo                                                     │
│ V3  overlays / texto / stickers                                     │
│ V2  imágenes / B-roll / gráficos                                    │
│ V1  video principal                                                  │
│ A1  audio del video                                                  │
│ A2  música                                                           │
│ A3  voz en off                                                       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Componentes principales del editor

---

# A. Barra superior

## Ubicación

Debe estar en la parte superior de la pantalla, fija y siempre visible.

## Función

Controla acciones globales del proyecto. No modifica directamente un clip específico, sino el proyecto completo.

## Opciones recomendadas

```text
Logo / Inicio
Nombre del proyecto
Estado: guardado / guardando / sin conexión
Deshacer
Rehacer
Ajustes del proyecto
Vista previa completa
Exportar
Cuenta / ayuda
```

## Acciones del usuario

El usuario puede:

- Cambiar el nombre del proyecto.
- Guardar.
- Ver estado de guardado.
- Deshacer una acción.
- Rehacer una acción.
- Abrir ajustes generales.
- Exportar el video.
- Volver al inicio.
- Acceder a ayuda.

## Recomendación UX

La acción **Exportar** debe estar destacada visualmente. Es una de las acciones más importantes del producto.

---

# B. Panel lateral izquierdo

## Ubicación

A la izquierda de la pantalla.

## Función

Es el centro de recursos del usuario. Desde aquí se importan archivos y se agregan elementos al proyecto.

## Secciones recomendadas

```text
Medios
Audio
Texto
Subtítulos
Transiciones
Efectos
Elementos gráficos
Plantillas
Grabador
Stock gratuito
```

## Dentro de “Medios”

```text
Botón: Importar archivos
Botón: Grabar pantalla
Botón: Grabar cámara
Botón: Grabar audio
Buscador
Filtros: videos / imágenes / audios
Vista en cuadrícula
Vista en lista
Carpetas o colecciones
```

## Acciones del usuario

El usuario puede:

- Importar videos.
- Importar imágenes.
- Importar audios.
- Grabar pantalla.
- Grabar cámara.
- Grabar voz.
- Buscar archivos.
- Filtrar medios.
- Arrastrar archivos a la timeline.
- Previsualizar archivos antes de usarlos.
- Eliminar archivos del proyecto.
- Organizar archivos en carpetas.

## Recomendación UX

El panel izquierdo debe ser colapsable. En pantallas pequeñas, puede convertirse en una barra de íconos.

---

# C. Previsualizador o visor

## Ubicación

Centro superior de la pantalla.

## Función

Muestra el resultado actual de la edición.

## Elementos del visor

```text
Pantalla de preview
Regla segura / guías
Selector de formato: 16:9, 9:16, 1:1, 4:5
Zoom del preview: 25%, 50%, ajustar
Botón pantalla completa
Controles de reproducción
Timecode actual
```

## Controles debajo del visor

```text
Ir al inicio
Retroceder frame
Play / pausa
Avanzar frame
Ir al final
Volumen preview
Tiempo actual / duración total
```

## Acciones del usuario

El usuario puede:

- Reproducir el video.
- Pausar.
- Avanzar frame por frame.
- Retroceder frame por frame.
- Revisar el resultado de los cortes.
- Ver el video en pantalla completa.
- Ajustar el zoom del preview.
- Cambiar relación de aspecto del proyecto.
- Mover elementos visuales directamente sobre el canvas, si el editor lo permite.

## Recomendación UX

El preview debe estar visible casi siempre. No conviene esconderlo detrás de menús o modales.

---

# D. Línea de tiempo o Timeline

## Ubicación

Parte inferior de la pantalla, ocupando todo el ancho disponible.

## Función

Es el área principal de edición. Aquí se ordenan clips, se cortan, se recortan, se mueven, se sincronizan audios y se construye el video final.

## Estructura visual

```text
Regla de tiempo
Cabezal de reproducción
Pistas de video
Pistas de audio
Clips
Ondas de audio
Miniaturas de video
Marcadores
Zoom horizontal
Scroll horizontal
Scroll vertical
```

## Pistas recomendadas

```text
V3: textos, stickers, overlays
V2: imágenes, B-roll, gráficos
V1: video principal
A1: audio original
A2: música
A3: voz en off
```

## Controles por pista

```text
Mostrar / ocultar pista
Bloquear pista
Silenciar pista
Volumen de pista
Nombre de pista
Altura de pista
```

## Acciones del usuario

El usuario puede:

- Arrastrar clips a la timeline.
- Mover clips.
- Dividir clips.
- Recortar inicio.
- Recortar final.
- Eliminar fragmentos.
- Copiar y pegar clips.
- Duplicar clips.
- Agrupar y desagrupar elementos.
- Cambiar el orden de capas.
- Ajustar la duración de textos.
- Sincronizar video con audio.
- Cambiar volumen.
- Añadir música.
- Añadir voz en off.
- Crear cortes precisos.
- Usar zoom de timeline.
- Activar o desactivar snapping.
- Agregar marcadores.

## Recomendación UX

La timeline debe sentirse rápida, estable y clara. Si la timeline falla, el editor completo se siente poco profesional.

---

# E. Barra de herramientas de edición

## Ubicación

Encima de la línea de tiempo o a la izquierda de ella.

## Función

Permite elegir herramientas para modificar clips y elementos de la timeline.

## Herramientas esenciales

```text
Seleccionar
Mover
Cortar / cuchilla
Dividir clip
Recortar inicio
Recortar final
Eliminar
Copiar
Pegar
Duplicar
Deshacer
Rehacer
Separar audio
Bloquear
Zoom timeline
Ajustar al clip
Snap activado/desactivado
```

## Herramientas avanzadas

```text
Ripple delete
Roll edit
Slip
Slide
Agrupar clips
Desagrupar clips
Marcador
Keyframes
Velocidad
Congelar frame
```

## Acciones del usuario

El usuario puede:

- Seleccionar objetos.
- Mover elementos en la timeline.
- Cortar clips en puntos específicos.
- Borrar espacios.
- Duplicar segmentos.
- Ajustar el zoom.
- Activar alineación automática.
- Crear marcadores.
- Separar audio de video.
- Bloquear elementos para evitar errores.

## Recomendación UX

Para una primera versión web, conviene mostrar pocas herramientas de forma permanente y dejar las avanzadas dentro de menús contextuales.

---

# F. Panel derecho o inspector

## Ubicación

Derecha de la pantalla.

## Función

Muestra las propiedades del elemento seleccionado. Es contextual: cambia según lo que el usuario seleccione.

## Inspector para video

```text
Transformar
- Posición X/Y
- Escala
- Rotación
- Recorte
- Opacidad

Tiempo
- Duración
- Velocidad
- Invertir clip
- Congelar frame

Color
- Brillo
- Contraste
- Saturación
- Temperatura
- Filtros

Audio
- Volumen
- Fade in
- Fade out
- Reducción de ruido

Animación
- Keyframes
- Entrada
- Salida
```

## Inspector para texto

```text
Contenido del texto
Fuente
Tamaño
Color
Alineación
Espaciado
Sombra
Contorno
Fondo
Animación de entrada
Animación de salida
Duración
```

## Inspector para audio

```text
Volumen
Fade in
Fade out
Reducción de ruido
Normalización
Velocidad
Separar canales
Silenciar
Loop
```

## Inspector para imagen

```text
Posición
Escala
Rotación
Recorte
Opacidad
Duración
Animación de entrada
Animación de salida
Filtros
```

## Acciones del usuario

El usuario puede:

- Ajustar posición.
- Cambiar tamaño.
- Rotar.
- Modificar opacidad.
- Cambiar velocidad.
- Ajustar color.
- Modificar volumen.
- Aplicar efectos.
- Añadir animaciones.
- Editar texto.
- Ajustar duración.

## Recomendación UX

No se deben mostrar todas las opciones todo el tiempo. El inspector debe ser contextual para evitar saturación.

Ejemplo:

```text
Selecciono video → veo transformar, velocidad, color, audio.
Selecciono texto → veo fuente, tamaño, color, animación.
Selecciono audio → veo volumen, fade, reducción de ruido.
Selecciono imagen → veo posición, escala, recorte, filtros.
```

---

## 7. Flujo básico del usuario

```text
1. Crear proyecto
2. Elegir formato: horizontal, vertical o cuadrado
3. Importar videos, imágenes y audios
4. Arrastrar clips a la línea de tiempo
5. Ordenar clips
6. Recortar inicio y final
7. Dividir clips
8. Eliminar partes innecesarias
9. Añadir texto, música, transiciones y efectos
10. Ajustar volumen y color
11. Previsualizar
12. Exportar
```

---

## 8. Flujo profesional simplificado

```text
1. Importar material
2. Organizar en carpetas
3. Revisar clips en preview
4. Marcar entrada y salida
5. Insertar en timeline
6. Hacer corte grueso
7. Refinar timing
8. Ajustar audio
9. Añadir gráficos, títulos y subtítulos
10. Corregir color básico
11. Revisar versión final
12. Exportar en formato elegido
```

---

## 9. Acciones principales del usuario

### Edición de clips

| Acción | Qué hace | Prioridad |
|---|---|---|
| Seleccionar clip | Activa propiedades y acciones | Alta |
| Mover clip | Cambia su posición en la timeline | Alta |
| Recortar inicio | Acorta desde el comienzo | Alta |
| Recortar final | Acorta desde el final | Alta |
| Dividir clip | Corta el clip en dos partes | Alta |
| Eliminar clip | Quita el clip seleccionado | Alta |
| Copiar | Copia clip o grupo | Alta |
| Pegar | Inserta clip copiado | Alta |
| Duplicar | Crea copia inmediata | Media |
| Separar audio | Divide video y audio | Media |
| Cambiar velocidad | Acelera o ralentiza | Media |
| Bloquear clip | Evita cambios accidentales | Media |

### Acciones en timeline

```text
Zoom in / zoom out
Snap a cortes
Mover playhead
Seleccionar rango
Seleccionar múltiples clips
Arrastrar clips entre pistas
Bloquear pistas
Silenciar pistas
Mostrar/ocultar pistas
Añadir marcadores
```

### Acciones de medios

```text
Importar archivo
Arrastrar y soltar
Buscar archivo
Filtrar por tipo
Renombrar archivo
Eliminar del proyecto
Ver detalles
Previsualizar archivo
Añadir a timeline
```

### Acciones de texto

```text
Añadir título
Añadir subtítulo
Editar contenido
Cambiar fuente
Cambiar tamaño
Cambiar color
Cambiar alineación
Añadir sombra
Añadir contorno
Animar entrada
Animar salida
Ajustar duración en timeline
```

### Acciones de audio

```text
Añadir música
Añadir voz en off
Separar audio de video
Ajustar volumen
Aplicar fade in
Aplicar fade out
Silenciar pista
Normalizar volumen
Reducir ruido
Sincronizar con video
```

### Acciones de exportación

```text
Elegir formato
Elegir resolución
Elegir calidad
Elegir FPS
Elegir relación de aspecto
Ver duración estimada
Exportar MP4
Descargar archivo
Compartir enlace
```

---

## 10. Botones recomendados por zona

### Barra superior

```text
Nuevo proyecto
Abrir
Guardar
Deshacer
Rehacer
Ayuda
Exportar
```

### Panel izquierdo

```text
Importar
Grabar
Medios
Audio
Texto
Subtítulos
Transiciones
Efectos
Plantillas
```

### Visor

```text
Play / pausa
Frame anterior
Frame siguiente
Volumen
Pantalla completa
Ajustar zoom
Formato del lienzo
```

### Timeline

```text
Seleccionar
Cuchilla / cortar
Dividir
Eliminar
Copiar
Pegar
Duplicar
Zoom +
Zoom -
Snap
Marcador
Bloquear pista
Silenciar pista
```

### Inspector

```text
Transformar
Recortar
Velocidad
Opacidad
Color
Audio
Animación
Keyframes
```

---

## 11. Propuesta para una primera versión web

## Nombre funcional

**Editor Web NLE Lite**

NLE significa *Non-Linear Editor*, o editor no lineal. Es el tipo de editor donde el usuario organiza clips libremente en una línea de tiempo.

## Problema que resuelve

Permite editar videos desde el navegador sin instalar software, con una interfaz sencilla pero basada en patrones profesionales.

## Usuario destinatario

```text
Creadores de contenido
Equipos de marketing
Profesores
Emprendedores
Editores principiantes
Usuarios que necesitan videos rápidos para redes sociales
```

## Pantalla principal recomendada

```text
┌──────────────────────────────────────────────────────────────┐
│ Proyecto sin título       Deshacer  Rehacer       Exportar   │
├──────┬───────────────────────┬───────────────────────────────┤
│ Menú │ Biblioteca            │ Preview                       │
│      │                       │                               │
│ 📁   │ Importar              │          VIDEO                │
│ 🎵   │ Buscar medios         │                               │
│ T    │ Miniaturas            │ Play  00:00 / 01:30           │
│ ✨   │                       │                               │
├──────┴───────────────────────┴───────────────────────────────┤
│ Herramientas: Seleccionar | Cortar | Dividir | Borrar | Zoom  │
├──────────────────────────────────────────────────────────────┤
│ Timeline                                                     │
│ Texto / overlays                                             │
│ Video principal                                              │
│ Audio                                                        │
│ Música                                                       │
└──────────────────────────────────────────────────────────────┘
```

## Funciones mínimas recomendadas

```text
Importar video, imagen y audio
Arrastrar a timeline
Preview sincronizado con timeline
Cortar/dividir clips
Recortar inicio y final
Mover clips
Copiar, pegar y duplicar
Eliminar clips
Añadir texto
Añadir música
Control de volumen
Exportar MP4
Formatos 16:9, 9:16 y 1:1
Autosave
```

---

## 12. Funciones por prioridad

### Prioridad 1: esencial para MVP

```text
Crear proyecto
Importar archivos
Arrastrar a timeline
Reproducir preview
Mover clips
Recortar clips
Dividir clips
Eliminar clips
Añadir texto
Añadir audio
Control de volumen
Deshacer / rehacer
Exportar MP4
```

### Prioridad 2: muy útil

```text
Plantillas
Subtítulos manuales
Transiciones básicas
Filtros de color
Separar audio de video
Duplicar clips
Copiar y pegar
Zoom de timeline
Snap
Autosave
Pantalla completa
```

### Prioridad 3: avanzado

```text
Subtítulos automáticos
Keyframes
Reducción de ruido
Corrección de color avanzada
Animaciones personalizadas
Edición multicámara
Colaboración en tiempo real
Versionado
Stock integrado
IA para cortes automáticos
IA para limpieza de audio
```

---

## 13. Reglas UX importantes

## Regla 1: el usuario debe ver siempre el resultado

El preview debe estar visible casi todo el tiempo. No conviene ocultarlo detrás de menús.

## Regla 2: la timeline manda

La línea de tiempo debe ser el centro operativo. Todo lo que el usuario edita debe reflejarse ahí.

## Regla 3: selección clara

Cuando un clip está seleccionado, debe verse claramente mediante borde, color, sombra o resaltado.

## Regla 4: acciones visibles al inicio

Para usuarios nuevos, muestra botones visibles:

```text
Cortar
Dividir
Eliminar
Texto
Audio
Exportar
```

No dependas solo de atajos de teclado.

## Regla 5: inspector contextual

El inspector debe mostrar solo propiedades relevantes según el objeto seleccionado.

## Regla 6: deshacer siempre visible

El usuario debe poder experimentar sin miedo. Deshacer y rehacer deben estar siempre disponibles.

## Regla 7: evitar saturación visual

Un editor profesional puede tener muchas opciones, pero un editor web gratuito debe priorizar claridad.

## Regla 8: arrastrar y soltar como interacción principal

El usuario debería poder construir el video arrastrando medios, textos, audios y efectos.

## Regla 9: feedback inmediato

Cada acción debe generar una respuesta visible:

- Al cortar, el clip se divide.
- Al mover, se ve la nueva posición.
- Al exportar, se muestra progreso.
- Al seleccionar, aparece el inspector correcto.

## Regla 10: exportación simple

Exportar debe ser claro, visible y sin demasiada configuración inicial.

---

## 14. Estados visuales importantes

### Clip normal

Representa un clip no seleccionado en la timeline.

### Clip seleccionado

Debe tener borde visible o color destacado.

### Clip bloqueado

Debe mostrar un icono de candado o apariencia atenuada.

### Clip con audio

Debe mostrar onda de audio.

### Clip con error

Debe mostrar alerta si falta el archivo fuente o no se puede procesar.

### Pista silenciada

Debe mostrar un icono de volumen apagado.

### Proyecto guardando

Debe mostrar estado en la barra superior.

### Exportación en progreso

Debe mostrar porcentaje, estado y opción de cancelar si aplica.

---

## 15. Atajos de teclado recomendados

```text
Espacio: reproducir / pausar
Ctrl/Cmd + Z: deshacer
Ctrl/Cmd + Shift + Z: rehacer
Ctrl/Cmd + C: copiar
Ctrl/Cmd + V: pegar
Delete / Backspace: eliminar
S: dividir clip
V: seleccionar
B: cuchilla
Ctrl/Cmd + +: acercar timeline
Ctrl/Cmd + -: alejar timeline
M: marcador
```

Los atajos no deben ser obligatorios, pero ayudan a usuarios avanzados.

---

## 16. Menú contextual con clic derecho

Al hacer clic derecho sobre un clip, el usuario podría ver:

```text
Dividir
Copiar
Pegar
Duplicar
Eliminar
Separar audio
Cambiar velocidad
Bloquear clip
Agrupar
Enviar adelante
Enviar atrás
Mostrar propiedades
```

Este menú reduce la necesidad de mostrar demasiados botones fijos.

---

## 17. Diseño responsive

Un editor de video funciona mejor en escritorio, pero se puede adaptar.

### Escritorio

```text
Panel izquierdo + preview + inspector + timeline completa
```

### Tablet

```text
Panel izquierdo colapsable
Inspector como panel flotante
Timeline reducida
Preview dominante
```

### Móvil

```text
Preview arriba
Timeline simplificada abajo
Botones principales en barra inferior
Paneles como pantallas modales
```

Para la primera versión, se recomienda priorizar escritorio.

---

## 18. Criterios de calidad del producto

El editor debería sentirse bien si cumple esto:

```text
El usuario entiende dónde importar archivos.
El usuario entiende dónde ver el resultado.
El usuario entiende dónde editar el tiempo.
El usuario puede cortar sin leer instrucciones.
El usuario puede deshacer cualquier error.
El usuario puede exportar sin fricción.
La interfaz no cambia demasiado al seleccionar objetos.
Los paneles pueden colapsarse.
La timeline responde rápido.
El preview está sincronizado con el playhead.
El usuario puede recuperar su proyecto.
Los botones importantes son visibles.
Las acciones destructivas piden confirmación o permiten deshacer.
```

---

## 19. Errores comunes que conviene evitar

```text
Poner demasiados botones desde el inicio.
Esconder la opción de exportar.
Hacer que el preview sea pequeño.
No mostrar claramente qué clip está seleccionado.
No permitir deshacer.
Tener una timeline lenta.
No diferenciar pistas de video y audio.
No mostrar ondas de audio.
No mostrar progreso de exportación.
No guardar automáticamente.
Copiar interfaces profesionales sin simplificarlas.
```

---

## 20. Descripción resumida del producto

El producto es un editor de video web gratuito con una interfaz profesional simplificada. Permite importar videos, imágenes y audios; organizarlos en una línea de tiempo; recortar, dividir, mover, copiar, pegar y eliminar clips; añadir textos, música, transiciones y efectos; previsualizar el resultado en tiempo real; ajustar propiedades desde un inspector contextual; y exportar el video final en formatos comunes.

La interfaz se distribuye en cinco zonas principales: barra superior, panel izquierdo de recursos, previsualizador central, inspector derecho y línea de tiempo inferior. Esta organización permite que el usuario entienda rápidamente dónde están sus archivos, dónde se ve el resultado, dónde se edita el tiempo y dónde se modifican las propiedades de cada elemento.

---

## 21. Brief listo para diseño UI/UX

```text
Diseñar una interfaz web para un editor de video gratuito, orientado a usuarios creadores de contenido y equipos pequeños.

La pantalla principal debe incluir:

1. Barra superior:
   - Nombre del proyecto.
   - Estado de guardado.
   - Deshacer.
   - Rehacer.
   - Exportar.

2. Panel izquierdo:
   - Medios.
   - Audio.
   - Texto.
   - Subtítulos.
   - Transiciones.
   - Efectos.
   - Plantillas.
   - Botón de importar.

3. Área central:
   - Previsualizador del video.
   - Controles de reproducción.
   - Selector de formato.
   - Timecode.

4. Panel derecho:
   - Inspector contextual.
   - Propiedades del elemento seleccionado.
   - Transformación, audio, color, velocidad, texto o animación según corresponda.

5. Parte inferior:
   - Línea de tiempo multipista.
   - Pistas de video, texto y audio.
   - Clips arrastrables.
   - Herramientas de cortar, dividir, mover, eliminar, copiar, pegar y zoom.

El diseño debe ser limpio, profesional, oscuro o neutro, con buena jerarquía visual, botones claros, iconografía reconocible y soporte para arrastrar y soltar.
```

---

## 22. Riesgos, límites y decisiones pendientes

### Riesgos

- Diseñar una interfaz demasiado compleja para usuarios principiantes.
- Copiar editores profesionales sin adaptarlos al navegador.
- Priorizar efectos visuales antes que estabilidad.
- Hacer una timeline difícil de usar.
- No definir bien el público objetivo.
- Agregar funciones avanzadas antes de resolver el flujo básico.

### Límites

Este documento describe estructura y UX, pero no define todavía:

- Arquitectura técnica.
- Motor de renderizado.
- Librerías frontend.
- Backend.
- Procesamiento de video.
- Costos de exportación.
- Límite de duración o peso de archivos.
- Modelo de monetización.

### Decisiones pendientes

```text
¿El editor estará orientado principalmente a videos horizontales o verticales?
¿La exportación se hará en el navegador o en servidor?
¿Habrá cuentas de usuario?
¿Los proyectos se guardarán en la nube o localmente?
¿Habrá colaboración entre usuarios?
¿Habrá plantillas?
¿Habrá recursos stock?
¿Habrá funciones de IA?
```

---

## 23. Recomendación final

Para una primera versión, conviene construir un editor con esta estructura:

```text
Barra superior simple
Panel izquierdo de medios y recursos
Preview central
Inspector derecho contextual
Timeline inferior multipista
Herramientas básicas de corte y movimiento
Exportación MP4
Autosave
```

La prioridad no debe ser tener muchas funciones, sino lograr que el usuario pueda completar el flujo básico sin perderse:

```text
Importar → Arrastrar → Cortar → Añadir texto/audio → Previsualizar → Exportar
```

Si esa experiencia es rápida, clara y confiable, el producto tendrá una base sólida para crecer hacia funciones más profesionales.
