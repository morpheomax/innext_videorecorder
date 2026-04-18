import { CaptureManager } from './capture.js';
import { AudioMixer } from './audioMixer.js';
import { Compositor } from './compositor.js';
import { Recorder } from './recorder.js';
import { EditorModule } from './editor.js';

class App {
  constructor() {
    this.capture = new CaptureManager();
    this.mixer = new AudioMixer();
    this.compositor = new Compositor(document.getElementById('composer-canvas'));
    this.recorder = new Recorder();
    this.editor = new EditorModule(this);

    // DOM Elements
    this.els = {
      sidebar: document.getElementById('sidebar'),
      toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),
      closeSidebarBtn: document.getElementById('close-sidebar-btn'),
      selectScreenBtn: document.getElementById('select-screen-btn'),
      cameraSelect: document.getElementById('camera-select'),
      micSelect: document.getElementById('mic-select'),
      mirrorCam: document.getElementById('mirror-cam-toggle'),
      micGain: document.getElementById('mic-gain'),
      micVolLabel: document.getElementById('mic-vol-label'),
      sysAudioIcon: document.getElementById('sys-audio-icon'),
      sysAudioText: document.getElementById('sys-audio-text'),
      recordBtn: document.getElementById('record-btn'),
      pauseBtn: document.getElementById('pause-btn'),
      timerDisplay: document.getElementById('timer-display'),
      formatBtns: document.querySelectorAll('.format-btn'),
      styleBtns: document.querySelectorAll('.style-btn'),
      camBorderColor: document.getElementById('cam-border-color'),
      openEditorBtn: document.getElementById('open-editor-btn')
    };

