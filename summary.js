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

    if (session.title) {
      setMetric('.summary-main-title', session.title);
    }
    const isRoadtrip = session.isRoadtrip || (session.id && session.id.startsWith('roadtrip_'));
    if (typeBadge) {
      if (isRoadtrip) {
        typeBadge.style.display = 'block';
        typeBadge.style.borderColor = '#00e5ff';
        typeBadge.style.color = '#00e5ff';
        typeBadge.style.background = 'rgba(0, 229, 255, 0.15)';
        typeBadge.textContent = `🗺️ ROADTRIP COMBINADO · ${(session.mergedRouteIds || []).length} RUTAS FUSIONADAS EN TRAYECTO UNIFICADO`;
      } else if (isSynth) {
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

    async function renderWeatherTimeline(session) {
      if (!weatherTimeline) return;
      weatherTimeline.replaceChildren();

      const points = (session.trackpoints || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
      if (points.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Sin datos GPS para consultar el tiempo.';
        weatherTimeline.appendChild(p);
        return;
      }

      const indices = [...new Set([0, Math.floor(points.length * 0.33), Math.floor(points.length * 0.66), points.length - 1])];

      for (let i = 0; i < indices.length; i++) {
        const pt = points[indices[i]];
        const card = document.createElement('div');
        card.className = 'weather-capture-card';

        const label = i === 0 ? 'SALIDA' : (i === indices.length - 1 ? 'META' : `TRAMO ${i}`);
        const ptTime = new Date(Number(pt.timestamp || session.startedAt || Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let temp = 18;
        let condIcon = '⛅';
        let hum = '65%';

        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(pt.lat).toFixed(4)}&longitude=${Number(pt.lng).toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code`);
          if (res.ok) {
            const data = await res.json();
            const curr = data.current || {};
            temp = Math.round(curr.temperature_2m ?? 18);
            hum = `${Math.round(curr.relative_humidity_2m ?? 65)}%`;
            const code = curr.weather_code ?? 0;
            const iconMap = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌧️', 61: '🌧️', 71: '❄️', 95: '⛈️' };
            condIcon = iconMap[code] || '⛅';
          }
        } catch (_) {}

        card.innerHTML = `
          <div class="capture-map-frame">
            <div class="mini-map-preview map-thumb-${(i % 4) + 1}"></div>
            <span class="snap-badge">${label}</span>
          </div>
          <div class="capture-info">
            <span class="capture-time">${ptTime}</span>
            <div class="weather-condition-row">
              <span class="w-icon">${condIcon}</span>
              <div class="w-metrics">
                <span class="w-temp">${temp}°C</span>
                <span class="w-hum">H: ${hum}</span>
              </div>
            </div>
          </div>
        `;

        weatherTimeline.appendChild(card);
      }
    }

    renderWeatherTimeline(session);

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

  if (exportBtn) exportBtn.addEventListener('click', () => {
    if (!currentSession) return showMessage('No hay una sesión guardada para exportar.', true);
    const points = (currentSession.trackpoints || []).filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)));
    if (!points.length) return showMessage('Esta sesión no tiene puntos GPS exportables.', true);
    if (window.GpxShareModal) {
      window.GpxShareModal.open(currentSession);
    }
  });
});
