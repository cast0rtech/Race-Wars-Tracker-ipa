// Race Wars Tracker - Real Telemetry & Cockpit Engine
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - 1. Bluetooth
  const btStatusBtn = document.getElementById('btStatusBtn');
  const btStateText = document.getElementById('btStateText');
  let isBtConnected = true;

  // DOM Elements - 2. Speedometer
  const mainSpeed = document.getElementById('mainSpeed');
  const maxSpeedTag = document.getElementById('maxSpeedTag');
  const speedRadialActive = document.getElementById('speedRadialActive');

  // DOM Elements - 3. Altimetry
  const altCanvas = document.getElementById('altimetryCanvas');
  const currentAlt = document.getElementById('currentAlt');
  const altMaxLbl = document.getElementById('altMaxLbl');
  const altMinLbl = document.getElementById('altMinLbl');
  const ctx = altCanvas.getContext('2d');

  // DOM Elements - 4. Three Satellite Cards
  const distanceVal = document.getElementById('distanceVal');
  const timeVal = document.getElementById('timeVal');
  const elevGainVal = document.getElementById('elevGainVal');
  const distBarFill = document.getElementById('distBarFill');

  // DOM Elements - 5. Manual Override Button
  const overrideBtn = document.getElementById('overrideBtn');
  const overrideText = document.getElementById('overrideText');
  const overrideSub = document.getElementById('overrideSub');
  const recStatusChip = document.getElementById('recStatusChip');

  // Aux controls
  const themeToggle = document.getElementById('themeToggle');
  const themeModalBtn = document.getElementById('themeModalBtn');
  const savedRoutesBtn = document.getElementById('savedRoutesBtn');
  const btMenuNavBtn = document.getElementById('btMenuNavBtn');

  // Weather Card Elements
  const weatherTempVal = document.getElementById('weatherTempVal');
  const weatherCondVal = document.getElementById('weatherCondVal');
  let lastWeatherFetch = 0;

  async function updateLiveWeather(lat, lon) {
    const now = Date.now();
    if (now - lastWeatherFetch < 600000) return;
    lastWeatherFetch = now;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const current = data.current || {};
        const temp = Math.round(current.temperature_2m ?? 18);
        const code = current.weather_code ?? 0;

        const condMap = {
          0: '☀️ DESPEJADO', 1: '🌤️ PARCIAL', 2: '⛅ NUBOSIDAD', 3: '☁️ NUBLADO',
          45: '🌫️ NIEBLA', 51: '🌧️ LLOVIZNA', 61: '🌧️ LLUVIA', 71: '❄️ NIEVE', 95: '⛈️ TORMENTA'
        };
        const condText = condMap[code] || '⛅ DESPEJADO';

        if (weatherTempVal) weatherTempVal.textContent = `${temp}°C`;
        if (weatherCondVal) weatherCondVal.textContent = condText;
      }
    } catch (err) {
      console.log('[Weather] Live update note:', err);
    }
  }

  // Initial Weather Location Check
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => updateLiveWeather(pos.coords.latitude, pos.coords.longitude),
      () => updateLiveWeather(40.4168, -3.7038),
      { timeout: 4000 }
    );
  } else {
    updateLiveWeather(40.4168, -3.7038);
  }

  // Haptic Feedback Helper
  function triggerHaptic(ms = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // Theme & Saved Routes Modals Trigger
  if (themeModalBtn) {
    themeModalBtn.addEventListener('click', () => {
      triggerHaptic(40);
      if (window.ThemeModal) window.ThemeModal.open();
    });
  }

  if (savedRoutesBtn) {
    savedRoutesBtn.addEventListener('click', () => {
      triggerHaptic(40);
      if (window.SavedRoutesModal) window.SavedRoutesModal.open();
    });
  }

  // Radial Gauge Calculation (0 - 240 KM/H)
  const maxDashOffset = 480;
  const minDashOffset = 150;
  function updateSpeedGauge(spd) {
    const clamped = Math.max(0, Math.min(240, spd));
    const ratio = clamped / 240;
    const offset = maxDashOffset - (ratio * (maxDashOffset - minDashOffset));
    speedRadialActive.style.strokeDashoffset = offset;
  }

  // Format Elapsed Time (MM:SS.d)
  function formatTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}<small>.${tenths}</small>`;
  }

  // THEME TOGGLE
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isRed = document.body.classList.toggle('theme-racing-red');
      themeToggle.innerHTML = isRed ? 'Tema: Racing Red' : 'Tema: Neón Verde';
      drawAltimetryGraph();
      triggerHaptic(60);
    });
  }

  // 1. GESTIÓN Y MENÚ DE BLUETOOTH DEL COCKPIT
  if (btStatusBtn) {
    btStatusBtn.addEventListener('click', () => {
      triggerHaptic(40);
      if (window.BluetoothMenu) {
        window.BluetoothMenu.open();
      }
    });
  }

  if (btMenuNavBtn) {
    btMenuNavBtn.addEventListener('click', () => {
      triggerHaptic(40);
      if (window.BluetoothMenu) {
        window.BluetoothMenu.open();
      }
    });
  }

  window.addEventListener('racewars:bluetooth_changed', (e) => {
    const btSettings = e.detail;
    isBtConnected = btSettings.isConnected;
    if (isBtConnected) {
      btStatusBtn.classList.remove('disconnected');
      btStatusBtn.classList.add('connected');
      btStateText.textContent = btSettings.selectedDevice ? btSettings.selectedDevice.substring(0, 12).toUpperCase() : 'CONECTADO';

      // Auto-inicio de ruta si el coche se conecta y está configurado
      if (btSettings.autoRecord && !telemetry.isRecording) {
        telemetry.startRecording();
        overrideBtn.classList.add('active-rec');
        overrideText.textContent = 'STOP RECORDING';
        overrideSub.textContent = `AUTO-ARRANQUE (${btSettings.selectedDevice})`;
        recStatusChip.classList.add('active-recording');
        recStatusChip.textContent = 'LIVE REC';
        if (window.ProPaywallModal) {
          window.ProPaywallModal.showToast(`⚡ Coche detectado (${btSettings.selectedDevice}): Grabación iniciada automáticamente.`);
        }
      }
    } else {
      btStatusBtn.classList.remove('connected');
      btStatusBtn.classList.add('disconnected');
      btStateText.textContent = 'INACTIVO';
    }
  });

  // Tocar el chip de estado GPS abre el gestor de permisos y sensores
  recStatusChip.addEventListener('click', () => {
    if (window.PermissionsModal) {
      window.PermissionsModal.open();
    }
  });

  // 2. INICIALIZAR MOTOR DE TELEMETRÍA DE HARDWARE REAL (GPS)
  const telemetry = new window.RealTelemetryEngine();

  // Escuchar estado del sensor GPS (Buscando / Activo / Error)
  telemetry.onStatusChange(({ text, state }) => {
    if (!telemetry.isRecording) {
      recStatusChip.textContent = text;
      if (state === 'active') {
        recStatusChip.style.color = 'var(--neon-lime)';
      } else if (state === 'searching') {
        recStatusChip.style.color = 'var(--neon-yellow)';
      } else {
        recStatusChip.style.color = 'var(--neon-red)';
      }
    } else {
      // Estado durante la grabación activa
      if (state === 'warning' || state === 'error') {
        recStatusChip.textContent = 'REC • SIN GPS (≤80 km/h)';
        recStatusChip.style.color = 'var(--neon-yellow)';
      } else if (state === 'active') {
        recStatusChip.textContent = 'LIVE REC';
        recStatusChip.style.color = '#ffffff';
      }
    }
  });

  // Actualización de la UI con datos REALES de los sensores
  telemetry.onUpdate((data) => {
    // 1. Velocímetro Real
    mainSpeed.textContent = data.speed;
    updateSpeedGauge(data.speed);
    maxSpeedTag.textContent = data.maxSpeed;

    // 1.5 Update weather if coordinates available
    if (data.lat && data.lng) {
      updateLiveWeather(data.lat, data.lng);
    }

    // 2. Distancia y Tiempo Real
    distanceVal.textContent = data.distanceKm.toFixed(2);
    timeVal.innerHTML = formatTime(data.elapsedMs);
    const progressTarget = Math.max(10, data.distanceKm + 5);
    distBarFill.style.width = `${Math.min(100, (data.distanceKm / progressTarget) * 100)}%`;

    // 3. Altitud y Desnivel Real
    currentAlt.textContent = data.altitudeAvailable ? `${data.currentAltitude} m` : '— m';
    elevGainVal.textContent = `+${data.elevationGain}`;

    // 4. Gráfico de Altimetría en vivo
    drawAltimetryGraph(data.altHistory);
  });

  // 3. DIBUJAR PERFIL DE ALTIMETRÍA EN CANVAS
  function drawAltimetryGraph(history = telemetry.altHistory) {
    const width = altCanvas.width;
    const height = altCanvas.height;
    ctx.clearRect(0, 0, width, height);

    const safeHistory = (history && history.length >= 2) ? history : [600, 600];
    const minAlt = Math.min(...safeHistory) - 10;
    const maxAlt = Math.max(...safeHistory) + 10;
    const altRange = Math.max(15, maxAlt - minAlt);

    // Update labels
    altMinLbl.textContent = `${Math.round(minAlt + 10)}m`;
    altMaxLbl.textContent = `${Math.round(maxAlt - 10)}m`;

    const isLightMode = document.body.classList.contains('theme-light') || document.documentElement.getAttribute('data-theme') === 'light';

    // Horizontal guideline
    ctx.strokeStyle = isLightMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Map points to canvas coordinates
    const stepX = width / (safeHistory.length - 1);
    const points = safeHistory.map((val, idx) => {
      const x = idx * stepX;
      const normalized = (val - minAlt) / altRange;
      const y = height - (normalized * (height - 18)) - 8;
      return { x, y };
    });

    const isRedTheme = document.body.classList.contains('theme-racing-red');
    const accentColor = isRedTheme ? '#ff1e44' : (isLightMode ? '#0284c7' : '#00e5ff');

    // 1. Fill Gradient below line
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    if (isLightMode) {
      grad.addColorStop(0, isRedTheme ? 'rgba(255, 30, 68, 0.25)' : 'rgba(2, 132, 199, 0.22)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0.01)');
    } else {
      grad.addColorStop(0, isRedTheme ? 'rgba(255, 30, 68, 0.35)' : 'rgba(0, 229, 255, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    ctx.lineTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Stroke Glowing Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    if (!isLightMode) {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Highlight Last Point (Current Vehicle Location)
    const lastP = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastP.x, lastP.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = isLightMode ? '#0f172a' : '#ffffff';
    if (!isLightMode) {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  window.addEventListener('racewars:theme_changed', () => {
    drawAltimetryGraph();
  });

  // 4. BOTÓN MANUAL OVERRIDE (START / STOP RECORDING)
  overrideBtn.addEventListener('click', async () => {
    triggerHaptic(75);

    if (!telemetry.isRecording) {
      // Iniciar grabación real
      telemetry.startRecording();
      overrideBtn.classList.add('active-rec');
      overrideText.textContent = 'STOP RECORDING';
      overrideSub.textContent = 'GRABANDO GPS • TOCAR PARA DETENER';
      recStatusChip.classList.add('active-recording');
      recStatusChip.textContent = 'LIVE REC';
      recStatusChip.style.color = '#ffffff';
    } else {
      // Detener grabación real y guardar sesión
      try {
        const savedSession = await telemetry.stopRecording();
        if (savedSession && savedSession.id) {
          // Navegar al resumen pasando SOLO el ID para forzar la lectura desde la base de datos
          window.location.href = `summary.html?session=${encodeURIComponent(savedSession.id)}`;
          return;
        }
      } catch (error) {
        console.error('[Telemetry] No se pudo guardar la sesión:', error);
      }
      overrideBtn.classList.remove('active-rec');
      overrideText.textContent = 'START ROUTE';
      overrideSub.textContent = 'PULSAR PARA REGISTRO';
      recStatusChip.classList.remove('active-recording');
      recStatusChip.textContent = 'STANDBY';
      recStatusChip.style.color = 'var(--neon-lime)';
    }
  });

  // Render inicial en reposo (0 km/h, esperando GPS)
  updateSpeedGauge(0);
  drawAltimetryGraph([500, 500]);
});
