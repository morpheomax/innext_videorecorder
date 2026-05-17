import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioMixer } from '../../core/audio/audio-mixer';
import StudioEditor from '../editor/StudioEditor';
import { CaptureManager, type DeviceAccessState, type MediaDeviceOption } from '../../core/capture/capture-manager';
import {
  POSITION_PRESETS,
  type CameraShape,
  type PositionPreset,
  type StudioFormat,
  StreamCompositor,
} from '../../core/compositor/stream-compositor';
import { RecorderPipeline } from '../../core/recorder/recorder-pipeline';
import { studioStorage, type RecordingMeta } from '../../core/storage/studio-storage';
import type { EditorAsset } from '../../features/editor/types';

type RecorderState = 'inactive' | 'recording' | 'paused';
type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type StudioView = 'studio' | 'editor';
type DeviceStatusTone = 'ready' | 'warning' | 'idle';

const formatOptions: Array<{ value: StudioFormat; label: string; hint: string }> = [
  { value: '16:9', label: '16:9', hint: 'YouTube y cursos horizontales' },
  { value: '9:16', label: '9:16', hint: 'Reels, Shorts y vertical' },
  { value: '1:1', label: '1:1', hint: 'Miniaturas y promos cuadradas' },
];

const shapeOptions: Array<{ value: CameraShape; label: string }> = [
  { value: 'circle', label: 'Circular' },
  { value: 'square', label: 'Cuadrada' },
  { value: 'vertical', label: 'Vertical' },
];

const hotkeyLabels: Array<{ combo: string; action: string }> = [
  { combo: 'Ctrl/Cmd + R', action: 'Iniciar o detener la grabacion' },
  { combo: 'Espacio', action: 'Pausar o reanudar' },
  { combo: 'Tab', action: 'Abrir o cerrar el panel' },
  { combo: 'Alt + 1..8', action: 'Mover la camara entre esquinas y centros de borde' },
];

