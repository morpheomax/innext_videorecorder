// js/audioMixer.js
export class AudioMixer {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.destination = this.ctx.createMediaStreamDestination();
    
    this.micSource = null;
    this.systemSource = null;
    
    // Nodos de ganancia
    this.micNode = this.ctx.createGain();
    this.systemNode = this.ctx.createGain();
    
    this.micNode.connect(this.destination);
    this.systemNode.connect(this.destination);

    this.micNode.gain.value = 1.0;
    this.systemNode.gain.value = 1.0;
  }

  setMicStream(stream) {
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (stream) {
      // Necesitamos reanudar contexto si está suspendido
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micSource.connect(this.micNode);
    }
  }

  setSystemStream(stream) {
    if (this.systemSource) {
      this.systemSource.disconnect();
      this.systemSource = null;
    }
    // Verificamos que el stream tenga tracks de audio
    if (stream && stream.getAudioTracks().length > 0) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.systemSource = this.ctx.createMediaStreamSource(stream);
      this.systemSource.connect(this.systemNode);
      return true; // Indica que se enganchó audio
    }
    return false;
  }

  setMicVolume(value) {
    this.micNode.gain.value = value;
  }

  getMixedStream() {
    return this.destination.stream;
  }
}
