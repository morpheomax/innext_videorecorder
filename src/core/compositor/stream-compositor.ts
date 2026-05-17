export type StudioFormat = '16:9' | '9:16' | '1:1';
export type CameraShape = 'circle' | 'square' | 'vertical';
export type PositionPreset =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const POSITION_PRESETS: Array<{ value: PositionPreset; label: string }> = [
  { value: 'top-left', label: 'Superior izquierda' },
  { value: 'top-center', label: 'Superior centro' },
  { value: 'top-right', label: 'Superior derecha' },
  { value: 'center-left', label: 'Centro izquierda' },
  { value: 'center-right', label: 'Centro derecha' },
  { value: 'bottom-left', label: 'Inferior izquierda' },
  { value: 'bottom-center', label: 'Inferior centro' },
  { value: 'bottom-right', label: 'Inferior derecha' },
];

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

export class StreamCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private screenVideo: HTMLVideoElement;
  private cameraVideo: HTMLVideoElement;
  private animationFrameId = 0;
  private format: StudioFormat = '16:9';
  private shape: CameraShape = 'circle';
  private mirrorCamera = true;
  private borderColor = '#22c55e';
  private positionPreset: PositionPreset = 'bottom-right';
  private dragging = false;
  private dragOffset: Point = { x: 0, y: 0 };
  private dragPoint: Point | null = null;
  private baseWidth = 1280;
  private baseHeight = 720;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('No fue posible crear el contexto 2D del canvas.');
    }

    this.canvas = canvas;
    this.ctx = context;
    this.screenVideo = document.createElement('video');
    this.cameraVideo = document.createElement('video');

    this.screenVideo.muted = true;
    this.screenVideo.playsInline = true;
    this.cameraVideo.muted = true;
    this.cameraVideo.playsInline = true;

    this.setFormat(this.format);
    this.setupPointerEvents();
    this.loop();
  }

  setFormat(format: StudioFormat) {
    this.format = format;

    if (format === '16:9') {
      this.baseWidth = 1280;
      this.baseHeight = 720;
    } else if (format === '9:16') {
      this.baseWidth = 720;
      this.baseHeight = 1280;
    } else {
      this.baseWidth = 1080;
      this.baseHeight = 1080;
    }

    this.canvas.width = this.baseWidth;
    this.canvas.height = this.baseHeight;
  }

  setScreenStream(stream: MediaStream | null) {
    this.screenVideo.srcObject = stream;
    if (stream) {
      void this.screenVideo.play().catch(() => undefined);
    }
  }

  setCameraStream(stream: MediaStream | null) {
    this.cameraVideo.srcObject = stream;
    if (stream) {
      void this.cameraVideo.play().catch(() => undefined);
    }
  }

  setCameraShape(shape: CameraShape) {
    this.shape = shape;
  }

  setMirror(mirror: boolean) {
    this.mirrorCamera = mirror;
  }

  setBorderColor(color: string) {
    this.borderColor = color;
  }

  setPositionPreset(position: PositionPreset) {
    this.positionPreset = position;
    this.dragPoint = this.getPresetOrigin(position);
  }

  getStream(fps = 30) {
    return this.canvas.captureStream(fps);
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId);
    this.screenVideo.srcObject = null;
    this.cameraVideo.srcObject = null;
  }

  private getPadding() {
    return Math.max(24, Math.round(Math.min(this.baseWidth, this.baseHeight) * 0.03));
  }

  private getCameraRect() {
    const minSide = Math.min(this.baseWidth, this.baseHeight);

    if (this.shape === 'vertical') {
      const width = Math.round(minSide * 0.2);
      const height = Math.round(width * 1.55);
      return { width, height };
    }

    const size = Math.round(minSide * 0.24);
    return { width: size, height: size };
  }

  private getPresetOrigin(position: PositionPreset): Point {
    const padding = this.getPadding();
    const rect = this.getCameraRect();

    const xByPreset: Record<PositionPreset, number> = {
      'top-left': padding,
      'top-center': Math.round((this.baseWidth - rect.width) / 2),
      'top-right': this.baseWidth - rect.width - padding,
      'center-left': padding,
      'center-right': this.baseWidth - rect.width - padding,
      'bottom-left': padding,
      'bottom-center': Math.round((this.baseWidth - rect.width) / 2),
      'bottom-right': this.baseWidth - rect.width - padding,
    };

    const yByPreset: Record<PositionPreset, number> = {
      'top-left': padding,
      'top-center': padding,
      'top-right': padding,
      'center-left': Math.round((this.baseHeight - rect.height) / 2),
      'center-right': Math.round((this.baseHeight - rect.height) / 2),
      'bottom-left': this.baseHeight - rect.height - padding,
      'bottom-center': this.baseHeight - rect.height - padding,
      'bottom-right': this.baseHeight - rect.height - padding,
    };

    return { x: xByPreset[position], y: yByPreset[position] };
  }

  private getActiveOrigin() {
    return this.dragPoint ?? this.getPresetOrigin(this.positionPreset);
  }

  private setupPointerEvents() {
    const getCanvasPoint = (event: MouseEvent | TouchEvent): Point => {
      const rect = this.canvas.getBoundingClientRect();
      const source = 'touches' in event ? event.touches[0] : event;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top) * scaleY,
      };
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!this.cameraVideo.srcObject) {
        return;
      }

      const point = getCanvasPoint(event);
      const rect = this.getCurrentCameraRect();
      if (
        point.x < rect.x ||
        point.x > rect.x + rect.width ||
        point.y < rect.y ||
        point.y > rect.y + rect.height
      ) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      this.dragging = true;
      this.dragOffset = { x: point.x - rect.x, y: point.y - rect.y };
      this.dragPoint = { x: rect.x, y: rect.y };
    };

    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      if (!this.dragging) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const point = getCanvasPoint(event);
      const size = this.getCameraRect();
      const padding = this.getPadding();

      this.dragPoint = {
        x: Math.min(
          Math.max(point.x - this.dragOffset.x, padding),
          this.baseWidth - size.width - padding,
        ),
        y: Math.min(
          Math.max(point.y - this.dragOffset.y, padding),
          this.baseHeight - size.height - padding,
        ),
      };
    };

    const onPointerUp = () => {
      if (!this.dragging || !this.dragPoint) {
        return;
      }

      this.dragging = false;
      this.positionPreset = this.getClosestPreset(this.dragPoint);
      this.dragPoint = this.getPresetOrigin(this.positionPreset);
    };

    this.canvas.addEventListener('mousedown', onPointerDown);
    this.canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
  }

  private getClosestPreset(point: Point) {
    let closest = POSITION_PRESETS[0].value;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (const preset of POSITION_PRESETS) {
      const origin = this.getPresetOrigin(preset.value);
      const dx = origin.x - point.x;
      const dy = origin.y - point.y;
      const distance = dx * dx + dy * dy;

      if (distance < smallestDistance) {
        smallestDistance = distance;
        closest = preset.value;
      }
    }

    return closest;
  }

  private getCurrentCameraRect(): Rect {
    const size = this.getCameraRect();
    const origin = this.getActiveOrigin();

    return {
      x: origin.x,
      y: origin.y,
      width: size.width,
      height: size.height,
    };
  }

  private drawEmptyState() {
    this.ctx.fillStyle = '#020617';
    this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

    const gradient = this.ctx.createLinearGradient(0, 0, this.baseWidth, this.baseHeight);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.16)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(24, 24, this.baseWidth - 48, this.baseHeight - 48);

    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.textAlign = 'center';
    this.ctx.font = '600 34px Inter, sans-serif';
    this.ctx.fillText('Selecciona una pantalla para iniciar tu set', this.baseWidth / 2, this.baseHeight / 2 - 14);
    this.ctx.font = '400 20px Inter, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(
      'La composicion sera exactamente lo que termines exportando.',
      this.baseWidth / 2,
      this.baseHeight / 2 + 28,
    );
  }

  private drawCover(video: HTMLVideoElement) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) {
      return;
    }

    const scale = Math.max(this.baseWidth / videoWidth, this.baseHeight / videoHeight);
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    const x = (this.baseWidth - width) / 2;
    const y = (this.baseHeight - height) / 2;

    this.ctx.drawImage(video, x, y, width, height);
  }

  private drawCamera() {
    if (!this.cameraVideo.srcObject || this.cameraVideo.readyState < 2) {
      return;
    }

    const rect = this.getCurrentCameraRect();
    const radius = Math.min(rect.width, rect.height) / 2;

    this.ctx.save();
    this.ctx.beginPath();

    if (this.shape === 'circle') {
      this.ctx.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, radius, 0, Math.PI * 2);
    } else if (this.shape === 'vertical') {
      this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 32);
    } else {
      this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 24);
    }

    this.ctx.clip();
    this.ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
    this.ctx.shadowBlur = 34;
    this.ctx.shadowOffsetY = 14;

    const videoWidth = this.cameraVideo.videoWidth;
    const videoHeight = this.cameraVideo.videoHeight;
    const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    const drawX = rect.x + (rect.width - width) / 2;
    const drawY = rect.y + (rect.height - height) / 2;

    if (this.mirrorCamera) {
      this.ctx.translate(this.baseWidth, 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.cameraVideo, this.baseWidth - drawX - width, drawY, width, height);
    } else {
      this.ctx.drawImage(this.cameraVideo, drawX, drawY, width, height);
    }

    this.ctx.restore();

    this.ctx.save();
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = this.borderColor;
    this.ctx.beginPath();
    if (this.shape === 'circle') {
      this.ctx.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, radius, 0, Math.PI * 2);
    } else if (this.shape === 'vertical') {
      this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 32);
    } else {
      this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 24);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  private loop = () => {
    if (this.screenVideo.srcObject && this.screenVideo.readyState >= 2) {
      this.drawCover(this.screenVideo);
    } else {
      this.drawEmptyState();
    }

    this.drawCamera();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