function createDownloadName() {
  return `studio-recorder-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
}

function formatSeconds(seconds: number) {
  const hrs = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudioApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<CaptureManager | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const compositorRef = useRef<StreamCompositor | null>(null);
  const recorderRef = useRef<RecorderPipeline | null>(null);
  const toastIdRef = useRef(0);
  const latestUrlRef = useRef<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [recordingState, setRecordingState] = useState<RecorderState>('inactive');
  const [secondsRecorded, setSecondsRecorded] = useState(0);
  const [format, setFormat] = useState<StudioFormat>('16:9');
  const [shape, setShape] = useState<CameraShape>('circle');
  const [borderColor, setBorderColor] = useState('#22c55e');
  const [mirrorCamera, setMirrorCamera] = useState(true);
  const [cursorMode, setCursorMode] = useState<'always' | 'motion' | 'never'>('always');
  const [micGain, setMicGain] = useState(1);
  const [systemGain, setSystemGain] = useState(1);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [activePosition, setActivePosition] = useState<PositionPreset>('bottom-right');
  const [latestRecordingUrl, setLatestRecordingUrl] = useState<string | null>(null);
  const [latestRecordingMime, setLatestRecordingMime] = useState('video/webm');
  const [view, setView] = useState<StudioView>('studio');
  const [editorAsset, setEditorAsset] = useState<EditorAsset | null>(null);
  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [deviceAccess, setDeviceAccess] = useState<DeviceAccessState>({ camera: 'unsupported', microphone: 'unsupported' });
  const [probingDevices, setProbingDevices] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const activePositionLabel = useMemo(
    () => POSITION_PRESETS.find((entry) => entry.value === activePosition)?.label ?? 'Inferior derecha',
    [activePosition],
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const capture = new CaptureManager();
    const mixer = new AudioMixer();
    const compositor = new StreamCompositor(canvasRef.current);
    const recorder = new RecorderPipeline();

    captureRef.current = capture;
    mixerRef.current = mixer;
    compositorRef.current = compositor;
    recorderRef.current = recorder;

    compositor.setFormat(format);
    compositor.setCameraShape(shape);
    compositor.setBorderColor(borderColor);
    compositor.setMirror(mirrorCamera);
    compositor.setPositionPreset(activePosition);

    void refreshDevices();
    void refreshRecordings();
    void refreshDeviceAccess();

    return () => {
      capture.stopAll();
      mixer.dispose();
      compositor.dispose();
      recorder.dispose();

      if (latestUrlRef.current) {
        URL.revokeObjectURL(latestUrlRef.current);
        latestUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) {
      return;
    }

    compositor.setFormat(format);
  }, [format]);

  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) {
      return;
    }

    compositor.setCameraShape(shape);
    compositor.setPositionPreset(activePosition);
  }, [shape, activePosition]);

  useEffect(() => {
    compositorRef.current?.setBorderColor(borderColor);
  }, [borderColor]);

  useEffect(() => {
    compositorRef.current?.setMirror(mirrorCamera);
  }, [mirrorCamera]);

  useEffect(() => {
    mixerRef.current?.setMicGain(micGain);
  }, [micGain]);

  useEffect(() => {
    mixerRef.current?.setSystemGain(systemGain);
  }, [systemGain]);

  useEffect(() => {
    if (recordingState !== 'recording') {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsRecorded((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [recordingState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        if (recordingState === 'inactive') {
          void startRecording();
        } else {
          void stopRecording();
        }
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        setSidebarOpen((current) => !current);
      }

      if (!isEditable && event.code === 'Space' && recordingState !== 'inactive') {
        event.preventDefault();
        if (recordingState === 'recording') {
          recorderRef.current?.pause();
          setRecordingState('paused');
          addToast('Grabacion en pausa.', 'info');
        } else if (recordingState === 'paused') {
          recorderRef.current?.resume();
          setRecordingState('recording');
          addToast('Grabacion reanudada.', 'success');
        }
      }

      if (event.altKey) {
        const index = Number.parseInt(event.key, 10);
        if (index >= 1 && index <= POSITION_PRESETS.length) {
          event.preventDefault();
          moveCameraTo(POSITION_PRESETS[index - 1].value);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recordingState]);

  async function refreshDevices() {
    try {
      const capture = captureRef.current;
      if (!capture) {
        return;
      }

      const devices = await capture.enumerateDevices();
      setCameras(devices.cameras);
      setMics(devices.mics);
    } catch {
      addToast('No fue posible listar dispositivos del navegador.', 'error');
    }
  }

  async function refreshDeviceAccess() {
    try {
      const capture = captureRef.current;
      if (!capture) {
        return;
      }

      setDeviceAccess(await capture.getDeviceAccessState());
    } catch {
      setDeviceAccess({ camera: 'unsupported', microphone: 'unsupported' });
    }
  }

  async function probeDevices() {
    const capture = captureRef.current;
    if (!capture) {
      return;
    }

    try {
      setProbingDevices(true);
      await capture.requestDeviceAccess();
      await refreshDevices();
      await refreshDeviceAccess();
      addToast('Permisos de camara y microfono listos. Ya puedes seleccionar dispositivos.', 'success');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : 'Error';
      if (name === 'NotAllowedError') {
        addToast('El navegador bloqueo camara o microfono. Debes conceder permisos para listar dispositivos.', 'error');
      } else {
        addToast('No fue posible detectar camara y microfono.', 'error');
      }
    } finally {
      setProbingDevices(false);
    }
  }

  async function refreshRecordings() {
    try {
      setRecordings(await studioStorage.listRecordings());
    } catch {
      addToast('No fue posible leer la biblioteca local.', 'error');
    }
  }

  function addToast(message: string, tone: Toast['tone']) {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function moveCameraTo(position: PositionPreset) {
    compositorRef.current?.setPositionPreset(position);
    setActivePosition(position);
  }

  async function handleScreenSelection() {
    try {
      const capture = captureRef.current;
      const compositor = compositorRef.current;
      const mixer = mixerRef.current;

      if (!capture || !compositor || !mixer) {
        return;
      }

      const stream = await capture.getScreenStream(cursorMode);
      compositor.setScreenStream(stream);

      const connectedSystemAudio = mixer.setSystemStream(stream);
      setHasSystemAudio(connectedSystemAudio);

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        compositor.setScreenStream(null);
        mixer.setSystemStream(null);
        setHasSystemAudio(false);
        addToast('La captura de pantalla se detuvo.', 'info');
      });

      addToast(
        connectedSystemAudio
          ? 'Pantalla conectada con audio de sistema disponible.'
          : 'Pantalla conectada. Si el navegador no entrega audio de sistema, seguiremos con el microfono.',
        'success',
      );
      await refreshDevices();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : 'Error';
      if (name !== 'NotAllowedError') {
        addToast('No fue posible capturar la pantalla.', 'error');
      }
    }
  }

  async function handleCameraChange(deviceId: string) {
    setSelectedCamera(deviceId);

    try {
      const capture = captureRef.current;
      const compositor = compositorRef.current;

      if (!capture || !compositor) {
        return;
      }

      if (!deviceId) {
        compositor.setCameraStream(null);
        return;
      }

      const stream = await capture.getCameraStream(deviceId);
      compositor.setCameraStream(stream);
      addToast('Camara conectada al set.', 'success');
      await refreshDevices();
    } catch {
      setSelectedCamera('');
      addToast('No fue posible encender la camara.', 'error');
    }
  }

  async function handleMicChange(deviceId: string) {
    setSelectedMic(deviceId);

    try {
      const capture = captureRef.current;
      const mixer = mixerRef.current;

      if (!capture || !mixer) {
        return;
      }

      if (!deviceId) {
        mixer.setMicStream(null);
        return;
      }

      const stream = await capture.getMicStream(deviceId);
      mixer.setMicStream(stream);
      addToast('Microfono conectado.', 'success');
      await refreshDevices();
    } catch {
      setSelectedMic('');
      addToast('No fue posible activar el microfono.', 'error');
    }
  }

  async function startRecording() {
    const capture = captureRef.current;
    const compositor = compositorRef.current;
    const mixer = mixerRef.current;
    const recorder = recorderRef.current;

    if (!capture?.screenStream || !compositor || !mixer || !recorder) {
      addToast('Selecciona primero una pantalla para grabar.', 'error');
      return;
    }

    try {
      recorder.start(compositor.getStream(30), mixer.getMixedTrack());
      setSecondsRecorded(0);
      setRecordingState('recording');
      addToast('Grabacion iniciada.', 'success');
    } catch {
      addToast('No fue posible iniciar la grabacion.', 'error');
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }

    const blob = await recorder.stop();
    setRecordingState('inactive');

    if (!blob) {
      return;
    }

    if (latestUrlRef.current) {
      URL.revokeObjectURL(latestUrlRef.current);
    }

    const url = URL.createObjectURL(blob);
    latestUrlRef.current = url;
    setLatestRecordingUrl(url);
    setLatestRecordingMime(blob.type || 'video/webm');

    const recordingId = `rec-${Date.now()}`;
    try {
      await studioStorage.saveRecording({
        id: recordingId,
        name: createDownloadName(),
        createdAt: new Date().toISOString(),
        durationMs: secondsRecorded * 1000,
        mimeType: blob.type || 'video/webm',
        sizeBytes: blob.size,
        format,
        blob,
      });
      await refreshRecordings();
    } catch {
      addToast('No fue posible guardar la grabacion en la biblioteca local.', 'error');
    }

    setEditorAsset({ blob, name: createDownloadName(), format });
    setEditorSessionKey((current) => current + 1);
    setView('editor');
    addToast('Grabacion lista. Abriendo editor multipista.', 'success');
  }

  async function openRecordingInEditor(recordingId: string) {
    try {
      const recording = await studioStorage.getRecording(recordingId);
      if (!recording) {
        addToast('La grabacion solicitada ya no existe.', 'error');
        await refreshRecordings();
        return;
      }

      if (latestUrlRef.current) {
        URL.revokeObjectURL(latestUrlRef.current);
      }

      const url = URL.createObjectURL(recording.blob);
      latestUrlRef.current = url;
      setLatestRecordingUrl(url);
      setLatestRecordingMime(recording.mimeType);
      setEditorAsset({ blob: recording.blob, name: recording.name, format: recording.format ?? '16:9' });
      setEditorSessionKey((current) => current + 1);
      setView('editor');
      addToast('Grabacion cargada desde la biblioteca local.', 'success');
    } catch {
      addToast('No fue posible abrir la grabacion guardada.', 'error');
    }
  }

  async function deleteRecording(recordingId: string) {
    try {
      await studioStorage.deleteRecording(recordingId);
      await refreshRecordings();
      addToast('Grabacion eliminada de la biblioteca local.', 'success');
    } catch {
      addToast('No fue posible eliminar la grabacion.', 'error');
    }
  }

  async function clearLocalData() {
    const confirmed = window.confirm('Esto borrara grabaciones y proyectos guardados localmente en este navegador.');
    if (!confirmed) {
      return;
    }

    try {
      await studioStorage.clearAll();
      setRecordings([]);
      addToast('Biblioteca local borrada por completo.', 'success');
    } catch {
      addToast('No fue posible borrar los datos locales.', 'error');
    }
  }

  const recordButtonLabel =
    recordingState === 'inactive' ? 'Grabar' : recordingState === 'recording' ? 'Detener' : 'Detener';

  const deviceSummary = useMemo(() => {
    const cameraReady = cameras.length > 0;
    const micReady = mics.length > 0;
    const tone: DeviceStatusTone = cameraReady || micReady ? 'ready' : probingDevices ? 'warning' : 'idle';
    const text = cameraReady || micReady
      ? `${cameras.length} camaras · ${mics.length} microfonos detectados`
      : 'Autoriza camara y microfono para ver dispositivos reales';
    return { tone, text };
  }, [cameras.length, mics.length, probingDevices]);

  const permissionLabel = useMemo(() => {
    const parts = [
      `Camara: ${deviceAccess.camera}`,
      `Microfono: ${deviceAccess.microphone}`,
    ];
    return parts.join(' · ');
  }, [deviceAccess]);

  if (view === 'editor') {
    return (
      <>
        <StudioEditor initialAsset={editorAsset} sessionKey={editorSessionKey} onBackToStudio={() => setView('studio')} />

        <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={[
                'rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur',
                toast.tone === 'success'
                  ? 'border-emerald-300/20 bg-emerald-400/14 text-emerald-50'
                  : toast.tone === 'error'
                    ? 'border-orange-300/25 bg-orange-400/14 text-orange-50'
                    : 'border-sky-300/20 bg-sky-400/14 text-sky-50',
              ].join(' ')}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="relative grid min-h-[calc(100vh-8rem)] gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside
        className={[
          'glass rounded-[28px] border px-5 py-5 transition duration-300',
          sidebarOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-6 opacity-0 lg:pointer-events-auto lg:translate-x-0 lg:opacity-100',
        ].join(' ')}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Streaming Studio</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Set de grabacion local</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-white/8 bg-white/3 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Fuentes</h3>
              <span className="text-xs text-slate-400">3 pasos para grabar</span>
            </div>
            <div className="grid gap-3">
              <button type="button" className="btn-primary w-full" onClick={handleScreenSelection}>
                Elegir pantalla
              </button>
              <button
                type="button"
                className="rounded-full border border-white/12 bg-slate-950/45 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-300/40 hover:text-white disabled:opacity-50"
                onClick={() => void probeDevices()}
                disabled={probingDevices}
              >
                {probingDevices ? 'Detectando dispositivos...' : 'Detectar camara y microfono'}
              </button>
            </div>
            <div
              className={[
                'mt-4 rounded-2xl border px-3 py-3 text-sm',
                deviceSummary.tone === 'ready'
                  ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                  : deviceSummary.tone === 'warning'
                    ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
                    : 'border-white/8 bg-slate-950/35 text-slate-300',
              ].join(' ')}
            >
              <strong className="block text-white">Estado de dispositivos</strong>
              <span className="mt-1 block">{deviceSummary.text}</span>
              <span className="mt-2 block text-xs text-slate-400">{permissionLabel}</span>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <label className="block">
                <span className="mb-2 block text-slate-300">Camara</span>
                <select
                  value={selectedCamera}
                  onChange={(event) => void handleCameraChange(event.target.value)}
                  disabled={cameras.length === 0}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-slate-100 outline-none"
                >
                  <option value="">Desactivada</option>
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-slate-300">Microfono</span>
                <select
                  value={selectedMic}
                  onChange={(event) => void handleMicChange(event.target.value)}
                  disabled={mics.length === 0}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-slate-100 outline-none"
                >
                  <option value="">Desactivado</option>
                  {mics.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </option>
                  ))}
                </select>
              </label>

              {cameras.length === 0 || mics.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 px-3 py-3 text-xs leading-6 text-slate-400">
                  Si no ves los nombres del equipo, pulsa <strong className="text-slate-200">Detectar camara y microfono</strong>.
                  Algunos navegadores no exponen dispositivos hasta que autorizas permisos.
                </p>
              ) : null}

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3 text-slate-200">
                <span>Espejo de camara</span>
                <input
                  type="checkbox"
                  checked={mirrorCamera}
                  onChange={(event) => setMirrorCamera(event.target.checked)}
                  className="h-4 w-4 accent-emerald-400"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/3 p-4">
            <h3 className="text-sm font-semibold text-white">Formato y estilo</h3>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                {formatOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value)}
                    className={[
                      'rounded-2xl border px-3 py-3 text-left text-sm transition',
                      format === option.value
                        ? 'border-emerald-300/60 bg-emerald-400/12 text-white'
                        : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20',
                    ].join(' ')}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">{option.hint}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {shapeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setShape(option.value)}
                    className={[
                      'rounded-2xl border px-3 py-3 text-sm transition',
                      shape === option.value
                        ? 'border-sky-300/60 bg-sky-400/12 text-white'
                        : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Color de borde</span>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(event) => setBorderColor(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-2"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/3 p-4">
            <h3 className="text-sm font-semibold text-white">Audio y cursor</h3>
            <div className="mt-4 space-y-4 text-sm">
              <label className="block">
                <div className="mb-2 flex items-center justify-between text-slate-300">
                  <span>Ganancia microfono</span>
                  <span>{Math.round(micGain * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={micGain}
                  onChange={(event) => setMicGain(Number(event.target.value))}
                  className="w-full accent-emerald-400"
                />
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between text-slate-300">
                  <span>Ganancia sistema</span>
                  <span>{Math.round(systemGain * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={systemGain}
                  onChange={(event) => setSystemGain(Number(event.target.value))}
                  className="w-full accent-sky-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-slate-300">Captura del cursor</span>
                <select
                  value={cursorMode}
                  onChange={(event) => setCursorMode(event.target.value as 'always' | 'motion' | 'never')}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-slate-100 outline-none"
                >
                  <option value="always">Siempre visible</option>
                  <option value="motion">Solo al moverlo</option>
                  <option value="never">Oculto</option>
                </select>
              </label>

              <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3 text-sm text-slate-300">
                <strong className="block text-white">Audio de sistema</strong>
                <span className={hasSystemAudio ? 'text-emerald-300' : 'text-amber-300'}>
                  {hasSystemAudio
                    ? 'Disponible en la fuente actual.'
                    : 'No garantizado. Depende del navegador y de la fuente compartida.'}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/3 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Posicion rapida de camara</h3>
                <p className="mt-1 text-xs text-slate-400">Activo: {activePositionLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {POSITION_PRESETS.map((preset, index) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => moveCameraTo(preset.value)}
                  className={[
                    'rounded-2xl border px-3 py-3 text-left transition',
                    activePosition === preset.value
                      ? 'border-emerald-300/60 bg-emerald-400/12 text-white'
                      : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20',
                  ].join(' ')}
                >
                  <span className="block font-medium">{preset.label}</span>
                  <span className="mt-1 block text-xs text-slate-400">Alt + {index + 1}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <section className="space-y-5">
        <div className="glass rounded-[30px] border px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Preview = export final</p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Estudio streaming sin registro</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 lg:hidden"
                onClick={() => setSidebarOpen((current) => !current)}
              >
                Ajustes
              </button>

              <span className="rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-sm text-slate-200">
                {formatSeconds(secondsRecorded)}
              </span>
              <button
                type="button"
                className={[
                  'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition',
                  recordingState === 'inactive'
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-amber-400 text-slate-950 hover:bg-amber-300',
                ].join(' ')}
                onClick={() => {
                  if (recordingState === 'inactive') {
                    void startRecording();
                  } else {
                    void stopRecording();
                  }
                }}
              >
                {recordButtonLabel}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 disabled:opacity-40"
                disabled={recordingState === 'inactive'}
                onClick={() => {
                  if (recordingState === 'recording') {
                    recorderRef.current?.pause();
                    setRecordingState('paused');
                  } else if (recordingState === 'paused') {
                    recorderRef.current?.resume();
                    setRecordingState('recording');
                  }
                }}
              >
                {recordingState === 'paused' ? 'Reanudar' : 'Pausar'}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#020617] p-3 shadow-[0_25px_120px_rgba(0,0,0,0.45)]">
            <canvas ref={canvasRef} className="aspect-video w-full rounded-[24px] bg-slate-950 object-contain" />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
              <h2 className="text-sm font-semibold text-white">Atajos del set</h2>
              <ul className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                {hotkeyLabels.map((entry) => (
                  <li key={entry.combo} className="rounded-2xl border border-white/6 bg-white/3 px-3 py-3">
                    <strong className="block text-white">{entry.combo}</strong>
                    <span className="mt-1 block text-slate-400">{entry.action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
              <h2 className="text-sm font-semibold text-white">Estado del flujo</h2>
              <ul className="mt-3 space-y-3 text-sm text-slate-300">
                <li className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-3 py-3">
                  <span>Pantalla</span>
                  <strong className="text-white">{captureRef.current?.screenStream ? 'Lista' : 'Pendiente'}</strong>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-3 py-3">
                  <span>Camara</span>
                  <strong className="text-white">{selectedCamera ? 'Activa' : cameras.length > 0 ? 'Lista para elegir' : 'Sin permisos'}</strong>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-3 py-3">
                  <span>Audio</span>
                  <strong className="text-white">{selectedMic || hasSystemAudio ? 'Listo' : mics.length > 0 ? 'Mic disponible' : 'Sin permisos'}</strong>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-3 py-3">
                  <span>Grabacion</span>
                  <strong className="text-white">
                    {recordingState === 'inactive'
                      ? 'Lista para iniciar'
                      : recordingState === 'paused'
                        ? 'En pausa'
                        : 'Grabando'}
                  </strong>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="glass rounded-[30px] border px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Biblioteca local</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Grabacion lista para entrar a timeline</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Al detener el set, la grabacion se abre directo en el editor multipista. Desde ahi ya puedes sumar pistas,
                ordenar clips, recortar, mezclar audio, importar imagenes y exportar WebM.
              </p>
            </div>
            <button type="button" className="rounded-full border border-orange-300/20 px-4 py-2 text-sm text-orange-200" onClick={() => void clearLocalData()}>
              Borrar todo local
            </button>
          </div>

          {latestRecordingUrl ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-hidden rounded-[24px] border border-white/8 bg-black">
                <video src={latestRecordingUrl} controls className="aspect-video w-full" />
              </div>
              <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4 text-sm text-slate-300">
                <h3 className="text-base font-semibold text-white">Ultima grabacion</h3>
                <p className="mt-3">Se genero localmente en el navegador. No se envio a ningun servidor.</p>
                <p className="mt-2 text-slate-400">Formato detectado: {latestRecordingMime}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={latestRecordingUrl} download={createDownloadName()} className="btn-primary">
                    Descargar de nuevo
                  </a>
                  <button type="button" className="btn-secondary" onClick={() => setView('editor')}>
                    Abrir editor
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-white/12 bg-slate-950/25 px-4 py-8 text-sm text-slate-400">
              Tu grabacion aparecera aqui apenas detengas el set y se abrira automaticamente en el editor multipista.
            </div>
          )}

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">Biblioteca local de grabaciones</h3>
              <span className="rounded-full border border-white/10 bg-slate-950/35 px-4 py-2 text-sm text-slate-300">
                {recordings.length} guardadas
              </span>
            </div>

            {recordings.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/12 bg-slate-950/20 px-4 py-8 text-sm text-slate-400">
                Todavia no hay grabaciones guardadas en este navegador.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {recordings.map((recording) => (
                  <article key={recording.id} className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4 text-sm text-slate-300">
                    <strong className="block text-base text-white">{recording.name}</strong>
                    <p className="mt-2 text-slate-400">{new Date(recording.createdAt).toLocaleString()}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>{formatSeconds(recording.durationMs / 1000)}</span>
                      <span>{formatBytes(recording.sizeBytes)}</span>
                      <span>{recording.mimeType}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100" onClick={() => void openRecordingInEditor(recording.id)}>
                        Abrir en editor
                      </button>
                      <button type="button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200" onClick={async () => {
                        const entry = await studioStorage.getRecording(recording.id);
                        if (!entry) {
                          addToast('La grabacion ya no existe.', 'error');
                          await refreshRecordings();
                          return;
                        }
                        const downloadUrl = URL.createObjectURL(entry.blob);
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = entry.name;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
                      }}>
                        Descargar
                      </button>
                      <button type="button" className="rounded-full border border-orange-300/20 px-3 py-2 text-xs text-orange-200" onClick={() => void deleteRecording(recording.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur',
              toast.tone === 'success'
                ? 'border-emerald-300/20 bg-emerald-400/14 text-emerald-50'
                : toast.tone === 'error'
                  ? 'border-orange-300/25 bg-orange-400/14 text-orange-50'
                  : 'border-sky-300/20 bg-sky-400/14 text-sky-50',
            ].join(' ')}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
