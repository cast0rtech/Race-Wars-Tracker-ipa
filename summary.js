// Race Wars Tracker - Resumen de Telemetría y Mapa Real (Estilo Foto 2)
document.addEventListener('DOMContentLoaded', async () => {
  const exportBtn = document.getElementById('exportZipBtn');
  const openShareModalBtn = document.getElementById('openShareModalBtn');
  const progressBar = document.getElementById('exportProgressBar');
  const toast = document.getElementById('toastFeedback');
  const scrubber = document.getElementById('routeScrubber');
  const scrubberBadge = document.getElementById('scrubberBadge');
  const scrubSpeedEl = document.getElementById('scrubSpeed');
  const scrubAltEl = document.getElementById('scrubAlt');
  const scrubTimeEl = document.getElementById('scrubTime');
  const routeTagPill = document.getElementById('routeTagPill');
  const routeTagText = document.getElementById('routeTagText');
  const profileCanvas = document.getElementById('routeProfileCanvas');

  let map = null;
  let routePolyline = null;
  let startMarker = null;
  let endMarker = null;
  let vehicleMarker = null;
  let currentSession = null;
  let validPoints = [];

  // 1. Obtener sesión persistida
  const sessions = window.RaceWarsSessionStore ? await window.RaceWarsSessionStore.list() : [];
  const requestedId = new URLSearchParams(location.search).get('session');

  if (requestedId && window.RaceWarsSessionStore) {
    currentSession = await window.RaceWarsSessionStore.get(requestedId);
  } else {
    currentSession = sessions[0] || null;
  }

  // Fallback a localStorage si IndexedDB no tenía la sesión
  if (!currentSession) {
    try {
      const raw = localStorage.getItem('racewars_last_session');
      if (raw) currentSession = JSON.parse(raw);
    } catch (_) {}
  }

  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? '#ff465c' : '#2f80ed';
    toast.style.color = isError ? '#ff7675' : '#ffffff';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '0m 00s';
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }

  function formatDateHeading(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const dayName = days[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = months[dateObj.getMonth()];
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const mins = String(dateObj.getMinutes()).padStart(2, '0');
    return `${dayName} ${dayNum} ${monthName} ${hours}:${mins}`;
  }

  async function reverseGeocode(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const cacheKey = `rw_geo_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        let name = '';
        if (data.address) {
          const road = data.address.road || data.address.pedestrian || data.address.highway || data.address.street;
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.county;
          if (road && city) name = `${road}, ${city}`;
          else if (road) name = road;
          else if (city) name = city;
        }
        if (!name && data.display_name) {
          name = data.display_name.split(',').slice(0, 2).join(',').trim();
        }
        if (name) {
          localStorage.setItem(cacheKey, name);
          return name;
        }
      }
    } catch (_) {}

    // Fallback a coordenadas limpias e.g. "47.3769° N, 8.5417° E"
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
  }

  function initLeafletMap(points) {
    if (map) {
      map.remove();
      map = null;
    }

    const mapContainer = document.getElementById('summaryMap');
    if (!mapContainer || typeof L === 'undefined') return;

    // Crear mapa
    map = L.map('summaryMap', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false
    });

    // Capa de mapa base en modo oscuro CartoDB Dark Matter (Estilo Foto 2)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    if (!points || points.length === 0) {
      map.setView([40.4168, -3.7038], 5);
      return;
    }

    const latLngs = points.map(p => [
      p.lat !== undefined ? Number(p.lat) : Number(p.latitude),
      p.lng !== undefined ? Number(p.lng) : (p.lon !== undefined ? Number(p.lon) : Number(p.longitude))
    ]);

    // 1. Trazado azul eléctrico de la carretera (Estilo Foto 2)
    // Capa de fondo sutil (glowing aura)
    L.polyline(latLngs, {
      color: '#0052cc',
      weight: 7,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Trazado azul principal nítido
    routePolyline = L.polyline(latLngs, {
      color: '#2f80ed',
      weight: 4.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // 2. Marcador de Salida (Gris/Plata con centro blanco, Foto 2)
    const firstPoint = latLngs[0];
    const startPinHtml = `
      <div class="custom-pin-start">
        <div class="pin-inner-grey"></div>
      </div>
    `;
    const startIcon = L.divIcon({
      className: '',
      html: startPinHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    startMarker = L.marker(firstPoint, { icon: startIcon, zIndexOffset: 500 }).addTo(map);

    // 3. Marcador de Meta (Pin rojo de destino, Foto 2)
    const lastPoint = latLngs[latLngs.length - 1];
    const endPinHtml = `
      <div class="custom-pin-end">
        <div class="pin-inner-red"></div>
      </div>
    `;
    const endIcon = L.divIcon({
      className: '',
      html: endPinHtml,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });
    endMarker = L.marker(lastPoint, { icon: endIcon, zIndexOffset: 600 }).addTo(map);

    // 4. Marcador del vehículo para el scrubber interactivo
    const vehicleHtml = `
      <div class="custom-pin-vehicle">
        <div class="vehicle-pulse-dot"></div>
      </div>
    `;
    const vehicleIcon = L.divIcon({
      className: '',
      html: vehicleHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    vehicleMarker = L.marker(firstPoint, { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);

    // Ajustar vista del mapa para encuadrar la ruta perfectamente con padding
    if (latLngs.length > 1) {
      map.fitBounds(routePolyline.getBounds(), {
        padding: [35, 35],
        maxZoom: 16
      });
    } else {
      map.setView(firstPoint, 15);
    }
  }

  function drawProfileChart(points, scrubIndex = 0) {
    if (!profileCanvas) return;
    const ctx = profileCanvas.getContext('2d');
    const width = profileCanvas.width = profileCanvas.clientWidth || 560;
    const height = profileCanvas.height = profileCanvas.clientHeight || 120;

    ctx.clearRect(0, 0, width, height);

    if (!points || points.length < 2) {
      // Línea neutra si no hay puntos
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, height / 2);
      ctx.lineTo(width - 10, height / 2);
      ctx.stroke();
      return;
    }

    const elevations = points.map(p => {
      const a = p.altitudeM ?? p.altitude;
      return (a != null && Number.isFinite(Number(a))) ? Number(a) : 0;
    });

    const minAlt = Math.min(...elevations);
    const maxAlt = Math.max(...elevations);
    const altRange = Math.max(10, maxAlt - minAlt);

    const padTop = 15;
    const padBottom = 15;
    const chartHeight = height - padTop - padBottom;

    // Crear gradiente azul estilo Foto 2
    const grad = ctx.createLinearGradient(0, padTop, 0, height);
    grad.addColorStop(0, 'rgba(47, 128, 237, 0.45)');
    grad.addColorStop(0.6, 'rgba(47, 128, 237, 0.15)');
    grad.addColorStop(1, 'rgba(47, 128, 237, 0.0)');

    // Dibujar área bajo la curva
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * (width - 20) + 10;
      const y = padTop + chartHeight - ((elevations[i] - minAlt) / altRange) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(width - 10, height);
    ctx.lineTo(10, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Dibujar trazo superior
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * (width - 20) + 10;
      const y = padTop + chartHeight - ((elevations[i] - minAlt) / altRange) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#2f80ed';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Línea indicadora del scrubber actual
    if (scrubIndex >= 0 && scrubIndex < points.length) {
      const scrubX = (scrubIndex / (points.length - 1)) * (width - 20) + 10;
      const scrubY = padTop + chartHeight - ((elevations[scrubIndex] - minAlt) / altRange) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(scrubX, padTop);
      ctx.lineTo(scrubX, height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Punto indicador
      ctx.beginPath();
      ctx.arc(scrubX, scrubY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00d2ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
  }

  function updateScrubberInfo(index) {
    if (!validPoints || validPoints.length === 0) return;
    const pt = validPoints[index];
    if (!pt) return;

    const lat = pt.lat !== undefined ? Number(pt.lat) : Number(pt.latitude);
    const lng = pt.lng !== undefined ? Number(pt.lng) : (pt.lon !== undefined ? Number(pt.lon) : Number(pt.longitude));

    if (vehicleMarker && Number.isFinite(lat) && Number.isFinite(lng)) {
      vehicleMarker.setLatLng([lat, lng]);
    }

    const spd = pt.speedKmh !== undefined ? Number(pt.speedKmh) : ((pt.speed || 0) * 3.6);
    const alt = pt.altitudeM ?? pt.altitude ?? 0;
    const ts = pt.timestamp || (currentSession?.startedAt ? currentSession.startedAt + index * 1000 : Date.now());
    const dateObj = new Date(ts);

    if (scrubSpeedEl) scrubSpeedEl.textContent = `${Math.round(spd)} km/h`;
    if (scrubAltEl) scrubAltEl.textContent = `${Math.round(alt)} m`;
    if (scrubTimeEl) scrubTimeEl.textContent = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    drawProfileChart(validPoints, index);
  }

  async function renderSession(session) {
    if (!session) {
      document.getElementById('summaryRouteTitle').textContent = 'Sin rutas guardadas';
      return;
    }

    // 1. Sanitizar y recalcular métricas con sessionStore
    if (window.RaceWarsSessionStore && typeof window.RaceWarsSessionStore.sanitizeSession === 'function') {
      const { session: clean } = window.RaceWarsSessionStore.sanitizeSession(session);
      session = clean;
    }

    currentSession = session;

    // Filtrar puntos válidos
    validPoints = (session.trackpoints || []).filter(p => {
      const lat = p.lat !== undefined ? Number(p.lat) : Number(p.latitude);
      const lon = p.lng !== undefined ? Number(p.lng) : (p.lon !== undefined ? Number(p.lon) : Number(p.longitude));
      return Number.isFinite(lat) && Number.isFinite(lon);
    });

    const startDate = new Date(session.startedAt || Date.parse(session.date) || Date.now());
    const endDate = new Date(session.endedAt || (startDate.getTime() + (session.durationMs || 0)));

    // 2. Actualizar Título y Tag
    document.getElementById('summaryRouteTitle').textContent = session.title || `Ruta GPS ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (session.tag && routeTagText) {
      routeTagText.textContent = session.tag;
    }

    // 3. Chip de Puntos
    const pointsCountEl = document.getElementById('routePointCount');
    if (pointsCountEl) {
      pointsCountEl.textContent = `${validPoints.length} PUNTOS`;
    }

    // 4. Hero KPIs (Distancia y Duración en grande, Foto 2)
    const distNum = Number(session.distanceKm || 0).toFixed(2).replace('.', ',');
    const durationStr = formatDuration(session.durationMs || (endDate - startDate));

    document.getElementById('primaryDistance').textContent = `${distNum} km`;
    document.getElementById('primaryDuration').textContent = durationStr;

    // 5. Highlights Grid
    document.getElementById('avgSpeedNum').textContent = Math.round(session.avgSpeedKmh || 0);
    document.getElementById('maxSpeedNum').textContent = Math.round(session.maxSpeedKmh || 0);
    document.getElementById('peakAltNum').textContent = session.peakAltitudeM != null ? Math.round(session.peakAltitudeM) : '—';
    document.getElementById('gainAltNum').textContent = session.elevationGainM != null ? `+${Math.round(session.elevationGainM)}` : '+0';
    document.getElementById('lossAltNum').textContent = session.elevationLossM != null ? `-${Math.round(session.elevationLossM)}` : '-0';

    // 6. Timestamps de Salida y Meta
    document.getElementById('startWaypointTime').textContent = formatDateHeading(startDate);
    document.getElementById('endWaypointTime').textContent = formatDateHeading(endDate);

    // 7. Direcciones de Waypoints
    const startAddrEl = document.getElementById('startWaypointAddress');
    const endAddrEl = document.getElementById('endWaypointAddress');

    if (validPoints.length > 0) {
      const pStart = validPoints[0];
      const pEnd = validPoints[validPoints.length - 1];
      const latStart = pStart.lat !== undefined ? Number(pStart.lat) : Number(pStart.latitude);
      const lonStart = pStart.lng !== undefined ? Number(pStart.lng) : (pStart.lon !== undefined ? Number(pStart.lon) : Number(pStart.longitude));
      const latEnd = pEnd.lat !== undefined ? Number(pEnd.lat) : Number(pEnd.latitude);
      const lonEnd = pEnd.lng !== undefined ? Number(pEnd.lng) : (pEnd.lon !== undefined ? Number(pEnd.lon) : Number(pEnd.longitude));

      // Usar nombres cacheados en la sesión si existen
      if (session.startLocationName) {
        startAddrEl.textContent = session.startLocationName;
      } else {
        reverseGeocode(latStart, lonStart).then(name => {
          if (name) {
            startAddrEl.textContent = name;
            session.startLocationName = name;
            if (window.RaceWarsSessionStore) window.RaceWarsSessionStore.save(session).catch(() => {});
          }
        });
      }

      if (session.endLocationName) {
        endAddrEl.textContent = session.endLocationName;
      } else {
        reverseGeocode(latEnd, lonEnd).then(name => {
          if (name) {
            endAddrEl.textContent = name;
            session.endLocationName = name;
            if (window.RaceWarsSessionStore) window.RaceWarsSessionStore.save(session).catch(() => {});
          }
        });
      }
    } else {
      startAddrEl.textContent = 'Sin datos de localización';
      endAddrEl.textContent = 'Sin datos de localización';
    }

    // 8. Inicializar Mapa Leaflet Real
    initLeafletMap(validPoints);

    // 9. Dibujar Perfil Gráfico
    drawProfileChart(validPoints, 0);

    const profileBadge = document.getElementById('profileGraphBadge');
    if (profileBadge) {
      const peak = session.peakAltitudeM ? `${Math.round(session.peakAltitudeM)}m` : '0m';
      profileBadge.textContent = `${distNum} km · ${peak}`;
    }

    // 10. Configurar Scrubber Slider
    if (scrubber) {
      scrubber.value = 0;
      scrubber.oninput = (e) => {
        if (!validPoints.length) return;
        const progress = Number(e.target.value);
        const idx = Math.min(validPoints.length - 1, Math.floor((progress / 100) * validPoints.length));
        updateScrubberInfo(idx);
      };
      if (validPoints.length > 0) {
        updateScrubberInfo(0);
      }
    }
  }

  // Interacción con Tag Pill para cambiar etiqueta (ej. Roadtrip 2026 -> Tramo Nocturno -> Race Track)
  if (routeTagPill) {
    routeTagPill.addEventListener('click', async () => {
      if (!currentSession) return;
      const current = routeTagText.textContent;
      const options = ['Roadtrip 2026', 'Carrera Nocturna', 'Tramo Montaña', 'Prueba de Telemetría', 'Ruta Diaria'];
      const nextIdx = (options.indexOf(current) + 1) % options.length;
      const nextTag = options[nextIdx];
      routeTagText.textContent = nextTag;
      currentSession.tag = nextTag;
      if (window.RaceWarsSessionStore) {
        await window.RaceWarsSessionStore.save(currentSession).catch(() => {});
      }
      showToast(`🏷️ Categoría actualizada: ${nextTag}`);
    });
  }

  // Abrir modal de exportación GPX/KML al pulsar el botón principal o el menú de tres puntos
  function openExportModal() {
    if (!currentSession) {
      showToast('No hay ninguna sesión para exportar', true);
      return;
    }
    if (window.GpxShareModal) {
      window.GpxShareModal.open(currentSession);
    } else {
      showToast('Cargando módulo de exportación...');
    }
  }

  if (exportBtn) exportBtn.addEventListener('click', openExportModal);
  if (openShareModalBtn) openShareModalBtn.addEventListener('click', openExportModal);

  // Cargar sesión inicial
  await renderSession(currentSession);
});
