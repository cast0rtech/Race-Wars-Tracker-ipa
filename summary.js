// Race Wars Tracker - session-backed summary and real GPX/ZIP export.
document.addEventListener('DOMContentLoaded', async () => {
  const exportBtn = document.getElementById('exportZipBtn');
  const progressBar = document.getElementById('exportProgressBar');
  const toast = document.getElementById('toastFeedback');
  const weatherTimeline = document.getElementById('weatherTimeline');
  const routeTrack = document.getElementById('routeTrack');
  
  const sessions = window.RaceWarsSessionStore ? await window.RaceWarsSessionStore.list() : [];
  const requestedId = new URLSearchParams(location.search).get('session');
  
  let currentSession = null;
  let isNotFoundError = false;

  // 1. Consulta estricta por ID persistido (Fuente única de verdad)
  if (requestedId) {
    if (window.RaceWarsSessionStore) {
      currentSession = await window.RaceWarsSessionStore.get(requestedId);
    }
    if (!currentSession) {
      isNotFoundError = true;
    }
  } else {
    currentSession = sessions[0] || null;
  }

  function showMessage(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? '#ff465c' : '#39ff14';
    toast.style.color = isError ? '#ff465c' : '#39ff14';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  }

  function setMetric(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderNotFoundState(id) {
    setMetric('.summary-main-title', 'Ruta no encontrada');
    setMetric('#routeDate', `ID: ${id}`);
    setMetric('#routeDistance', 'DISTANCIA: — KM');
    setMetric('#routePointCount', 'TRAZADO GPS: ERROR (NO ENCONTRADA)');
    
    setMetric('.highlights-grid .hl-card:nth-child(1) .hl-num', '—');
    setMetric('.highlights-grid .hl-card:nth-child(2) .hl-num', '—');
    setMetric('.highlights-grid .hl-card:nth-child(3) .hl-num', '—');
    setMetric('.highlights-grid .hl-card:nth-child(4) .hl-num', '—');
    setMetric('.highlights-grid .hl-card:nth-child(5) .hl-num', '—');

    const typeBadge = document.getElementById('routeTypeBadge');
    if (typeBadge) {
      typeBadge.style.display = 'block';
      typeBadge.style.borderColor = '#ff465c';
      typeBadge.style.color = '#ff465c';
      typeBadge.style.background = 'rgba(255, 70, 92, 0.15)';
      typeBadge.textContent = `❌ ERROR: No se encontró la ruta en disco (ID: ${id})`;
    }

    if (routeTrack) routeTrack.setAttribute('points', '');
    if (weatherTimeline) {
      weatherTimeline.innerHTML = `<p style="color: #ff465c;">No se encontró la ruta con ID <code>${id}</code> en el almacenamiento local.</p>`;
    }
    if (exportBtn) exportBtn.disabled = true;

    showMessage(`No se encontró la ruta con ID: ${id}`, true);
  }

  function renderEmptyState() {
    setMetric('#routeDate', 'No hay sesiones guardadas');
    setMetric('#routeDistance', 'DISTANCIA: 0.00 KM');
    setMetric('#routePointCount', 'TRAZADO GPS: 0 PUNTOS');
    if (exportBtn) exportBtn.disabled = true;
    if (weatherTimeline) weatherTimeline.textContent = 'Graba una ruta GPS para ver aquí sus datos reales.';
  }

  function renderSession(session) {
    if (window.RaceWarsSessionStore && typeof window.RaceWarsSessionStore.sanitizeSession === 'function') {
      const { session: clean, modified } = window.RaceWarsSessionStore.sanitizeSession(session);
      session = clean;
      if (modified) {
        window.RaceWarsSessionStore.save(session).catch(() => {});
      }
    } else if (session && (session.maxSpeedKmh > 350 || session.maxSpeedKmh <= 0)) {
      const valid = (session.trackpoints || [])
        .map(p => Number(p.speedKmh || 0))
        .filter(s => Number.isFinite(s) && s > 0 && s <= 350);
      if (valid.length > 0) {
        session.maxSpeedKmh = Math.round(Math.max(...valid));
      } else if (session.maxSpeedKmh > 350) {
        session.maxSpeedKmh = session.avgSpeedKmh ? Math.round(session.avgSpeedKmh * 1.35) : 120;
      }
    }

    currentSession = session;
    const getLat = p => (p && p.lat !== undefined ? Number(p.lat) : Number(p?.latitude));
    const getLng = p => (p && p.lng !== undefined ? Number(p.lng) : (p?.lon !== undefined ? Number(p?.lon) : Number(p?.longitude)));
    const isValidPoint = p => Number.isFinite(getLat(p)) && Number.isFinite(getLng(p));
    const points = (session.trackpoints || []).filter(isValidPoint);
    const start = session.startedAt || Date.parse(session.date) || Date.now();
    const date = new Date(start);
    setMetric('#routeDate', `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setMetric('#routeDistance', `DISTANCIA: ${Number(session.distanceKm || 0).toFixed(2)} KM`);
    
    // Distinción específica entre 0 puntos vs ruta con puntos
    if (points.length === 0) {
      setMetric('#routePointCount', 'TRAZADO GPS: 0 PUNTOS (LA RUTA NO TIENE PUNTOS)');
    } else {
      setMetric('#routePointCount', `TRAZADO GPS: ${points.length} PUNTOS`);
    }

    setMetric('.highlights-grid .hl-card:nth-child(1) .hl-num', Math.round(session.avgSpeedKmh || 0));
    setMetric('.highlights-grid .hl-card:nth-child(2) .hl-num', Math.round(session.maxSpeedKmh || 0));
    setMetric('.highlights-grid .hl-card:nth-child(3) .hl-num', session.peakAltitudeM == null ? '—' : Math.round(session.peakAltitudeM));
    setMetric('.highlights-grid .hl-card:nth-child(4) .hl-num', session.elevationGainM == null ? '—' : `+${Math.round(session.elevationGainM)}`);
    setMetric('.highlights-grid .hl-card:nth-child(5) .hl-num', session.elevationLossM == null ? '—' : `-${Math.round(session.elevationLossM)}`);

    if (session.title) {
      setMetric('.summary-main-title', session.title);
    }
    const isRoadtrip = session.isRoadtrip || (session.id && session.id.startsWith('roadtrip_'));
    const typeBadge = document.getElementById('routeTypeBadge');
    if (typeBadge) {
      if (points.length === 0) {
        typeBadge.style.display = 'block';
        typeBadge.style.borderColor = '#ff9900';
        typeBadge.style.color = '#ff9900';
        typeBadge.style.background = 'rgba(255, 153, 0, 0.15)';
        typeBadge.textContent = '⚠️ LA RUTA NO TIENE PUNTOS GPS REGISTRADOS';
      } else if (isRoadtrip) {
        typeBadge.style.display = 'block';
        typeBadge.style.borderColor = '#00e5ff';
        typeBadge.style.color = '#00e5ff';
        typeBadge.style.background = 'rgba(0, 229, 255, 0.15)';
        typeBadge.textContent = `🗺️ ROADTRIP COMBINADO · ${(session.mergedRouteIds || []).length} RUTAS FUSIONADAS EN TRAYECTO UNIFICADO`;
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
      const lats = points.map(getLat);
      const lngs = points.map(getLng);
      const minLat = lats.reduce((a, b) => Math.min(a, b), Infinity);
      const maxLat = lats.reduce((a, b) => Math.max(a, b), -Infinity);
      const minLng = lngs.reduce((a, b) => Math.min(a, b), Infinity);
      const maxLng = lngs.reduce((a, b) => Math.max(a, b), -Infinity);
      const project = (point) => {
        const x = 20 + ((getLng(point) - minLng) / Math.max(1e-9, maxLng - minLng)) * 360;
        const y = 15 + ((maxLat - getLat(point)) / Math.max(1e-9, maxLat - minLat)) * 180;
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

      const points = (session.trackpoints || []).filter(isValidPoint);
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
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(getLat(pt)).toFixed(4)}&longitude=${Number(getLng(pt)).toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code`);
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
    if (points.length === 0) showMessage('La sesión guardada no contiene puntos GPS registrados.', true);
  }

  // Desplegable de selección de sesión (si hay más de una)
  const dateBadge = document.querySelector('.route-date-badge');
  if (dateBadge && sessions.length > 1) {
    const selector = document.createElement('select');
    selector.setAttribute('aria-label', 'Seleccionar sesión guardada');
    selector.style.cssText = 'display:block;max-width:260px;margin-top:6px;background:#111820;color:#dbe8ed;border:1px solid #38434a;border-radius:5px;padding:4px;font:inherit';
    sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      const date = new Date(session.startedAt || session.date);
      const status = session.status && session.status !== 'COMPLETED' ? ' [INTERRUMPIDA]' : '';
      option.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${Number(session.distanceKm || 0).toFixed(2)} km${status}`;
      selector.appendChild(option);
    });
    selector.value = currentSession?.id || '';
    selector.addEventListener('change', () => {
      const session = sessions.find(item => item.id === selector.value);
      if (session) renderSession(session);
    });
    dateBadge.appendChild(selector);
  }

  // 2. Ejecutar render según el resultado de la consulta
  if (isNotFoundError) {
    renderNotFoundState(requestedId);
  } else if (currentSession) {
    renderSession(currentSession);
    if (currentSession?.status === 'INTERRUPTED') {
      showMessage('Mostrando la última copia guardada de una ruta interrumpida.');
    }
  } else {
    renderEmptyState();
  }

  if (exportBtn) exportBtn.addEventListener('click', () => {
    if (!currentSession) return showMessage('No hay una sesión guardada para exportar.', true);
    const getLat = p => (p && p.lat !== undefined ? Number(p.lat) : Number(p?.latitude));
    const getLng = p => (p && p.lng !== undefined ? Number(p.lng) : (p?.lon !== undefined ? Number(p?.lon) : Number(p?.longitude)));
    const points = (currentSession.trackpoints || []).filter(p => Number.isFinite(getLat(p)) && Number.isFinite(getLng(p)));
    if (!points.length) return showMessage('Esta sesión no tiene puntos GPS exportables.', true);
    if (window.GpxShareModal) {
      window.GpxShareModal.open(currentSession);
    }
  });
});
