import { ToolbarIcon } from './EditorIcons';

interface EditorTimelineToolbarProps {
  hasSelectedClip: boolean;
  onSplit: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onJumpBack: () => void;
  onJumpForward: () => void;
}

export function EditorTimelineToolbar({
  hasSelectedClip,
  onSplit,
  onCopy,
  onPaste,
  onDuplicate,
  onJumpBack,
  onJumpForward,
}: EditorTimelineToolbarProps) {
  return (
    <section className="border-t border-white/8 bg-[#151515] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Timeline</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" title="Seleccionar" className="rounded-xl border border-white/10 p-2 text-slate-200"><ToolbarIcon name="select" /></button>
          <button type="button" title="Cortar [S]" className="rounded-xl border border-white/10 p-2 text-slate-200 disabled:opacity-40" onClick={onSplit} disabled={!hasSelectedClip}><ToolbarIcon name="cut" /></button>
          <button type="button" title="Copiar" className="rounded-xl border border-white/10 p-2 text-slate-200 disabled:opacity-40" onClick={onCopy} disabled={!hasSelectedClip}><ToolbarIcon name="copy" /></button>
          <button type="button" title="Pegar" className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={onPaste}><ToolbarIcon name="paste" /></button>
          <button type="button" title="Duplicar" className="rounded-xl border border-white/10 p-2 text-slate-200 disabled:opacity-40" onClick={onDuplicate} disabled={!hasSelectedClip}><ToolbarIcon name="duplicate" /></button>
          <button type="button" title="Retroceder 1s" className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={onJumpBack}><ToolbarIcon name="rewind" /></button>
          <button type="button" title="Avanzar 1s" className="rounded-xl border border-white/10 p-2 text-slate-200" onClick={onJumpForward}><ToolbarIcon name="forward" /></button>
          <span title="Snap activo" className="inline-flex rounded-xl border border-white/10 bg-slate-950/35 p-2 text-slate-300"><ToolbarIcon name="snap" /></span>
        </div>
      </div>
    </section>
  );
}
