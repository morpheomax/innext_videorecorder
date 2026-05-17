import type { StudioFormat } from '../../core/compositor/stream-compositor';

export type EditorTrackId = 'video-1' | 'video-2' | 'video-3' | 'audio-1' | 'audio-2' | 'audio-3' | 'overlay-1';

export type EditorClipKind = 'video' | 'audio' | 'image' | 'text';

export interface EditorClip {
  id: string;
  name: string;
  kind: EditorClipKind;
  trackId: EditorTrackId;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  volume: number;
  muted: boolean;
  url?: string;
  blob?: Blob;
  text?: string;
  fontSize?: number;
  color?: string;
  background?: string;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  rotation?: number;
  fadeIn?: number;
  fadeOut?: number;
  filter?: 'none' | 'warm' | 'cool' | 'mono' | 'dramatic';
}

export interface EditorAsset {
  blob: Blob;
  name: string;
  format: StudioFormat;
}

export interface EditorTrackDefinition {
  id: EditorTrackId;
  label: string;
  kind: 'video' | 'audio' | 'overlay';
}
