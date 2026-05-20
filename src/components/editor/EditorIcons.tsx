import type { EditorClip } from '../../features/editor/types';

export type SidebarSection = 'media' | 'audio' | 'text' | 'captions' | 'transitions' | 'effects' | 'projects';

export type IconName = 'play' | 'pause' | 'cut' | 'copy' | 'paste' | 'duplicate' | 'rewind-small' | 'forward-small' | 'rewind' | 'forward' | 'select' | 'snap' | 'up' | 'down' | 'close' | 'trash';

export function SidebarSectionIcon({ section }: { section: SidebarSection }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-5 w-5',
  };

  switch (section) {
    case 'media':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m7 15 3-3 3 3 4-5 2 3" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'audio':
      return (
        <svg {...commonProps}>
          <path d="M4 14h2l3 4V6l-3 4H4z" />
          <path d="M15 9a5 5 0 0 1 0 6" />
          <path d="M18 7a8 8 0 0 1 0 10" />
        </svg>
      );
    case 'text':
      return (
        <svg {...commonProps}>
          <path d="M5 6h14" />
          <path d="M12 6v12" />
          <path d="M8 18h8" />
        </svg>
      );
    case 'captions':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 11h3" />
          <path d="M8 14h3" />
          <path d="M13 11h3" />
          <path d="M13 14h3" />
        </svg>
      );
    case 'transitions':
      return (
        <svg {...commonProps}>
          <path d="M5 17V7" />
          <path d="M11 17V7" />
          <path d="M11 12c0-2.8 2.2-5 5-5h3v10h-3c-2.8 0-5-2.2-5-5Z" />
        </svg>
      );
    case 'effects':
      return (
        <svg {...commonProps}>
          <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.7 7.2 18l.9-5.4-3.9-3.8 5.4-.8z" />
        </svg>
      );
    case 'projects':
      return (
        <svg {...commonProps}>
          <path d="M4 7h5l2 2h9v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <path d="M4 7V6a2 2 0 0 1 2-2h3l2 2h3" />
        </svg>
      );
  }
}

export function ToolbarIcon({ name }: { name: IconName }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-4 w-4',
  };

  switch (name) {
    case 'play':
      return <svg {...commonProps}><path d="m8 6 10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
    case 'pause':
      return <svg {...commonProps}><path d="M9 6v12" /><path d="M15 6v12" /></svg>;
    case 'cut':
      return <svg {...commonProps}><circle cx="6" cy="7" r="2" /><circle cx="6" cy="17" r="2" /><path d="M8 8 18 18" /><path d="M8 16 12 12" /><path d="M12 12 18 6" /></svg>;
    case 'copy':
      return <svg {...commonProps}><rect x="9" y="9" width="10" height="10" rx="2" /><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" /></svg>;
    case 'paste':
      return <svg {...commonProps}><path d="M9 4h6" /><path d="M10 2h4l1 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3z" /></svg>;
    case 'duplicate':
      return <svg {...commonProps}><rect x="4" y="7" width="9" height="13" rx="2" /><rect x="11" y="4" width="9" height="13" rx="2" /></svg>;
    case 'rewind-small':
      return <svg {...commonProps}><path d="m11 8-4 4 4 4" /><path d="M17 8v8" /></svg>;
    case 'forward-small':
      return <svg {...commonProps}><path d="m13 8 4 4-4 4" /><path d="M7 8v8" /></svg>;
    case 'rewind':
      return <svg {...commonProps}><path d="m11 8-4 4 4 4" /><path d="m17 8-4 4 4 4" /></svg>;
    case 'forward':
      return <svg {...commonProps}><path d="m7 8 4 4-4 4" /><path d="m13 8 4 4-4 4" /></svg>;
    case 'select':
      return <svg {...commonProps}><path d="m5 4 11 8-5 1 2 6-2 1-2-6-4 3z" /></svg>;
    case 'snap':
      return <svg {...commonProps}><path d="M7 7h4v4" /><path d="M17 17h-4v-4" /><path d="M7 17l10-10" /></svg>;
    case 'up':
      return <svg {...commonProps}><path d="m12 6-5 6h10z" fill="currentColor" stroke="none" /></svg>;
    case 'down':
      return <svg {...commonProps}><path d="m12 18 5-6H7z" fill="currentColor" stroke="none" /></svg>;
    case 'close':
      return <svg {...commonProps}><path d="M6 6 18 18" /><path d="m18 6-12 12" /></svg>;
    case 'trash':
      return <svg {...commonProps}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" /></svg>;
  }
}

export function getTimelineClipDecoration(clip: EditorClip) {
  if (clip.kind === 'audio') {
    return Array.from({ length: 12 }, (_, index) => 18 + ((index * 11) % 26));
  }

  if (clip.kind === 'text') {
    return Array.from({ length: 8 }, (_, index) => (index % 2 === 0 ? 0.22 : 0.1));
  }

  return Array.from({ length: 7 }, (_, index) => (index % 3 === 0 ? 0.22 : 0.14));
}
