import { useEffect, useMemo, useRef, useState } from 'react';
import { SidebarSectionIcon, ToolbarIcon, getTimelineClipDecoration, type SidebarSection } from './EditorIcons';
import { EditorTopBar } from './EditorTopBar';
import { generateWaveform } from '../../core/audio/waveform-generator';
import type { StudioFormat } from '../../core/compositor/stream-compositor';
import { transcodeWebmToMp4 } from '../../core/export/mp4-transcoder';
import { RecorderPipeline } from '../../core/recorder/recorder-pipeline';
import { studioStorage, type ProjectRecord } from '../../core/storage/studio-storage';
import { EDITOR_TRACKS } from '../../features/editor/tracks';
import type { EditorAsset, EditorClip, EditorTrackDefinition, EditorTrackId } from '../../features/editor/types';

interface StudioEditorProps {
  initialAsset: EditorAsset | null;
  sessionKey: number;
  onBackToStudio: () => void;
}

type DragMode =
  | { type: 'move'; clipId: string; startX: number; startTime: number; startTrackId: EditorTrackId }
  | { type: 'trim-start'; clipId: string; startX: number; startTrim: number; startTime: number }
  | { type: 'trim-end'; clipId: string; startX: number; startTrim: number };

const DEFAULT_ZOOM = 84;
const MIN_CLIP_DURATION = 0.25;
const SNAP_PIXELS = 14;
const TIMELINE_LABEL_WIDTH = 124;

function getFormatDimensions(format: StudioFormat) {
  if (format === '9:16') {
    return { width: 720, height: 1280 };
  }

  if (format === '1:1') {
    return { width: 1080, height: 1080 };
  }

  return { width: 1280, height: 720 };
}

const EDITOR_FORMAT_OPTIONS: Array<{ value: StudioFormat; label: string }> = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
];

type ExportFormat = 'webm' | 'mp4';
type VisualFilter = NonNullable<EditorClip['filter']>;

const FILTER_LABELS: Array<{ value: VisualFilter; label: string; css: string }> = [
  { value: 'none', label: 'Normal', css: 'none' },
  { value: 'warm', label: 'Warm', css: 'saturate(1.15) sepia(0.18) contrast(1.04)' },
  { value: 'cool', label: 'Cool', css: 'saturate(0.9) hue-rotate(12deg) brightness(1.02)' },
  { value: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.08)' },
  { value: 'dramatic', label: 'Dramatic', css: 'contrast(1.18) saturate(1.22) brightness(0.96)' },
];

function formatSeconds(seconds: number) {
  const total = Math.max(0, seconds);
  const hrs = Math.floor(total / 3600)
    .toString()
    .padStart(2, '0');
  const mins = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function formatPreciseTime(seconds: number) {
  const total = Math.max(0, seconds);
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  const millis = Math.round((total % 1) * 1000)
    .toString()
    .padStart(3, '0');
  return `${mins}:${secs}.${millis}`;
}

function formatTimelineTime(seconds: number, totalDuration: number) {
  const total = Math.max(0, seconds);

  if (totalDuration >= 3600) {
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60)
      .toString()
      .padStart(2, '0');
    return `${hrs}:${mins}`;
  }

  if (totalDuration >= 300) {
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  }

  return `${Math.floor(total)}s`;
}

function parsePreciseTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
  }

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  return null;
}

function clipDuration(clip: EditorClip) {
  return Math.max(0, clip.trimEnd - clip.trimStart);
}

function clipEnd(clip: EditorClip) {
  return clip.startTime + clipDuration(clip);
}

function sortClips(a: EditorClip, b: EditorClip) {
  return a.startTime - b.startTime || a.name.localeCompare(b.name);
}

function isVisualClip(clip: EditorClip) {
  return clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'text';
}

function isMediaClip(clip: EditorClip) {
  return clip.kind === 'video' || clip.kind === 'audio';
}

