// js/recorder.js
export class Recorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  start(videoStream, audioStream) {
    // Combinar el track de video del canvas con el track(s) de audio mezclado
    const tracks = [
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ];
    
    // Crear el stream combinado final
    const combinedStream = new MediaStream(tracks);
    
    const options = { mimeType: 'video/webm;codecs=vp9' };
    
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.warn("VP9 no soportado, fallback a estándar");
      options.mimeType = 'video/webm';
    }

    this.mediaRecorder = new MediaRecorder(combinedStream, options);
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100); // chunkings 100ms for safety
  }

  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
         resolve(null);
         return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'video/webm' });
        this.recordedChunks = [];
        resolve(blob);
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  }

  getState() {
    return this.mediaRecorder ? this.mediaRecorder.state : 'inactive';
  }
}
