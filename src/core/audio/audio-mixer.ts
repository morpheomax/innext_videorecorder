export class AudioMixer {
  private context: AudioContext;
  private destination: MediaStreamAudioDestinationNode;
  private micGainNode: GainNode;
  private systemGainNode: GainNode;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private systemSource: MediaStreamAudioSourceNode | null = null;

  constructor() {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
    this.micGainNode = this.context.createGain();
    this.systemGainNode = this.context.createGain();

    this.micGainNode.gain.value = 1;
    this.systemGainNode.gain.value = 1;

    this.micGainNode.connect(this.destination);
    this.systemGainNode.connect(this.destination);
  }

  private ensureRunning() {
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  setMicStream(stream: MediaStream | null) {
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (!stream) {
      return;
    }

    this.ensureRunning();
    this.micSource = this.context.createMediaStreamSource(stream);
    this.micSource.connect(this.micGainNode);
  }

  setSystemStream(stream: MediaStream | null) {
    if (this.systemSource) {
      this.systemSource.disconnect();
      this.systemSource = null;
    }

    if (!stream || stream.getAudioTracks().length === 0) {
      return false;
    }

    this.ensureRunning();
    this.systemSource = this.context.createMediaStreamSource(stream);
    this.systemSource.connect(this.systemGainNode);
    return true;
  }

  setMicGain(value: number) {
    this.micGainNode.gain.value = value;
  }

  setSystemGain(value: number) {
    this.systemGainNode.gain.value = value;
  }

  getMixedTrack() {
    return this.destination.stream.getAudioTracks()[0] ?? null;
  }

  dispose() {
    this.micSource?.disconnect();
    this.systemSource?.disconnect();
    this.micGainNode.disconnect();
    this.systemGainNode.disconnect();
    void this.context.close();
  }
}