function createClipId() {
  return `clip-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  element: HTMLVideoElement | HTMLImageElement,
  width: number,
  height: number,
) {
  const mediaWidth = 'videoWidth' in element ? element.videoWidth : element.naturalWidth;
  const mediaHeight = 'videoHeight' in element ? element.videoHeight : element.naturalHeight;
  if (!mediaWidth || !mediaHeight) {
    return;
  }

  const scale = Math.max(width / mediaWidth, height / mediaHeight);
  const drawWidth = mediaWidth * scale;
  const drawHeight = mediaHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(element, x, y, drawWidth, drawHeight);
}

function getVisualPosition(clip: EditorClip) {
  return {
    x: clip.x ?? 0.5,
    y: clip.y ?? 0.5,
    scale: clip.scale ?? 1,
    opacity: clip.opacity ?? 1,
    rotation: clip.rotation ?? 0,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTextMetrics(clip: EditorClip, previewWidth: number, previewHeight: number) {
  const { x, y, scale } = getVisualPosition(clip);
  const fontSize = Math.max(24, (clip.fontSize ?? 42) * scale);
  const boxWidth = Math.max(260, (previewWidth - 160) * scale);
  const boxHeight = Math.max(68, 88 * scale);
  const boxX = previewWidth * x - boxWidth / 2;
  const boxY = previewHeight * y - boxHeight / 2;

  return { x, y, fontSize, boxWidth, boxHeight, boxX, boxY };
}

function getClipLocalTime(clip: EditorClip, time: number) {
  return time - clip.startTime;
}

function getFadeMultiplier(clip: EditorClip, time: number) {
  const localTime = getClipLocalTime(clip, time);
  const duration = clipDuration(clip);
  let opacity = 1;

  if (clip.fadeIn && clip.fadeIn > 0) {
    opacity = Math.min(opacity, clamp(localTime / clip.fadeIn, 0, 1));
  }

  if (clip.fadeOut && clip.fadeOut > 0) {
    opacity = Math.min(opacity, clamp((duration - localTime) / clip.fadeOut, 0, 1));
  }

  return opacity;
}

function getFilterCss(filter: EditorClip['filter']) {
  return FILTER_LABELS.find((entry) => entry.value === (filter ?? 'none'))?.css ?? 'none';
}

function drawPositionedMedia(
  ctx: CanvasRenderingContext2D,
  element: HTMLVideoElement | HTMLImageElement,
  previewWidth: number,
  previewHeight: number,
  clip: EditorClip,
  alphaMultiplier = 1,
) {
  const mediaWidth = 'videoWidth' in element ? element.videoWidth : element.naturalWidth;
  const mediaHeight = 'videoHeight' in element ? element.videoHeight : element.naturalHeight;
  if (!mediaWidth || !mediaHeight) {
    return;
  }

  const { x, y, scale, opacity, rotation } = getVisualPosition(clip);
  const baseScale = Math.min(previewWidth / mediaWidth, previewHeight / mediaHeight);
  const drawWidth = mediaWidth * baseScale * scale;
  const drawHeight = mediaHeight * baseScale * scale;
  const centerX = previewWidth * x;
  const centerY = previewHeight * y;

  ctx.save();
  ctx.globalAlpha = opacity * alphaMultiplier;
  ctx.filter = getFilterCss(clip.filter);
  ctx.translate(centerX, centerY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(element, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

export default function StudioEditor({ initialAsset, sessionKey, onBackToStudio }: StudioEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaNodesRef = useRef<
    Map<
      string,
      {
        element: HTMLVideoElement | HTMLAudioElement;
        source: MediaElementAudioSourceNode;
        panner: StereoPannerNode;
        gain: GainNode;
      }
    >
  >(new Map());
  const imageNodesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const laneRefs = useRef<Partial<Record<EditorTrackId, HTMLDivElement | null>>>({});
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineRulerRef = useRef<HTMLDivElement | null>(null);
  const previewDragRef = useRef<
    | { mode: 'move'; clipId: string; offsetX: number; offsetY: number }
    | { mode: 'scale'; clipId: string; startDistance: number; startScale: number }
    | null
  >(null);
  const draggedLibraryClipIdRef = useRef<string | null>(null);
  const timelineScrubRef = useRef(false);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<DragMode | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const importedSessionRef = useRef<number | null>(null);
  const exportRecorderRef = useRef<RecorderPipeline | null>(null);
  const exportFormatRef = useRef<ExportFormat>('webm');
  const undoHistoryRef = useRef<EditorClip[][]>([]);
  const redoHistoryRef = useRef<EditorClip[][]>([]);
  const historyTransactionRef = useRef(false);
  const clipboardRef = useRef<EditorClip | null>(null);
  const skipHistoryRef = useRef(false);
  const waveformRequestsRef = useRef<Set<string>>(new Set());

  const [clips, setClips] = useState<EditorClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [projectName, setProjectName] = useState(initialAsset?.name.replace(/\.[^.]+$/, '') ?? 'Proyecto sin titulo');
  const [activeSidebarSection, setActiveSidebarSection] = useState<SidebarSection>('media');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [projectFormat, setProjectFormat] = useState<StudioFormat>(initialAsset?.format ?? '16:9');
  const [textDraft, setTextDraft] = useState('Nuevo texto');
  const [captionDraft, setCaptionDraft] = useState('Escribe un subtitulo');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('webm');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [savingProject, setSavingProject] = useState(false);
  const [timelineTimeInput, setTimelineTimeInput] = useState('00:00.000');
  const [isTimelineScrubbing, setIsTimelineScrubbing] = useState(false);
  const [timelineHoverTime, setTimelineHoverTime] = useState<number | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ trackId: EditorTrackId; startTime: number } | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(() => {
    if (typeof window === 'undefined') {
      return 280;
    }

    const saved = Number(window.localStorage.getItem('studio-recorder-timeline-height'));
    return Number.isFinite(saved) ? clamp(saved, 160, 600) : 280;
  });
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [clipWaveforms, setClipWaveforms] = useState<Map<string, number[]>>(new Map());
  const [tracks, setTracks] = useState<EditorTrackDefinition[]>(() => [...EDITOR_TRACKS]);
  const [collapsedTrackIds, setCollapsedTrackIds] = useState<Set<EditorTrackId>>(() => new Set());
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({});
  const [trackPans, setTrackPans] = useState<Record<string, number>>({});
  const [openTrackControl, setOpenTrackControl] = useState<{ trackId: EditorTrackId; type: 'volume' | 'pan' } | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  const totalDuration = useMemo(
    () => clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0),
    [clips],
  );

  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) ?? null,
    [clips, selectedClipId],
  );

  function getTrackDefinition(trackId: EditorTrackId) {
    return tracks.find((track) => track.id === trackId) ?? tracks[0] ?? EDITOR_TRACKS[0];
  }

  function getTrackOrder(trackId: EditorTrackId) {
    const index = tracks.findIndex((track) => track.id === trackId);
    return index === -1 ? tracks.length : index;
  }

  function getTrackEnd(trackId: EditorTrackId) {
    return clips
      .filter((clip) => clip.trackId === trackId)
      .reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
  }

  function getCompatibleTrackIds(kind: EditorClip['kind']) {
    const targetKind = kind === 'audio' ? 'audio' : kind === 'text' ? 'overlay' : 'video';
    return tracks.filter((track) => track.kind === targetKind).map((track) => track.id);
  }

  function getDefaultTrackId(kind: EditorClip['kind']) {
    return getCompatibleTrackIds(kind)[0] ?? tracks[0]?.id ?? EDITOR_TRACKS[0].id;
  }

  function getTrackVolume(trackId: EditorTrackId) {
    return trackVolumes[trackId] ?? 1;
  }

  function getTrackPan(trackId: EditorTrackId) {
    return trackPans[trackId] ?? 0;
  }

  const previewSize = useMemo(() => getFormatDimensions(projectFormat), [projectFormat]);
  const previewAspectRatio = `${previewSize.width} / ${previewSize.height}`;
  const rulerMinorStep = useMemo(() => {
    if (totalDuration >= 3600) return 300;
    if (totalDuration >= 900) return 60;
    if (totalDuration >= 300) return 30;
    if (zoom >= 160) return 0.1;
    if (zoom >= 100) return 0.25;
    if (zoom >= 64) return 0.5;
    return 1;
  }, [totalDuration, zoom]);
  const rulerMajorStep = useMemo(() => {
    if (totalDuration >= 3600) return 600;
    if (totalDuration >= 900) return 120;
    if (totalDuration >= 300) return 60;
    return 1;
  }, [totalDuration]);

  useEffect(() => {
    setTimelineTimeInput(formatPreciseTime(currentTime));
  }, [currentTime]);

  useEffect(() => {
    const mediaClips = clips.filter((clip) => isMediaClip(clip) && clip.blob);

    for (const clip of mediaClips) {
      if (!clip.blob || clipWaveforms.has(clip.id) || waveformRequestsRef.current.has(clip.id)) {
        continue;
      }

      waveformRequestsRef.current.add(clip.id);
      const bars = Math.max(24, Math.min(160, Math.floor(Math.max(clipDuration(clip) * zoom, 80) / 5)));

      void generateWaveform(clip.blob, bars)
        .then((waveform) => {
          setClipWaveforms((current) => {
            const next = new Map(current);
            next.set(clip.id, waveform);
            return next;
          });
        })
        .catch(() => undefined)
        .finally(() => {
          waveformRequestsRef.current.delete(clip.id);
        });
    }
  }, [clips, clipWaveforms, zoom]);

  useEffect(() => {
    if (selectedClipId) {
      setInspectorOpen(true);
    }
  }, [selectedClipId]);

  useEffect(() => {
    const scroller = timelineScrollRef.current;
    if (!scroller) {
      return;
    }

    const playheadLeft = TIMELINE_LABEL_WIDTH + currentTime * zoom;
    const visibleLeft = scroller.scrollLeft + TIMELINE_LABEL_WIDTH;
    const visibleRight = scroller.scrollLeft + scroller.clientWidth;
    const gutter = 96;

    if (playheadLeft < visibleLeft + gutter) {
      scroller.scrollLeft = Math.max(0, playheadLeft - TIMELINE_LABEL_WIDTH - gutter);
      return;
    }

    if (playheadLeft > visibleRight - gutter) {
      scroller.scrollLeft = Math.max(0, playheadLeft - scroller.clientWidth + gutter);
    }
  }, [currentTime, zoom, isPlaying, isTimelineScrubbing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = new AudioContext();
    const destination = ctx.createMediaStreamDestination();
    audioContextRef.current = ctx;
    audioDestinationRef.current = destination;

    return () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }

      cancelAnimationFrame(rafRef.current);
      mediaNodesRef.current.forEach((node) => {
        node.element.pause();
        node.element.src = '';
        node.gain.disconnect();
        node.panner.disconnect();
        node.source.disconnect();
      });
      imageNodesRef.current.clear();
      mediaNodesRef.current.clear();
      void ctx.close();
    };
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setPreviewFullscreen(document.fullscreenElement === previewShellRef.current);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoLastChange();
        } else {
          undoLastChange();
        }
        return;
      }

      if (!isEditable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && selectedClipId) {
        event.preventDefault();
        copyClip(selectedClipId);
        return;
      }

      if (!isEditable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteClip();
        return;
      }

      if (!isEditable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && selectedClipId) {
        event.preventDefault();
        duplicateClip(selectedClipId);
        return;
      }

      if (!isEditable && (event.metaKey || event.ctrlKey) && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        setZoomAroundPlayhead(Math.min(180, zoom + 10));
        return;
      }

      if (!isEditable && (event.metaKey || event.ctrlKey) && event.key === '-') {
        event.preventDefault();
        setZoomAroundPlayhead(Math.max(40, zoom - 10));
        return;
      }

      if (isEditable) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedClipId) {
        event.preventDefault();
        deleteClip(selectedClipId);
        return;
      }

      if (event.key.toLowerCase() === 's' && selectedClipId) {
        event.preventDefault();
        splitClip(selectedClipId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedClipId, currentTime, clips, zoom]);

  useEffect(() => {
    if (!initialAsset || importedSessionRef.current === sessionKey) {
      return;
    }

    importedSessionRef.current = sessionKey;
    setProjectFormat(initialAsset.format);
    setProjectName(initialAsset.name.replace(/\.[^.]+$/, '') || 'Proyecto sin titulo');
    void importBlobAsClip(initialAsset.blob, initialAsset.name, 'video', true, initialAsset.durationSeconds);
  }, [initialAsset, sessionKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = previewSize.width;
    canvas.height = previewSize.height;
    renderPreview();
  }, [previewSize.width, previewSize.height, projectFormat]);

  useEffect(() => {
    const loop = (timestamp: number) => {
      const last = lastTickRef.current;
      const delta = last ? (timestamp - last) / 1000 : 0;
      lastTickRef.current = timestamp;

      setCurrentTime((time) => {
        if (!isPlaying) {
          return time;
        }

        const next = time + delta;
        if (exportRecorderRef.current && totalDuration > 0) {
          setExportProgress(Math.min(0.9, next / totalDuration));
        }
        if (next >= totalDuration) {
          handlePlaybackEnd();
          return totalDuration;
        }

        return next;
      });

      renderPreview();
      syncMediaPlayback();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  });

  useEffect(() => {
    syncMediaPlayback();
    renderPreview();
  }, [clips, currentTime, isPlaying]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (timelineScrubRef.current) {
        seekFromRulerClientX(event.clientX);
        return;
      }

      if (previewDragRef.current) {
        const point = getCanvasPoint(event);
        if (!point) {
          return;
        }

        setClips((current) =>
          current.map((clip) => {
            if (clip.id !== previewDragRef.current?.clipId) {
              return clip;
            }

            if (previewDragRef.current.mode === 'scale') {
              const bounds = getVisualClipBounds(clip);
              if (!bounds) {
                return clip;
              }

              const center = getBoundsCenter(bounds);
              const currentDistance = Math.hypot(point.x - center.x, point.y - center.y);
              const nextScale = clamp((previewDragRef.current.startScale * currentDistance) / Math.max(1, previewDragRef.current.startDistance), 0.25, 3.2);
              return { ...clip, scale: nextScale };
            }

            const nextX = clamp((point.x - previewDragRef.current.offsetX) / previewSize.width, 0.05, 0.95);
            const nextY = clamp((point.y - previewDragRef.current.offsetY) / previewSize.height, 0.05, 0.95);
            return { ...clip, x: nextX, y: nextY };
          }),
        );
        return;
      }

      if (!dragRef.current) {
        return;
      }

      const deltaSeconds = (event.clientX - dragRef.current.startX) / zoom;
      setClips((current) =>
        current.map((clip) => {
          if (clip.id !== dragRef.current?.clipId) {
            return clip;
          }

          if (dragRef.current.type === 'move') {
            const rawStart = Math.max(0, dragRef.current.startTime + deltaSeconds);
            const duration = clipDuration(clip);
            const hoveredTrackId = getTrackAtClientPoint(event.clientY, clip.kind) ?? dragRef.current.startTrackId;
            const snapResult = getSnapResult(current, clip.id, hoveredTrackId, rawStart, duration);
            setSnapGuideTime(snapResult.guideTime);
            const constrainedStart = constrainMoveWithinTrack(current, clip.id, hoveredTrackId, snapResult.startTime, duration);
            return { ...clip, trackId: hoveredTrackId, startTime: constrainedStart };
          }

          if (dragRef.current.type === 'trim-start') {
            const nextTrimStart = Math.min(
              Math.max(0, dragRef.current.startTrim + deltaSeconds),
              clip.trimEnd - MIN_CLIP_DURATION,
            );
            const proposedStartTime = Math.max(0, dragRef.current.startTime + (nextTrimStart - dragRef.current.startTrim));
            const snapResult = getSnapResult(
              current,
              clip.id,
              clip.trackId,
              proposedStartTime,
              clip.trimEnd - nextTrimStart,
            );
            setSnapGuideTime(snapResult.guideTime);
            const constrained = constrainTrimStartWithinTrack(
              current,
              clip,
              snapResult.startTime,
              nextTrimStart + (snapResult.startTime - proposedStartTime),
            );
            return {
              ...clip,
              trimStart: constrained.trimStart,
              startTime: constrained.startTime,
            };
          }

          const nextTrimEnd = Math.max(
            clip.trimStart + MIN_CLIP_DURATION,
            Math.min(clip.duration, dragRef.current.startTrim + deltaSeconds),
          );
          const snapThreshold = SNAP_PIXELS / zoom;
          const proposedEnd = clip.startTime + (nextTrimEnd - clip.trimStart);
          const snapTargets = [
            currentTime,
            ...getNeighborClips(current, clip.id, clip.trackId).flatMap((candidate) => [candidate.startTime, clipEnd(candidate)]),
          ];
          let snappedTrimEnd = nextTrimEnd;
          let nextGuideTime: number | null = null;

          snapTargets.forEach((target) => {
            if (Math.abs(proposedEnd - target) <= snapThreshold) {
              snappedTrimEnd = clip.trimStart + (target - clip.startTime);
              nextGuideTime = target;
            }
          });

          setSnapGuideTime(nextGuideTime);

          return { ...clip, trimEnd: constrainTrimEndWithinTrack(current, clip, snappedTrimEnd) };
        }),
      );
    };

    const onUp = () => {
      dragRef.current = null;
      previewDragRef.current = null;
      timelineScrubRef.current = false;
      setIsTimelineScrubbing(false);
      setSnapGuideTime(null);
      endHistoryTransaction();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [zoom, previewSize.width, previewSize.height, totalDuration]);

  function ensureToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }

  function cloneClipState(source: EditorClip[]) {
    return source.map((clip) => ({ ...clip }));
  }

  function beginHistoryTransaction(source: EditorClip[]) {
    if (skipHistoryRef.current || historyTransactionRef.current) {
      return;
    }

    historyTransactionRef.current = true;
    pushHistorySnapshot(source);
  }

  function endHistoryTransaction() {
    historyTransactionRef.current = false;
  }

  function pushHistorySnapshot(source: EditorClip[]) {
    if (skipHistoryRef.current) {
      return;
    }

    undoHistoryRef.current.push(cloneClipState(source));
    redoHistoryRef.current = [];
    if (undoHistoryRef.current.length > 40) {
      undoHistoryRef.current.shift();
    }
  }

  function undoLastChange() {
    endHistoryTransaction();
    const previous = undoHistoryRef.current.pop();
    if (!previous) {
      ensureToast('No hay acciones para deshacer.');
      return;
    }

    setClips((current) => {
      redoHistoryRef.current.push(cloneClipState(current));
      const currentIds = new Set(current.map((clip) => clip.id));
      const previousIds = new Set(previous.map((clip) => clip.id));
      current
        .filter((clip) => currentIds.has(clip.id) && !previousIds.has(clip.id))
        .forEach((clip) => revokeClipResources([clip], previous));
      return cloneClipState(previous);
    });

    setSelectedClipId((current) => (previous.some((clip) => clip.id === current) ? current : previous[0]?.id ?? null));
    ensureToast('Accion deshecha.');
  }

  function redoLastChange() {
    endHistoryTransaction();
    const next = redoHistoryRef.current.pop();
    if (!next) {
      ensureToast('No hay acciones para rehacer.');
      return;
    }

    setClips((current) => {
      undoHistoryRef.current.push(cloneClipState(current));
      const currentIds = new Set(current.map((clip) => clip.id));
      const nextIds = new Set(next.map((clip) => clip.id));
      current
        .filter((clip) => currentIds.has(clip.id) && !nextIds.has(clip.id))
        .forEach((clip) => revokeClipResources([clip], next));
      return cloneClipState(next);
    });

    setSelectedClipId((current) => (next.some((clip) => clip.id === current) ? current : next[0]?.id ?? null));
    ensureToast('Accion rehecha.');
  }

  function sanitizeText(value: string) {
    return value.replace(/[<>]/g, '').trim();
  }

  function revokeClipResources(targetClips: EditorClip[], remainingClips: EditorClip[] = []) {
    targetClips.forEach((clip) => {
      mediaNodesRef.current.get(clip.id)?.element.pause();
      mediaNodesRef.current.get(clip.id)?.gain.disconnect();
      mediaNodesRef.current.get(clip.id)?.panner.disconnect();
      mediaNodesRef.current.get(clip.id)?.source.disconnect();
      mediaNodesRef.current.delete(clip.id);
      imageNodesRef.current.delete(clip.id);
      if (clip.url && !remainingClips.some((candidate) => candidate.id !== clip.id && candidate.url === clip.url)) {
        URL.revokeObjectURL(clip.url);
      }
    });
  }

  function cloneClipForInsertion(source: EditorClip, startTime: number) {
    const blob = source.blob;
    return {
      ...source,
      id: createClipId(),
      startTime,
      name: `${source.name} copia`,
      blob,
      url: blob ? URL.createObjectURL(blob) : source.url,
    } satisfies EditorClip;
  }

  function insertLibraryClipIntoTrack(sourceClipId: string, trackId: EditorTrackId, proposedStartTime: number) {
    setClips((current) => {
      const source = current.find((clip) => clip.id === sourceClipId);
      if (!source) {
        return current;
      }

      endHistoryTransaction();
      pushHistorySnapshot(current);

      const clone = cloneClipForInsertion(source, Math.max(0, proposedStartTime));
      clone.trackId = trackId;

      const snappedStart = getSnappedTime(current, clone.id, trackId, clone.startTime, clipDuration(clone));
      clone.startTime = constrainMoveWithinTrack(current, clone.id, trackId, snappedStart, clipDuration(clone));

      setSelectedClipId(clone.id);
      ensureToast(`Clip agregado a ${getTrackDefinition(trackId).label}.`);
      return [...current, clone].sort(sortClips);
    });
  }

  function moveClipToAdjacentTrack(clipId: string, direction: -1 | 1) {
    const clip = clips.find((entry) => entry.id === clipId);
    if (!clip) {
      return;
    }

    const compatibleTracks = getCompatibleTrackIds(clip.kind);
    const currentIndex = compatibleTracks.indexOf(clip.trackId);
    if (currentIndex === -1) {
      return;
    }

    const nextTrackId = compatibleTracks[currentIndex + direction];
    if (!nextTrackId) {
      return;
    }

    updateClip(clipId, { trackId: nextTrackId });
  }

  function getTrackAtClientPoint(clientY: number, kind: EditorClip['kind']) {
    const compatibleTrackIds = new Set(getCompatibleTrackIds(kind));

    for (const track of tracks) {
      if (!compatibleTrackIds.has(track.id)) {
        continue;
      }

      const lane = laneRefs.current[track.id];
      if (!lane) {
        continue;
      }

      const rect = lane.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return track.id;
      }
    }

    return null;
  }

  function getCanvasPoint(event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * previewSize.width,
      y: ((event.clientY - rect.top) / rect.height) * previewSize.height,
    };
  }

  function getVisualClipBounds(clip: EditorClip) {
    if (!isVisualClip(clip)) {
      return null;
    }

    if (clip.kind === 'text') {
      return getTextMetrics(clip, previewSize.width, previewSize.height);
    }

    let mediaWidth = 0;
    let mediaHeight = 0;

    if (clip.kind === 'image') {
      const image = getImageNode(clip);
      if (!image) {
        return null;
      }

      mediaWidth = image.naturalWidth;
      mediaHeight = image.naturalHeight;
    } else {
      const video = getMediaNode(clip)?.element as HTMLVideoElement | undefined;
      if (!video) {
        return null;
      }

      mediaWidth = video.videoWidth;
      mediaHeight = video.videoHeight;
    }
    if (!mediaWidth || !mediaHeight) {
      return null;
    }

    const { x, y, scale } = getVisualPosition(clip);
    const baseScale = Math.min(previewSize.width / mediaWidth, previewSize.height / mediaHeight);
    const drawWidth = mediaWidth * baseScale * scale;
    const drawHeight = mediaHeight * baseScale * scale;
    const boxX = previewSize.width * x - drawWidth / 2;
    const boxY = previewSize.height * y - drawHeight / 2;
    return { boxX, boxY, boxWidth: drawWidth, boxHeight: drawHeight, x, y };
  }

  function getBoundsCenter(bounds: { boxX: number; boxY: number; boxWidth: number; boxHeight: number }) {
    return {
      x: bounds.boxX + bounds.boxWidth / 2,
      y: bounds.boxY + bounds.boxHeight / 2,
    };
  }

  function pickVisualClipAtPoint(point: { x: number; y: number }) {
    const activeVisualClips = clips
      .filter((clip) => isVisualClip(clip) && currentTime >= clip.startTime && currentTime < clipEnd(clip))
      .sort((a, b) => getTrackOrder(b.trackId) - getTrackOrder(a.trackId));

    return activeVisualClips.find((clip) => {
      const bounds = getVisualClipBounds(clip);
      if (!bounds) {
        return false;
      }

      return point.x >= bounds.boxX && point.x <= bounds.boxX + bounds.boxWidth && point.y >= bounds.boxY && point.y <= bounds.boxY + bounds.boxHeight;
    }) ?? null;
  }

  function getNeighborClips(source: EditorClip[], clipId: string, trackId: EditorTrackId) {
    return source
      .filter((clip) => clip.trackId === trackId && clip.id !== clipId)
      .sort((a, b) => a.startTime - b.startTime);
  }

  function getSnapResult(source: EditorClip[], clipId: string, trackId: EditorTrackId, proposedStart: number, duration: number) {
    const snapThreshold = SNAP_PIXELS / zoom;
    const candidates = new Set<number>([0, currentTime]);

    getNeighborClips(source, clipId, trackId).forEach((clip) => {
      candidates.add(clip.startTime);
      candidates.add(clipEnd(clip));
    });

    let snappedStart = proposedStart;
    let closestDistance = snapThreshold + 1;
    let guideTime: number | null = null;

    candidates.forEach((candidate) => {
      const startDistance = Math.abs(proposedStart - candidate);
      if (startDistance <= snapThreshold && startDistance < closestDistance) {
        snappedStart = candidate;
        closestDistance = startDistance;
        guideTime = candidate;
      }

      const endDistance = Math.abs(proposedStart + duration - candidate);
      if (endDistance <= snapThreshold && endDistance < closestDistance) {
        snappedStart = candidate - duration;
        closestDistance = endDistance;
        guideTime = candidate;
      }
    });

    return { startTime: Math.max(0, snappedStart), guideTime };
  }

  function getSnappedTime(source: EditorClip[], clipId: string, trackId: EditorTrackId, proposedStart: number, duration: number) {
    return getSnapResult(source, clipId, trackId, proposedStart, duration).startTime;
  }

  function constrainMoveWithinTrack(source: EditorClip[], clipId: string, trackId: EditorTrackId, proposedStart: number, duration: number) {
    const neighbors = getNeighborClips(source, clipId, trackId);
    const previous = neighbors.filter((clip) => clip.startTime < proposedStart).at(-1) ?? null;
    const next = neighbors.find((clip) => clip.startTime >= proposedStart) ?? null;

    let minStart = 0;
    let maxStart = Number.POSITIVE_INFINITY;

    if (previous) {
      minStart = clipEnd(previous);
    }

    if (next) {
      maxStart = next.startTime - duration;
    }

    if (maxStart < minStart) {
      return proposedStart < minStart ? minStart : maxStart;
    }

    return Math.max(minStart, Math.min(maxStart, proposedStart));
  }

  function constrainTrimStartWithinTrack(source: EditorClip[], clip: EditorClip, proposedStartTime: number, nextTrimStart: number) {
    const neighbors = getNeighborClips(source, clip.id, clip.trackId);
    const previous = neighbors.filter((candidate) => clipEnd(candidate) <= clip.startTime).at(-1) ?? null;
    const minimumStartTime = previous ? clipEnd(previous) : 0;
    const safeStartTime = Math.max(minimumStartTime, proposedStartTime);
    const trimOffset = safeStartTime - clip.startTime;
    return {
      startTime: safeStartTime,
      trimStart: nextTrimStart + trimOffset,
    };
  }

  function constrainTrimEndWithinTrack(source: EditorClip[], clip: EditorClip, proposedTrimEnd: number) {
    const neighbors = getNeighborClips(source, clip.id, clip.trackId);
    const next = neighbors.find((candidate) => candidate.startTime >= clip.startTime) ?? null;
    if (!next) {
      return proposedTrimEnd;
    }

    const maxTrimEnd = clip.trimStart + Math.max(MIN_CLIP_DURATION, next.startTime - clip.startTime);
    return Math.max(clip.trimStart + MIN_CLIP_DURATION, Math.min(proposedTrimEnd, maxTrimEnd));
  }

  async function refreshProjects() {
    try {
      setProjects(await studioStorage.listProjects());
    } catch {
      ensureToast('No fue posible leer los proyectos guardados.');
    }
  }

  function getAudioContext() {
    const context = audioContextRef.current;
    if (!context) {
      throw new Error('AudioContext no disponible.');
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    return context;
  }

  function getMediaNode(clip: EditorClip) {
    if (!isMediaClip(clip) || !clip.url) {
      return null;
    }

    const existing = mediaNodesRef.current.get(clip.id);
    if (existing) {
      return existing;
    }

    const context = getAudioContext();
    const destination = audioDestinationRef.current;
    if (!destination) {
      return null;
    }

    const element = document.createElement(clip.kind === 'video' ? 'video' : 'audio');
    element.src = clip.url;
    element.preload = 'auto';
    element.crossOrigin = 'anonymous';
    element.muted = false;
    if (clip.kind === 'video') {
      (element as HTMLVideoElement).playsInline = true;
    }

    const source = context.createMediaElementSource(element);
    const panner = context.createStereoPanner();
    const gain = context.createGain();
    source.connect(panner);
    panner.connect(gain);
    gain.connect(context.destination);
    gain.connect(destination);

    if (clip.kind === 'video') {
      const refreshPreview = () => {
        renderPreview();
      };
      element.addEventListener('loadedmetadata', refreshPreview);
      element.addEventListener('loadeddata', refreshPreview);
      element.addEventListener('canplay', refreshPreview);
      element.addEventListener('seeked', refreshPreview);
      element.load();
    }

    const node = { element, source, panner, gain };
    mediaNodesRef.current.set(clip.id, node);
    return node;
  }

  function getImageNode(clip: EditorClip) {
    if (clip.kind !== 'image' || !clip.url) {
      return null;
    }

    const existing = imageNodesRef.current.get(clip.id);
    if (existing) {
      return existing;
    }

    const image = new Image();
    image.src = clip.url;
    imageNodesRef.current.set(clip.id, image);
    return image;
  }

  function syncMediaPlayback() {
    clips.forEach((clip) => {
      const node = getMediaNode(clip);
      if (!node) {
        return;
      }

      const active = currentTime >= clip.startTime && currentTime < clipEnd(clip);
      node.gain.gain.value = active && !clip.muted ? clip.volume * getTrackVolume(clip.trackId) * getFadeMultiplier(clip, currentTime) : 0;
      node.panner.pan.value = getTrackPan(clip.trackId);

      if (!active) {
        if (!node.element.paused) {
          node.element.pause();
        }
        return;
      }

      const targetTime = clip.trimStart + (currentTime - clip.startTime);
      if (Math.abs(node.element.currentTime - targetTime) > 0.18) {
        node.element.currentTime = targetTime;
      }

      if (isPlaying) {
        void node.element.play().catch(() => undefined);
      } else if (!node.element.paused) {
        node.element.pause();
      }
    });
  }

  function renderPreview() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const { width: previewWidth, height: previewHeight } = previewSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, previewWidth, previewHeight);
    const previewGradient = ctx.createLinearGradient(0, 0, previewWidth, previewHeight);
    previewGradient.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
    previewGradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
    ctx.fillStyle = previewGradient;
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    const visualClips = clips
      .filter((clip) => isVisualClip(clip) && currentTime >= clip.startTime && currentTime < clipEnd(clip))
      .sort((a, b) => getTrackOrder(a.trackId) - getTrackOrder(b.trackId));

    if (visualClips.length === 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Importa medios o graba para comenzar la edicion', previewWidth / 2, previewHeight / 2 - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 20px Inter, sans-serif';
      ctx.fillText('El editor ya admite timeline, trim, mezcla de audio y export WebM.', previewWidth / 2, previewHeight / 2 + 26);
      return;
    }

    visualClips.forEach((clip) => {
      const fadeMultiplier = getFadeMultiplier(clip, currentTime);
      if (clip.kind === 'video') {
        const node = getMediaNode(clip);
        if (node && (node.element as HTMLVideoElement).readyState >= 2) {
          if (clip.trackId === 'video-1' && (clip.scale ?? 1) === 1 && (clip.x ?? 0.5) === 0.5 && (clip.y ?? 0.5) === 0.5 && (clip.opacity ?? 1) === 1) {
            ctx.save();
            ctx.globalAlpha = fadeMultiplier;
            ctx.filter = getFilterCss(clip.filter);
            drawCover(ctx, node.element as HTMLVideoElement, previewWidth, previewHeight);
            ctx.restore();
          } else {
            drawPositionedMedia(ctx, node.element as HTMLVideoElement, previewWidth, previewHeight, clip, fadeMultiplier);
          }
        } else {
          ctx.save();
          ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
          ctx.fillRect(0, 0, previewWidth, previewHeight);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 28px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Cargando vista previa del video...', previewWidth / 2, previewHeight / 2);
          ctx.restore();
        }
        return;
      }

      if (clip.kind === 'image') {
        const image = getImageNode(clip);
        if (image?.complete) {
          drawPositionedMedia(ctx, image, previewWidth, previewHeight, clip, fadeMultiplier);
        }
        return;
      }

      if (clip.kind === 'text') {
        const { x, y, fontSize, boxWidth, boxHeight } = getTextMetrics(clip, previewWidth, previewHeight);
        const { opacity, rotation } = getVisualPosition(clip);
        ctx.save();
        ctx.globalAlpha = opacity * fadeMultiplier;
        ctx.translate(previewWidth * x, previewHeight * y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillStyle = clip.background ?? 'rgba(2, 6, 23, 0.55)';
        ctx.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
        ctx.fillStyle = clip.color ?? '#ffffff';
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(clip.text ?? '', 0, 0);
        ctx.restore();
      }
    });

    if (selectedClip && isVisualClip(selectedClip) && currentTime >= selectedClip.startTime && currentTime < clipEnd(selectedClip)) {
      const bounds = getVisualClipBounds(selectedClip);
      if (bounds) {
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.92)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.strokeRect(bounds.boxX, bounds.boxY, bounds.boxWidth, bounds.boxHeight);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.95)';
        ctx.fillRect(bounds.boxX + bounds.boxWidth - 12, bounds.boxY + bounds.boxHeight - 12, 12, 12);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, previewWidth - 56, previewHeight - 56);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.74)';
    ctx.fillRect(28, 28, 210, 38);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(selectedClip ? `Activo: ${selectedClip.name.slice(0, 18)}` : formatPreciseTime(currentTime), 42, 53);
    ctx.restore();
  }

  function handlePlaybackEnd() {
    setIsPlaying(false);
    if (exportRecorderRef.current) {
      const recorder = exportRecorderRef.current;
      exportRecorderRef.current = null;
      void recorder.stop().then(async (blob) => {
        if (!blob) {
          setExporting(false);
          setExportStage(null);
          setExportProgress(0);
          return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        try {
          if (exportFormatRef.current === 'mp4') {
            setExportStage('Convirtiendo a MP4 en este navegador...');
            setExportProgress(0.92);
            const mp4Blob = await transcodeWebmToMp4(blob, (progress) => {
              setExportProgress(0.92 + progress * 0.08);
            });

            if (exportUrl) {
              URL.revokeObjectURL(exportUrl);
            }

            const url = URL.createObjectURL(mp4Blob);
            setExportUrl(url);
            const link = document.createElement('a');
            link.href = url;
            link.download = `studio-recorder-edit-${timestamp}.mp4`;
            link.click();
            ensureToast('Exportacion MP4 lista. Descarga iniciada.');
          } else {
            if (exportUrl) {
              URL.revokeObjectURL(exportUrl);
            }

            const url = URL.createObjectURL(blob);
            setExportUrl(url);
            const link = document.createElement('a');
            link.href = url;
            link.download = `studio-recorder-edit-${timestamp}.webm`;
            link.click();
            ensureToast('Exportacion WebM lista. Descarga iniciada.');
          }
        } catch {
          ensureToast('No fue posible completar la exportacion MP4 local. Intenta con WebM.');
        } finally {
          setExporting(false);
          setExportStage(null);
          setExportProgress(0);
        }
      });
    }
  }

  function pauseAllMedia() {
    mediaNodesRef.current.forEach((node) => {
      node.element.pause();
    });
  }

  function togglePlayback() {
    if (totalDuration === 0) {
      ensureToast('Importa o graba primero un clip para reproducir.');
      return;
    }

    void audioContextRef.current?.resume();

    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }

    setIsPlaying((value) => !value);
  }

  async function createClipFromBlob(blob: Blob, name: string, kind: 'video' | 'audio' | 'image', insertAtStart = false, knownDuration?: number) {
    const url = URL.createObjectURL(blob);

    if (kind === 'image') {
      const imageTrackId = 'video-2';
      return {
        id: createClipId(),
        name,
        kind,
        trackId: imageTrackId,
        startTime: insertAtStart ? 0 : getTrackEnd(imageTrackId),
        trimStart: 0,
        trimEnd: 5,
        duration: 5,
        volume: 1,
        muted: false,
        fontSize: undefined,
        blob,
        url,
        x: 0.5,
        y: 0.5,
        scale: 1,
        opacity: 1,
        rotation: 0,
      } satisfies EditorClip;
    }

    let duration = knownDuration && Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 0;

    if (duration <= 0) {
      const element = document.createElement(kind === 'video' ? 'video' : 'audio');
      element.preload = 'metadata';
      element.src = url;

      duration = await new Promise<number>((resolve, reject) => {
        element.onloadedmetadata = () => {
          if (Number.isFinite(element.duration) && element.duration > 0) {
            resolve(element.duration);
            return;
          }

          element.currentTime = 24 * 60 * 60;
        };
        element.ondurationchange = () => {
          if (Number.isFinite(element.duration) && element.duration > 0) {
            resolve(element.duration);
          }
        };
        element.onseeked = () => resolve(Number.isFinite(element.duration) && element.duration > 0 ? element.duration : element.currentTime || 5);
        element.onerror = () => reject(new Error('No fue posible leer la metadata del archivo.'));
      });
    }

    const trackId = getDefaultTrackId(kind);
    return {
      id: createClipId(),
      name,
      kind,
      trackId,
      startTime: insertAtStart ? 0 : getTrackEnd(trackId),
      trimStart: 0,
      trimEnd: duration,
      duration,
      volume: 1,
      muted: false,
      fontSize: undefined,
      blob,
      url,
      x: kind === 'video' ? 0.5 : undefined,
      y: kind === 'video' ? 0.5 : undefined,
      scale: kind === 'video' ? 1 : undefined,
      opacity: kind === 'video' ? 1 : undefined,
      rotation: kind === 'video' ? 0 : undefined,
    } satisfies EditorClip;
  }

  async function importBlobAsClip(blob: Blob, name: string, kind: 'video' | 'audio' | 'image', insertAtStart = false, knownDuration?: number) {
    try {
      const clip = await createClipFromBlob(blob, name, kind, insertAtStart, knownDuration);
      setClips((current) => {
        endHistoryTransaction();
        pushHistorySnapshot(current);
        return [...current, clip].sort(sortClips);
      });
      setSelectedClipId(clip.id);
      ensureToast(`Clip agregado a ${getTrackDefinition(clip.trackId).label}.`);
    } catch {
      ensureToast('No fue posible importar ese archivo.');
    }
  }

  async function handleImportFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        await importBlobAsClip(file, file.name, 'video');
      } else if (file.type.startsWith('audio/')) {
        await importBlobAsClip(file, file.name, 'audio');
      } else if (file.type.startsWith('image/')) {
        await importBlobAsClip(file, file.name, 'image');
      }
    }

    event.target.value = '';
  }

  function addTextClip() {
    const trackId = getDefaultTrackId('text');
    const cleanText = sanitizeText(textDraft) || 'Nuevo texto';
    const clip: EditorClip = {
      id: createClipId(),
      name: cleanText.slice(0, 20) || 'Texto',
      kind: 'text',
      trackId,
      startTime: getTrackEnd(trackId),
      trimStart: 0,
      trimEnd: 4,
      duration: 4,
      volume: 1,
      muted: false,
      text: cleanText,
      fontSize: 42,
      color: '#ffffff',
      background: 'rgba(2, 6, 23, 0.55)',
      x: 0.5,
      y: 0.82,
      scale: 1,
      opacity: 1,
      rotation: 0,
    };

    setClips((current) => {
      endHistoryTransaction();
      pushHistorySnapshot(current);
      return [...current, clip].sort(sortClips);
    });
    setSelectedClipId(clip.id);
    ensureToast('Overlay de texto agregado.');
  }

  function addCaptionClip() {
    const cleanText = sanitizeText(captionDraft) || 'Nuevo subtitulo';
    const trackId: EditorTrackId = 'overlay-1';
    const clip: EditorClip = {
      id: createClipId(),
      name: `Sub: ${cleanText.slice(0, 18)}`,
      kind: 'text',
      trackId,
      startTime: currentTime,
      trimStart: 0,
      trimEnd: 3.5,
      duration: 3.5,
      volume: 1,
      muted: false,
      text: cleanText,
      fontSize: 34,
      color: '#ffffff',
      background: 'rgba(2, 6, 23, 0.74)',
      x: 0.5,
      y: 0.88,
      scale: 1,
      opacity: 1,
      rotation: 0,
      fadeIn: 0.12,
      fadeOut: 0.18,
      filter: 'none',
    };

    setClips((current) => {
      endHistoryTransaction();
      pushHistorySnapshot(current);
      return [...current, clip].sort(sortClips);
    });
    setSelectedClipId(clip.id);
    setActiveSidebarSection('captions');
    ensureToast('Subtitulo agregado en el playhead.');
  }

  function applyFadePreset(target: EditorClip, fadeIn: number, fadeOut: number) {
    const maxFade = Math.max(0, clipDuration(target) - MIN_CLIP_DURATION);
    updateClip(target.id, {
      fadeIn: clamp(fadeIn, 0, maxFade),
      fadeOut: clamp(fadeOut, 0, maxFade),
    });
  }

  function updateClip(clipId: string, patch: Partial<EditorClip>, options?: { commitHistory?: boolean }) {
    setClips((current) => {
      if (options?.commitHistory !== false) {
        endHistoryTransaction();
        pushHistorySnapshot(current);
      }
      return current
        .map((clip) => {
          if (clip.id !== clipId) {
            return clip;
          }

          const nextClip = { ...clip, ...patch };

          if (patch.trackId !== undefined || patch.startTime !== undefined) {
            nextClip.startTime = constrainMoveWithinTrack(
              current,
              clipId,
              nextClip.trackId,
              nextClip.startTime,
              clipDuration(nextClip),
            );
          }

          if (patch.trimStart !== undefined) {
            const constrained = constrainTrimStartWithinTrack(current, clip, nextClip.startTime, nextClip.trimStart);
            nextClip.startTime = constrained.startTime;
            nextClip.trimStart = constrained.trimStart;
          }

          if (patch.trimEnd !== undefined) {
            nextClip.trimEnd = constrainTrimEndWithinTrack(current, nextClip, nextClip.trimEnd);
          }

          return nextClip;
        })
        .sort(sortClips);
    });
  }

  function deleteClip(clipId: string) {
    setClips((current) => {
      endHistoryTransaction();
      pushHistorySnapshot(current);
      const target = current.find((clip) => clip.id === clipId);
      if (target) {
        revokeClipResources([target], current.filter((clip) => clip.id !== clipId));
      }
      return current.filter((clip) => clip.id !== clipId);
    });
    setSelectedClipId((current) => (current === clipId ? null : current));
  }

  function splitClip(clipId: string) {
    setClips((current) => {
      const source = current.find((clip) => clip.id === clipId);
      if (!source) {
        return current;
      }

      if (currentTime <= source.startTime + MIN_CLIP_DURATION || currentTime >= clipEnd(source) - MIN_CLIP_DURATION) {
        ensureToast('Mueve el cabezal dentro del clip para poder cortarlo.');
        return current;
      }

      const offset = currentTime - source.startTime;
      const splitTrim = source.trimStart + offset;
      endHistoryTransaction();
      pushHistorySnapshot(current);
      const left: EditorClip = { ...source, trimEnd: splitTrim };
      const right: EditorClip = {
        ...source,
        id: createClipId(),
        name: `${source.name} B`,
        startTime: currentTime,
        trimStart: splitTrim,
      };

      setSelectedClipId(right.id);
      ensureToast('Clip dividido en el cabezal actual.');
      return current.flatMap((clip) => (clip.id === clipId ? [left, right] : clip)).sort(sortClips);
    });
  }

  function nudgeClip(clipId: string, amount: number) {
    const target = clips.find((clip) => clip.id === clipId);
    if (!target) {
      return;
    }

    updateClip(clipId, { startTime: Math.max(0, target.startTime + amount) });
  }

  function duplicateClip(clipId: string) {
    setClips((current) => {
      endHistoryTransaction();
      pushHistorySnapshot(current);
      const source = current.find((clip) => clip.id === clipId);
      if (!source) {
        return current;
      }

      const clone = cloneClipForInsertion(source, clipEnd(source) + 0.2);

      setSelectedClipId(clone.id);
      return [...current, clone].sort(sortClips);
    });
  }

  function copyClip(clipId: string) {
    const source = clips.find((clip) => clip.id === clipId);
    if (!source) {
      return;
    }

    clipboardRef.current = { ...source };
    ensureToast('Clip copiado.');
  }

  function pasteClip() {
    const source = clipboardRef.current;
    if (!source) {
      ensureToast('No hay clip copiado.');
      return;
    }

    setClips((current) => {
      endHistoryTransaction();
      pushHistorySnapshot(current);
      const clone = cloneClipForInsertion(source, Math.max(0, currentTime));
      setSelectedClipId(clone.id);
      return [...current, clone].sort(sortClips);
    });
    ensureToast('Clip pegado en el playhead.');
  }

  function seekTo(time: number) {
    pauseAllMedia();
    setIsPlaying(false);
    setCurrentTime(Math.max(0, Math.min(totalDuration || 0, time)));
  }

  function jumpPlayhead(amount: number) {
    seekTo(currentTime + amount);
  }

  function commitTimelineTimeInput() {
    const parsed = parsePreciseTimeInput(timelineTimeInput);
    if (parsed === null || Number.isNaN(parsed)) {
      setTimelineTimeInput(formatPreciseTime(currentTime));
      ensureToast('Usa un tiempo valido como 12.5 o 01:12.250.');
      return;
    }

    seekTo(parsed);
  }

  function seekFromRulerClientX(clientX: number) {
    const ruler = timelineRulerRef.current;
    if (!ruler) {
      return;
    }

    const rect = ruler.getBoundingClientRect();
    const laneClientX = clientX - rect.left - TIMELINE_LABEL_WIDTH;
    const nextTime = clamp(laneClientX / zoom, 0, totalDuration);
    seekTo(nextTime);
  }

  function getTimeFromRulerClientX(clientX: number) {
    const ruler = timelineRulerRef.current;
    if (!ruler) {
      return null;
    }

    const rect = ruler.getBoundingClientRect();
    const laneClientX = clientX - rect.left - TIMELINE_LABEL_WIDTH;
    return clamp(laneClientX / zoom, 0, totalDuration);
  }

  function setZoomAroundPlayhead(nextZoom: number) {
    const scroller = timelineScrollRef.current;
    if (!scroller) {
      setZoom(nextZoom);
      return;
    }

    const playheadX = currentTime * zoom;
    const viewportCenter = scroller.scrollLeft + (scroller.clientWidth - TIMELINE_LABEL_WIDTH) / 2;
    const playheadOffsetFromCenter = playheadX - viewportCenter;
    const nextPlayheadX = currentTime * nextZoom;

    setZoom(nextZoom);

    requestAnimationFrame(() => {
      const nextScroller = timelineScrollRef.current;
      if (!nextScroller) {
        return;
      }

      const nextViewportCenter = nextPlayheadX - playheadOffsetFromCenter;
      nextScroller.scrollLeft = Math.max(0, nextViewportCenter - (nextScroller.clientWidth - TIMELINE_LABEL_WIDTH) / 2);
    });
  }

  function startTimelineResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = timelineHeight;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = clamp(startHeight + startY - moveEvent.clientY, 160, 600);
      setTimelineHeight(nextHeight);
      window.localStorage.setItem('studio-recorder-timeline-height', String(Math.round(nextHeight)));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  function clearDropIndicator() {
    setDropIndicator(null);
  }

  function addTrack(kind: EditorTrackDefinition['kind']) {
    const prefix = kind === 'audio' ? 'audio' : kind === 'overlay' ? 'overlay' : 'video';
    const count = tracks.filter((track) => track.kind === kind).length + 1;
    const id = `${prefix}-${Date.now()}`;
    const label = kind === 'audio' ? `A${count} Audio` : kind === 'overlay' ? `T${count} Texto / overlays` : `V${count} Video`;

    setTracks((current) => [...current, { id, label, kind }]);
    ensureToast(`Canal agregado: ${label}.`);
  }

  function removeTrack(trackId: EditorTrackId) {
    const track = tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }

    if (clips.some((clip) => clip.trackId === trackId)) {
      ensureToast('No se puede quitar un canal con clips. Mueve o elimina sus clips primero.');
      return;
    }

    if (tracks.filter((entry) => entry.kind === track.kind).length <= 1) {
      ensureToast('Debe quedar al menos un canal de ese tipo.');
      return;
    }

    setTracks((current) => current.filter((entry) => entry.id !== trackId));
    setCollapsedTrackIds((current) => {
      const next = new Set(current);
      next.delete(trackId);
      return next;
    });
    ensureToast(`Canal quitado: ${track.label}.`);
  }

  function toggleTrackCollapsed(trackId: EditorTrackId) {
    setCollapsedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function updateTrackVolume(trackId: EditorTrackId, value: number) {
    setTrackVolumes((current) => ({ ...current, [trackId]: value }));
  }

  function updateTrackPan(trackId: EditorTrackId, value: number) {
    setTrackPans((current) => ({ ...current, [trackId]: value }));
  }

  function formatPan(value: number) {
    if (Math.abs(value) < 0.01) {
      return 'Centro';
    }

    return value < 0 ? `Izq ${Math.round(Math.abs(value) * 100)}%` : `Der ${Math.round(value * 100)}%`;
  }

  async function togglePreviewFullscreen() {
    const shell = previewShellRef.current;
    if (!shell) {
      return;
    }

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await shell.requestFullscreen().catch(() => ensureToast('No fue posible abrir pantalla completa.'));
  }

  function openSidebarSection(sectionId: SidebarSection) {
    setActiveSidebarSection(sectionId);
    setSidebarExpanded(true);
  }

  async function saveProject() {
    if (clips.length === 0) {
      ensureToast('No hay clips para guardar como proyecto.');
      return;
    }

    const name = window.prompt('Nombre del proyecto', projectName || `Proyecto ${new Date().toLocaleString()}`)?.trim();
    if (!name) {
      return;
    }

    const projectId = `project-${Date.now()}`;
    const now = new Date().toISOString();
    const record: ProjectRecord = {
      id: projectId,
      name,
      createdAt: now,
      updatedAt: now,
      duration: totalDuration,
      format: projectFormat,
      tracks,
      trackVolumes,
      trackPans,
      collapsedTrackIds: Array.from(collapsedTrackIds),
      clips: clips.map((clip) => ({
        ...clip,
        url: undefined,
        blob: undefined,
        text: clip.text ? sanitizeText(clip.text) : clip.text,
      })),
    };

    try {
      setSavingProject(true);
      setProjectName(name);
      await studioStorage.saveProject(
        record,
        clips
          .filter((clip) => clip.blob)
          .map((clip) => ({
            projectId,
            clipId: clip.id,
            blob: clip.blob as Blob,
            name: clip.name,
          })),
      );
      await refreshProjects();
      ensureToast('Proyecto guardado localmente.');
    } catch {
      ensureToast('No fue posible guardar el proyecto localmente.');
    } finally {
      setSavingProject(false);
    }
  }

  async function loadProject(projectId: string) {
    try {
      const snapshot = await studioStorage.getProject(projectId);
      if (!snapshot) {
        ensureToast('El proyecto solicitado no existe.');
        return;
      }

      pauseAllMedia();
      setIsPlaying(false);
      setCurrentTime(0);

      setClips((current) => {
        pushHistorySnapshot(current);
        revokeClipResources(current);
        return [];
      });

      const assetsByClipId = new Map(snapshot.assets.map((asset) => [asset.clipId, asset]));
      skipHistoryRef.current = true;
      const nextClips: EditorClip[] = snapshot.project.clips.map((clip) => {
        const asset = assetsByClipId.get(clip.id);
        const blob = asset?.blob;
        return {
          ...clip,
          blob,
          url: blob ? URL.createObjectURL(blob) : undefined,
        };
      });

      setProjectFormat(snapshot.project.format ?? '16:9');
      setProjectName(snapshot.project.name);
      setTracks(snapshot.project.tracks?.length ? snapshot.project.tracks : [...EDITOR_TRACKS]);
      setTrackVolumes(snapshot.project.trackVolumes ?? {});
      setTrackPans(snapshot.project.trackPans ?? {});
      setCollapsedTrackIds(new Set(snapshot.project.collapsedTrackIds ?? []));
      setClips(nextClips);
      setSelectedClipId(nextClips[0]?.id ?? null);
      undoHistoryRef.current = [];
      redoHistoryRef.current = [];
      endHistoryTransaction();
      skipHistoryRef.current = false;
      ensureToast(`Proyecto "${snapshot.project.name}" cargado.`);
    } catch {
      skipHistoryRef.current = false;
      ensureToast('No fue posible cargar el proyecto.');
    }
  }

  async function deleteProject(projectId: string) {
    try {
      await studioStorage.deleteProject(projectId);
      await refreshProjects();
      ensureToast('Proyecto eliminado del almacenamiento local.');
    } catch {
      ensureToast('No fue posible eliminar el proyecto.');
    }
  }

  function exportTimeline() {
    const canvas = canvasRef.current;
    const destination = audioDestinationRef.current;
    if (!canvas) {
      return;
    }

    if (totalDuration === 0) {
      ensureToast('No hay contenido en la timeline para exportar.');
      return;
    }

    const recorder = new RecorderPipeline();
    exportRecorderRef.current = recorder;
    exportFormatRef.current = exportFormat;
    recorder.start(canvas.captureStream(30), destination?.stream.getAudioTracks()[0] ?? null);
    setCurrentTime(0);
    setExporting(true);
    setExportProgress(0.1);
    setExportStage(exportFormat === 'mp4' ? 'Renderizando WebM base para luego convertir a MP4...' : 'Exportando WebM desde la timeline actual...');
    setIsPlaying(true);
    ensureToast(exportFormat === 'mp4' ? 'Iniciando exportacion MP4 local...' : 'Exportando WebM desde la timeline actual...');
  }

  const sidebarSections: Array<{ id: SidebarSection; label: string; shortLabel: string; hint: string }> = [
    { id: 'media', label: 'Medios', shortLabel: 'M', hint: 'Videos, imagenes y assets del proyecto' },
    { id: 'audio', label: 'Audio', shortLabel: 'A', hint: 'Musica, locucion y clips sonoros' },
    { id: 'text', label: 'Texto', shortLabel: 'T', hint: 'Titulos y overlays rapidos' },
    { id: 'captions', label: 'Subtitulos', shortLabel: 'CC', hint: 'Panel listo para subtitulos manuales' },
    { id: 'transitions', label: 'Transiciones', shortLabel: 'Tr', hint: 'Panel listo para transiciones basicas' },
    { id: 'effects', label: 'Efectos', shortLabel: 'Fx', hint: 'Panel listo para filtros y efectos' },
    { id: 'projects', label: 'Proyectos', shortLabel: 'P', hint: 'Guardados locales del navegador' },
  ];
  const mediaLibrary = clips.filter((clip) => clip.kind !== 'text');
  const timelineContentWidth = Math.max(totalDuration * zoom + 200, 1200 - TIMELINE_LABEL_WIDTH);
  const timelineWidth = TIMELINE_LABEL_WIDTH + timelineContentWidth;

  return (
    <div className="fixed inset-0 z-40 bg-[#0b0d12] text-white">
      <input ref={fileInputRef} type="file" accept="video/*,audio/*,image/*" multiple className="hidden" onChange={handleImportFiles} />

      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0f1117]">
        <EditorTopBar
          onBackToStudio={onBackToStudio}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          projectFormat={projectFormat}
          exportFormat={exportFormat}
          exporting={exporting}
          savingProject={savingProject}
          onUndo={undoLastChange}
          onRedo={redoLastChange}
          onSaveProject={() => void saveProject()}
          onSetExportFormat={setExportFormat}
          onExport={exportTimeline}
          sidebarExpanded={sidebarExpanded}
          inspectorOpen={inspectorOpen}
          onToggleSidebar={() => setSidebarExpanded((value) => !value)}
          onToggleInspector={() => setInspectorOpen((value) => !value)}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 overflow-hidden border-b border-white/8">
            <aside className="flex min-h-0 shrink-0 border-r border-white/8 bg-[#12161e]">
              <div className="flex w-16 flex-col items-center gap-2 border-r border-white/8 bg-[#0f141b] px-2 py-3">
                {sidebarSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    title={section.label}
                    className={[
                      'flex h-11 w-11 items-center justify-center rounded-2xl border text-xs font-semibold transition',
                      activeSidebarSection === section.id
                        ? 'border-emerald-300/30 bg-emerald-400/15 text-white'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200',
                    ].join(' ')}
                    onClick={() => openSidebarSection(section.id)}
                  >
                    <SidebarSectionIcon section={section.id} />
                  </button>
                ))}
                <button
                  type="button"
                  className="mt-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-xs font-semibold text-slate-400 hover:border-white/15 hover:text-slate-200"
                  onClick={() => setSidebarExpanded((value) => !value)}
                >
                  {sidebarExpanded ? '<' : '>'}
                </button>
              </div>

              {sidebarExpanded ? (
                <div className="flex min-h-0 w-[320px] flex-col bg-[#171717]">
                  <div className="border-b border-white/8 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Archivos y herramientas</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{sidebarSections.find((section) => section.id === activeSidebarSection)?.label}</h3>
                      </div>
                      <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300" onClick={() => setSidebarExpanded(false)}>
                        Ocultar
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{sidebarSections.find((section) => section.id === activeSidebarSection)?.hint}</p>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {activeSidebarSection === 'media' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Biblioteca de medios</p>
                        <p className="mt-1 text-xs text-slate-500">Importa archivos y reusa clips ya presentes en el proyecto.</p>
                      </div>
                      <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>Importar</button>
                    </div>
                  </div>

                  {mediaLibrary.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/25 px-4 py-10 text-sm text-slate-400">Aun no hay medios en el proyecto. Importa video, audio o imagen para comenzar.</div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {mediaLibrary.map((clip) => (
                        <button
                          key={clip.id}
                          type="button"
                          draggable
                          className="rounded-2xl border border-white/8 bg-slate-950/35 p-3 text-left text-sm text-slate-300 transition hover:border-white/15"
                          onClick={() => { setSelectedClipId(clip.id); seekTo(clip.startTime); }}
                          onDragStart={(event) => {
                            draggedLibraryClipIdRef.current = clip.id;
                            event.dataTransfer.effectAllowed = 'copy';
                            event.dataTransfer.setData('text/plain', clip.id);
                          }}
                          onDragEnd={() => {
                            draggedLibraryClipIdRef.current = null;
                            clearDropIndicator();
                          }}
                        >
                          <div className="mb-3 aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black">
                            {clip.kind === 'image' && clip.url ? (
                              <img src={clip.url} alt={clip.name} className="h-full w-full object-cover" />
                            ) : clip.kind === 'video' && clip.url ? (
                              <video src={clip.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full flex-col justify-between p-3">
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">audio</span>
                                <span className="text-3xl text-emerald-200/80">♪</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <strong className="block truncate text-white">{clip.name}</strong>
                              <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-slate-500">{getTrackDefinition(clip.trackId).label}</span>
                            </div>
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-100">{clipDuration(clip).toFixed(1)}s</span>
                          </div>
                          <span className="mt-2 block text-xs text-slate-500">Arrastra a la timeline o haz clic para ubicarlo</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {activeSidebarSection === 'audio' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                    <p className="text-sm font-semibold text-white">Audio del proyecto</p>
                    <p className="mt-1 text-xs text-slate-500">Importa musica, fx o voz y ubicalos en A1, A2 o A3.</p>
                    <button type="button" className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => fileInputRef.current?.click()}>Importar audio</button>
                  </div>
                  <div className="grid gap-3">
                    {clips.filter((clip) => clip.kind === 'audio').map((clip) => (
                      <button key={clip.id} type="button" className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 text-left text-sm text-slate-300" onClick={() => setSelectedClipId(clip.id)}>
                        <strong className="block text-white">{clip.name}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{getTrackDefinition(clip.trackId).label} · {Math.round(clip.volume * 100)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeSidebarSection === 'text' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                    <p className="text-sm font-semibold text-white">Titulos y overlays</p>
                    <p className="mt-1 text-xs text-slate-500">Crea textos rapidos para V3 y ajustalos desde el inspector.</p>
                    <div className="mt-4 space-y-3">
                      <input type="text" value={textDraft} onChange={(event) => setTextDraft(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none" placeholder="Escribe un titulo" />
                      <button type="button" className="btn-primary w-full" onClick={addTextClip}>Agregar texto a timeline</button>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {clips.filter((clip) => clip.kind === 'text').map((clip) => (
                      <button key={clip.id} type="button" className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 text-left text-sm text-slate-300" onClick={() => setSelectedClipId(clip.id)}>
                        <strong className="block text-white">{clip.name}</strong>
                        <span className="mt-1 block text-xs text-slate-500">Overlay · {clipDuration(clip).toFixed(1)}s</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeSidebarSection === 'projects' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Proyectos locales</p>
                    <span className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs text-slate-400">{projects.length}</span>
                  </div>
                  {projects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/25 px-4 py-8 text-sm text-slate-400">Aun no hay proyectos guardados en este navegador.</div>
                  ) : (
                    projects.map((project) => (
                      <article key={project.id} className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 text-sm text-slate-300">
                        <strong className="block text-white">{project.name}</strong>
                        <p className="mt-2 text-xs text-slate-500">{new Date(project.updatedAt).toLocaleString()}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatSeconds(project.duration)} · {project.format ?? '16:9'}</p>
                        <div className="mt-4 flex gap-2">
                          <button type="button" className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100" onClick={() => void loadProject(project.id)}>Cargar</button>
                          <button type="button" className="rounded-full border border-orange-300/20 px-3 py-2 text-xs text-orange-200" onClick={() => void deleteProject(project.id)}>Eliminar</button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              ) : null}

              {activeSidebarSection === 'captions' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                    <p className="text-sm font-semibold text-white">Subtitulos manuales</p>
                    <p className="mt-1 text-xs text-slate-500">Inserta subtitulos en el punto actual del playhead y editalos desde el inspector.</p>
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={captionDraft}
                        onChange={(event) => setCaptionDraft(event.target.value)}
                        className="h-24 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                        placeholder="Escribe el subtitulo"
                      />
                      <button type="button" className="btn-primary w-full" onClick={addCaptionClip}>
                        Insertar subtitulo en el playhead
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {clips.filter((clip) => clip.kind === 'text').map((clip) => (
                      <button key={clip.id} type="button" className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 text-left text-sm text-slate-300" onClick={() => { setSelectedClipId(clip.id); seekTo(clip.startTime); }}>
                        <strong className="block truncate text-white">{clip.text ?? clip.name}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{clip.startTime.toFixed(1)}s · {clipDuration(clip).toFixed(1)}s</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeSidebarSection === 'transitions' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                    <p className="text-sm font-semibold text-white">Transiciones basicas</p>
                    <p className="mt-1 text-xs text-slate-500">Aplica fades rapidos al clip seleccionado para entrada, salida o ambos.</p>
                    {selectedClip ? (
                      <div className="mt-4 grid gap-2">
                        <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => applyFadePreset(selectedClip, 0.3, selectedClip.fadeOut ?? 0)}>
                          Fade in 0.3s
                        </button>
                        <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => applyFadePreset(selectedClip, selectedClip.fadeIn ?? 0, 0.3)}>
                          Fade out 0.3s
                        </button>
                        <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => applyFadePreset(selectedClip, 0.3, 0.3)}>
                          Fade in/out 0.3s
                        </button>
                        <button type="button" className="rounded-full border border-orange-300/20 px-4 py-2 text-sm text-orange-200" onClick={() => applyFadePreset(selectedClip, 0, 0)}>
                          Quitar fades
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                        Selecciona un clip para aplicar transiciones basicas.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeSidebarSection === 'effects' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                    <p className="text-sm font-semibold text-white">Presets de efectos</p>
                    <p className="mt-1 text-xs text-slate-500">Aplica correcciones visuales rapidas a imagenes y video.</p>
                    {selectedClip && isVisualClip(selectedClip) ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {FILTER_LABELS.map((filter) => (
                          <button
                            key={filter.value}
                            type="button"
                            className={[
                              'rounded-2xl border px-3 py-3 text-sm transition',
                              (selectedClip.filter ?? 'none') === filter.value
                                ? 'border-emerald-300/30 bg-emerald-400/10 text-white'
                                : 'border-white/10 bg-white/5 text-slate-300',
                            ].join(' ')}
                            onClick={() => updateClip(selectedClip.id, { filter: filter.value })}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                        Selecciona un clip visual para aplicar efectos.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

                  </div>
                </div>
              ) : null}

            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0e1118]">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-white/8 p-4 xl:p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Previsualizador del video</p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-sm text-slate-300">
                    <span className="mr-1 max-w-[220px] truncate text-sm text-white">{selectedClip ? selectedClip.name : 'Sin clip seleccionado'}</span>
                    <button type="button" title="Ir al inicio" className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={() => seekTo(0)}><ToolbarIcon name="rewind" /></button>
                    <button type="button" title={isPlaying ? 'Pausar' : 'Reproducir'} className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={togglePlayback}><ToolbarIcon name={isPlaying ? 'pause' : 'play'} /></button>
                    <button type="button" title="Retroceder 0.1s" className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={() => jumpPlayhead(-0.1)}><ToolbarIcon name="rewind-small" /></button>
                    <button type="button" title="Avanzar 0.1s" className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={() => jumpPlayhead(0.1)}><ToolbarIcon name="forward-small" /></button>
                    <button type="button" title="Cortar en playhead" className="rounded-xl border border-white/10 p-2 text-slate-200 disabled:opacity-40" onClick={() => selectedClip && splitClip(selectedClip.id)} disabled={!selectedClip}><ToolbarIcon name="cut" /></button>
                    <button type="button" title="Mover a pista superior" className="rounded-xl border border-white/10 p-2 text-slate-200 disabled:opacity-40" onClick={() => selectedClip && moveClipToAdjacentTrack(selectedClip.id, -1)} disabled={!selectedClip}><ToolbarIcon name="up" /></button>
                    <button type="button" title="Mover a pista inferior" className="rounded-xl border border-white/10 p-2 text-slate-200 disabled:opacity-40" onClick={() => selectedClip && moveClipToAdjacentTrack(selectedClip.id, 1)} disabled={!selectedClip}><ToolbarIcon name="down" /></button>
                    <input id="editor-zoom" type="range" min="40" max="180" value={zoom} onChange={(event) => setZoomAroundPlayhead(Number(event.target.value))} className="w-24 accent-sky-400" />
                    {EDITOR_FORMAT_OPTIONS.map((option) => (
                      <button key={option.value} type="button" className={[ 'rounded-xl px-3 py-2 text-xs transition', projectFormat === option.value ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/5 text-slate-300' ].join(' ')} onClick={() => setProjectFormat(option.value)}>{option.label}</button>
                    ))}
                    <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200" onClick={() => void togglePreviewFullscreen()}>
                      {previewFullscreen ? 'Salir full' : 'Pantalla completa'}
                    </button>
                  </div>
                </div>

                <div ref={previewShellRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-white/8 bg-black p-3">
                  <div
                    className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[20px] bg-slate-950"
                  >
              <canvas
                ref={canvasRef}
                className="block max-h-full max-w-full cursor-crosshair bg-slate-950 object-contain"
                style={{ aspectRatio: previewAspectRatio }}
                onPointerDown={(event) => {
                  const point = getCanvasPoint(event);
                  if (!point) {
                    return;
                  }

                  const targetClip = pickVisualClipAtPoint(point);
                  if (!targetClip) {
                    setSelectedClipId(null);
                    return;
                  }

                  const bounds = getVisualClipBounds(targetClip);
                  if (!bounds) {
                    return;
                  }

                  beginHistoryTransaction(clips);
                  setSelectedClipId(targetClip.id);
                  const handleSize = 18;
                  const inResizeHandle =
                    point.x >= bounds.boxX + bounds.boxWidth - handleSize &&
                    point.x <= bounds.boxX + bounds.boxWidth + 6 &&
                    point.y >= bounds.boxY + bounds.boxHeight - handleSize &&
                    point.y <= bounds.boxY + bounds.boxHeight + 6;

                  if (inResizeHandle) {
                    const center = getBoundsCenter(bounds);
                    previewDragRef.current = {
                      mode: 'scale',
                      clipId: targetClip.id,
                      startDistance: Math.max(1, Math.hypot(point.x - center.x, point.y - center.y)),
                      startScale: targetClip.scale ?? 1,
                    };
                    return;
                  }

                  previewDragRef.current = {
                    mode: 'move',
                    clipId: targetClip.id,
                    offsetX: point.x - (bounds.boxX + bounds.boxWidth / 2),
                    offsetY: point.y - (bounds.boxY + bounds.boxHeight / 2),
                  };
                }}
              />
                  </div>
                </div>

                {exporting ? (
                  <div className="mt-2 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{exportStage ?? `Modo de exportacion: ${exportFormat.toUpperCase()}`}</span>
                      <span>{Math.round(exportProgress * 100)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width]" style={{ width: `${Math.max(exporting || exportProgress > 0 ? 2 : 0, exportProgress * 100)}%` }} />
                    </div>
                    {exportFormat === 'mp4' ? (<p className="mt-2 text-xs text-slate-400">MP4 usa conversion local avanzada y puede tardar mas en equipos modestos.</p>) : null}
                  </div>
                ) : null}
              </div>

              <aside className={[ 'flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden bg-[#171717] transition-all duration-200', inspectorOpen ? 'w-[300px] border-l border-white/8 p-3 xl:w-[320px] xl:p-4' : 'w-16 border-l border-white/8 px-2 py-4' ].join(' ')}>
                {inspectorOpen ? (
                  <>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Inspector</p>
                        <h3 className="mt-1 truncate text-base font-semibold text-white">Propiedades</h3>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" title="Cerrar inspector" className="rounded-xl border border-white/10 p-2 text-xs text-slate-200" onClick={() => setInspectorOpen(false)}><ToolbarIcon name="close" /></button>
                        {selectedClip ? (
                          <>
                            <button type="button" title="Duplicar clip" className="rounded-xl border border-white/10 p-2 text-xs text-slate-200" onClick={() => duplicateClip(selectedClip.id)}><ToolbarIcon name="duplicate" /></button>
                            <button type="button" title="Eliminar clip" className="rounded-xl border border-orange-300/20 p-2 text-xs text-orange-200" onClick={() => deleteClip(selectedClip.id)}><ToolbarIcon name="trash" /></button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {selectedClip ? (
                      <div className="mt-4 min-h-0 min-w-0 space-y-3 overflow-y-auto pr-1 text-sm text-slate-300">
              <div className="min-w-0 rounded-2xl border border-white/8 bg-slate-950/35 p-3">
                <strong className="block truncate text-sm text-white">{selectedClip.name}</strong>
                <p className="mt-1 text-slate-400">{getTrackDefinition(selectedClip.trackId).label} · {selectedClip.kind}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" title="Cortar en playhead" className="rounded-xl border border-white/10 p-2 text-xs text-slate-200" onClick={() => splitClip(selectedClip.id)}><ToolbarIcon name="cut" /></button>
                  <button type="button" title="Copiar clip" className="rounded-xl border border-white/10 p-2 text-xs text-slate-200" onClick={() => copyClip(selectedClip.id)}><ToolbarIcon name="copy" /></button>
                  <button type="button" title="Mover -0.25s" className="rounded-xl border border-white/10 p-2 text-xs text-slate-200" onClick={() => nudgeClip(selectedClip.id, -0.25)}><ToolbarIcon name="rewind-small" /></button>
                  <button type="button" title="Mover +0.25s" className="rounded-xl border border-white/10 p-2 text-xs text-slate-200" onClick={() => nudgeClip(selectedClip.id, 0.25)}><ToolbarIcon name="forward-small" /></button>
                </div>
              </div>

                <label className="block min-w-0">
                  <span className="mb-2 block">Pista</span>
                  <select
                  value={selectedClip.trackId}
                  onChange={(event) => updateClip(selectedClip.id, { trackId: event.target.value as EditorTrackId })}
                   className="min-w-0 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white"
                >
                  {tracks.filter((track) => {
                    if (selectedClip.kind === 'audio') return track.kind === 'audio';
                    if (selectedClip.kind === 'text') return track.kind === 'overlay';
                    return track.kind === 'video';
                  }).map((track) => (
                    <option key={track.id} value={track.id}>{track.label}</option>
                  ))}
                  </select>
                </label>

                {isVisualClip(selectedClip) ? (
                  <div className="min-w-0 space-y-4 rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Transformar</p>
                      <h4 className="mt-1 text-sm font-semibold text-white">Posicion y apariencia</h4>
                    </div>

                    <label className="block min-w-0">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Posicion X</span>
                        <span>{Math.round((selectedClip.x ?? 0.5) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.95"
                        step="0.01"
                        value={selectedClip.x ?? 0.5}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { x: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-sky-400"
                      />
                    </label>

                    <label className="block min-w-0">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Posicion Y</span>
                        <span>{Math.round((selectedClip.y ?? 0.5) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.95"
                        step="0.01"
                        value={selectedClip.y ?? 0.5}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { y: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-sky-400"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Escala</span>
                        <span>{(selectedClip.scale ?? 1).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.35"
                        max="2.4"
                        step="0.01"
                        value={selectedClip.scale ?? 1}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { scale: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-emerald-400"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Opacidad</span>
                        <span>{Math.round((selectedClip.opacity ?? 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.01"
                        value={selectedClip.opacity ?? 1}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { opacity: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-fuchsia-400"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Fade in</span>
                        <span>{(selectedClip.fadeIn ?? 0).toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, clipDuration(selectedClip) - MIN_CLIP_DURATION)}
                        step="0.01"
                        value={selectedClip.fadeIn ?? 0}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { fadeIn: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-cyan-400"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Fade out</span>
                        <span>{(selectedClip.fadeOut ?? 0).toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, clipDuration(selectedClip) - MIN_CLIP_DURATION)}
                        step="0.01"
                        value={selectedClip.fadeOut ?? 0}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { fadeOut: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-cyan-400"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Rotacion</span>
                        <span>{Math.round(selectedClip.rotation ?? 0)}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={selectedClip.rotation ?? 0}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { rotation: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-amber-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block">Filtro</span>
                      <select
                        value={selectedClip.filter ?? 'none'}
                        onChange={(event) => updateClip(selectedClip.id, { filter: event.target.value as VisualFilter })}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white"
                      >
                        {FILTER_LABELS.map((filter) => (
                          <option key={filter.value} value={filter.value}>{filter.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <label className="block min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                  <span>Inicio en timeline</span>
                  <span>{selectedClip.startTime.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(totalDuration + 5, selectedClip.startTime + 5)}
                  step="0.01"
                  value={selectedClip.startTime}
                  onPointerDown={() => beginHistoryTransaction(clips)}
                  onPointerUp={endHistoryTransaction}
                  onChange={(event) => updateClip(selectedClip.id, { startTime: Number(event.target.value) }, { commitHistory: false })}
                  className="w-full accent-sky-400"
                />
              </label>

               <label className="block min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <span>Trim inicio</span>
                  <span>{selectedClip.trimStart.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, selectedClip.trimEnd - MIN_CLIP_DURATION)}
                  step="0.01"
                  value={selectedClip.trimStart}
                  onPointerDown={() => beginHistoryTransaction(clips)}
                  onPointerUp={endHistoryTransaction}
                  onChange={(event) => updateClip(selectedClip.id, { trimStart: Number(event.target.value) }, { commitHistory: false })}
                  className="w-full accent-emerald-400"
                />
              </label>

               <label className="block min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <span>Trim fin</span>
                  <span>{selectedClip.trimEnd.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={selectedClip.trimStart + MIN_CLIP_DURATION}
                  max={selectedClip.duration}
                  step="0.01"
                  value={selectedClip.trimEnd}
                  onPointerDown={() => beginHistoryTransaction(clips)}
                  onPointerUp={endHistoryTransaction}
                  onChange={(event) => updateClip(selectedClip.id, { trimEnd: Number(event.target.value) }, { commitHistory: false })}
                  className="w-full accent-emerald-400"
                />
              </label>

              {selectedClip.kind === 'audio' || selectedClip.kind === 'video' ? (
                <label className="block min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                    <span>Volumen</span>
                    <span>{Math.round(selectedClip.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={selectedClip.volume}
                    onPointerDown={() => beginHistoryTransaction(clips)}
                    onPointerUp={endHistoryTransaction}
                    onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) }, { commitHistory: false })}
                    className="w-full accent-orange-400"
                  />
                </label>
              ) : null}

              {selectedClip.kind === 'audio' || selectedClip.kind === 'video' ? (
                <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3">
                  <span>Mute</span>
                  <input
                    type="checkbox"
                    checked={selectedClip.muted}
                    onChange={(event) => updateClip(selectedClip.id, { muted: event.target.checked })}
                    className="h-4 w-4 accent-emerald-400"
                  />
                </label>
              ) : null}

                {selectedClip.kind === 'text' ? (
                  <>
                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Tamano texto</span>
                        <span>{Math.round(selectedClip.fontSize ?? 42)}px</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="120"
                        step="1"
                        value={selectedClip.fontSize ?? 42}
                        onPointerDown={() => beginHistoryTransaction(clips)}
                        onPointerUp={endHistoryTransaction}
                        onChange={(event) => updateClip(selectedClip.id, { fontSize: Number(event.target.value) }, { commitHistory: false })}
                        className="w-full accent-fuchsia-400"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block">Texto</span>
                      <textarea
                      value={selectedClip.text ?? ''}
                      onFocus={() => beginHistoryTransaction(clips)}
                      onBlur={endHistoryTransaction}
                      onChange={(event) => updateClip(selectedClip.id, { text: event.target.value, name: event.target.value.slice(0, 20) || 'Texto' }, { commitHistory: false })}
                      className="h-28 min-w-0 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white"
                    />
                  </label>
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <label className="block min-w-0">
                      <span className="mb-2 block">Texto</span>
                      <input type="color" value={selectedClip.color ?? '#ffffff'} onChange={(event) => updateClip(selectedClip.id, { color: event.target.value })} className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-2" />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-2 block">Fondo</span>
                      <input type="color" value={(selectedClip.background ?? '#020617').slice(0, 7)} onChange={(event) => updateClip(selectedClip.id, { background: `${event.target.value}cc` })} className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-2" />
                    </label>
                  </div>
                </>
              ) : null}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-slate-950/20 px-4 py-10 text-sm text-slate-400">
                        Selecciona un clip en la timeline para editar su pista, trim, volumen, mute o texto.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center gap-3">
                    <button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-300" onClick={() => setInspectorOpen(true)}>
                      INS
                    </button>
                    {selectedClip ? <span className="-rotate-180 text-[10px] uppercase tracking-[0.25em] text-slate-500 [writing-mode:vertical-rl]">{selectedClip.kind}</span> : null}
                  </div>
                )}
              </aside>
            </section>
          </div>

        <div
          className="group h-2 shrink-0 cursor-ns-resize border-t border-white/8 bg-[#101010] hover:bg-sky-400/10"
          onPointerDown={startTimelineResize}
          title="Arrastra para cambiar la altura de la timeline"
        >
          <div className="mx-auto mt-[3px] h-px w-28 rounded-full bg-white/12 group-hover:bg-sky-300/50" />
        </div>

        <section
          className="shrink-0 overflow-hidden border-t border-white/8 bg-[#101010] transition-[height] duration-150"
          style={{ height: timelineCollapsed ? 58 : timelineHeight }}
        >
          {!timelineCollapsed ? <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Timeline multipista</h3>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-xs text-slate-400">
              <span className="rounded-lg border border-white/8 bg-slate-950/40 px-2 py-1 text-xs text-slate-300">{formatPreciseTime(currentTime)} / {formatSeconds(totalDuration)}</span>
              <input
                id="timeline-time-input"
                type="text"
                value={timelineTimeInput}
                onChange={(event) => setTimelineTimeInput(event.target.value)}
                onBlur={commitTimelineTimeInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitTimelineTimeInput();
                  }
                }}
                className="w-24 rounded-xl border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-white outline-none"
              />
              <span className="mx-1 h-5 w-px bg-white/10" />
              <button type="button" className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-100" onClick={() => addTrack('video')}>+ Video</button>
              <button type="button" className="rounded-full border border-teal-300/20 bg-teal-400/10 px-3 py-1 text-teal-100" onClick={() => addTrack('audio')}>+ Audio</button>
              <button type="button" className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-100" onClick={() => addTrack('overlay')}>+ Overlay</button>
              <span className="mx-1 h-5 w-px bg-white/10" />
              <button type="button" title="Seleccionar" className="rounded-xl border border-white/10 p-1.5 text-slate-200"><ToolbarIcon name="select" /></button>
              <button type="button" title="Cortar [S]" className="rounded-xl border border-white/10 p-1.5 text-slate-200 disabled:opacity-40" onClick={() => selectedClip && splitClip(selectedClip.id)} disabled={!selectedClip}><ToolbarIcon name="cut" /></button>
              <button type="button" title="Copiar" className="rounded-xl border border-white/10 p-1.5 text-slate-200 disabled:opacity-40" onClick={() => selectedClip && copyClip(selectedClip.id)} disabled={!selectedClip}><ToolbarIcon name="copy" /></button>
              <button type="button" title="Pegar" className="rounded-xl border border-white/10 p-1.5 text-slate-200" onClick={pasteClip}><ToolbarIcon name="paste" /></button>
              <button type="button" title="Duplicar" className="rounded-xl border border-white/10 p-1.5 text-slate-200 disabled:opacity-40" onClick={() => selectedClip && duplicateClip(selectedClip.id)} disabled={!selectedClip}><ToolbarIcon name="duplicate" /></button>
              <button type="button" title="Retroceder 1s" className="rounded-xl border border-white/10 p-1.5 text-slate-200" onClick={() => jumpPlayhead(-1)}><ToolbarIcon name="rewind" /></button>
              <button type="button" title="Avanzar 1s" className="rounded-xl border border-white/10 p-1.5 text-slate-200" onClick={() => jumpPlayhead(1)}><ToolbarIcon name="forward" /></button>
              <span title="Snap activo" className="inline-flex rounded-xl border border-white/10 bg-slate-950/35 p-1.5 text-slate-300"><ToolbarIcon name="snap" /></span>
              <span className="mx-1 h-5 w-px bg-white/10" />
              <button type="button" className="rounded-full border border-white/8 px-3 py-1 text-slate-200 hover:border-sky-300/40" onClick={() => setTimelineCollapsed(true)}>
                Colapsar
              </button>
              <span className="rounded-full border border-white/8 px-2 py-1">Space play</span>
              <span className="rounded-full border border-white/8 px-2 py-1">Cmd/Ctrl+Z</span>
              <span className="rounded-full border border-white/8 px-2 py-1">Shift+Z</span>
              <span className="rounded-full border border-white/8 px-2 py-1">C/V</span>
            </div>
          </div> : <div className="flex h-0 justify-end px-4"><button type="button" className="relative z-40 mt-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs text-slate-200" onClick={() => setTimelineCollapsed(false)}>Expandir timeline</button></div>}

          <div ref={timelineScrollRef} className="h-full overflow-auto px-4 pb-2">
            <div className={['relative', timelineCollapsed ? 'min-h-[48px]' : 'min-h-[420px]'].join(' ')} style={{ width: timelineWidth }}>
              <div
                ref={timelineRulerRef}
                className="sticky top-0 z-20 mb-3 flex h-10 cursor-pointer items-end gap-0 border-b border-white/8 bg-[#101010] text-xs text-slate-500"
                onPointerDown={(event) => {
                  timelineScrubRef.current = true;
                  setIsTimelineScrubbing(true);
                  seekFromRulerClientX(event.clientX);
                }}
                onPointerMove={(event) => {
                  setTimelineHoverTime(getTimeFromRulerClientX(event.clientX));
                }}
                onPointerLeave={() => {
                  setTimelineHoverTime(null);
                }}
              >
                <div className="sticky left-0 z-10 h-full shrink-0 border-r border-white/8 bg-[#101010]" style={{ width: TIMELINE_LABEL_WIDTH }} />
                <div className="relative h-full" style={{ width: timelineContentWidth }}>
                  {rulerMinorStep < 1
                    ? Array.from({ length: Math.floor((Math.ceil(totalDuration) + 8) / rulerMinorStep) }, (_, index) => {
                        const time = index * rulerMinorStep;
                        if (Math.abs(time - Math.round(time)) < 0.001) {
                          return null;
                        }

                        return (
                          <div
                            key={`minor-${time.toFixed(2)}`}
                            className="pointer-events-none absolute bottom-0 top-4 w-px bg-white/6"
                            style={{ left: time * zoom }}
                          />
                        );
                      })
                    : null}
                  {Array.from({ length: Math.ceil((totalDuration + rulerMajorStep * 4) / rulerMajorStep) + 1 }, (_, index) => index * rulerMajorStep).map((time) => (
                    <div key={time} className="absolute inset-y-0 border-l border-white/8 pl-2 pt-4" style={{ left: time * zoom, width: rulerMajorStep * zoom }}>
                      {formatTimelineTime(time, totalDuration)}
                      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/5" />
                    </div>
                  ))}
                </div>
                <div
                  className="absolute inset-y-0 z-30 w-px bg-rose-400"
                  style={{ left: TIMELINE_LABEL_WIDTH + currentTime * zoom }}
                >
                  <button
                    type="button"
                    aria-label="Mover playhead"
                    className="absolute left-1/2 top-0 h-full w-4 -translate-x-1/2 cursor-ew-resize bg-transparent"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      timelineScrubRef.current = true;
                      setIsTimelineScrubbing(true);
                      seekFromRulerClientX(event.clientX);
                    }}
                  />
                  <span className={[ 'absolute -left-10 -top-7 rounded-lg border px-2 py-1 text-[10px] font-medium shadow-lg backdrop-blur', isTimelineScrubbing ? 'border-rose-300/40 bg-rose-400/20 text-rose-50' : 'border-white/10 bg-slate-950/90 text-slate-200' ].join(' ')}>
                    {formatPreciseTime(currentTime)}
                  </span>
                </div>
                {timelineHoverTime !== null ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-sky-300/55"
                    style={{ left: TIMELINE_LABEL_WIDTH + timelineHoverTime * zoom }}
                  >
                    <span className="absolute -left-10 -top-7 rounded-lg border border-sky-300/30 bg-sky-400/15 px-2 py-1 text-[10px] font-medium text-sky-50 shadow-lg backdrop-blur">
                      {formatPreciseTime(timelineHoverTime)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="absolute top-0 z-10 h-full w-px bg-rose-400/70" style={{ left: TIMELINE_LABEL_WIDTH + currentTime * zoom }} />
              {snapGuideTime !== null ? (
                <div className="pointer-events-none absolute top-0 z-10 h-full w-px bg-emerald-300/85" style={{ left: TIMELINE_LABEL_WIDTH + snapGuideTime * zoom }} />
              ) : null}

              {!timelineCollapsed ? <div className="space-y-3">
                {tracks.map((track) => {
                  const laneClips = clips.filter((clip) => clip.trackId === track.id).sort((a, b) => a.startTime - b.startTime);
                  const isTrackCollapsed = collapsedTrackIds.has(track.id);

                  return (
                    <div key={track.id} className="grid items-stretch gap-0" style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px 1fr` }}>
                      <div className="sticky left-0 z-50 rounded-l-2xl border border-r-0 border-white/8 bg-[#05070d] px-3 py-2 text-sm text-slate-200 shadow-[18px_0_24px_rgba(0,0,0,0.75)] ring-1 ring-black/60">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block truncate text-white">{track.label}</strong>
                            <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">{track.kind} · {laneClips.length}</span>
                          </div>
                          <div className="flex w-12 shrink-0 justify-end gap-1">
                            <button type="button" className="h-6 w-6 rounded-lg border border-white/10 text-xs text-slate-300" onClick={() => toggleTrackCollapsed(track.id)} title={isTrackCollapsed ? 'Expandir pista' : 'Colapsar pista'}>
                              {isTrackCollapsed ? '+' : '-'}
                            </button>
                            <button type="button" className="h-6 w-6 rounded-lg border border-orange-300/20 text-xs text-orange-200 disabled:opacity-30" onClick={() => removeTrack(track.id)} disabled={laneClips.length > 0} title="Quitar canal vacio">
                              x
                            </button>
                          </div>
                        </div>
                        {track.kind !== 'overlay' && !isTrackCollapsed ? (
                          <div className="relative mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                            <button
                              type="button"
                              className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-200"
                              title={`Volumen ${Math.round(getTrackVolume(track.id) * 100)}%`}
                              onClick={() => setOpenTrackControl((current) => current?.trackId === track.id && current.type === 'volume' ? null : { trackId: track.id, type: 'volume' })}
                            >
                              Vol {Math.round(getTrackVolume(track.id) * 100)}%
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-200"
                              title={`Paneo ${formatPan(getTrackPan(track.id))}`}
                              onClick={() => setOpenTrackControl((current) => current?.trackId === track.id && current.type === 'pan' ? null : { trackId: track.id, type: 'pan' })}
                            >
                              Pan {formatPan(getTrackPan(track.id))}
                            </button>
                            {openTrackControl?.trackId === track.id ? (
                              <div className="absolute left-0 top-8 z-[70] w-52 rounded-2xl border border-white/10 bg-[#05070d] p-3 shadow-2xl">
                                {openTrackControl.type === 'volume' ? (
                                  <label className="block">
                                    <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                                      <span>Volumen canal</span>
                                      <span>{Math.round(getTrackVolume(track.id) * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="2" step="0.05" value={getTrackVolume(track.id)} onChange={(event) => updateTrackVolume(track.id, Number(event.target.value))} className="w-full accent-sky-400" />
                                  </label>
                                ) : (
                                  <label className="block">
                                    <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                                      <span>Paneo</span>
                                      <span>{formatPan(getTrackPan(track.id))}</span>
                                    </div>
                                    <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                                      <span>Izquierda</span>
                                      <span>Centro</span>
                                      <span>Derecha</span>
                                    </div>
                                    <input type="range" min="-1" max="1" step="0.05" value={getTrackPan(track.id)} onChange={(event) => updateTrackPan(track.id, Number(event.target.value))} className="w-full accent-fuchsia-400" />
                                  </label>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div
                        ref={(element) => { laneRefs.current[track.id] = element; }}
                        className={['relative rounded-r-2xl border border-white/8 bg-slate-950/30', isTrackCollapsed ? 'h-10' : 'h-20'].join(' ')}
                        onDoubleClick={(event) => { const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect(); seekTo((event.clientX - rect.left) / zoom); }}
                        onPointerDown={(event) => {
                          if (event.target !== event.currentTarget) {
                            return;
                          }

                          const rect = event.currentTarget.getBoundingClientRect();
                          timelineScrubRef.current = true;
                          setIsTimelineScrubbing(true);
                          seekTo((event.clientX - rect.left) / zoom);
                        }}
                        onDragOver={(event) => {
                          const draggedClipId = draggedLibraryClipIdRef.current;
                          const draggedClip = draggedClipId ? clips.find((clip) => clip.id === draggedClipId) : null;
                          if (!draggedClip) {
                            clearDropIndicator();
                            return;
                          }

                          if (!getCompatibleTrackIds(draggedClip.kind).includes(track.id)) {
                            clearDropIndicator();
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'copy';
                          const rect = event.currentTarget.getBoundingClientRect();
                          setDropIndicator({
                            trackId: track.id,
                            startTime: Math.max(0, (event.clientX - rect.left) / zoom),
                          });
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            clearDropIndicator();
                          }
                        }}
                        onDrop={(event) => {
                          const draggedClipId = draggedLibraryClipIdRef.current ?? event.dataTransfer.getData('text/plain');
                          if (!draggedClipId) {
                            clearDropIndicator();
                            return;
                          }

                          const draggedClip = clips.find((clip) => clip.id === draggedClipId);
                          if (!draggedClip || !getCompatibleTrackIds(draggedClip.kind).includes(track.id)) {
                            draggedLibraryClipIdRef.current = null;
                            clearDropIndicator();
                            return;
                          }

                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const startTime = Math.max(0, (event.clientX - rect.left) / zoom);
                          insertLibraryClipIntoTrack(draggedClipId, track.id, startTime);
                          draggedLibraryClipIdRef.current = null;
                          clearDropIndicator();
                        }}
                      >
                        {dropIndicator?.trackId === track.id ? (
                          <>
                            <div className="pointer-events-none absolute inset-0 rounded-r-2xl border border-emerald-300/35 bg-emerald-400/6" />
                            <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-emerald-300" style={{ left: dropIndicator.startTime * zoom }}>
                              <span className="absolute -left-8 top-2 rounded-md border border-emerald-300/30 bg-emerald-400/15 px-1.5 py-1 text-[10px] font-medium text-emerald-50">
                                {formatPreciseTime(dropIndicator.startTime)}
                              </span>
                            </div>
                          </>
                        ) : null}
                        {laneClips.map((clip) => {
                          const left = clip.startTime * zoom;
                          const width = Math.max(clipDuration(clip) * zoom, 28);
                          const isSelected = selectedClipId === clip.id;
                          const decoration = getTimelineClipDecoration(clip);
                          const waveform = clipWaveforms.get(clip.id);

                          return (
                            <div key={clip.id} className={[ 'absolute rounded-2xl border px-3 shadow-lg transition', isTrackCollapsed ? 'top-1 h-8 py-1' : 'top-2 h-16 py-2', isSelected ? 'border-emerald-300/70 bg-emerald-400/18 text-white' : clip.kind === 'audio' ? 'border-teal-300/25 bg-teal-400/15 text-slate-100 hover:border-teal-200/35' : clip.kind === 'text' ? 'border-fuchsia-300/25 bg-fuchsia-400/15 text-slate-100 hover:border-fuchsia-200/35' : 'border-white/10 bg-sky-400/12 text-slate-100 hover:border-white/20' ].join(' ')} style={{ left, width }} onPointerDown={(event) => { beginHistoryTransaction(clips); dragRef.current = { type: 'move', clipId: clip.id, startX: event.clientX, startTime: clip.startTime, startTrackId: clip.trackId }; setSelectedClipId(clip.id); }} onClick={() => setSelectedClipId(clip.id)}>
                              <button type="button" className="absolute left-0 top-0 h-full w-3 cursor-ew-resize rounded-l-2xl bg-black/20" onPointerDown={(event) => { event.stopPropagation(); beginHistoryTransaction(clips); dragRef.current = { type: 'trim-start', clipId: clip.id, startX: event.clientX, startTrim: clip.trimStart, startTime: clip.startTime }; }} />
                              <button type="button" className="absolute right-0 top-0 h-full w-3 cursor-ew-resize rounded-r-2xl bg-black/20" onPointerDown={(event) => { event.stopPropagation(); beginHistoryTransaction(clips); dragRef.current = { type: 'trim-end', clipId: clip.id, startX: event.clientX, startTrim: clip.trimEnd }; }} />
                              {!isTrackCollapsed ? <div className="pointer-events-none absolute inset-x-3 bottom-2 top-2 overflow-hidden rounded-xl">
                                {clip.kind === 'audio' || clip.kind === 'video' ? (
                                  <div className="flex h-full items-end gap-1 opacity-75">
                                    {(waveform ?? decoration).map((value, index) => (
                                      <span
                                        key={index}
                                        className="w-1 shrink-0 rounded-full bg-white/45"
                                        style={{ height: typeof value === 'number' && value <= 1 ? `${Math.max(8, value * 100)}%` : value }}
                                      />
                                    ))}
                                  </div>
                                ) : clip.kind === 'text' ? (
                                  <div className="space-y-2 pt-6 opacity-60">
                                    {decoration.map((opacity, index) => (
                                      <span key={index} className="block h-1.5 rounded-full bg-white" style={{ width: `${72 - index * 6}%`, opacity }} />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid h-full grid-cols-7 gap-1 opacity-45">
                                    {decoration.map((opacity, index) => (
                                      <span key={index} className="rounded-lg bg-white/80" style={{ opacity }} />
                                    ))}
                                  </div>
                                )}
                              </div> : null}
                              <div className="relative z-10">
                                <span className="block truncate text-sm font-semibold">{clip.name}</span>
                                {!isTrackCollapsed ? <span className="mt-1 block text-[11px] text-slate-200/80">{clip.kind} · {clipDuration(clip).toFixed(1)}s</span> : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div> : null}
            </div>
          </div>
        </section>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-emerald-300/20 bg-emerald-400/14 px-4 py-3 text-sm text-emerald-50 shadow-xl backdrop-blur">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
