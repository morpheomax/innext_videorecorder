import type { StudioFormat } from '../../core/compositor/stream-compositor';

type ExportFormat = 'webm' | 'mp4';

interface EditorTopBarProps {
  onBackToStudio: () => void;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  projectFormat: StudioFormat;
  exportFormat: ExportFormat;
  exporting: boolean;
  savingProject: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onSetExportFormat: (format: ExportFormat) => void;
  onExport: () => void;
  sidebarExpanded: boolean;
  inspectorOpen: boolean;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
}

export function EditorTopBar({
  onBackToStudio,
  projectName,
  onProjectNameChange,
  projectFormat,
  exportFormat,
  exporting,
  savingProject,
  onUndo,
  onRedo,
  onSaveProject,
  onSetExportFormat,
  onExport,
  sidebarExpanded,
  inspectorOpen,
  onToggleSidebar,
  onToggleInspector,
}: EditorTopBarProps) {
  return (
    <header className="border-b border-white/8 bg-[#111318] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200" onClick={onBackToStudio}>
            Volver
          </button>
          <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300" onClick={onToggleSidebar}>
            {sidebarExpanded ? 'Panel' : 'Iconos'}
          </button>
          <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300" onClick={onToggleInspector}>
            {inspectorOpen ? 'Inspector' : 'Propiedades'}
          </button>
          <div className="ml-2">
            <p className="text-[10px] uppercase tracking-[0.28em] text-sky-300">Proyecto</p>
            <input
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              className="mt-1 w-[220px] max-w-full bg-transparent text-base font-semibold text-white outline-none md:w-[280px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">{projectFormat} · {exportFormat.toUpperCase()}</span>
          <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200" onClick={onUndo}>Deshacer</button>
          <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200" onClick={onRedo}>Rehacer</button>
          <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 disabled:opacity-50" onClick={onSaveProject} disabled={savingProject}>{savingProject ? 'Guardando...' : 'Guardar'}</button>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/35 px-2 py-2 text-sm text-slate-200">
            <button type="button" className={[ 'rounded-lg px-3 py-1.5 transition', exportFormat === 'webm' ? 'bg-sky-400/20 text-sky-100' : 'bg-white/5 text-slate-300' ].join(' ')} onClick={() => onSetExportFormat('webm')} disabled={exporting}>WebM</button>
            <button type="button" className={[ 'rounded-lg px-3 py-1.5 transition', exportFormat === 'mp4' ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/5 text-slate-300' ].join(' ')} onClick={() => onSetExportFormat('mp4')} disabled={exporting}>MP4</button>
          </div>
          <button type="button" className="btn-primary" onClick={onExport} disabled={exporting}>{exporting ? 'Exportando...' : 'Exportar'}</button>
        </div>
      </div>
    </header>
  );
}
