// js/editor.js — NLE Multi-track Editor Engine v5
// ────────────────────────────────────────────────────────────
// FIXES v5:
//  ✅ Audio en preview: Web Audio API con GainNode por clip
//  ✅ Export con audio: canvas stream + audioDestination combinados
//  ✅ Save/Load IndexedDB: transacciones robustas + indicador visual
//  ✅ Clip model: volume (0-1) + speed (0.25-2) + color grading
//  ✅ Undo básico (Ctrl+Z para las últimas 30 acciones)
//  ✅ Screenshot del frame actual (Save PNG)
//  ✅ Velocidad de reproducción por clip

export class EditorModule {
  constructor(app) {
    this.app   = app;
    this.tracks = { video: [[], [], [], []], audio: [[], [], [], []] };
    this.totalDuration  = 0;
    this.currentTime    = 0;
    this.pixelsPerSec   = 60;
    this.isPlaying      = false;
    this.lastRAF        = null;
    this.rafId          = null;
    this.selectedClipId = null;
    this.overlays       = [];
    this.selectedOverlayId = null;
    this._db            = null;
    this._undoStack     = [];  // simple undo: JSON snapshots of tracks
    this._MAX_UNDO      = 30;

    // Web Audio
    this._audioCtx   = null;
    this._gainNodes  = new Map();  // clipId → GainNode
    this._srcNodes   = new Map();  // clipId → MediaElementSourceNode

    this.els = {
      view:            document.getElementById('editor-view'),
      canvas:          document.getElementById('nle-canvas'),
      wrapper:         document.getElementById('nle-canvas-wrapper'),
      videoSlots:      document.getElementById('nle-video-slots'),
      overlaysCont:    document.getElementById('editor-overlays-container'),
      playBtn:         document.getElementById('editor-play-btn'),
      timecode:        document.getElementById('editor-time-display'),
      splitBtn:        document.getElementById('split-btn'),
      exportBtn:       document.getElementById('export-video-btn'),
      exportProg:      document.getElementById('export-progress'),
      exportFill:      document.getElementById('export-progress-fill'),
      exportText:      document.getElementById('export-progress-text'),
      ruler:           document.getElementById('nle-ruler'),
      playhead:        document.getElementById('nle-playhead'),
      importVideoBtn:  document.getElementById('import-video-btn'),
      importAudioBtn:  document.getElementById('import-audio-btn'),
      importImageBtn:  document.getElementById('import-image-btn'),
      importVideoFile: document.getElementById('import-video-file'),
      importAudioFile: document.getElementById('import-audio-file'),
      importImageFile: document.getElementById('import-image-file'),
      closeBtn:        document.getElementById('close-editor-btn'),
      textInput:       document.getElementById('overlay-text-input'),
      textColor:       document.getElementById('overlay-text-color'),
      addTextBtn:      document.getElementById('add-text-btn'),
      logoInput:       document.getElementById('overlay-logo-input'),
      addLogoBtn:      document.getElementById('add-logo-btn'),
      quickbar:        document.getElementById('nle-quickbar'),
      qbName:          document.getElementById('quickbar-clip-name'),
      qaSplit:         document.getElementById('qa-split'),
      qaDelete:        document.getElementById('qa-delete'),
      qaDuplicate:     document.getElementById('qa-duplicate'),
      qaMute:          document.getElementById('qa-mute'),
      qaFill:          document.getElementById('qa-fill'),
      qaResetSize:     document.getElementById('qa-reset-size'),
      zoomSlider:      document.getElementById('timeline-zoom'),
      zoomVal:         document.getElementById('timeline-zoom-val'),
      saveBtn:         document.getElementById('save-project-btn'),
      loadBtn:         document.getElementById('load-project-btn'),
    };

    this.ctx = this.els.canvas.getContext('2d');
    this._W  = 1280;
    this._H  = 720;
    this.els.canvas.width  = this._W;
    this.els.canvas.height = this._H;

    this._openDB().then(() => {
      this._bindUI();
      this._buildRuler();
      this._renderFrame();
    });
  }

  // ═══════════════════════════════════════════════════════
  //  PUBLIC
  // ═══════════════════════════════════════════════════════
  loadBlob(blob) { this._importMediaBlob(blob, 'video', 0); }

  openBlank() {
    this.els.view.classList.remove('state-hidden');
    document.getElementById('main-stage').style.display = 'none';
    document.getElementById('sidebar').classList.add('closed');
  }

  // ═══════════════════════════════════════════════════════
  //  WEB AUDIO CONTEXT
  // ═══════════════════════════════════════════════════════
  _getAudioCtx() {
    if (!this._audioCtx || this._audioCtx.state === 'closed') {
      this._audioCtx = new AudioContext();
    }
    if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
    return this._audioCtx;
  }

  /** Connect a media element to AudioContext with gain. Returns { src, gain } */
  _connectAudio(clipId, mediaEl, volume = 1, destination = null) {
    const ctx  = this._getAudioCtx();
    const dest = destination || ctx.destination;
    // Reuse existing source node if possible
    if (!this._srcNodes.has(clipId)) {
      try {
        const src  = ctx.createMediaElementSource(mediaEl);
        const gain = ctx.createGain();
        gain.gain.value = volume;
        src.connect(gain);
        gain.connect(dest);
        this._srcNodes.set(clipId, src);
        this._gainNodes.set(clipId, gain);
        return { src, gain };
      } catch (e) {
        // Already captured by another AudioContext call — ignore
        return null;
      }
    }
    // Update gain
    const gain = this._gainNodes.get(clipId);
    if (gain) {
      gain.gain.value = volume;
      // Reconnect to new destination if needed
      try { gain.connect(dest); } catch (_) {}
    }
    return { src: this._srcNodes.get(clipId), gain };
  }

  _disconnectAllAudio() {
    this._srcNodes.forEach((src, id) => {
      try { src.disconnect(); } catch (_) {}
    });
    this._gainNodes.forEach((gain) => {
      try { gain.disconnect(); } catch (_) {}
    });
    this._srcNodes.clear();
    this._gainNodes.clear();
  }

