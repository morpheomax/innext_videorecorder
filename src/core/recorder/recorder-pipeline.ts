const preferredMimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

function pickMimeType() {
  for (const mimeType of preferredMimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

export class RecorderPipeline {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  start(videoStream: MediaStream, audioTrack: MediaStreamTrack | null) {
    const tracks = [...videoStream.getVideoTracks()];
    if (audioTrack) {
      tracks.push(audioTrack);
    }

    const stream = new MediaStream(tracks);
    const mimeType = pickMimeType();
    this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.recordedChunks = [];

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    });

    this.mediaRecorder.start(200);
  }

  pause() {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resume() {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  async stop() {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      return null;
    }

    return await new Promise<Blob | null>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          const type = recorder.mimeType || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type });
          this.recordedChunks = [];
          resolve(blob);
        },
        { once: true },
      );

      recorder.stop();
    });
  }

  dispose() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.recordedChunks = [];
    this.mediaRecorder = null;
  }
}
