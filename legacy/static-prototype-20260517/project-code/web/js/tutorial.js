// js/tutorial.js — Native Tutorial / Onboarding System
export class TutorialManager {
  constructor() {
    this.steps = [
      {
        selector: '#select-screen-btn',
        title: '1. Selección de Pantalla',
        text: 'Haz clic aquí para seleccionar la ventana, pestaña o pantalla completa que deseas grabar. Es el primer paso esencial de tu captura.'
      },
      {
        selector: '#camera-select',
        title: '2. Picture-in-Picture (Cámara)',
        text: 'Selecciona tu cámara web aquí. Se creará un pequeño recuadro sobre tu grabación que podrás arrastrar y redimensionar libremente. Puedes apagarla si solo quieres grabar pantalla.'
      },
      {
        selector: '.settings-group',
        title: '3. Fuentes de Audio',
        text: 'Elige tu micrófono y asegúrate de que el indicador del sistema esté activado si quieres que los sonidos de tu PC (un video de YouTube, reuniones, etc.) se escuchen en la grabación final.'
      },
      {
        selector: '.format-buttons',
        title: '4. Formato y Redes Sociales',
        text: 'Selecciona el formato antes de grabar: 16:9 (clásico para YouTube), 9:16 (vertical para TikTok, Reels o Shorts) o 1:1 (cuadrado).'
      },
      {
        selector: '#btn-record',
        title: '5. ¡A Grabar!',
        text: 'Presiona aquí para iniciar. Podrás pausar y continuar cuando quieras. Al darle Stop, se te llevará de inmediato a la mesa de edición.'
      },
      {
        selector: '#import-video-btn',
        title: '6. Editor: Agregar Medios',
        text: '¡Bienvenido al Editor! Utiliza estos botones para subir nuevos videos extra, canciones de fondo o imágenes estáticas. Soportamos un motor multipista completo.'
      },
      {
        selector: '#video-tracks-container',
        title: '7. Línea de Tiempo (Timeline)',
        text: 'Aquí se apilan tus clips. Tienes 4 canales de Video/Imágenes y 4 de Audio independiente. Arrastra los bordes de un clip para recortarlo, o múevelo para ajustarlo en el tiempo.'
      },
      {
        selector: '#nle-preview-panel',
        title: '8. Previsualizador Libre',
        text: 'En el centro de la pantalla puedes seleccionar un video para moverlo libremente, encogerlo, hacer PiP, o llenarlo ("Fill") y ajustarlo ("Fit") con la minibarra superior.'
      },
      {
        selector: '#nle-quickbar',
        title: '9. Acciones Rápidas del Clip',
        text: '¡Súper importante! Al dar clic a un clip, aparecerá una barra superior contextual: aquí podrás Cortar el video, Silenciarlo, cambiar Velocidad, bajar Volumen o hacer Duplicados.'
      },
      {
        selector: '.nle-overlays-toolbar',
        title: '10. Textos y Logos Flotantes',
        text: 'Añade títulos descriptivos con color y agrega logotipos de tu marca. Podrás arrastrarlos directamente sobre el previsualizador interactivo.'
      },
      {
        selector: '#save-project-btn',
        title: '11. Guarda tu progreso',
        text: 'Guarda toda tu sesión de edición localmente en tu propio navegador. Totalmente privado, no enviamos archivos a ningún servidor externo.'
      },
      {
        selector: '#export-video-btn',
        title: '12. Exportar Archivo Final',
        text: 'Cuando la magia termine, exporta. El sistema renderizará todos tus cortes, textos y música en un video webm/mp4 de alta resolución.'
      }
    ];
    this.currentStep = 0;
    this.isActive = false;

    // Build UI
    this.overlay = document.createElement('div');
    this.overlay.className = 'nle-tutorial-overlay';
    
    this.dialog = document.createElement('div');
    this.dialog.className = 'nle-tutorial-dialog';

    this.titleEl = document.createElement('h3');
    this.textEl = document.createElement('p');
    
    this.btnRow = document.createElement('div');
    this.btnRow.className = 'nle-tutorial-btns';

    this.btnSkip = document.createElement('button');
    this.btnSkip.className = 'nle-tutorial-btn-alt';
    this.btnSkip.textContent = 'Saltar Todo';

    this.btnNext = document.createElement('button');
    this.btnNext.className = 'nle-tutorial-btn-main';
    this.btnNext.textContent = 'Siguiente';

    this.btnRow.append(this.btnSkip, this.btnNext);
    this.dialog.append(this.titleEl, this.textEl, this.btnRow);

    this.btnSkip.addEventListener('click', () => this.end(true));
    this.btnNext.addEventListener('click', () => this.next());
    window.addEventListener('resize', () => { if (this.isActive) this._renderStep(); });
  }

