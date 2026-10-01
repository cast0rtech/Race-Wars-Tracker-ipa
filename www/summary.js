// Race Wars Tracker - session-backed summary and real GPX/ZIP export.
document.addEventListener('DOMContentLoaded', async () => {
  const exportBtn = document.getElementById('exportZipBtn');
  const progressBar = document.getElementById('exportProgressBar');
  const toast = document.getElementById('toastFeedback');
  const weatherTimeline = document.getElementById('weatherTimeline');
  const sessions = window.RaceWarsSessionStore ? await window.RaceWarsSessionStore.list() : [];
  const requestedId = new URLSearchParams(location.search).get('session');
  let currentSession = sessions.find(item => item.id === requestedId) || sessions[0] || null;

  function showMessage(message, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? '#ff465c' : '#39ff14';
    toast.style.color = isError ? '#ff465c' : '#39ff14';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  function setMetric(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderSession(session) {
    currentSession = session;
    const points = (session.trackpoints || []).filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)));
    const start = session.startedAt || Date.parse(session.date) || Date.now();
    const date = new Date(start);
    setMetric('#routeDate', `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setMetric('#routeDistance', `DISTANCIA: ${Number(session.distanceKm || 0).toFixed(2)} KM`);
    setMetric('#routePointCount', `TRAZADO GPS: ${points.length} PUNTOS`);
    setMetric('.highlights-grid .hl-card:nth-child(1) .hl-num', Math.round(session.avgSpeedKmh || 0));
    setMetric('.highlights-grid .hl-card:nth-child(2) .hl-num', Math.round(session.maxSpeedKmh || 0));
    setMetric('.highlights-grid .hl-card:nth-child(3) .hl-num', session.peakAltitudeM == null ? '—' : Math.round(session.peakAltitudeM));
    setMetric('.highlights-grid .hl-card:nth-child(4) .hl-num', session.elevationGainM == null ? '—' : `+${Math.round(session.elevationGainM)}`);
    setMetric('.highlights-grid .hl-card:nth-child(5) .hl-num', session.elevationLossM == null ? '—' : `-${Math.round(session.elevationLossM)}`);

    const typeBadge = document.getElementById('sessionTypeBadge');
    const isSynth = session.isSynthetic || session.isDemo || (session.id && session.id.includes('demo'));
    if (typeBadge) {
      if (isSynth) {
        typeBadge.style.display = 'block';
        typeBadge.style.borderColor = '#ffdd00';
        typeBadge.style.color = '#ffdd00';
        typeBadge.style.background = 'rgba(255, 221, 0, 0.15)';
        typeBadge.textContent = '⚠️ DEMO SINTÉTICA · DATOS SIMULADOS (NO ES UNA RUTA REAL GPS)';
      } else if (session.status === 'INTERRUPTED' || session.status === 'CRASH_RECOVERED') {
        typeBadge.style.display = 'block';
        typeBadge.style.borderColor = '#ff9900';
        typeBadge.style.color = '#ff9900';
        typeBadge.style.background = 'rgba(255, 153, 0, 0.15)';
        typeBadge.textContent = '⚠️ RUTA INTERRUMPIDA RECUPERADA · DATOS GUARDADOS HASTA EL CORTE';
      } else {
        typeBadge.style.display = 'none';
      }
    }

    const route = document.getElementById('routeTrack');
    if (points.length > 0 && route) {
      const lats = points.map(point => Number(point.lat));
      const lngs = points.map(point => Number(point.lng));
      const minLat = lats.reduce((a, b) => Math.min(a, b), Infinity);
      const maxLat = lats.reduce((a, b) => Math.max(a, b), -Infinity);
      const minLng = lngs.reduce((a, b) => Math.min(a, b), Infinity);
      const maxLng = lngs.reduce((a, b) => Math.max(a, b), -Infinity);
      const project = (point) => {
        const x = 20 + ((Number(point.lng) - minLng) / Math.max(1e-9, maxLng - minLng)) * 360;
        const y = 15 + ((maxLat - Number(point.lat)) / Math.max(1e-9, maxLat - minLat)) * 180;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      };
      const stride = Math.max(1, Math.ceil(points.length / 3000));
      const displayPoints = points.filter((_, index) => index % stride === 0);
      if (displayPoints[displayPoints.length - 1] !== points[points.length - 1]) displayPoints.push(points[points.length - 1]);
      route.setAttribute('points', displayPoints.map(project).join(' '));
      document.querySelector('.start-pin')?.setAttribute('transform', `translate(${project(points[0])})`);
      document.querySelector('.finish-pin')?.setAttribute('transform', `translate(${project(points[points.length - 1])})`);
    } else if (route) {
      route.setAttribute('points', '');
    }

    if (weatherTimeline) {
      weatherTimeline.replaceChildren();
      const notice = document.createElement('p');
      notice.textContent = 'Esta versión no captura datos meteorológicos. No hay datos reales del tiempo para esta sesión.';
      weatherTimeline.appendChild(notice);
    }
    if (exportBtn) exportBtn.disabled = points.length === 0;
    if (points.length === 0) showMessage('La sesión guardada no contiene puntos GPS exportables.', true);
  }

  // Keep all recorded sessions available from the summary screen.
  const dateBadge = document.querySelector('.route-date-badge');
  if (dateBadge && sessions.length > 1) {
    const selector = document.createElement('select');
    selector.setAttribute('aria-label', 'Seleccionar sesión guardada');
    selector.style.cssText = 'display:block;max-width:260px;margin-top:6px;background:#111820;color:#dbe8ed;border:1px solid #38434a;border-radius:5px;padding:4px;font:inherit';
    sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      const date = new Date(session.startedAt || session.date);
      const isSynth = session.isSynthetic || session.isDemo;
      const synthTag = isSynth ? ' [DEMO]' : '';
      const status = session.status && session.status !== 'COMPLETED' ? ' [INTERRUMPIDA]' : '';
      option.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${Number(session.distanceKm || 0).toFixed(2)} km${synthTag}${status}`;
      selector.appendChild(option);
    });
    selector.value = currentSession?.id || '';
    selector.addEventListener('change', () => {
      const session = sessions.find(item => item.id === selector.value);
      if (session) renderSession(session);
    });
    dateBadge.appendChild(selector);
  }

  if (currentSession) renderSession(currentSession);
  else {
    setMetric('#routeDate', 'No hay sesiones guardadas');
    if (exportBtn) exportBtn.disabled = true;
    if (weatherTimeline) weatherTimeline.textContent = 'Graba una ruta GPS para ver aquí sus datos reales.';
  }
  if (currentSession?.status === 'INTERRUPTED') {
    showMessage('Mostrando la última copia guardada de una ruta interrumpida.');
  }

  function escapeXml(value) {
    return String(value).replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]));
  }

  function makeGpx(session) {
    const points = (session.trackpoints || []).filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)));
    const trackPoints = points.map(point => {
      const elevation = point.altitudeM != null && Number.isFinite(Number(point.altitudeM)) ? `<ele>${Number(point.altitudeM).toFixed(1)}</ele>` : '';
      const time = Number.isFinite(Number(point.timestamp)) ? `<time>${new Date(Number(point.timestamp)).toISOString()}</time>` : '';
      return `<trkpt lat="${Number(point.lat).toFixed(7)}" lon="${Number(point.lng).toFixed(7)}">${elevation}${time}</trkpt>`;
    }).join('');
    const date = new Date(session.startedAt || session.date || Date.now()).toISOString();
    const isSynth = session.isSynthetic || session.isDemo;
    const creator = isSynth ? "Race Wars Tracker (Synthetic Demo)" : "Race Wars Tracker";
    const titleName = escapeXml(session.title || (isSynth ? 'Ruta Sintetica Demo' : 'Ruta Real Race Wars'));
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${titleName}</name><time>${date}</time></metadata><trk><name>${titleName}</name><trkseg>${trackPoints}</trkseg></trk></gpx>`;
  }

  function makeZip(files) {
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
    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  async function deliverFile(file) {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name });
      return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  if (exportBtn) exportBtn.addEventListener('click', async () => {
    if (!currentSession) return showMessage('No hay una sesión guardada para exportar.', true);
    const points = (currentSession.trackpoints || []).filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)));
    if (!points.length) return showMessage('Esta sesión no tiene puntos GPS exportables.', true);
    const label = exportBtn.querySelector('.export-main-label');
    const subLabel = exportBtn.querySelector('.export-sub-label');
    exportBtn.disabled = true;
    if (label) label.textContent = 'CREANDO ARCHIVO…';
    if (subLabel) subLabel.textContent = `INCLUYENDO ${points.length} PUNTOS GPS REALES`;
    if (progressBar) progressBar.style.width = '65%';
    try {
      const timestamp = new Date(currentSession.startedAt || currentSession.date || Date.now()).toISOString().replace(/[:.]/g, '-');
      const filename = `RaceWars_${timestamp}.zip`;
      const json = JSON.stringify(currentSession, null, 2);
      const zip = makeZip([
        { name: 'route.gpx', content: makeGpx(currentSession) },
        { name: 'session.json', content: json }
      ]);
      await deliverFile(new File([zip], filename, { type: 'application/zip' }));
      showMessage(`Exportación creada con ${points.length} puntos GPS reales.`);
    } catch (error) {
      if (error.name !== 'AbortError') showMessage(`No se pudo exportar la sesión: ${error.message || error}`, true);
    } finally {
      exportBtn.disabled = !currentSession || !((currentSession.trackpoints || []).length);
      if (label) label.textContent = 'EXPORTAR ZIP REAL';
      if (subLabel) subLabel.textContent = '(GPX GPS + TELEMETRÍA JSON)';
      if (progressBar) progressBar.style.width = '0%';
    }
  });
});
