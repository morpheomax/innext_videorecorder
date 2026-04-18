// js/capture.js
export class CaptureManager {
  constructor() {
    this.screenStream = null;
    this.cameraStream = null;
    this.micStream = null;
  }

  async enumerateDevices() {
    try {
      // Pedimos permiso genérico inicial para ver las etiquetas
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(e => {
        console.warn("Permiso inicial ignorado u omitido, leyendo lo que esté disponible.");
      });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        cameras: devices.filter(d => d.kind === 'videoinput'),
        mics: devices.filter(d => d.kind === 'audioinput')
      };
    } catch (err) {
      console.error("Error al enumerar dispositivos", err);
      throw err;
    }
  }

  async getScreenStream() {
    try {
      if (this.screenStream) {
        this.stopStream(this.screenStream);
      }
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", frameRate: 30 },
        audio: true // Solicitamos audio del tab/sistema si está disponible
      });
      return this.screenStream;
    } catch (err) {
      console.error("Error capturando pantalla", err);
      throw err;
    }
  }

  async getCameraStream(deviceId) {
    if (this.cameraStream) {
      this.stopStream(this.cameraStream);
      this.cameraStream = null;
    }
    
    if (!deviceId) return null;

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: 1280, height: 720 },
        audio: false
      });
      return this.cameraStream;
    } catch (err) {
      console.error("Error capturando cámara", err);
      throw err;
    }
  }

  async getMicStream(deviceId) {
    if (this.micStream) {
      this.stopStream(this.micStream);
      this.micStream = null;
    }
    
    if (!deviceId) return null;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false
      });
      return this.micStream;
    } catch (err) {
      console.error("Error capturando micrófono", err);
      throw err;
    }
  }

  stopStream(stream) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }

  stopAll() {
    this.stopStream(this.screenStream);
    this.stopStream(this.cameraStream);
    this.stopStream(this.micStream);
    this.screenStream = null;
    this.cameraStream = null;
    this.micStream = null;
  }
}
