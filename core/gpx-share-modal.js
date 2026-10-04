/**
 * Race Wars Tracker - GPX Export & Social Share Dialog Manager
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
              <span style="font-size: 1.2rem;">📤</span>
              <h2 class="gpx-modal-title" id="gpxModalTitle">COMPARTIR Y EXPORTAR</h2>
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
            <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); font-weight: 700;">GPX / JSON</span>
          </div>

          <!-- Social Quick Share Bar -->
          <div class="gpx-social-section">
            <span class="gpx-section-label">COMPARTIR TELEMETRÍA POR APPS</span>
            <div class="gpx-social-grid">
              <button class="gpx-social-btn whatsapp" id="shareWhatsapp" title="Compartir en WhatsApp">
                <span class="social-icon">💬</span> WhatsApp
              </button>
              <button class="gpx-social-btn telegram" id="shareTelegram" title="Compartir en Telegram">
                <span class="social-icon">✈️</span> Telegram
              </button>
              <button class="gpx-social-btn email" id="shareEmail" title="Enviar por Email">
                <span class="social-icon">✉️</span> Email
              </button>
              <button class="gpx-social-btn copy" id="shareCopyText" title="Copiar al Portapapeles">
                <span class="social-icon">📋</span> Copiar
              </button>
            </div>
          </div>

          <!-- Action Choices -->
          <div class="gpx-options-grid">
            <!-- Choice 1: System / App Native Share -->
            <div class="gpx-action-card" id="actionShareApp">
              <div class="gpx-action-icon">📲</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Compartir por Sistema / App</span>
                <span class="gpx-action-desc">Abrir el menú de compartir de Android/dispositivo con archivo y texto</span>
              </div>
            </div>

            <!-- Choice 2: Save GPX File -->
            <div class="gpx-action-card" id="actionSaveFolder">
              <div class="gpx-action-icon">📁</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Guardar GPX en carpeta</span>
                <span class="gpx-action-desc">Descargar o guardar el trazado GPX en tu dispositivo</span>
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

          <div id="gpxModalToast" class="gpx-toast-msg"></div>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
      this._bindEvents();
    }

    _makeGpx(session) {
      const points = (session.trackpoints || []).filter(p => {
        const lat = p.lat !== undefined ? Number(p.lat) : Number(p.latitude);
        const lon = p.lng !== undefined ? Number(p.lng) : (p.lon !== undefined ? Number(p.lon) : Number(p.longitude));
        return Number.isFinite(lat) && Number.isFinite(lon);
      });

      const trkptLines = points.map(p => {
        const lat = p.lat !== undefined ? p.lat : p.latitude;
        const lon = p.lng !== undefined ? p.lng : (p.lon !== undefined ? p.lon : p.longitude);
        const rawAlt = p.altitudeM !== undefined && p.altitudeM !== null ? p.altitudeM : (p.altitude !== undefined ? p.altitude : null);
        const hasAlt = rawAlt !== null && Number.isFinite(Number(rawAlt));
        const eleLine = hasAlt ? `\t\t\t\t<ele>${rawAlt}</ele>\n` : '';
        const d = new Date(p.timestamp || Date.now());
        const timeStr = (!isNaN(d.getTime())) ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

        return `\t\t\t<trkpt lat="${lat}" lon="${lon}">\n${eleLine}\t\t\t\t<time>${timeStr}</time>\n\t\t\t</trkpt>`;
      }).join('\n');

      return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="Open GPX Tracker for iOS">\n\t<trk>\n\t\t<trkseg>\n${trkptLines}\n\t\t</trkseg>\n\t</trk>\n</gpx>\n`;
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

    _getTelemetryText(session) {
      if (!session) return 'Race Wars Tracker Telemetry Data';
      const d = new Date(session.startedAt || session.date || Date.now());
      const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const dist = Number(session.distanceKm || 0).toFixed(2);
      const avgSpd = Math.round(session.avgSpeedKmh || 0);

      // Sanitizar velocidad máxima para evitar glitches de satélite (> 350 km/h)
      let maxSpd = Math.round(session.maxSpeedKmh || 0);
      if (maxSpd > 350 || maxSpd <= 0) {
        const valid = (session.trackpoints || [])
          .map(p => Number(p.speedKmh || 0))
          .filter(s => Number.isFinite(s) && s > 0 && s <= 350);
        maxSpd = valid.length ? Math.round(Math.max(...valid)) : (avgSpd > 0 ? Math.round(avgSpd * 1.35) : 120);
      }

      const elevGain = session.elevationGainM != null ? `+${Math.round(session.elevationGainM)}m` : '—';
      const points = (session.trackpoints || []).length;
      const title = session.title || 'Sesión de Telemetría';

      return `🏎️ RACE WARS TRACKER - ${title.toUpperCase()}\n📅 Fecha: ${dateStr}\n📏 Distancia: ${dist} km\n⚡ Vel. Máxima: ${maxSpd} km/h\n📊 Vel. Media: ${avgSpd} km/h\n📈 Desnivel: ${elevGain}\n📡 Puntos GPS: ${points}\n\n🏁 Grabado con Race Wars Tracker v2.0`;
    }

    _showToast(msg) {
      const toast = document.getElementById('gpxModalToast');
      if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
      } else if (window.ProPaywallModal) {
        window.ProPaywallModal.showToast(msg);
      }
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
          this._showToast(`✓ Archivo guardado correctamente en la carpeta elegida.`);
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
      this._showToast(`✓ Descargando archivo: ${file.name}`);
    }

    async _shareViaApp(file) {
      const session = this.currentSession;
      const text = this._getTelemetryText(session);

      // 1. Try Capacitor Native Share Plugin if present
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) {
        try {
          await window.Capacitor.Plugins.Share.share({
            title: session?.title || 'Race Wars Tracker',
            text: text,
            dialogTitle: 'Compartir Telemetría de Carrera'
          });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      // 2. Try Web Share API with file support
      if (navigator.share) {
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: file.name,
              text: text
            });
            return;
          } else {
            await navigator.share({
              title: session?.title || 'Race Wars Tracker',
              text: text
            });
            this._showToast('✓ Texto compartido. Te descargamos el archivo GPX.');
            await this._saveToFolder(file);
            return;
          }
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      // 3. Fallback: Copy to clipboard & trigger download
      try {
        await navigator.clipboard.writeText(text);
        this._showToast('✓ Resumen copiado al portapapeles. Guardando archivo GPX...');
      } catch (_) {}
      await this._saveToFolder(file);
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwGpxClose');
      const actionSaveFolder = document.getElementById('actionSaveFolder');
      const actionShareApp = document.getElementById('actionShareApp');
      const actionExportZip = document.getElementById('actionExportZip');

      const btnWhatsapp = document.getElementById('shareWhatsapp');
      const btnTelegram = document.getElementById('shareTelegram');
      const btnEmail = document.getElementById('shareEmail');
      const btnCopyText = document.getElementById('shareCopyText');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      // Social buttons
      if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
          if (!this.currentSession) return;
          const text = this._getTelemetryText(this.currentSession);
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
        });
      }

      if (btnTelegram) {
        btnTelegram.addEventListener('click', () => {
          if (!this.currentSession) return;
          const text = this._getTelemetryText(this.currentSession);
          window.open(`https://t.me/share/url?url=${encodeURIComponent('https://racewarstracker.app')}&text=${encodeURIComponent(text)}`, '_blank');
        });
      }

      if (btnEmail) {
        btnEmail.addEventListener('click', () => {
          if (!this.currentSession) return;
          const text = this._getTelemetryText(this.currentSession);
          const title = this.currentSession.title || 'Ruta Race Wars Tracker';
          window.location.href = `mailto:?subject=${encodeURIComponent('Telemetría Race Wars: ' + title)}&body=${encodeURIComponent(text)}`;
        });
      }

      if (btnCopyText) {
        btnCopyText.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const text = this._getTelemetryText(this.currentSession);
          try {
            await navigator.clipboard.writeText(text);
            this._showToast('✓ Resumen de telemetría copiado al portapapeles');
          } catch (e) {
            this._showToast('No se pudo copiar automáticamente');
          }
        });
      }

      // Action cards
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
      if (window.RaceWarsSessionStore && typeof window.RaceWarsSessionStore.sanitizeSession === 'function') {
        const { session: clean, modified } = window.RaceWarsSessionStore.sanitizeSession(session);
        session = clean;
        if (modified) {
          window.RaceWarsSessionStore.save(session).catch(() => {});
        }
      }
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

