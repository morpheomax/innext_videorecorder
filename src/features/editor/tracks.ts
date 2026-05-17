import type { EditorClip, EditorTrackDefinition, EditorTrackId } from './types';

export const EDITOR_TRACKS: EditorTrackDefinition[] = [
  { id: 'overlay-1', label: 'V3 Texto / overlays', kind: 'overlay' },
  { id: 'video-3', label: 'V2 Imagenes / B-roll', kind: 'video' },
  { id: 'video-2', label: 'V1 Apoyo / B-roll', kind: 'video' },
  { id: 'video-1', label: 'V1 Video principal', kind: 'video' },
  { id: 'audio-1', label: 'A1 Audio principal', kind: 'audio' },
  { id: 'audio-2', label: 'A2 Musica', kind: 'audio' },
  { id: 'audio-3', label: 'A3 Voz en off', kind: 'audio' },
];

export function getTrackDefinition(trackId: EditorTrackId) {
  return EDITOR_TRACKS.find((track) => track.id === trackId) ?? EDITOR_TRACKS[0];
}

export function getTrackOrder(trackId: EditorTrackId) {
  return EDITOR_TRACKS.findIndex((track) => track.id === trackId);
}

export function getTrackEnd(clips: EditorClip[], trackId: EditorTrackId) {
  return clips
    .filter((clip) => clip.trackId === trackId)
    .reduce((max, clip) => Math.max(max, clip.startTime + (clip.trimEnd - clip.trimStart)), 0);
}

export function getDefaultTrackId(kind: EditorClip['kind']): EditorTrackId {
  if (kind === 'audio') {
    return 'audio-1';
  }

  if (kind === 'text') {
    return 'overlay-1';
  }

  return 'video-1';
}

export function getCompatibleTrackIds(kind: EditorClip['kind']) {
  if (kind === 'audio') {
    return EDITOR_TRACKS.filter((track) => track.kind === 'audio').map((track) => track.id);
  }

  if (kind === 'text') {
    return EDITOR_TRACKS.filter((track) => track.kind === 'overlay').map((track) => track.id);
  }

  return EDITOR_TRACKS.filter((track) => track.kind === 'video').map((track) => track.id);
}