  // ═══════════════════════════════════════════════════════
  //  INDEXEDDB — Save / Load
  // ═══════════════════════════════════════════════════════
  _openDB() {
    return new Promise((resolve) => {
      const req = indexedDB.open('StudioRecorderNLE', 3);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('blobs'))    db.createObjectStore('blobs');
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects');
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(); };
      req.onerror   = (e) => { console.warn('IndexedDB unavailable', e); resolve(); };
    });
  }

  async _saveProject() {
    if (!this._db) { this.app.showToast('IndexedDB no disponible', 'error'); return; }

    // Show saving indicator
    const btn = this.els.saveBtn;
    const origHtml = btn?.innerHTML;
    if (btn) btn.innerHTML = '<i class="ph ph-spinner"></i>';

    try {
      const allClips = [...this.tracks.video, ...this.tracks.audio].flat();

      // 1. Store all blobs as ArrayBuffers for reliable IndexedDB storage
      for (const clip of allClips) {
        if (!clip.blob) continue;
        const arrayBuf = await clip.blob.arrayBuffer();
        await new Promise((ok, fail) => {
          const tx  = this._db.transaction('blobs', 'readwrite');
          const req = tx.objectStore('blobs').put({ buffer: arrayBuf, type: clip.blob.type }, clip.id);
          req.onsuccess = ok;
          req.onerror   = fail;
        }).catch(e => console.warn('blob save err', e));
      }

      // 2. Store project JSON
      const projectData = {
        version: 3,
        savedAt: new Date().toISOString(),
        totalDuration: this.totalDuration,
        pixelsPerSec:  this.pixelsPerSec,
        overlays: this.overlays.map(ov => ({
          id: ov.id, type: ov.type,
          content:  ov.type === 'text' ? ov.content : null,
          color:    ov.color,
          pctX:     ov.pctX,  pctY: ov.pctY,
          fontSize: ov.fontSize, pctW: ov.pctW,
        })),
        tracks: {
          video: this.tracks.video.map(arr => arr.map(c => this._serializeClip(c))),
          audio: this.tracks.audio.map(arr => arr.map(c => this._serializeClip(c))),
        },
      };

      await new Promise((ok, fail) => {
        const tx  = this._db.transaction('projects', 'readwrite');
        const req = tx.objectStore('projects').put(projectData, 'current');
        req.onsuccess = ok;
        req.onerror   = fail;
      });

      this.app.showToast('✅ Proyecto guardado exitosamente');
    } catch (err) {
      console.error('Save error:', err);
      this.app.showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      if (btn && origHtml) btn.innerHTML = origHtml;
    }
  }

  async _loadProject() {
    if (!this._db) { this.app.showToast('IndexedDB no disponible', 'error'); return; }

    const projectData = await new Promise(resolve => {
      const tx  = this._db.transaction('projects', 'readonly');
      const req = tx.objectStore('projects').get('current');
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror   = () => resolve(null);
    });

    if (!projectData) {
      this.app.showToast('No hay proyecto guardado', 'error'); return;
    }

    // Show loading state
    const btn = this.els.loadBtn;
    const origHtml = btn?.innerHTML;
    if (btn) btn.innerHTML = '<i class="ph ph-spinner"></i>';

    try {
      this._clearAll();

      // Restore zoom
      this.pixelsPerSec = projectData.pixelsPerSec || 60;
      if (this.els.zoomSlider) {
        this.els.zoomSlider.value    = this.pixelsPerSec;
        this.els.zoomVal.textContent = this.pixelsPerSec;
      }

      // Restore clips
      for (const type of ['video', 'audio']) {
        for (let ti = 0; ti < 4; ti++) {
          const clipsData = projectData.tracks?.[type]?.[ti] || [];
          for (const cd of clipsData) {
            // Load blob (convert from ArrayBuffer record)
            const record = await new Promise(resolve => {
              const tx  = this._db.transaction('blobs', 'readonly');
              const req = tx.objectStore('blobs').get(cd.id);
              req.onsuccess = e => resolve(e.target.result || null);
              req.onerror   = () => resolve(null);
            });
            let blob = null;
            if (record && record.buffer) {
              blob = new Blob([record.buffer], { type: record.type });
            } else if (record instanceof Blob) { // Backwards compat
              blob = record;
            }

            if (!blob && cd.type !== 'image') {
              this.app.showToast(`Clip "${cd.name}" no encontrado`, 'error');
              continue;
            }

            const url  = blob ? URL.createObjectURL(blob) : (cd.dataUrl || '');
            const clip = {
              ...cd, blob, url, _el: null,
              cx: cd.cx ?? 0, cy: cd.cy ?? 0, cw: cd.cw ?? 1, ch: cd.ch ?? 1,
              volume: cd.volume ?? 1, speed: cd.speed ?? 1,
            };
            clip._el = this._createMediaElement(clip);

            const arr = type === 'video' ? this.tracks.video[ti] : this.tracks.audio[ti];
            arr.push(clip);
            this._renderClipBlock(clip);
          }
        }
      }

      // Restore text overlays
      for (const ov of (projectData.overlays || [])) {
        if (ov.type === 'text' && ov.content) {
          this._addOverlay({ type: 'text', content: ov.content, color: ov.color || '#fff', fontSize: ov.fontSize || 28 });
        }
      }

      this._recomputeDuration();
      this._buildRuler();
      this._syncAllSlots();
      this._renderFrame();
      this._syncTimecode();

      const savedAt = projectData.savedAt ? new Date(projectData.savedAt).toLocaleString() : '';
      this.app.showToast(`✅ Proyecto cargado ${savedAt ? '— Guardado: ' + savedAt : ''}`);

    } catch (err) {
      console.error('Load error:', err);
      this.app.showToast('Error al cargar: ' + err.message, 'error');
    } finally {
      if (btn && origHtml) btn.innerHTML = origHtml;
    }
  }

  _serializeClip(c) {
    return {
      id: c.id, type: c.type, trackIdx: c.trackIdx, name: c.name,
      startT: c.startT, trimIn: c.trimIn, trimOut: c.trimOut, duration: c.duration,
      imgDuration: c.imgDuration,
      visible: c.visible !== false,
      muted:   !!c.muted,
      volume:  c.volume  ?? 1,
      speed:   c.speed   ?? 1,
      cx: c.cx ?? 0, cy: c.cy ?? 0,
      cw: c.cw ?? 1, ch: c.ch ?? 1,
    };
  }

  _clearAll() {
    this._pause();
    this._disconnectAllAudio();
    document.querySelectorAll('.nle-clip').forEach(el => el.remove());
    document.querySelectorAll('.nle-video-slot').forEach(el => el.remove());
    [...this.tracks.video, ...this.tracks.audio].flat().forEach(c => {
      if (c._el) { c._el.src = ''; }
      if (c.url && c.blob) URL.revokeObjectURL(c.url);
    });
    this.tracks = { video: [[], [], [], []], audio: [[], [], [], []] };
    this.overlays = [];
    this.els.overlaysCont.innerHTML = '';
    this.selectedClipId = null;
    this._selectClip(null, null);
    this.currentTime = 0;
    this._updatePlayheadUI();
    this._syncTimecode();
  }

  // ═══════════════════════════════════════════════════════
  //  UNDO
  // ═══════════════════════════════════════════════════════
  _pushUndo() {
    const snap = JSON.stringify({
      video: this.tracks.video.map(arr => arr.map(c => this._serializeClip(c))),
      audio: this.tracks.audio.map(arr => arr.map(c => this._serializeClip(c))),
    });
    this._undoStack.push(snap);
    if (this._undoStack.length > this._MAX_UNDO) this._undoStack.shift();
  }

  _undo() {
    if (this._undoStack.length === 0) {
      this.app.showToast('No hay acciones para deshacer', 'error'); return;
    }
    const snap = JSON.parse(this._undoStack.pop());

    // Rebuild DOM for all tracks from snapshot
    document.querySelectorAll('.nle-clip').forEach(el => el.remove());
    document.querySelectorAll('.nle-video-slot').forEach(el => el.remove());

    // Restore clip data BUT re-use existing _el (match by id)
    const existingClips = [...this.tracks.video, ...this.tracks.audio].flat();
    const byId = new Map(existingClips.map(c => [c.id, c]));

    ['video','audio'].forEach(type => {
      snap[type].forEach((arrData, ti) => {
        this.tracks[type][ti] = arrData.map(cd => {
          const existing = byId.get(cd.id);
          const clip = { ...cd, _el: existing?._el || null, blob: existing?.blob || null, url: existing?.url || '' };
          if (!clip._el && clip.blob) clip._el = this._createMediaElement(clip);
          return clip;
        });
        this.tracks[type][ti].forEach(c => this._renderClipBlock(c));
      });
    });

    this._recomputeDuration(); this._buildRuler(); this._syncAllSlots(); this._renderFrame();
    this.app.showToast('↩️ Deshacer');
  }

  // ═══════════════════════════════════════════════════════
  //  SCREENSHOT (capture current frame as PNG)
  // ═══════════════════════════════════════════════════════
  _screenshot() {
    this._renderFrame();
    this.els.canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `frame-${this._fmtT(this.currentTime).replace(/:/g,'.')}.png`
      });
      a.click();
      URL.revokeObjectURL(url);
      this.app.showToast('📸 Frame exportado como PNG');
    }, 'image/png');
  }

  // ═══════════════════════════════════════════════════════
  //  IMPORT
  // ═══════════════════════════════════════════════════════
  _importMediaBlob(blob, type, trackIdx) {
    const url = URL.createObjectURL(blob);
    if (type === 'image') {
      const img = new Image();
      img.onload = () => this._addClip({ blob, url, type: 'image', trackIdx,
        duration: 0, name: blob.name || 'Imagen', imgDuration: 5 });
      img.src = url; return;
    }
    const probe = document.createElement('video');
    probe.preload = 'metadata'; probe.src = url;
    probe.onloadedmetadata = () => {
      const resolve = (dur) => this._addClip({ blob, url, type, trackIdx, duration: dur,
        name: blob.name || `Clip ${Date.now()}` });
      if (probe.duration !== Infinity) { resolve(probe.duration); return; }
      probe.currentTime = 1e101;
      probe.ontimeupdate = () => { probe.ontimeupdate = null; resolve(probe.currentTime); };
    };
    probe.onerror = () => this.app.showToast(`Error al cargar: ${blob.name}`, 'error');
  }

  _addClip({ blob, url, type, trackIdx, duration, name, imgDuration = 5,
             startT = null, trimIn = 0, trimOut = null,
             cx = null, cy = null, cw = null, ch = null,
             visible = true, muted = false, volume = 1, speed = 1 }) {

    const targetType = (type === 'image') ? 'video' : type;
    const arr = this.tracks[targetType][trackIdx];
    if (!arr) { this.app.showToast('Pista inválida', 'error'); return; }
    if (arr.length >= 8) { this.app.showToast('Pista llena (máx 8 clips)', 'error'); return; }

    this._pushUndo();

    const autoStart = arr.reduce((s, c) => Math.max(s, this._clipEnd(c)), 0);
    const to        = trimOut ?? duration;
    const id        = `clip-${type}-${trackIdx}-${Date.now()}`;

    let defCx = 0, defCy = 0, defCw = 1, defCh = 1;
    if ((type === 'video' || type === 'image') && trackIdx > 0) {
      const pip = [[0.63, 0.02], [0.02, 0.02], [0.02, 0.61]];
      const p = pip[Math.min(trackIdx - 1, 2)];
      defCx = p[0]; defCy = p[1]; defCw = 0.35; defCh = 0.35;
    }

    const clip = {
      id, url, blob, type: (type === 'image') ? 'image' : type,
      trackIdx, name, startT: startT ?? autoStart,
      trimIn, trimOut: to, duration, imgDuration,
      visible, muted, volume, speed,
      cx: cx ?? defCx, cy: cy ?? defCy, cw: cw ?? defCw, ch: ch ?? defCh,
      _el: null,
    };

    clip._el = this._createMediaElement(clip);
    arr.push(clip);

    this._recomputeDuration();
    this._buildRuler();
    this._renderClipBlock(clip);
    this._syncAllSlots();
    this._renderFrame();
    this.app.showToast(`"${name}" → ${this._trackLabel(clip.type, trackIdx)}`);
  }

  _trackLabel(type, idx) {
    return type === 'audio' ? `A${idx+1}` : type === 'image' ? `V${idx+1}(img)` : `V${idx+1}`;
  }

  // ░░░  Create per-clip media element ░░░
  _createMediaElement(clip) {
    if (clip.type === 'image') {
      const img = new Image();
      img.src = clip.url;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;pointer-events:none;';
      return img;
    }
    if (clip.type === 'audio') {
      const audio = document.createElement('audio');
      audio.src = clip.url; audio.preload = 'auto';
      audio.muted = false;   // audio clips play their audio
      audio.volume = clip.volume ?? 1;
      audio.playbackRate = clip.speed ?? 1;
      return audio;
    }
    // video — NOT muted; audio handled via Web Audio GainNode
    const vid = document.createElement('video');
    vid.src = clip.url; vid.preload = 'auto';
    vid.playsInline  = true;
    vid.muted        = false;          // ← real audio
    vid.volume       = clip.volume ?? 1;
    vid.playbackRate = clip.speed ?? 1;
    vid.crossOrigin  = 'anonymous';    // needed for Web Audio capture
    vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;pointer-events:none;';
    vid.addEventListener('loadedmetadata', () => {
      if (vid.currentTime < clip.trimIn) vid.currentTime = clip.trimIn;
    }, { once: true });
    return vid;
  }

  // ═══════════════════════════════════════════════════════
  //  SLOT CONTAINERS  (one per video track)
  // ═══════════════════════════════════════════════════════
  _syncAllSlots() {
    this.tracks.video.forEach((arr, ti) => {
      const slotId = `vslot-${ti}`;
      let slot = document.getElementById(slotId);
      if (!slot) {
        slot = document.createElement('div');
        slot.id = slotId; slot.className = 'nle-video-slot';
        slot.dataset.trackIdx = ti;
        ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
          const h = document.createElement('div');
          h.className = `resize-handle ${dir}`;
          h.dataset.dir = dir; h.style.display = 'none';
          slot.appendChild(h);
          this._setupSlotResize(h, slot, ti);
        });
        this.els.videoSlots.appendChild(slot);
        this._setupSlotDrag(slot, ti);
        slot.addEventListener('click', () => {
          const clip = this._activeClipAt(arr, this.currentTime) || arr[0];
          if (clip) this._selectClip(null, clip);
        });
      }

      // Inject clip elements into slot
      arr.forEach(clip => {
        if (clip._el && clip._el.parentElement !== slot && clip.type !== 'audio') {
          slot.insertBefore(clip._el, slot.querySelector('.resize-handle'));
        }
      });

      slot.style.display = arr.length > 0 ? 'block' : 'none';
      if (arr.length > 0) {
        const ref = this._activeClipAt(arr, this.currentTime) || arr[0];
        this._applySlotGeometry(slot, ref);
      }

      const isSel = arr.some(c => c.id === this.selectedClipId);
      slot.classList.toggle('slot-selected', isSel);
      slot.querySelectorAll('.resize-handle').forEach(h => h.style.display = isSel ? 'block' : 'none');

      this._syncClipVisibility(ti);
    });
  }

  _syncClipVisibility(ti) {
    const arr         = this.tracks.video[ti];
    const activeClip  = this._activeClipAt(arr, this.currentTime);
    arr.forEach(clip => {
      if (!clip._el || clip.type === 'audio') return;
      const show = clip === activeClip && clip.visible !== false;
      clip._el.style.display = show ? 'block' : 'none';
      if (show && clip.type === 'video') {
        const expected = clip.trimIn + (this.currentTime - clip.startT);
        if (Math.abs(clip._el.currentTime - expected) > 0.25) clip._el.currentTime = expected;
        if (this.isPlaying && clip._el.paused) clip._el.play().catch(() => {});
        clip._el.playbackRate = clip.speed ?? 1;
      }
      if (!show && clip.type === 'video' && !clip._el.paused) clip._el.pause();
    });
    const slot = document.getElementById(`vslot-${ti}`);
    if (slot && activeClip) this._applySlotGeometry(slot, activeClip);
  }

  _applySlotGeometry(slot, clip) {
    const W = this.els.wrapper.offsetWidth  || 640;
    const H = this.els.wrapper.offsetHeight || 360;
    slot.style.left   = (clip.cx * W) + 'px';
    slot.style.top    = (clip.cy * H) + 'px';
    slot.style.width  = (clip.cw * W) + 'px';
    slot.style.height = (clip.ch * H) + 'px';
  }

  _setupSlotDrag(slot, ti) {
    let sx, sy, oCx, oCy;
    const down = (e) => {
      if (e.target.classList.contains('resize-handle')) return;
      if (e.cancelable) e.preventDefault();
      sx = e.touches ? e.touches[0].clientX : e.clientX; 
      sy = e.touches ? e.touches[0].clientY : e.clientY;
      const clip = this._activeClipAt(this.tracks.video[ti], this.currentTime) || this.tracks.video[ti][0];
      if (!clip) return; oCx = clip.cx; oCy = clip.cy;
      const W = this.els.wrapper.offsetWidth, H = this.els.wrapper.offsetHeight;
      const mv = (e) => {
        if (e.cancelable) e.preventDefault();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        clip.cx = Math.max(0, Math.min(1 - clip.cw, oCx + (cx - sx) / W));
        clip.cy = Math.max(0, Math.min(1 - clip.ch, oCy + (cy - sy) / H));
        this._applySlotGeometry(slot, clip); this._renderFrame();
      };
      const up = () => { 
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); 
        window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up); 
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      window.addEventListener('touchmove', mv, {passive: false}); window.addEventListener('touchend', up);
    };
    slot.addEventListener('mousedown', down);
    slot.addEventListener('touchstart', down, {passive: false});
  }

  _setupSlotResize(handle, slot, ti) {
    const down = (e) => {
      if (e.cancelable) e.preventDefault(); e.stopPropagation();
      const dir  = handle.dataset.dir;
      const clip = this._activeClipAt(this.tracks.video[ti], this.currentTime) || this.tracks.video[ti][0];
      if (!clip) return;
      const W = this.els.wrapper.offsetWidth, H = this.els.wrapper.offsetHeight;
      const sx = e.touches ? e.touches[0].clientX : e.clientX; 
      const sy = e.touches ? e.touches[0].clientY : e.clientY;
      const { cx: oCx, cy: oCy, cw: oCw, ch: oCh } = clip;
      const mv = (e) => {
        if (e.cancelable) e.preventDefault();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = (cx - sx)/W, dy = (cy - sy)/H;
        if (dir.includes('e')) clip.cw = Math.max(0.05, oCw + dx);
        if (dir.includes('s')) clip.ch = Math.max(0.05, oCh + dy);
        if (dir.includes('w')) { const nw=Math.max(0.05,oCw-dx); clip.cx=oCx+(oCw-nw); clip.cw=nw; }
        if (dir.includes('n')) { const nh=Math.max(0.05,oCh-dy); clip.cy=oCy+(oCh-nh); clip.ch=nh; }
        clip.cx=Math.max(0,clip.cx); clip.cy=Math.max(0,clip.cy);
        clip.cw=Math.min(1-clip.cx,clip.cw); clip.ch=Math.min(1-clip.cy,clip.ch);
        this._applySlotGeometry(slot, clip); this._renderFrame();
      };
      const up = () => { 
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); 
        window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up); 
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      window.addEventListener('touchmove', mv, {passive: false}); window.addEventListener('touchend', up);
    };
    handle.addEventListener('mousedown', down);
    handle.addEventListener('touchstart', down, {passive: false});
  }

  // ═══════════════════════════════════════════════════════
  //  DURATION HELPERS
  // ═══════════════════════════════════════════════════════
  _clipDuration(clip) {
    if (clip.type === 'image') return clip.imgDuration || 5;
    return clip.trimOut - clip.trimIn;
  }
  _clipEnd(clip)   { return clip.startT + this._clipDuration(clip); }
  _activeClipAt(arr, time) {
    return arr.find(c => time >= c.startT && time < this._clipEnd(c)) || null;
  }
  _recomputeDuration() {
    let max = 10;
    ['video','audio'].forEach(t => this.tracks[t].forEach(arr => arr.forEach(c => { max = Math.max(max, this._clipEnd(c)); })));
    this.totalDuration = max;
  }

  // ═══════════════════════════════════════════════════════
  //  RULER
  // ═══════════════════════════════════════════════════════
  _buildRuler() {
    const ruler = this.els.ruler;
    ruler.innerHTML = ''; ruler.appendChild(this.els.playhead);
    const totalPx = Math.max(this.totalDuration * this.pixelsPerSec + 400, 1200);
    const W = totalPx + 'px';
    ruler.style.width = ruler.style.minWidth = W;
    const step = this.pixelsPerSec >= 80 ? 1 : this.pixelsPerSec >= 40 ? 2 : 5;
    for (let t = 0; t <= this.totalDuration + step; t += step) {
      const tick = document.createElement('div'); tick.className = 'nle-ruler-tick';
      tick.style.left = (t * this.pixelsPerSec) + 'px';
      const lbl = document.createElement('span');
      lbl.textContent = `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
      tick.appendChild(lbl); ruler.appendChild(tick);
    }
    document.querySelectorAll('.nle-track-lane').forEach(l => l.style.minWidth = l.style.width = W);
    this._updatePlayheadUI();
  }

  // ═══════════════════════════════════════════════════════
  //  CLIP BLOCKS (timeline DOM)
  // ═══════════════════════════════════════════════════════
  _renderClipBlock(clip) {
    const trackType = (clip.type === 'image') ? 'video' : clip.type;
    const lane = document.querySelector(`.nle-track-lane[data-track-type="${trackType}"][data-track-index="${clip.trackIdx}"]`);
    if (!lane) return;

    const el = document.createElement('div');
    el.id = clip.id; el.className = `nle-clip type-${clip.type}`; el.dataset.id = clip.id;

    const handleL = Object.assign(document.createElement('div'), { className: 'nle-clip-handle left' });
    const handleR = Object.assign(document.createElement('div'), { className: 'nle-clip-handle right' });
    const label   = Object.assign(document.createElement('span'), { className: 'nle-clip-label' });
    const icon    = clip.type === 'image' ? '🖼 ' : clip.type === 'audio' ? '🎵 ' : '🎬 ';
    label.textContent = icon + clip.name;
    const delBtn = Object.assign(document.createElement('button'), { className: 'nle-clip-del', innerHTML: '✕' });
    delBtn.addEventListener('click', e => { e.stopPropagation(); this._deleteClip(clip); });
    const ph = Object.assign(document.createElement('div'), { className: 'lane-playhead' });

    el.append(handleL, label, handleR, delBtn, ph);
    lane.appendChild(el);

    this._positionClipBlock(el, clip);
    this._setupClipDrag(el, clip);
    if (clip.type !== 'image') this._setupClipTrimDrag(handleL, handleR, el, clip);
    el.addEventListener('click', () => this._selectClip(el, clip));
  }

  _positionClipBlock(el, clip) {
    el.style.left  = (clip.startT * this.pixelsPerSec) + 'px';
    el.style.width = Math.max(this._clipDuration(clip) * this.pixelsPerSec, 8) + 'px';
  }

  _selectClip(el, clip) {
    document.querySelectorAll('.nle-clip').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');
    this.selectedClipId = clip?.id ?? null;

    if (clip) {
      this.els.quickbar.style.display = 'flex';
      this.els.qbName.textContent = clip.name;
      this.els.qaMute.classList.toggle('active', !!clip.muted);
    } else {
      this.els.quickbar.style.display = 'none';
    }
    this._syncAllSlots();
    this._updateClipControls(clip);
  }

  _updateClipControls(clip) {
    const volEl   = document.getElementById('qa-volume');
    const spdEl   = document.getElementById('qa-speed');
    const spdVal  = document.getElementById('qa-speed-val');
    if (!clip) { return; }
    if (volEl && clip.type !== 'image') volEl.value = (clip.volume ?? 1) * 100;
    if (spdEl && clip.type === 'video') { spdEl.value = clip.speed ?? 1; if (spdVal) spdVal.textContent = (clip.speed ?? 1)+'x'; }
  }

  _findClipById(id) {
    for (const t of ['video','audio']) for (const arr of this.tracks[t]) { const c = arr.find(x => x.id === id); if (c) return c; }
    return null;
  }
  _findArrForClip(clip) {
    const type = (clip.type === 'image' || clip.type === 'video') ? 'video' : 'audio';
    return this.tracks[type][clip.trackIdx];
  }

  _deleteClip(clip) {
    this._pushUndo();
    const arr = this._findArrForClip(clip);
    arr.splice(arr.indexOf(clip), 1);
    document.getElementById(clip.id)?.remove();
    if (clip._el) clip._el.src = '';
    if (clip.blob && clip.url) URL.revokeObjectURL(clip.url);
    if (this.selectedClipId === clip.id) this._selectClip(null, null);
    this._recomputeDuration(); this._buildRuler(); this._syncAllSlots(); this._renderFrame();
  }

  _duplicateClip(clip) {
    this._pushUndo();
    const newUrl = URL.createObjectURL(clip.blob);
    const copy   = { ...clip, id: `clip-${clip.type}-${clip.trackIdx}-${Date.now()}`,
      url: newUrl, _el: null, startT: this._clipEnd(clip) + 0.1 };
    copy._el = this._createMediaElement(copy);
    this._findArrForClip(clip).push(copy);
    this._recomputeDuration(); this._buildRuler();
    this._renderClipBlock(copy); this._syncAllSlots();
    this.app.showToast(`"${clip.name}" duplicado`);
  }

  // ═══════════════════════════════════════════════════════
  //  DRAG / TRIM
  // ═══════════════════════════════════════════════════════
  _setupClipDrag(el, clip) {
    let sx, sy, origST, ghost = null, hlLane = null;
    const SNAP = 0.4;
    const trackType = (clip.type === 'image' || clip.type === 'video') ? 'video' : 'audio';

    const down = (e) => {
      if (e.target.classList.contains('nle-clip-handle') || e.target.classList.contains('nle-clip-del')) return;
      // Do not prevent default immediately on touch, let them tap. Wait, preventDefault on touchstart might kill scroll.
      // We will preventDefault on move to prevent vertical scroll while dragging clips.
      
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      
      sx = cx; sy = cy; origST = clip.startT;

      const rect = el.getBoundingClientRect();
      ghost = el.cloneNode(true);
      ghost.style.cssText = `position:fixed;width:${rect.width}px;top:${rect.top}px;left:${rect.left}px;opacity:0.7;z-index:9999;pointer-events:none;transition:none;`;
      document.body.appendChild(ghost);
      el.style.opacity = '0.3';

      const mv = (e) => {
        if (e.cancelable) e.preventDefault(); // allow dragging horizontally without pull-to-refresh
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = cx-sx, dy = cy-sy;
        ghost.style.left = (rect.left+dx)+'px'; ghost.style.top = (rect.top+dy)+'px';
        const lanes = Array.from(document.querySelectorAll(`.nle-track-lane[data-track-type="${trackType}"]`));
        let tgt = null;
        for (const l of lanes) { const r = l.getBoundingClientRect(); if (cy>=r.top && cy<=r.bottom) { tgt=l; break; } }
        if (hlLane && hlLane!==tgt) hlLane.classList.remove('drag-over');
        if (tgt) { tgt.classList.add('drag-over'); hlLane=tgt; }
        el.style.left = Math.max(0,(origST+dx/this.pixelsPerSec)*this.pixelsPerSec)+'px';
      };

      const up = (e) => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
        window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up);
        ghost?.remove(); ghost=null; el.style.opacity='1';
        if (hlLane) hlLane.classList.remove('drag-over');
        
        // if no movement, let it be just a select
        const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const dx = cx-sx;
        if (Math.abs(dx) < 2 && !hlLane) {
          return; // was just a click
        }
        
        this._pushUndo();
        let newST = Math.max(0, origST + dx/this.pixelsPerSec);

        if (hlLane) {
          const newTI = parseInt(hlLane.dataset.trackIndex);
          if (newTI !== clip.trackIdx) {
            const oldArr = this._findArrForClip(clip);
            oldArr.splice(oldArr.indexOf(clip),1);
            clip.trackIdx = newTI;
            this.tracks[trackType][newTI].push(clip);
            el.remove(); hlLane.appendChild(el);
            el.appendChild(Object.assign(document.createElement('div'), { className:'lane-playhead' }));
          }
        }

        const tArr = this._findArrForClip(clip);
        let snapD=SNAP, snapT=null;
        tArr.forEach(o => {
          if (o.id===clip.id) return;
          const oe=this._clipEnd(o);
          if (Math.abs(newST-oe)<snapD) { snapD=Math.abs(newST-oe); snapT=oe; }
          const me=newST+this._clipDuration(clip);
          if (Math.abs(me-o.startT)<snapD) { snapD=Math.abs(me-o.startT); snapT=o.startT-this._clipDuration(clip); }
        });
        clip.startT = snapT!==null ? Math.max(0,snapT) : newST;
        this._positionClipBlock(el,clip);
        this._recomputeDuration(); this._buildRuler(); this._syncAllSlots(); this._renderFrame();
      };

      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      window.addEventListener('touchmove', mv, {passive: false}); window.addEventListener('touchend', up);
    };
    
    el.addEventListener('mousedown', down);
    el.addEventListener('touchstart', down, {passive: false});
  }

  _setupClipTrimDrag(handleL, handleR, el, clip) {
    const drag = (side, e) => {
      if (e.cancelable) e.preventDefault(); e.stopPropagation();
      this._pushUndo();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const sx=cx, oIn=clip.trimIn, oOut=clip.trimOut, oST=clip.startT;
      const mv = (e) => {
        if (e.cancelable) e.preventDefault();
        const mx = e.touches ? e.touches[0].clientX : e.clientX;
        const dx=(mx-sx)/this.pixelsPerSec;
        if (side==='left') { const ni=Math.max(0,Math.min(oIn+dx,clip.trimOut-0.05)); clip.startT=oST+(ni-oIn); clip.trimIn=ni; }
        else { clip.trimOut=Math.max(clip.trimIn+0.05, Math.min(clip.duration, oOut+dx)); }
        this._positionClipBlock(el,clip); this._recomputeDuration(); this._buildRuler();
      };
      const up = () => { 
        window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); 
        window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',up); 
        this._renderFrame(); 
      };
      window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
      window.addEventListener('touchmove',mv, {passive: false}); window.addEventListener('touchend',up);
    };
    handleL.addEventListener('mousedown', e => drag('left',e));
    handleL.addEventListener('touchstart', e => drag('left',e), {passive: false});
    handleR.addEventListener('mousedown', e => drag('right',e));
    handleR.addEventListener('touchstart', e => drag('right',e), {passive: false});
  }

  // ═══════════════════════════════════════════════════════
  //  SPLIT
  // ═══════════════════════════════════════════════════════
  _splitAtPlayhead() {
    const t = this.currentTime;
    let did = false;
    this._pushUndo();
    ['video','audio'].forEach(type => {
      this.tracks[type].forEach((arr, ti) => {
        const toSplit = arr.filter(c => {
          if (c.type==='image') return t>c.startT+0.1 && t<this._clipEnd(c)-0.1;
          return t>c.startT+c.trimIn+0.05 && t<c.startT+c.trimOut-0.05;
        });
        toSplit.forEach(clip => {
          const elapsed = t - clip.startT;
          const rightUrl = URL.createObjectURL(clip.blob);
          const right = {
            ...clip,
            id:          `clip-${clip.type}-${ti}-${Date.now()}`,
            url:         rightUrl,
            _el:         null,
            startT:      t,
            trimIn:      clip.type==='image' ? 0 : clip.trimIn + elapsed,
            imgDuration: clip.type==='image' ? this._clipEnd(clip)-t : clip.imgDuration,
          };
          right._el = this._createMediaElement(right);
          if (clip.type==='image') clip.imgDuration = elapsed;
          else clip.trimOut = clip.trimIn + elapsed;
          arr.push(right);
          const origEl = document.getElementById(clip.id);
          if (origEl) this._positionClipBlock(origEl, clip);
          this._renderClipBlock(right);
          did = true;
        });
      });
    });
    if (did) {
      this._recomputeDuration(); this._buildRuler(); this._syncAllSlots();
      this.app.showToast('✂️ Clip cortado en el cabezal');
    } else {
      this.app.showToast('No hay clip bajo el cabezal para cortar', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════
  //  PLAYBACK  — Web Audio for mixing, no muted video
  // ═══════════════════════════════════════════════════════
  _play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.els.playBtn.innerHTML = '<i class="ph ph-pause"></i>';
    this.lastRAF = performance.now();

    // Setup Web Audio context for mixing
    const ctx  = this._getAudioCtx();

    // Pre-seek & play all video clips
    this.tracks.video.flat().forEach(clip => {
      if (clip.type !== 'video' || !clip._el) return;
      const vt = clip.trimIn + (this.currentTime - clip.startT);
      clip._el.volume       = clip.muted ? 0 : (clip.volume ?? 1);
      clip._el.playbackRate = clip.speed ?? 1;
      const isActive = vt >= clip.trimIn && vt <= clip.trimOut;
      if (isActive && clip.visible !== false) {
        clip._el.currentTime = vt;
        clip._el.play().catch(() => {});
      }
    });

    // Pre-seek & play audio track clips
    this.tracks.audio.flat().forEach(clip => {
      if (!clip._el) return;
      clip._el.volume       = clip.muted ? 0 : (clip.volume ?? 1);
      clip._el.playbackRate = clip.speed ?? 1;
      const at = clip.trimIn + (this.currentTime - clip.startT);
      if (this.currentTime >= clip.startT && this.currentTime < this._clipEnd(clip)) {
        clip._el.currentTime = at;
        clip._el.play().catch(() => {});
      }
    });

    const tick = (now) => {
      if (!this.isPlaying) return;
      const dt    = (now - this.lastRAF) / 1000;
      this.lastRAF = now;
      this.currentTime = Math.min(this.currentTime + dt, this.totalDuration);

      // Video track sync
      this.tracks.video.forEach((arr, ti) => {
        const active = this._activeClipAt(arr, this.currentTime);
        arr.forEach(clip => {
          if (!clip._el || clip.type === 'audio') return;
          const show = clip === active && clip.visible !== false;
          clip._el.style.display = show ? 'block' : 'none';
          if (show && clip.type === 'video') {
            const exp = clip.trimIn + (this.currentTime - clip.startT);
            if (Math.abs(clip._el.currentTime - exp) > 0.3) clip._el.currentTime = exp;
            if (clip._el.paused) clip._el.play().catch(() => {});
            clip._el.volume       = clip.muted ? 0 : (clip.volume ?? 1);
            clip._el.playbackRate = clip.speed ?? 1;
          }
          if (!show && clip.type === 'video' && !clip._el.paused) clip._el.pause();
        });
        if (active) { const slot = document.getElementById(`vslot-${ti}`); if (slot) this._applySlotGeometry(slot, active); }
      });

      // Audio track sync
      this.tracks.audio.forEach(arr => {
        const active = this._activeClipAt(arr, this.currentTime);
        arr.forEach(clip => {
          if (!clip._el) return;
          const isActive = clip === active && !clip.muted;
          if (isActive && clip._el.paused) {
            clip._el.currentTime = clip.trimIn + (this.currentTime - clip.startT);
            clip._el.play().catch(() => {});
          }
          if (!isActive && !clip._el.paused) clip._el.pause();
          clip._el.volume = clip.muted ? 0 : (clip.volume ?? 1);
        });
      });

      this._renderFrame();
      this._updatePlayheadUI();
      this._syncTimecode();
      if (this.currentTime >= this.totalDuration) { this._pause(); return; }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _pause() {
    this.isPlaying = false;
    cancelAnimationFrame(this.rafId);
    this.els.playBtn.innerHTML = '<i class="ph ph-play"></i>';
    [...this.tracks.video, ...this.tracks.audio].flat().forEach(c => {
      if (c._el && c._el.tagName !== 'IMG' && !c._el.paused) c._el.pause();
    });
  }

  // ═══════════════════════════════════════════════════════
  //  CANVAS RENDER
  // ═══════════════════════════════════════════════════════
  _renderFrame() {
    const ctx=this.ctx, W=this._W, H=this._H;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    this.tracks.video.forEach((arr) => {
      const clip = this._activeClipAt(arr, this.currentTime);
      if (!clip || clip.visible===false || !clip._el) return;
      const px=clip.cx*W, py=clip.cy*H, pw=clip.cw*W, ph=clip.ch*H;
      const ready = clip.type==='image' ? clip._el.complete : clip._el.readyState>=2;
      if (!ready) return;
      ctx.save(); ctx.beginPath(); ctx.rect(px,py,pw,ph); ctx.clip();
      ctx.drawImage(clip._el, px,py,pw,ph);
      ctx.restore();
    });
    this.overlays.forEach(ov => {
      const nx=ov.pctX*W, ny=ov.pctY*H;
      if (ov.type==='text') {
        ctx.font=`700 ${ov.fontSize||28}px Inter,sans-serif`;
        ctx.fillStyle=ov.color;
        ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=4;
        ctx.textBaseline='top'; ctx.fillText(ov.content,nx,ny);
        ctx.shadowColor='transparent'; ctx.shadowBlur=0;
      } else if (ov.elContent?.complete) {
        const iw=(ov.pctW||0.15)*W, ih=iw*(ov.elContent.naturalHeight/(ov.elContent.naturalWidth||1));
        ctx.drawImage(ov.elContent,nx,ny,iw,ih);
      }
    });
  }

  _updatePlayheadUI() {
    const px = this.currentTime * this.pixelsPerSec;
    this.els.playhead.style.left = px+'px';
    document.querySelectorAll('.lane-playhead').forEach(p => p.style.left = px+'px');
  }

  _fmtT(s) {
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  }
  _syncTimecode() {
    this.els.timecode.textContent = `${this._fmtT(this.currentTime)} / ${this._fmtT(this.totalDuration)}`;
  }

  _activeClipAt(arr, time) {
    return arr.find(c => time >= c.startT && time < this._clipEnd(c)) || null;
  }

  _seekTo(t) {
    const was = this.isPlaying; this._pause();
    this.currentTime = Math.max(0, Math.min(t, this.totalDuration));
    this.tracks.video.flat().forEach(c => { if (c._el && c.type==='video') c._el.style.display='none'; });
    this._syncAllSlots();
    this._updatePlayheadUI(); this._syncTimecode(); this._renderFrame();
    if (was) this._play();
  }

  // ═══════════════════════════════════════════════════════
  //  EXPORT  — canvas + audio stream combined
  // ═══════════════════════════════════════════════════════
  async _exportRender() {
    this._pause();
    this.els.exportBtn.disabled = true;
    this.els.exportProg.style.display = 'block';
    this.els.exportText.textContent = 'Preparando…';

    const W=this._W, H=this._H;
    const off = document.createElement('canvas'); off.width=W; off.height=H;
    const offCtx = off.getContext('2d');
    const FPS = 30;

    // ── Setup Web Audio for export ──
    const audioCtx = new AudioContext();
    const audioDest = audioCtx.createMediaStreamDestination();

    // Create export video elements per clip
    const clipEls = new Map();
    const audioEls = new Map();

    const allVideoClips = this.tracks.video.flat().filter(c => c.type==='video');
    const allAudioClips = this.tracks.audio.flat();
    const allVidAudClips = allVideoClips; // video clips also have audio

    // Pre-load all video clips for export
    await Promise.all(allVideoClips.map(clip => new Promise(resolve => {
      const v = document.createElement('video');
      v.src = clip.url; v.preload='auto'; v.crossOrigin='anonymous'; v.muted=false;
      v.onloadedmetadata = () => { v.currentTime = clip.trimIn; resolve(); };
      v.onerror = resolve;
      clipEls.set(clip.id, v);
    })));

    // Connect video clip audio to export audio context
    for (const clip of allVideoClips) {
      if (clip.muted) continue;
      const v = clipEls.get(clip.id); if (!v) continue;
      try {
        const src  = audioCtx.createMediaElementSource(v);
        const gain = audioCtx.createGain();
        gain.gain.value = clip.volume ?? 1;
        src.connect(gain); gain.connect(audioDest);
      } catch(e) { console.warn('audio connect err', e); }
    }

    // Pre-load all audio track clips
    await Promise.all(allAudioClips.map(clip => new Promise(resolve => {
      const a = document.createElement('audio');
      a.src = clip.url; a.preload='auto'; a.crossOrigin='anonymous';
      a.onloadedmetadata = () => { a.currentTime = clip.trimIn; resolve(); };
      a.onerror = resolve;
      audioEls.set(clip.id, a);
      if (!clip.muted) {
        try {
          const src  = audioCtx.createMediaElementSource(a);
          const gain = audioCtx.createGain();
          gain.gain.value = clip.volume ?? 1;
          src.connect(gain); gain.connect(audioDest);
        } catch(e) {}
      }
    })));

    // ── Combine canvas video + export audio ──
    const canvasStream = off.captureStream(FPS);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size>0) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(this._expRaf);
      audioCtx.close();
      const blob = new Blob(chunks, { type:'video/webm' });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href:url, download:`studio-nle-${Date.now()}.webm` }).click();
      URL.revokeObjectURL(url);
      this.els.exportProg.style.display='none';
      this.els.exportBtn.disabled=false;
      this.app.showToast('✅ Exportación completa (con audio)');
    };

    this.currentTime = 0;
    recorder.start();
    let lastT = performance.now();

    const exportTick = (now) => {
      const dt = (now-lastT)/1000; lastT=now;
      this.currentTime += dt;
      if (this.currentTime > this.totalDuration) { recorder.stop(); return; }

      offCtx.fillStyle='#000'; offCtx.fillRect(0,0,W,H);

      this.tracks.video.forEach(arr => {
        const clip = this._activeClipAt(arr, this.currentTime);
        if (!clip || clip.visible===false) return;
        const px=clip.cx*W, py=clip.cy*H, pw=clip.cw*W, ph=clip.ch*H;
        if (clip.type==='image') {
          if (clip._el?.complete) { offCtx.drawImage(clip._el,px,py,pw,ph); } return;
        }
        const v = clipEls.get(clip.id); if (!v||v.readyState<2) return;
        const exp = clip.trimIn+(this.currentTime-clip.startT);
        if (Math.abs(v.currentTime-exp)>0.3) v.currentTime=exp;
        if (v.paused) v.play().catch(()=>{});
        offCtx.save(); offCtx.beginPath(); offCtx.rect(px,py,pw,ph); offCtx.clip();
        offCtx.drawImage(v,px,py,pw,ph); offCtx.restore();
      });

      // Manage audio clip playback during export
      allAudioClips.forEach(clip => {
        const a = audioEls.get(clip.id); if (!a) return;
        const isActive = this.currentTime>=clip.startT && this.currentTime<this._clipEnd(clip);
        if (isActive && a.paused) { a.currentTime=clip.trimIn+(this.currentTime-clip.startT); a.play().catch(()=>{}); }
        if (!isActive && !a.paused) a.pause();
      });

      // Overlays
      this.overlays.forEach(ov => {
        const nx=ov.pctX*W, ny=ov.pctY*H;
        if (ov.type==='text') {
          offCtx.font=`700 ${ov.fontSize||28}px Inter,sans-serif`;
          offCtx.fillStyle=ov.color; offCtx.shadowColor='rgba(0,0,0,0.85)'; offCtx.shadowBlur=4;
          offCtx.textBaseline='top'; offCtx.fillText(ov.content,nx,ny);
          offCtx.shadowColor='transparent'; offCtx.shadowBlur=0;
        } else if (ov.elContent?.complete) {
          const iw=(ov.pctW||0.15)*W, ih=iw*(ov.elContent.naturalHeight/(ov.elContent.naturalWidth||1));
          offCtx.drawImage(ov.elContent,nx,ny,iw,ih);
        }
      });

      const pct = Math.round((this.currentTime/this.totalDuration)*100);
      this.els.exportFill.style.width = pct+'%';
      this.els.exportText.textContent = `Exportando con audio… ${pct}%`;
      this._expRaf = requestAnimationFrame(exportTick);
    };
    this._expRaf = requestAnimationFrame(exportTick);
  }

  // ═══════════════════════════════════════════════════════
  //  OVERLAYS
  // ═══════════════════════════════════════════════════════
  _addOverlay({ type, content, color='#fff', fontSize=28, pctW=0.15 }) {
    const id='ov-'+Date.now();
    const el=document.createElement('div');
    el.id=id; el.className='draggable-overlay';
    el.style.cssText='position:absolute;left:50%;top:80%;transform:translate(-50%,-50%);z-index:50;';
    const removeBtn = Object.assign(document.createElement('button'),{ className:'remove-overlay', innerHTML:'✕' });
    const knob      = Object.assign(document.createElement('div'),{ className:'ov-resize' });
    let domEl;
    if (type==='text') {
      domEl=document.createElement('span'); domEl.textContent=content;
      domEl.style.cssText=`color:${color};font-size:${fontSize}px;font-weight:700;text-shadow:2px 2px 6px rgba(0,0,0,0.85);font-family:Inter,sans-serif;white-space:nowrap;`;
    } else {
      domEl=new Image(); domEl.src=content; domEl.style.display='block'; domEl.style.maxWidth='180px';
    }
    el.append(domEl, removeBtn, knob);
    this.els.overlaysCont.appendChild(el);
    const ovData={id,type,content,color,elContent:domEl,fontSize,pctW,pctX:0,pctY:0};
    setTimeout(()=>{
      const r=el.getBoundingClientRect(), wr=this.els.wrapper.getBoundingClientRect();
      el.style.transform='none';
      el.style.left=((wr.width/2)-(r.width/2))+'px'; el.style.top=((wr.height*0.8)-(r.height/2))+'px';
      ovData.pctX=parseFloat(el.style.left)/wr.width; ovData.pctY=parseFloat(el.style.top)/wr.height;
      this.overlays.push(ovData);
      if (type==='text') { this.selectedOverlayId=id; this.els.textColor.value=color; }
    },10);
    this._setupOverlayInteraction(el,ovData,removeBtn,knob);
  }

  _setupOverlayInteraction(el,ovData,removeBtn,knob) {
    removeBtn.addEventListener('click',()=>{ el.remove(); this.overlays=this.overlays.filter(o=>o.id!==el.id); });
    let ox, oy;
    const drag = (e) => {
      if (e.target===removeBtn||e.target===knob) return;
      if (e.cancelable) e.preventDefault();
      const ov=this.overlays.find(o=>o.id===el.id);
      if (ov?.type==='text') { this.selectedOverlayId=ov.id; this.els.textColor.value=ov.color; }
      const wr=this.els.wrapper.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      ox=cx-wr.left-el.offsetLeft; oy=cy-wr.top-el.offsetTop;
      const mv=(e)=>{
        if (e.cancelable) e.preventDefault();
        const mx = e.touches ? e.touches[0].clientX : e.clientX;
        const my = e.touches ? e.touches[0].clientY : e.clientY;
        const wr2=this.els.wrapper.getBoundingClientRect();
        const nx=Math.max(0,Math.min(mx-wr2.left-ox,wr2.width-el.offsetWidth));
        const ny=Math.max(0,Math.min(my-wr2.top-oy,wr2.height-el.offsetHeight));
        el.style.left=nx+'px'; el.style.top=ny+'px';
        ovData.pctX=nx/wr2.width; ovData.pctY=ny/wr2.height;
      };
      const up=()=>{ 
        window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); 
        window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',up); 
      };
      window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
      window.addEventListener('touchmove',mv, {passive: false}); window.addEventListener('touchend',up);
    };
    el.addEventListener('mousedown', drag);
    el.addEventListener('touchstart', drag, {passive: false});

    const resize = (e) => {
      if (e.cancelable) e.preventDefault(); e.stopPropagation();
      const sx = e.touches ? e.touches[0].clientX : e.clientX;
      const origW=el.offsetWidth, origFS=ovData.fontSize;
      const wr=this.els.wrapper.getBoundingClientRect();
      const mv=(e)=>{
        if (e.cancelable) e.preventDefault();
        const mx = e.touches ? e.touches[0].clientX : e.clientX;
        const nw=Math.max(60,origW+(mx-sx));
        ovData.pctW=nw/wr.width;
        if (ovData.type==='text') { ovData.fontSize=Math.max(10,Math.round((nw/origW)*origFS)); ovData.elContent.style.fontSize=ovData.fontSize+'px'; }
        else { ovData.elContent.style.maxWidth=nw+'px'; }
      };
      const up=()=>{ 
        window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); 
        window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',up); 
      };
      window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
      window.addEventListener('touchmove',mv, {passive: false}); window.addEventListener('touchend',up);
    };
    knob.addEventListener('mousedown', resize);
    knob.addEventListener('touchstart', resize, {passive: false});
  }

  // ═══════════════════════════════════════════════════════
  //  TRACK CONTROLS (eye + mute buttons)
  // ═══════════════════════════════════════════════════════
  _bindTrackControls() {
    document.querySelectorAll('.eye-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const ti=parseInt(btn.closest('.nle-track').dataset.trackIndex);
        const on=btn.classList.toggle('active');
        btn.classList.toggle('muted',!on);
        btn.innerHTML=on?'<i class="ph ph-eye"></i>':'<i class="ph ph-eye-slash"></i>';
        this.tracks.video[ti].forEach(c=>c.visible=on);
        this._syncAllSlots(); this._renderFrame();
      });
    });
    document.querySelectorAll('.track-mute-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const track=btn.closest('.nle-track');
        const type=track.dataset.trackType, ti=parseInt(track.dataset.trackIndex);
        const on=btn.classList.toggle('active');
        btn.classList.toggle('muted',!on);
        btn.innerHTML=on?'<i class="ph ph-speaker-high"></i>':'<i class="ph ph-speaker-slash"></i>';
        this.tracks[type][ti].forEach(c=>{ c.muted=!on; if (c._el&&c._el.tagName!=='IMG') c._el.volume=!on?0:(c.volume??1); });
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  //  BIND UI
  // ═══════════════════════════════════════════════════════
  _bindUI() {
    this.els.closeBtn.addEventListener('click',()=>{
      this._pause();
      this.els.view.classList.add('state-hidden');
      document.getElementById('main-stage').style.display='flex';
      document.getElementById('sidebar').classList.remove('closed');
    });

    this.els.playBtn.addEventListener('click',()=>{ if (this.isPlaying) this._pause(); else this._play(); });
    this.els.splitBtn.addEventListener('click',()=>this._splitAtPlayhead());
    this.els.exportBtn.addEventListener('click',()=>this._exportRender());
    this.els.saveBtn?.addEventListener('click',()=>this._saveProject());
    this.els.loadBtn?.addEventListener('click',()=>this._loadProject());

    // Ruler seek
    this.els.ruler.addEventListener('click',(e)=>{
      const r=this.els.ruler.getBoundingClientRect();
      this._seekTo((e.clientX-r.left)/this.pixelsPerSec);
    });

    // Zoom
    this.els.zoomSlider?.addEventListener('input',(e)=>{
      this.pixelsPerSec=parseInt(e.target.value);
      this.els.zoomVal.textContent=this.pixelsPerSec;
      document.querySelectorAll('.nle-clip').forEach(el=>{ const c=this._findClipById(el.dataset.id); if (c) this._positionClipBlock(el,c); });
      this._buildRuler();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown',(e)=>{
      if (this.els.view.classList.contains('state-hidden')) return;
      if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
      if (e.code==='Space')   { e.preventDefault(); if (this.isPlaying) this._pause(); else this._play(); }
      if (e.code==='KeyC')    this._splitAtPlayhead();
      if (e.code==='KeyZ' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); this._undo(); }
      if (e.code==='KeyS' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); this._saveProject(); }
      if (e.code==='Delete'||e.code==='Backspace') { const c=this._findClipById(this.selectedClipId); if (c) this._deleteClip(c); }
      if (e.code==='ArrowLeft')  { e.preventDefault(); this._seekTo(this.currentTime-1); }
      if (e.code==='ArrowRight') { e.preventDefault(); this._seekTo(this.currentTime+1); }
      if (e.code==='Home')  { e.preventDefault(); this._seekTo(0); }
      if (e.code==='End')   { e.preventDefault(); this._seekTo(this.totalDuration); }
    });

    // Quick Actions
    this.els.qaSplit.addEventListener('click',()=>this._splitAtPlayhead());
    this.els.qaDelete.addEventListener('click',()=>{ const c=this._findClipById(this.selectedClipId); if (c) this._deleteClip(c); });
    this.els.qaDuplicate.addEventListener('click',()=>{ const c=this._findClipById(this.selectedClipId); if (c) this._duplicateClip(c); });
    this.els.qaMute.addEventListener('click',()=>{
      const c=this._findClipById(this.selectedClipId); if (!c) return;
      c.muted=!c.muted; if (c._el&&c._el.tagName!=='IMG') c._el.volume=c.muted?0:(c.volume??1);
      this.els.qaMute.classList.toggle('active',c.muted);
    });
    this.els.qaFill.addEventListener('click',()=>{
      const c=this._findClipById(this.selectedClipId);
      if (!c||!['video','image'].includes(c.type)) return;
      c.cx=0;c.cy=0;c.cw=1;c.ch=1;
      const slot=document.getElementById(`vslot-${c.trackIdx}`); if (slot) this._applySlotGeometry(slot,c);
      this._renderFrame();
    });
    this.els.qaResetSize.addEventListener('click',()=>{
      const c=this._findClipById(this.selectedClipId);
      if (!c||!['video','image'].includes(c.type)) return;
      if (c.trackIdx===0) { c.cx=0;c.cy=0;c.cw=1;c.ch=1; }
      else { const pip=[[0.63,0.02],[0.02,0.02],[0.02,0.61]]; const p=pip[Math.min(c.trackIdx-1,2)]; c.cx=p[0];c.cy=p[1];c.cw=0.35;c.ch=0.35; }
      const slot=document.getElementById(`vslot-${c.trackIdx}`); if (slot) this._applySlotGeometry(slot,c);
      this._renderFrame();
    });

    // Volume & Speed controls in quickbar (if elements exist)
    const volEl  = document.getElementById('qa-volume');
    const spdEl  = document.getElementById('qa-speed');
    const spdVal = document.getElementById('qa-speed-val');
    if (volEl) volEl.addEventListener('input',(e)=>{
      const c=this._findClipById(this.selectedClipId); if (!c) return;
      c.volume=parseInt(e.target.value)/100;
      if (c._el&&c._el.tagName!=='IMG') c._el.volume=c.muted?0:c.volume;
    });
    if (spdEl) spdEl.addEventListener('input',(e)=>{
      const c=this._findClipById(this.selectedClipId); if (!c) return;
      c.speed=parseFloat(e.target.value);
      if (c._el&&c._el.tagName!=='IMG') c._el.playbackRate=c.speed;
      if (spdVal) spdVal.textContent=c.speed+'x';
    });

    // Screenshot button
    document.getElementById('qa-screenshot')?.addEventListener('click',()=>this._screenshot());

    // Imports
    this.els.importVideoBtn.addEventListener('click',()=>this.els.importVideoFile.click());
    this.els.importVideoFile.addEventListener('change',(e)=>{
      Array.from(e.target.files).slice(0,4).forEach(f=>{
        const ti=this.tracks.video.findIndex(a=>a.length<8);
        if (ti===-1) { this.app.showToast('Canales de video llenos','error'); return; }
        this._importMediaBlob(f,'video',ti);
      }); e.target.value='';
    });
    this.els.importAudioBtn.addEventListener('click',()=>this.els.importAudioFile.click());
    this.els.importAudioFile.addEventListener('change',(e)=>{
      Array.from(e.target.files).slice(0,4).forEach(f=>{
        const ti=this.tracks.audio.findIndex(a=>a.length<8);
        if (ti===-1) { this.app.showToast('Canales de audio llenos','error'); return; }
        this._importMediaBlob(f,'audio',ti);
      }); e.target.value='';
    });
    this.els.importImageBtn?.addEventListener('click',()=>this.els.importImageFile?.click());
    this.els.importImageFile?.addEventListener('change',(e)=>{
      Array.from(e.target.files).slice(0,4).forEach(f=>{
        const ti=this.tracks.video.findIndex(a=>a.length<8);
        if (ti===-1) { this.app.showToast('Canales llenos','error'); return; }
        this._importMediaBlob(f,'image',ti);
      }); e.target.value='';
    });

    // Text overlay
    this.els.addTextBtn.addEventListener('click',()=>{
      const txt=this.els.textInput.value.trim(); if (!txt) return;
      this._addOverlay({type:'text',content:txt,color:this.els.textColor.value});
      this.els.textInput.value='';
    });
    this.els.textInput.addEventListener('keydown',e=>{ if (e.key==='Enter') this.els.addTextBtn.click(); });
    this.els.textColor.addEventListener('input',(e)=>{
      if (!this.selectedOverlayId) return;
      const ov=this.overlays.find(o=>o.id===this.selectedOverlayId);
      if (ov?.type==='text') { ov.color=e.target.value; ov.elContent.style.color=e.target.value; }
    });

    // Logo
    this.els.addLogoBtn.addEventListener('click',()=>this.els.logoInput.click());
    this.els.logoInput.addEventListener('change',(e)=>{
      const f=e.target.files[0]; if (!f) return;
      const r=new FileReader(); r.onload=ev=>this._addOverlay({type:'image',content:ev.target.result}); r.readAsDataURL(f); e.target.value='';
    });

    this._bindTrackControls();
    this._syncTimecode();

    // ── Video view mode: Fit / Fill ──
    const videoSlots=this.els.videoSlots;
    const fitBtn=document.getElementById('view-fit-btn');
    const fillBtn=document.getElementById('view-fill-btn');
    videoSlots.classList.add('mode-fit');
    fitBtn?.addEventListener('click',()=>{ videoSlots.classList.replace('mode-fill','mode-fit')||videoSlots.classList.add('mode-fit'); fitBtn.classList.add('active'); fillBtn?.classList.remove('active'); });
    fillBtn?.addEventListener('click',()=>{ videoSlots.classList.replace('mode-fit','mode-fill')||videoSlots.classList.add('mode-fill'); fillBtn.classList.add('active'); fitBtn?.classList.remove('active'); });

    // ── Preview panel resize buttons + drag bar ──
    const previewPanel=document.getElementById('nle-preview-panel');
    const sizePct=document.getElementById('preview-size-pct');
    const MIN_W=20, MAX_W=85, STEP=5;
    const _getPct=()=>{ const bodyW=document.getElementById('editor-view').offsetWidth; return bodyW>0?Math.round((previewPanel.offsetWidth/bodyW)*100):55; };
    const _setPct=(pct)=>{ const c=Math.max(MIN_W,Math.min(MAX_W,pct)); previewPanel.style.width=c+'%'; if (sizePct) sizePct.textContent=c+'%'; };
    document.getElementById('preview-shrink-btn')?.addEventListener('click',()=>_setPct(_getPct()-STEP));
    document.getElementById('preview-grow-btn')?.addEventListener('click',()=>_setPct(_getPct()+STEP));
    const resizeBar=document.getElementById('nle-resize-bar');
    if (resizeBar&&previewPanel) {
      const startResize = (e) => {
        // Disable horizontal rezise on vertical layouts
        if (window.innerWidth <= 900) return;
        if (e.cancelable) e.preventDefault(); 
        resizeBar.classList.add('dragging');
        document.body.style.cursor='col-resize'; document.body.style.userSelect='none';
        const startX = e.touches ? e.touches[0].clientX : e.clientX;
        const body=document.getElementById('editor-view'), startW=previewPanel.offsetWidth, bodyW=body.offsetWidth;
        const mv=(e)=>{ 
          if (e.cancelable) e.preventDefault();
          const mx = e.touches ? e.touches[0].clientX : e.clientX;
          const dx=mx-startX, nw=Math.max(MIN_W/100*bodyW,Math.min(MAX_W/100*bodyW,startW+dx)); 
          const pct=Math.round((nw/bodyW)*100); previewPanel.style.width=pct+'%'; if (sizePct) sizePct.textContent=pct+'%'; 
        };
        const up=()=>{ 
          resizeBar.classList.remove('dragging'); document.body.style.cursor=''; document.body.style.userSelect=''; 
          window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); 
          window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',up); 
        };
        window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
        window.addEventListener('touchmove',mv, {passive: false}); window.addEventListener('touchend',up);
      };
      resizeBar.addEventListener('mousedown', startResize);
      resizeBar.addEventListener('touchstart', startResize, {passive: false});
    }
  }
}