  start() {
    this.currentStep = 0;
    this.isActive = true;
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.dialog);
    this._renderStep();
  }

  end(skipped = false) {
    this.isActive = false;
    if (this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
    if (this.dialog.parentNode) this.dialog.parentNode.removeChild(this.dialog);
    if (skipped || this.currentStep >= this.steps.length) {
      localStorage.setItem('studio_tutorial_seen', 'true');
    }
    // Return to main stage on finish for user to play
    document.getElementById('editor-view').classList.add('state-hidden');
    document.getElementById('main-stage').style.display = 'flex';
  }

  next() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.end();
      return;
    }
    this._renderStep();
  }

  _renderStep() {
    const step = this.steps[this.currentStep];
    this.titleEl.textContent = step.title;
    this.textEl.textContent = step.text;
    
    if (this.currentStep === this.steps.length - 1) {
      this.btnNext.textContent = 'Terminar 🎉';
    } else {
      this.btnNext.textContent = 'Siguiente';
    }

    // Determine if step is in Editor or Main Stage
    const isEditorStep = step.title.includes('Editor:') || step.title.includes('Línea de Tiempo') || step.title.includes('Acciones Rápidas') || step.title.includes('Textos') || step.title.includes('Guarda') || step.title.includes('Exportar') || step.title.includes('Previsualizador');
    
    const editorView = document.getElementById('editor-view');
    const mainStage = document.getElementById('main-stage');

    if (isEditorStep) {
      editorView.classList.remove('state-hidden');
      mainStage.style.display = 'none';
      if (document.getElementById('save-project-btn') && !editorView.dataset.simulated) {
          editorView.dataset.simulated = true;
      }
    } else {
      editorView.classList.add('state-hidden');
      mainStage.style.display = 'flex';
    }

    // Delay for DOM to paint completely avoiding geometry errors
    setTimeout(() => {
      const target = document.querySelector(step.selector);
      if (target) {
        // Enforce visible quickbar if it's the quickbar step
        if (step.selector === '#nle-quickbar') target.style.display = 'flex';

        const rect = target.getBoundingClientRect();
        
        // Spotlight size (padding)
        const pad = 6;
        
        // Constrain spotlight inside window so it doesn't draw a buggy shape if partially offscreen
        const leftBox = Math.max(0, rect.left - pad);
        const topBox = Math.max(0, rect.top - pad);
        const rightBox = Math.min(window.innerWidth, rect.right + pad);
        const bottomBox = Math.min(window.innerHeight, rect.bottom + pad);

        this.overlay.style.clipPath = `polygon(
          0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
          ${leftBox}px ${topBox}px,
          ${rightBox}px ${topBox}px,
          ${rightBox}px ${bottomBox}px,
          ${leftBox}px ${bottomBox}px,
          ${leftBox}px ${topBox}px
        )`;

        // Calculate dialog position safely within viewport
        const dialogW = 340; 
        const dialogH = 180; // approximate
        
        let top = bottomBox + 16;
        let left = leftBox + ((rightBox - leftBox) / 2) - (dialogW / 2);

        // If bottom overflows, put on top
        if (top + dialogH > window.innerHeight) {
            top = topBox - dialogH - 16;
        }
        
        // If still negative (too big), put at least safe offset
        if (top < 10) top = 16;
        
        // Horizontal bounds check
        if (left < 16) left = 16;
        if (left + dialogW > window.innerWidth) left = window.innerWidth - dialogW - 16;

        this.dialog.style.top = top + 'px';
        this.dialog.style.left = left + 'px';
        this.dialog.style.transform = 'none';

      } else {
        // Fallback if target not found
        this.overlay.style.clipPath = 'none';
        this.dialog.style.top = '50%';
        this.dialog.style.left = '50%';
        this.dialog.style.transform = 'translate(-50%, -50%)';
      }
    }, 150);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tutorial = new TutorialManager();
  window.StudioTutorial = tutorial;

  const btn = document.getElementById('tutorial-btn');
  if (btn) btn.addEventListener('click', () => tutorial.start());

  if (!localStorage.getItem('studio_tutorial_seen')) {
    setTimeout(() => tutorial.start(), 1500);
  }
});
