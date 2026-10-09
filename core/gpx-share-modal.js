/**
 * Race Wars Tracker - GPX & KML Export & Share Dialog Manager
 * Versión 2.1 - Exportación completa de datos reales GPS (GPX 1.1 y KML 2.2 Google Earth)
 */
(function () {
  'use strict';

  class GpxShareModal {
    constructor() {
      this.backdrop = null;
      this.currentSession = null;
      this.activeTab = 'gpx'; // 'gpx' | 'kml' | 'summary'
      this._cachedGpx = '';
      this._cachedKml = '';
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
              <span class="gpx-header-icon">🛰️</span>
              <div>
                <h2 class="gpx-modal-title" id="gpxModalTitle">EXPORTAR TELEMETRÍA</h2>
                <span class="gpx-modal-subtitle">Formatos oficiales GPX 1.1 & KML Google Earth</span>
              </div>
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
              <span class="gpx-info-title" id="gpxPreviewDate">04 oct 2026</span>
              <span class="gpx-info-sub" id="gpxPreviewSub">0.0 km · 0 puntos GPS</span>
            </div>
            <div class="gpx-badges">
              <span class="gpx-format-tag tag-gpx">GPX 1.1</span>
              <span class="gpx-format-tag tag-kml">KML 2.2</span>
            </div>
          </div>

          <!-- Action Choices -->
          <div class="gpx-options-grid">
            <!-- Choice 1: Export GPX File -->
            <div class="gpx-action-card card-gpx" id="actionExportGpx" role="button" tabindex="0">
              <div class="gpx-action-icon icon-gpx">📍</div>
              <div class="gpx-action-text">
                <div class="gpx-action-topline">
                  <span class="gpx-action-title">Exportar Archivo GPX (.gpx)</span>
                  <span class="gpx-badge-rec">RECOMENDADO</span>
                </div>
                <span class="gpx-action-desc">Guardar en Archivos de iOS / Compartir datos completos con trackpoints reales</span>
              </div>
            </div>

            <!-- Choice 2: Export KML File -->
            <div class="gpx-action-card card-kml" id="actionExportKml" role="button" tabindex="0">
              <div class="gpx-action-icon icon-kml">🌍</div>
              <div class="gpx-action-text">
                <div class="gpx-action-topline">
                  <span class="gpx-action-title">Exportar Archivo KML (.kml)</span>
                  <span class="gpx-badge-kml">GOOGLE EARTH</span>
                </div>
                <span class="gpx-action-desc">Trazado 3D con línea verde neón, pines de salida/meta y animación temporal</span>
              </div>
            </div>

            <!-- Choice 3: Export Full ZIP (GPX + KML + Telemetry JSON) -->
            <div class="gpx-action-card" id="actionExportZip" role="button" tabindex="0">
              <div class="gpx-action-icon">🗜️</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Exportar Pack Completo (.zip)</span>
                <span class="gpx-action-desc">Archivo comprimido con GPX 1.1 + KML Google Earth + Telemetría cruda JSON</span>
              </div>
            </div>

            <!-- Choice 4: Inspect / Copy Raw Data -->
            <div class="gpx-action-card" id="actionToggleInspector" role="button" tabindex="0">
              <div class="gpx-action-icon">👁️</div>
              <div class="gpx-action-text">
                <span class="gpx-action-title">Ver y Copiar Datos GPS Reales</span>
                <span class="gpx-action-desc">Inspecciona el código XML/KML completo y copia todas las coordenadas al portapapeles</span>
              </div>
            </div>
          </div>

          <!-- Collapsible Raw Data Inspector Section -->
          <div class="gpx-raw-inspector" id="gpxRawInspector" style="display: none;">
            <div class="gpx-inspector-header">
              <div class="gpx-inspector-tabs">
                <button class="gpx-tab-btn is-active" id="tabGpx" data-tab="gpx">GPX 1.1</button>
                <button class="gpx-tab-btn" id="tabKml" data-tab="kml">KML (Google Earth)</button>
                <button class="gpx-tab-btn" id="tabSummary" data-tab="summary">Resumen</button>
              </div>
              <button class="gpx-copy-raw-btn" id="copyRawContentBtn" title="Copiar código al portapapeles">
                <span class="copy-icon">📋</span> Copiar Todo
              </button>
            </div>
            <div class="gpx-code-container">
              <pre class="gpx-code-block"><code id="gpxRawCodeText">Cargando datos...</code></pre>
            </div>
            <div class="gpx-inspector-footer">
              <span id="gpxPointsCounter">0 puntos analizados</span>
              <span class="gpx-inspector-hint">Listo para pegar en Google Earth, Strava o editores GPS</span>
            </div>
          </div>

          <!-- Social Quick Share Bar -->
          <div class="gpx-social-section">
            <span class="gpx-section-label">COMPARTIR RESUMEN RÁPIDO</span>
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
              <button class="gpx-social-btn copy" id="shareCopyText" title="Copiar Resumen al Portapapeles">
                <span class="social-icon">📋</span> Copiar
              </button>
            </div>
          </div>

          <div id="gpxModalToast" class="gpx-toast-msg"></div>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
      this._bindEvents();
    }

    _getValidPoints(session) {
      return (session?.trackpoints || []).filter(p => {
        const lat = p.lat !== undefined ? Number(p.lat) : Number(p.latitude);
        const lon = p.lng !== undefined ? Number(p.lng) : (p.lon !== undefined ? Number(p.lon) : Number(p.longitude));
        return Number.isFinite(lat) && Number.isFinite(lon);
      });
    }

    _makeGpx(session) {
      const points = this._getValidPoints(session);
      const title = session?.title || 'Ruta Race Wars Tracker';
      const escapedTitle = this._escapeXml(title);

      const trkptLines = points.map((p, index) => {
        const lat = p.lat !== undefined ? Number(p.lat).toFixed(6) : Number(p.latitude).toFixed(6);
        const lon = p.lng !== undefined ? Number(p.lng).toFixed(6) : (p.lon !== undefined ? Number(p.lon).toFixed(6) : Number(p.longitude).toFixed(6));
        const rawAlt = p.altitudeM !== undefined && p.altitudeM !== null ? p.altitudeM : (p.altitude !== undefined ? p.altitude : null);
        const hasAlt = rawAlt !== null && Number.isFinite(Number(rawAlt));
        const eleLine = hasAlt ? `\t\t\t\t<ele>${Number(rawAlt).toFixed(1)}</ele>\n` : '';
        const d = new Date(p.timestamp || (session?.startedAt ? session.startedAt + index * 1000 : Date.now()));
        const timeStr = (!isNaN(d.getTime())) ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

        let rawSpeed = p.speedKmh !== undefined ? Number(p.speedKmh) : (p.speed !== undefined ? Number(p.speed) * 3.6 : null);
        if ((rawSpeed === null || rawSpeed <= 0) && index > 0) {
          const prev = points[index - 1];
          const prevLat = Number(prev.lat ?? prev.latitude);
          const prevLon = Number(prev.lng ?? prev.lon ?? prev.longitude);
          const dtSec = Math.max(0.1, ((p.timestamp || 0) - (prev.timestamp || 0)) / 1000);
          if (dtSec > 0 && dtSec < 3600) {
            const dLat = (Number(lat) - prevLat) * Math.PI / 180;
            const dLon = (Number(lon) - prevLon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(prevLat * Math.PI / 180) * Math.cos(Number(lat) * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const imp = (distKm / dtSec) * 3600;
            if (imp > 0 && imp <= 350) rawSpeed = imp;
          }
        }

        let speedLine = '';
        if (rawSpeed !== null && Number.isFinite(rawSpeed) && rawSpeed > 0) {
          const speedMps = (rawSpeed / 3.6).toFixed(2);
          speedLine = `\t\t\t\t<extensions>\n\t\t\t\t\t<gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">\n\t\t\t\t\t\t<gpxtpx:speed>${speedMps}</gpxtpx:speed>\n\t\t\t\t\t</gpxtpx:TrackPointExtension>\n\t\t\t\t</extensions>\n`;
        }

        return `\t\t\t<trkpt lat="${lat}" lon="${lon}">\n${eleLine}\t\t\t\t<time>${timeStr}</time>\n${speedLine}\t\t\t</trkpt>`;
      }).join('\n');

      return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="Open GPX Tracker for iOS">
\t<metadata>
\t\t<name>${escapedTitle}</name>
\t\t<time>${new Date(session?.startedAt || Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z')}</time>
\t</metadata>
\t<trk>
\t\t<name>${escapedTitle}</name>
\t\t<trkseg>
${trkptLines}
\t\t</trkseg>
\t</trk>
</gpx>
`;
    }

    _makeKml(session) {
      const points = this._getValidPoints(session);
      const title = session?.title || 'Ruta Race Wars Tracker';
      const escapedTitle = this._escapeXml(title);
      const desc = this._escapeXml(this._getTelemetryText(session));

      if (points.length === 0) {
        return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapedTitle}</name></Document></kml>`;
      }

      // KML coordinates are: lon,lat,alt (separated by space or newline)
      const coordPairs = points.map(p => {
        const lat = p.lat !== undefined ? p.lat : p.latitude;
        const lon = p.lng !== undefined ? p.lng : (p.lon !== undefined ? p.lon : p.longitude);
        const alt = p.altitudeM !== undefined && p.altitudeM !== null ? p.altitudeM : (p.altitude !== undefined ? p.altitude : 0);
        return `${lon},${lat},${alt || 0}`;
      }).join('\n          ');

      // gx:Track for Google Earth animation slider
      const gxWhens = [];
      const gxCoords = [];
      points.forEach(p => {
        const lat = p.lat !== undefined ? p.lat : p.latitude;
        const lon = p.lng !== undefined ? p.lng : (p.lon !== undefined ? p.lon : p.longitude);
        const alt = p.altitudeM !== undefined && p.altitudeM !== null ? p.altitudeM : (p.altitude !== undefined ? p.altitude : 0);
        const d = new Date(p.timestamp || Date.now());
        const timeStr = (!isNaN(d.getTime())) ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

        gxWhens.push(`        <when>${timeStr}</when>`);
        gxCoords.push(`        <gx:coord>${lon} ${lat} ${alt || 0}</gx:coord>`);
      });

      const first = points[0];
      const last = points[points.length - 1];
      const firstLat = first.lat !== undefined ? first.lat : first.latitude;
      const firstLon = first.lng !== undefined ? first.lng : (first.lon !== undefined ? first.lon : first.longitude);
      const firstAlt = first.altitudeM || first.altitude || 0;

      const lastLat = last.lat !== undefined ? last.lat : last.latitude;
      const lastLon = last.lng !== undefined ? last.lng : (last.lon !== undefined ? last.lon : last.longitude);
      const lastAlt = last.altitudeM || last.altitude || 0;

      return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${escapedTitle}</name>
    <description>${desc}</description>

    <!-- Estilo de Carrera Verde Neón Race Wars (#39FF14 -> ff14ff39 en KML) -->
    <Style id="raceTrackStyle">
      <LineStyle>
        <color>ff14ff39</color>
        <width>4</width>
      </LineStyle>
    </Style>

    <Style id="startPointStyle">
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <Style id="finishPointStyle">
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <!-- Punto de Salida -->
    <Placemark>
      <name>Salida</name>
      <styleUrl>#startPointStyle</styleUrl>
      <Point>
        <coordinates>${firstLon},${firstLat},${firstAlt}</coordinates>
      </Point>
    </Placemark>

    <!-- Punto de Meta -->
    <Placemark>
      <name>Meta</name>
      <styleUrl>#finishPointStyle</styleUrl>
      <Point>
        <coordinates>${lastLon},${lastLat},${lastAlt}</coordinates>
      </Point>
    </Placemark>

    <!-- Trazado 3D de la Ruta -->
    <Placemark>
      <name>${escapedTitle} (Trazado)</name>
      <styleUrl>#raceTrackStyle</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
          ${coordPairs}
        </coordinates>
      </LineString>
    </Placemark>

    <!-- Reproducción Temporal para Google Earth -->
    <Placemark>
      <name>${escapedTitle} (Reproducción Temporal)</name>
      <styleUrl>#raceTrackStyle</styleUrl>
      <gx:Track>
        <altitudeMode>clampToGround</altitudeMode>
${gxWhens.join('\n')}
${gxCoords.join('\n')}
      </gx:Track>
    </Placemark>

  </Document>
</kml>
`;
    }

    _escapeXml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    _makeZipBlob(gpxContent, kmlContent, session) {
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
        { name: 'route.kml', content: kmlContent },
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
      const points = this._getValidPoints(session).length;
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

    async _shareOrSaveFile(file) {
      // 1. Prioridad para iOS / Safari: Web Share API con archivos
      // Al pasar `files: [file]` en iOS, se abre la hoja de compartir nativa
      // con la opción "Guardar en Archivos", AirDrop, WhatsApp, etc.
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: file.name,
            text: `Ruta exportada desde Race Wars Tracker: ${file.name}`
          });
          this._showToast(`✓ Archivo compartido: ${file.name}`);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // Usuario canceló
          console.warn('[GpxShareModal] Error en navigator.share({files}):', err);
        }
      }

      // 2. File System Access API para navegadores de escritorio (Chrome, Edge)
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const ext = file.name.split('.').pop() || 'dat';
          const handle = await window.showSaveFilePicker({
            suggestedName: file.name,
            types: [{
              description: ext.toUpperCase() + ' File',
              accept: { [file.type || 'application/octet-stream']: ['.' + ext] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(file);
          await writable.close();
          this._showToast(`✓ Archivo guardado correctamente.`);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      // 3. Fallback con Data URL o Blob URL
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = file.name;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          a.remove();
          this._showToast(`✓ Descargando archivo: ${file.name}`);
        };
        reader.readAsDataURL(file);
      } catch (err) {
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
    }

    _updateInspectorContent() {
      const codeEl = document.getElementById('gpxRawCodeText');
      const counterEl = document.getElementById('gpxPointsCounter');
      if (!codeEl || !this.currentSession) return;

      const points = this._getValidPoints(this.currentSession);
      if (counterEl) {
        counterEl.textContent = `${points.length} puntos GPS listos`;
      }

      if (this.activeTab === 'gpx') {
        if (!this._cachedGpx) this._cachedGpx = this._makeGpx(this.currentSession);
        codeEl.textContent = this._cachedGpx;
      } else if (this.activeTab === 'kml') {
        if (!this._cachedKml) this._cachedKml = this._makeKml(this.currentSession);
        codeEl.textContent = this._cachedKml;
      } else {
        codeEl.textContent = this._getTelemetryText(this.currentSession);
      }
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwGpxClose');
      const actionExportGpx = document.getElementById('actionExportGpx');
      const actionExportKml = document.getElementById('actionExportKml');
      const actionExportZip = document.getElementById('actionExportZip');
      const actionToggleInspector = document.getElementById('actionToggleInspector');
      const rawInspector = document.getElementById('gpxRawInspector');

      const tabGpx = document.getElementById('tabGpx');
      const tabKml = document.getElementById('tabKml');
      const tabSummary = document.getElementById('tabSummary');
      const copyRawContentBtn = document.getElementById('copyRawContentBtn');

      const btnWhatsapp = document.getElementById('shareWhatsapp');
      const btnTelegram = document.getElementById('shareTelegram');
      const btnEmail = document.getElementById('shareEmail');
      const btnCopyText = document.getElementById('shareCopyText');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      // Tabs del Inspector
      const setTab = (tabName, activeEl) => {
        this.activeTab = tabName;
        [tabGpx, tabKml, tabSummary].forEach(b => b?.classList.remove('is-active'));
        activeEl?.classList.add('is-active');
        this._updateInspectorContent();
      };

      if (tabGpx) tabGpx.addEventListener('click', () => setTab('gpx', tabGpx));
      if (tabKml) tabKml.addEventListener('click', () => setTab('kml', tabKml));
      if (tabSummary) tabSummary.addEventListener('click', () => setTab('summary', tabSummary));

      // Copiar código del inspector
      if (copyRawContentBtn) {
        copyRawContentBtn.addEventListener('click', async () => {
          const codeEl = document.getElementById('gpxRawCodeText');
          const content = codeEl ? codeEl.textContent : '';
          if (!content) return;
          try {
            await navigator.clipboard.writeText(content);
            this._showToast(`✓ ¡Código ${this.activeTab.toUpperCase()} copiado al portapapeles!`);
          } catch (e) {
            this._showToast('Selecciona el texto para copiar manualmente');
          }
        });
      }

      // Toggle Inspector
      if (actionToggleInspector) {
        actionToggleInspector.addEventListener('click', () => {
          if (!rawInspector) return;
          const isHidden = rawInspector.style.display === 'none';
          rawInspector.style.display = isHidden ? 'flex' : 'none';
          if (isHidden) {
            this._updateInspectorContent();
            rawInspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }

      // Exportar GPX
      if (actionExportGpx) {
        actionExportGpx.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const points = this._getValidPoints(this.currentSession);
          if (points.length === 0) {
            this._showToast('⚠️ No hay puntos GPS válidos para exportar.');
            return;
          }

          // Prioridad: Si estamos en iOS nativo, usar NativeTracker para abrir la hoja de compartir de iOS (Archivos/AirDrop)
          if (window.Capacitor?.Plugins?.NativeTracker?.exportGPX) {
            try {
              this._showToast('Generando GPX nativo...');
              await window.Capacitor.Plugins.NativeTracker.exportGPX({
                routeName: this.currentSession.title || 'Ruta Race Wars Tracker',
                points: points
              });
              this._showToast('✓ Hoja de compartir GPX abierta.');
              return;
            } catch (err) {
              console.warn('[GpxShareModal] NativeTracker.exportGPX error, usando fallback:', err);
            }
          }

          const gpxStr = this._makeGpx(this.currentSession);
          const dateStr = new Date(this.currentSession.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const file = new File([gpxStr], `RaceWars_${dateStr}.gpx`, { type: 'application/gpx+xml' });
          await this._shareOrSaveFile(file);
        });
      }

      // Exportar KML
      if (actionExportKml) {
        actionExportKml.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const points = this._getValidPoints(this.currentSession);
          if (points.length === 0) {
            this._showToast('⚠️ No hay puntos GPS válidos para exportar.');
            return;
          }

          // Prioridad: Si estamos en iOS nativo, usar NativeTracker para abrir la hoja de compartir de iOS
          if (window.Capacitor?.Plugins?.NativeTracker?.exportKML) {
            try {
              this._showToast('Generando KML nativo...');
              await window.Capacitor.Plugins.NativeTracker.exportKML({
                routeName: this.currentSession.title || 'Ruta Race Wars Tracker',
                points: points
              });
              this._showToast('✓ Hoja de compartir KML abierta.');
              return;
            } catch (err) {
              console.warn('[GpxShareModal] NativeTracker.exportKML error, usando fallback:', err);
            }
          }

          const kmlStr = this._makeKml(this.currentSession);
          const dateStr = new Date(this.currentSession.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const file = new File([kmlStr], `RaceWars_${dateStr}.kml`, { type: 'application/vnd.google-earth.kml+xml' });
          await this._shareOrSaveFile(file);
        });
      }

      // Exportar ZIP
      if (actionExportZip) {
        actionExportZip.addEventListener('click', async () => {
          if (!this.currentSession) return;
          const points = this._getValidPoints(this.currentSession);
          if (points.length === 0) {
            this._showToast('⚠️ No hay puntos GPS válidos para exportar.');
            return;
          }
          const gpxStr = this._makeGpx(this.currentSession);
          const kmlStr = this._makeKml(this.currentSession);
          const zipBlob = this._makeZipBlob(gpxStr, kmlStr, this.currentSession);
          const dateStr = new Date(this.currentSession.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const file = new File([zipBlob], `RaceWars_${dateStr}.zip`, { type: 'application/zip' });
          await this._shareOrSaveFile(file);
        });
      }

      // Social Quick Share Buttons
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
    }

    async open(session) {
      if (window.RaceWarsSessionStore && typeof window.RaceWarsSessionStore.sanitizeSession === 'function') {
        const { session: clean, modified } = window.RaceWarsSessionStore.sanitizeSession(session);
        session = clean;
        if (modified) {
          window.RaceWarsSessionStore.save(session).catch(() => {});
        }
      }

      // Si la sesión no tiene puntos en memoria, consultar si el NativeTracker tiene puntos registrados
      if ((!session?.trackpoints || session.trackpoints.length === 0) && window.Capacitor?.Plugins?.NativeTracker?.getRecordedPoints) {
        try {
          const nativeRes = await window.Capacitor.Plugins.NativeTracker.getRecordedPoints();
          if (nativeRes && Array.isArray(nativeRes.points) && nativeRes.points.length > 0) {
            session.trackpoints = nativeRes.points;
            if (window.RaceWarsSessionStore) {
              window.RaceWarsSessionStore.save(session).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('[GpxShareModal] Error obteniendo puntos nativos:', e);
        }
      }

      this.currentSession = session;
      this._cachedGpx = '';
      this._cachedKml = '';
      this.activeTab = 'gpx';

      if (!this.backdrop) this._buildModal();

      const dateEl = document.getElementById('gpxPreviewDate');
      const subEl = document.getElementById('gpxPreviewSub');
      const rawInspector = document.getElementById('gpxRawInspector');
      if (rawInspector) rawInspector.style.display = 'none';

      if (session) {
        const d = new Date(session.startedAt || session.date || Date.now());
        if (dateEl) {
          dateEl.textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        const points = this._getValidPoints(session).length;
        if (subEl) {
          subEl.textContent = `${Number(session.distanceKm || 0).toFixed(2)} km · ${points} puntos GPS registrados`;
        }
      }

      this.backdrop.classList.add('is-visible');
    }

    close() {
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.GpxShareModal = new GpxShareModal();
})();
