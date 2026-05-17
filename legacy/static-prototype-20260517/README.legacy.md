# Innext Studio Recorder 🎬

Una herramienta web profesional de alto rendimiento (100% client-side) diseñada para grabar capacitaciones, tutoriales y demos con una estética moderna de streaming.

![Studio Recorder Preview](https://via.placeholder.com/800x450/111111/FFFFFF?text=Innext+Studio+Recorder)

## 🚀 Características Principales

- **Grabación Multifuente**: Captura pantalla, ventana o pestaña junto con tu cámara web en tiempo real.
- **Composición Dinámica**: Picture-in-Picture (PiP) configurable, cambio de formatos (16:9, 9:16, 1:1) y estilos en vivo.
- **Mezclador de Audio Avanzado**: Combina audio de micrófono y sistema con controles de ganancia independientes.
- **Privacidad Total**: Todo el procesamiento es local. Tus videos no pasan por ningún servidor.
- **Editor Integrado**: Recorta y revisa tus grabaciones antes de exportar.

## 🛠️ Stack Tecnológico

Este proyecto prioriza el rendimiento y la simplicidad utilizando APIs nativas del navegador:

- **Composición**: [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) para el renderizado de capas y efectos.
- **Audio**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) para la mezcla de múltiples fuentes en tiempo real.
- **Grabación**: [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) con `canvas.captureStream()`.
- **Persistencia Local**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) para la gestión de proyectos y clips grandes.
- **Estilos**: Vanilla CSS con variables modernas para un modo oscuro elegante y responsivo.

## 📂 Estructura del Proyecto

```text
├── docs/                   # Documentación detallada (PRD, SRS, Arquitectura)
├── project-code/
│   └── web/                # Código fuente de la aplicación
│       ├── index.html      # Punto de entrada principal
│       ├── css/            # Estilos (Layout, Editor, UI)
│       └── js/             # Lógica modular
│           ├── app.js      # Orquestador principal
│           ├── capture.js  # Gestión de MediaDevices y ScreenShare
│           ├── mixer.js    # Motor de mezcla de audio
│           ├── compositor.js # Motor de renderizado en Canvas
│           └── editor.js   # Módulo de edición NLE
└── README.md
```

## 🛠️ Cómo Inpezar

Para correr este proyecto localmente no necesitas instalar dependencias pesadas. Simplemente sirve la carpeta `project-code/web` con cualquier servidor estático:

```bash
# Ejemplo con Python
python -m http.server 8000

# Ejemplo con Node (serve)
npx serve project-code/web
```

Luego abre `http://localhost:8000` en tu navegador.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si deseas aportar:

1. Lee la documentación en `/docs` para entender las reglas de diseño y arquitectura.
2. Asegúrate de seguir las [Reglas UX](./docs/UX.md) para mantener la simplicidad.
3. Envía un Pull Request con tus mejoras.

---

**Desarrollado por [Max Sandoval](https://github.com/morpheomax)**