    this.timerInterval = null;
    this.secondsRecorded = 0;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.compositor.start();
    await this.populateDevices();
  }

  async populateDevices() {
    try {
      const { cameras, mics } = await this.capture.enumerateDevices();
      
      this.els.cameraSelect.innerHTML = '<option value="">Desactivada</option>' + 
        cameras.map(c => `<option value="${c.deviceId}">${c.label || 'Cámara ' + c.deviceId.substring(0,5)}</option>`).join('');
      
      this.els.micSelect.innerHTML = '<option value="">Desactivado</option>' + 
        mics.map(m => `<option value="${m.deviceId}">${m.label || 'Micrófono ' + m.deviceId.substring(0,5)}</option>`).join('');

    } catch (e) {
      this.showToast('Error accediendo a dispositivos. Otorga permisos.', 'error');
    }
  }

  bindEvents() {
    // Sidebar On/Off
    const togglePanel = () => this.els.sidebar.classList.toggle('closed');
    this.els.toggleSidebarBtn.addEventListener('click', togglePanel);
    this.els.closeSidebarBtn.addEventListener('click', togglePanel);

    // Open Editor in blank mode (without recording first)
    this.els.openEditorBtn.addEventListener('click', () => {
      this.editor.openBlank();
    });
    
    // Screenshare
    this.els.selectScreenBtn.addEventListener('click', async () => {
      try {
        const stream = await this.capture.getScreenStream();
        this.compositor.setScreenStream(stream);
        
        // Setup system audio
        const hasAudio = this.mixer.setSystemStream(stream);
        if (hasAudio) {
          this.els.sysAudioIcon.className = "ph ph-speaker-high";
          this.els.sysAudioIcon.parentElement.classList.add('active');
          this.els.sysAudioText.textContent = "Audio de sistema conectado";
        } else {
          this.els.sysAudioIcon.className = "ph ph-speaker-slash";
          this.els.sysAudioIcon.parentElement.classList.remove('active');
          this.els.sysAudioText.textContent = "Sin audio de sistema";
        }

        // On stream stop (user clicks stop sharing in browser UI)
        stream.getVideoTracks()[0].onended = () => {
          this.compositor.setScreenStream(null);
          this.mixer.setSystemStream(null);
          this.els.sysAudioIcon.className = "ph ph-speaker-slash";
          this.els.sysAudioIcon.parentElement.classList.remove('active');
          this.els.sysAudioText.textContent = "Audio de sistema inactivo";
        };
      } catch (err) {
        if(err.name !== 'NotAllowedError') {
          this.showToast('Error al capturar pantalla.', 'error');
        }
      }
    });

    // Camera Select
    this.els.cameraSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (!val) {
        this.compositor.setCameraStream(null);
        return;
      }
      try {
        const stream = await this.capture.getCameraStream(val);
        this.compositor.setCameraStream(stream);
      } catch (err) {
        this.showToast('Error al encender la cámara.', 'error');
        this.els.cameraSelect.value = "";
      }
    });

    // Mic Select
    this.els.micSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (!val) {
        this.mixer.setMicStream(null);
        return;
      }
      try {
        const stream = await this.capture.getMicStream(val);
        this.mixer.setMicStream(stream);
      } catch (err) {
        this.showToast('Error al encender micrófono.', 'error');
        this.els.micSelect.value = "";
      }
    });

    // Toggles & Settings
    this.els.mirrorCam.addEventListener('change', (e) => {
      this.compositor.setMirror(e.target.checked);
    });

    this.els.micGain.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.els.micVolLabel.textContent = Math.round(val * 100);
      this.mixer.setMicVolume(val);
    });

    // Styles & formats
    this.els.formatBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.els.formatBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.compositor.setFormat(target.dataset.format);
      });
    });

    this.els.styleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.els.styleBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.compositor.setStyle(target.dataset.style);
      });
    });

    this.els.camBorderColor.addEventListener('input', (e) => {
      this.compositor.setBorderColor(e.target.value);
    });

    // Recording Controls
    this.els.recordBtn.addEventListener('click', () => {
      const state = this.recorder.getState();
      if (state === 'inactive') {
        this.startRecording();
      } else {
        this.stopRecording();
      }
    });

    this.els.pauseBtn.addEventListener('click', () => {
      const state = this.recorder.getState();
      if (state === 'recording') {
        this.recorder.pause();
        this.els.pauseBtn.innerHTML = '<i class="ph ph-play"></i>';
        this.stopTimer();
      } else if (state === 'paused') {
        this.recorder.resume();
        this.els.pauseBtn.innerHTML = '<i class="ph ph-pause"></i>';
        this.startTimer();
      }
    });

    // Hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        togglePanel();
      }
    });
  }

  startRecording() {
    if (!this.capture.screenStream) {
      this.showToast('Selecciona una pantalla para grabar.', 'error');
      return;
    }

    try {
      // Tomar videoTrack de nuestro canvas composer
      const videoStream = this.compositor.getStream(30);
      // Tomar audioTrack mezclado de mic + system
      const audioStream = this.mixer.getMixedStream();

      this.recorder.start(videoStream, audioStream);
      
      this.els.recordBtn.classList.add('recording');
      this.els.recordBtn.querySelector('span').textContent = 'Detener';
      this.els.pauseBtn.classList.remove('state-hidden');
      
      this.secondsRecorded = 0;
      this.updateTimerDisplay();
      this.startTimer();
      this.showToast('Grabación iniciada', 'success');

    } catch (err) {
      console.error(err);
      this.showToast('Error al iniciar la grabación.', 'error');
    }
  }

  async stopRecording() {
    this.stopTimer();
    const blob = await this.recorder.stop();
    
    this.els.recordBtn.classList.remove('recording');
    this.els.recordBtn.querySelector('span').textContent = 'Grabar';
    this.els.pauseBtn.classList.add('state-hidden');
    this.els.pauseBtn.innerHTML = '<i class="ph ph-pause"></i>'; // reset icon

    if (blob) {
      // Pass blob to the NLE editor and open it
      document.getElementById('main-stage').style.display = 'none';
      this.els.sidebar.classList.add('closed');
      document.getElementById('editor-view').classList.remove('state-hidden');
      this.editor.loadBlob(blob);
      this.showToast('Grabación lista → Editor Multipista', 'success');
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.secondsRecorded++;
      this.updateTimerDisplay();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const h = Math.floor(this.secondsRecorded / 3600).toString().padStart(2, '0');
    const m = Math.floor((this.secondsRecorded % 3600) / 60).toString().padStart(2, '0');
    const s = (this.secondsRecorded % 60).toString().padStart(2, '0');
    this.els.timerDisplay.textContent = `${h}:${m}:${s}`;
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? '<i class="ph ph-warning-circle"></i>' : '<i class="ph ph-check-circle"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.studioApp = new App();
});
