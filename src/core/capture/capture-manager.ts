export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface DeviceAccessState {
  camera: PermissionState | 'unsupported';
  microphone: PermissionState | 'unsupported';
}

type DisplayCursorMode = 'always' | 'motion' | 'never';
type DisplayTrackConstraints = MediaTrackConstraints & { cursor?: DisplayCursorMode };

export class CaptureManager {
  screenStream: MediaStream | null = null;
  cameraStream: MediaStream | null = null;
  micStream: MediaStream | null = null;

  private async queryPermission(name: 'camera' | 'microphone'): Promise<PermissionState | 'unsupported'> {
    if (!('permissions' in navigator) || !navigator.permissions?.query) {
      return 'unsupported';
    }

    try {
      const status = await navigator.permissions.query({ name } as PermissionDescriptor);
      return status.state;
    } catch {
      return 'unsupported';
    }
  }

  async getDeviceAccessState(): Promise<DeviceAccessState> {
    const [camera, microphone] = await Promise.all([
      this.queryPermission('camera'),
      this.queryPermission('microphone'),
    ]);

    return { camera, microphone };
  }

  async requestDeviceAccess() {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    probe.getTracks().forEach((track) => track.stop());
    return await this.enumerateDevices();
  }

  async enumerateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const cameras = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camara ${index + 1}`,
      }));

    const mics = devices
      .filter((device) => device.kind === 'audioinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microfono ${index + 1}`,
      }));

    return { cameras, mics };
  }

  async getScreenStream(cursor: DisplayCursorMode) {
    this.stopStream(this.screenStream);

    const videoConstraints: DisplayTrackConstraints = {
      cursor,
      frameRate: 30,
    };

    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: videoConstraints,
      audio: true,
    });

    return this.screenStream;
  }

  async getCameraStream(deviceId: string) {
    this.stopStream(this.cameraStream);

    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    return this.cameraStream;
  }

  async getMicStream(deviceId: string) {
    this.stopStream(this.micStream);

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });

    return this.micStream;
  }

  stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop());
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
