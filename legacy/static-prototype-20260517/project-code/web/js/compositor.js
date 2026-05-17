// js/compositor.js
export class Compositor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.screenVideo = document.createElement('video');
    this.cameraVideo = document.createElement('video');
    
    this.screenVideo.muted = true;
    this.screenVideo.playsInline = true;
    this.cameraVideo.muted = true;
    this.cameraVideo.playsInline = true;

    this.format = '16:9';
    this.camStyle = 'circle'; // circle, square, rounded
    this.mirrorCam = true;
    this.camBorderColor = '#FFFFFF';

    // Estado interno del canvas
    this.loopId = null;
    this.baseW = 1280;
    this.baseH = 720;
    
    // PiP Props
    this.pipW = 240;
    this.pipH = 240;
    this.pipX = this.baseW - this.pipW - 30; // 30px padding
    this.pipY = this.baseH - this.pipH - 30;
    this.targetPipX = this.pipX;
    this.targetPipY = this.pipY;
    
    // Drag state
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.setupDragEvents();
    this.setFormat('16:9');
  }

  setFormat(format) {
    this.format = format;
    if (format === '16:9') {
      this.baseW = 1280;
      this.baseH = 720;
    } else if (format === '9:16') {
      this.baseW = 720;
      this.baseH = 1280;
    } else if (format === '1:1') {
      this.baseW = 1080;
      this.baseH = 1080;
    }
    
    this.canvas.width = this.baseW;
    this.canvas.height = this.baseH;

    // Reset PiP to bottom-right corner when format changes to prevent it going off screen
    this.pipW = Math.floor(Math.min(this.baseW, this.baseH) * 0.25);
    this.pipH = this.pipW;
    
    // Asegurarse de que el PiP esté dentro de los límites
    this.snapPiP();
  }

  setScreenStream(stream) {
    if (stream) {
      this.screenVideo.srcObject = stream;
      this.screenVideo.play().catch(e => console.warn(e));
    } else {
      this.screenVideo.srcObject = null;
    }
  }

  setCameraStream(stream) {
    if (stream) {
      this.cameraVideo.srcObject = stream;
      this.cameraVideo.play().catch(e => console.warn(e));
    } else {
      this.cameraVideo.srcObject = null;
    }
  }

  setStyle(style) {
    this.camStyle = style;
  }

  setBorderColor(color) {
    this.camBorderColor = color;
  }

  setMirror(mirror) {
    this.mirrorCam = mirror;
  }

  start() {
    if (!this.loopId) {
      this.loop = this.loop.bind(this);
      this.loopId = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    if (this.loopId) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
  }

  getStream(fps = 30) {
    // capturamos stream a 30fps por defecto
    return this.canvas.captureStream(fps);
  }

  loop() {
    // Dibuja el fondo claro para el marco de letterboxing
    this.ctx.fillStyle = '#F1F5F9';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Lerp (suavizado) de la posición target de la cámara
    this.pipX += (this.targetPipX - this.pipX) * 0.15;
    this.pipY += (this.targetPipY - this.pipY) * 0.15;

    // 1. Escalar pantalla (object-fit cover o contain behavior)
    if (this.screenVideo.srcObject && this.screenVideo.readyState >= 2) {
      this.drawObjectFit(this.screenVideo, 'cover');
    }

    // 2. Dibujar cámara (PiP)
    if (this.cameraVideo.srcObject && this.cameraVideo.readyState >= 2) {
      this.drawCamera();
    }
    
    this.loopId = requestAnimationFrame(this.loop);
  }

  drawObjectFit(video, fit = 'contain') {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
    if (vw === 0 || vh === 0) return;

    let rw = cw / vw;
    let rh = ch / vh;
    let r = fit === 'cover' ? Math.max(rw, rh) : Math.min(rw, rh);
    
    let newW = vw * r;
    let newH = vh * r;
    let dx = (cw - newW) / 2;
    let dy = (ch - newH) / 2;

    this.ctx.drawImage(video, dx, dy, newW, newH);
  }

  drawCamera() {
    this.ctx.save();
    
    // Configura el area de dibujo (Path de mascara)
    this.ctx.beginPath();
    const cx = this.pipX + this.pipW / 2;
    const cy = this.pipY + this.pipH / 2;
    
    if (this.camStyle === 'circle') {
      this.ctx.arc(cx, cy, this.pipW / 2, 0, Math.PI * 2);
    } else if (this.camStyle === 'rounded') {
      this.ctx.roundRect(this.pipX, this.pipY, this.pipW, this.pipH, 20);
    } else { // square
      this.ctx.rect(this.pipX, this.pipY, this.pipW, this.pipH);
    }
    
    this.ctx.clip(); // Corta el dibujo a esta zona

    // Efecto espejo
    if (this.mirrorCam) {
      this.ctx.scale(-1, 1);
      // Traslación porque el escale invirtio X
      this.ctx.translate(-this.baseW, 0);
    }

    // Dibujar el video, considerando el aspect ratio de la camara
    const vw = this.cameraVideo.videoWidth;
    const vh = this.cameraVideo.videoHeight;
    let rw = this.pipW / vw;
    let rh = this.pipH / vh;
    let r = Math.max(rw, rh);
    let newW = vw * r;
    let newH = vh * r;
    
    let realX = this.mirrorCam ? this.baseW - this.pipX - this.pipW : this.pipX;
    
    let dx = realX + (this.pipW - newW) / 2;
    let dy = this.pipY + (this.pipH - newH) / 2;

    this.ctx.drawImage(this.cameraVideo, dx, dy, newW, newH);
    
    this.ctx.restore();

    // Dibujar borde externo para darle estilo "premium"
    this.ctx.save();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = this.camBorderColor;
    if (this.camStyle === 'circle') {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, this.pipW / 2, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (this.camStyle === 'rounded') {
      this.ctx.beginPath();
      this.ctx.roundRect(this.pipX, this.pipY, this.pipW, this.pipH, 20);
      this.ctx.stroke();
    } else {
      this.ctx.strokeRect(this.pipX, this.pipY, this.pipW, this.pipH);
    }
    
    // Sombras
    this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 5;
    this.ctx.restore();
  }

  // Lógica de Mouse y Touch para Drag & Drop
  setupDragEvents() {
    let rawCanvas = this.canvas;
    // We map client coordinates to canvas internal baseW / baseH
    const getPos = (e) => {
      const rect = rawCanvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
      
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const down = (e) => {
      if (!this.cameraVideo.srcObject) return;
      
      // Allow scroll if not tapping on the camera PIP
      const pos = getPos(e);
      if (pos.x >= this.pipX && pos.x <= this.pipX + this.pipW &&
          pos.y >= this.pipY && pos.y <= this.pipY + this.pipH) {
        
        if (e.cancelable) e.preventDefault(); // Stop scrolling
        this.isDragging = true;
        this.dragOffsetX = pos.x - this.pipX;
        this.dragOffsetY = pos.y - this.pipY;
      }
    };

    const move = (e) => {
      if (!this.isDragging) return;
      if (e.cancelable) e.preventDefault();
      const pos = getPos(e);
      this.targetPipX = pos.x - this.dragOffsetX;
      this.targetPipY = pos.y - this.dragOffsetY;
    };

    const up = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.snapPiP();
      }
    };

    rawCanvas.addEventListener('mousedown', down);
    rawCanvas.addEventListener('touchstart', down, { passive: false });

    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });

    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
  }

  snapPiP() {
    const pad = 30; // margin distance
    const centerW = this.canvas.width / 2;
    const centerH = this.canvas.height / 2;
    const currentCx = this.targetPipX + (this.pipW/2);
    const currentCy = this.targetPipY + (this.pipH/2);

    // X axis snap
    if (currentCx < centerW) {
      this.targetPipX = pad;
    } else {
      this.targetPipX = this.canvas.width - this.pipW - pad;
    }

    // Y axis snap
    if (currentCy < centerH) {
      this.targetPipY = pad;
    } else {
      this.targetPipY = this.canvas.height - this.pipH - pad;
    }
  }
}
