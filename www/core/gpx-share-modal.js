/**
 * Race Wars Tracker - GPX Export & Share Dialog Manager
 */
(function () {
  'use strict';

  class GpxShareModal {
    constructor() {
      this.backdrop = null;
      this.currentSession = null;
      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._buildModal());
      } else {
        this._buildModal();
      }
    }

    _buildModal() {
      if (document.getElementById('rwGpxModalBackdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'rwGpxModalBackdrop';
      backdrop.className = 'gpx-modal-backdrop';

      backdrop.innerHTML = `
        <div class="gpx-modal-container" role="dialog" aria-modal="true" aria-labelledby="gpxModalTitle">
          <div class="gpx-modal-header">
            <div class="gpx-modal-title-box">
              <span style="font-size: 1.2rem;">📦</span>
              <h2 class="gpx-modal-title" id="gpxModalTitle">EXPORTAR / ENVIAR GPX</h2>
            </div>
            <button class="gpx-modal-close" id="rwGpxClose" aria-label="Cerrar modal">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Session Info Preview -->
          <div class="gpx-route-info" id="gpxRoutePreview">
            <div class="gpx-info-left">
              <span class="gpx-info-title" id="gpxPreviewDate">02 oct 2026</span>
              <span class="gpx-info-sub" id="gpxPreviewSub">0.0 km · 0 puntos GPS</span>
            </div>
            <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); font-weight: 700;">GPX 1.1</span>
          </div>

          <!-- Action Choices -->
          <div class="gpx-options-grid">
            <!-- Choice 1: Save to Chosen Folder -->
            <div class="gpx-action-card" id="actionSaveFolder">
              <div class="gpx-action-icon">📁</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Guardar en carpeta a elegir</span>
                <span class="gpx-action-desc">Selecciona la carpeta de destino en tu dispositivo o tarjeta SD</span>
              </div>
            </div>

            <!-- Choice 2: Share / Send via App -->
            <div class="gpx-action-card" id="actionShareApp">
              <div class="gpx-action-icon">📲</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Enviar / Compartir por App</span>
                <span class="gpx-action-desc">Enviar por WhatsApp, Telegram, Google Drive, Gmail o Bluetooth</span>
              </div>
            </div>

            <!-- Choice 3: Export Full ZIP (GPX + Telemetry JSON) -->
            <div class="gpx-action-card" id="actionExportZip">
              <div class="gpx-action-icon">🗜️</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Exportar Pack ZIP Completo</span>
                <span class="gpx-action-desc">Incluye archivo GPX estándar + Telemetría cruda JSON</span>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
      this._bindEvents();
    }

    _makeGpx(session) {
      const points = (session.trackpoints || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
      const trkpts = points.map(p => {
        const ele = p.altitudeM != null && Number.isFinite(Number(p.altitudeM)) ? `<ele>${Number(p.altitudeM).toFixed(1)}</ele>` : '';
        const time = Number.isFinite(Number(p.timestamp)) ? `<time>${new Date(Number(p.timestamp)).toISOString()}</time>` : '';
        return `<trkpt lat="${Number(p.lat).toFixed(7)}" lon="${Number(p.lng).toFixed(7)}">${ele}${time}</trkpt>`;
      }).join('');

      const startDate = new Date(session.startedAt || session.date || Date.now()).toISOString();
      const title = session.title || 'Ruta Race Wars Tracker';
      return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Race Wars Tracker" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${title}</name><time>${startDate}</time></metadata><trk><name>${title}</name><trkseg>${trkpts}</trkseg></trk></gpx>`;
    }

    _makeZipBlob(gpxContent, session) {
      const jsonContent = JSON.stringify(session, null, 2);
      const encoder = new TextEncoder();
      const crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
      const crc32 = bytes => {
        let crc = 0xffffffff;
        for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
      };

      const files = [
        { name: 'route.gpx', content: gpxContent },
        { name: 'telemetry_session.json', content: jsonContent }
      ];

      const localParts = [], centralParts = [];
      let offset = 0;
      for (const file of files) {
        const name = encoder.encode(file.name), data = encoder.encode(file.content), crc = crc32(data);
        const local = new Uint8Array(30 + name.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
        lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
        lv.setUint16(26, name.length, true); local.set(name, 30);
        localParts.push(local, data);

        const central = new Uint8Array(46 + name.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true); cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
        centralParts.push(central);
        offset += local.length + data.length;
      }
      const centralSize = centralParts.reduce((t, p) => t + p.length, 0);
      const end = new Uint8Array(22);
      const ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
      ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
      return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
    }

    async _saveToFolder(file) {
      // 1. Try File System Access API showSaveFilePicker if available
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: file.name,
            types: [{
              description: 'GPX Route File',
              accept: { [file.type]: [file.name.endsWith('.zip') ? '.zip' : '.gpx'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(file);
          await writable.close();
          if (window.ProPaywallModal) window.ProPaywallModal.showToast(`✓ Archivo guardado correctamente en la carpeta elegida.`);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // User canceled picker
        }
      }

      // 2. Fallback to standard Blob Download trigger
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (window.ProPaywallModal) window.ProPaywallModal.showToast(`✓ Archivo descárgado: ${file.name}`);
    }

    async _shareViaApp(file) {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: file.name,
            text: `Ruta GPX grabada con Race Wars Tracker`
          });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      // Fallback if native sharing is unsupported
      alert('Tu navegador no soporta el menú directo de compartir archivos. Te ofrecemos la descarga directa.');
      await this._saveToFolder(file);
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwGpxClose');
      const actionSaveFolder = document.getElementById('actionSaveFolder');
      const actionShareApp = document.getElementById('actionShareApp');
      const actionExportZip = document.getElementById('actionExportZip');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      if (actionSaveFolder) {
        actionSaveFolder.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const gpxStr = this._makeGpx(this.currentSession);
          const dateStr = new Date(this.currentSession.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-');
          const file = new File([gpxStr], `RaceWars_${dateStr}.gpx`, { type: 'application/gpx+xml' });
          await this._saveToFolder(file);
          this.close();
        });
      }

      if (actionShareApp) {
        actionShareApp.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const gpxStr = this._makeGpx(this.currentSession);
          const dateStr = new Date(this.currentSession.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-');
          const file = new File([gpxStr], `RaceWars_${dateStr}.gpx`, { type: 'application/gpx+xml' });
          await this._shareViaApp(file);
          this.close();
        });
      }

      if (actionExportZip) {
        actionExportZip.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const gpxStr = this._makeGpx(this.currentSession);
          const zipBlob = this._makeZipBlob(gpxStr, this.currentSession);
          const dateStr = new Date(this.currentSession.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-');
          const file = new File([zipBlob], `RaceWars_${dateStr}.zip`, { type: 'application/zip' });
          await this._saveToFolder(file);
          this.close();
        });
      }
    }

    open(session) {
      this.currentSession = session;
      if (!this.backdrop) this._buildModal();

      const dateEl = document.getElementById('gpxPreviewDate');
      const subEl = document.getElementById('gpxPreviewSub');

      if (session) {
        const d = new Date(session.startedAt || session.date || Date.now());
        if (dateEl) dateEl.textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const points = (session.trackpoints || []).length;
        if (subEl) subEl.textContent = `${Number(session.distanceKm || 0).toFixed(2)} km · ${points} puntos GPS`;
      }

      this.backdrop.classList.add('is-visible');
    }

    close() {
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.GpxShareModal = new GpxShareModal();
})();
