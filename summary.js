// Race Wars Tracker - Post-Race Debrief & Export Engine (Freemium & Google Play)
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportZipBtn');
  const exportProgressBar = document.getElementById('exportProgressBar');
  const toastFeedback = document.getElementById('toastFeedback');
  const weatherCards = document.querySelectorAll('.weather-capture-card');
  const proStatusBtn = document.getElementById('proStatusBtn');
  const proStatusText = document.getElementById('proStatusText');
  let isExporting = false;

  // 0. Freemium Status Synchronization
  function updateProUI() {
    if (!window.ProManager) return;
    const isPro = window.ProManager.isPro();
    if (proStatusBtn && proStatusText) {
      if (isPro) {
        proStatusBtn.className = 'pro-status-pill is-pro';
        proStatusText.textContent = 'PRO VIP';
        // Hide lock badges on cards
        document.querySelectorAll('.pro-lock-badge').forEach(b => b.style.display = 'none');
      } else {
        proStatusBtn.className = 'pro-status-pill is-free';
        proStatusText.textContent = 'FREE';
        document.querySelectorAll('.pro-lock-badge').forEach(b => b.style.display = 'inline-flex');
      }
    }
  }

  if (proStatusBtn) {
    proStatusBtn.addEventListener('click', () => {
      if (window.ProManager) {
        window.ProManager.openPaywall('Administra tu suscripción Race Wars Pro');
      }
    });
  }

  window.addEventListener('racewars:pro_status_changed', updateProUI);
  updateProUI();

  // 1. CARGAR DATOS REALES DE LA SESIÓN GRABADA CON GPS
  const lastSessionRaw = localStorage.getItem('racewars_last_session');
  if (lastSessionRaw) {
    try {
      const session = JSON.parse(lastSessionRaw);
      console.log('[Summary] Cargando sesión GPS real:', session);

      const routeDistBadge = document.querySelector('.map-data-chip .chip-item.text-lime');
      if (routeDistBadge) routeDistBadge.innerHTML = `<b>DISTANCIA REAL:</b> ${session.distanceKm} KM`;

      const dateBadge = document.querySelector('.route-date-badge span');
      if (dateBadge && session.date) {
        const d = new Date(session.date);
        dateBadge.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      const avgSpeedNum = document.querySelector('.highlights-grid .hl-card:nth-child(1) .hl-num');
      if (avgSpeedNum && session.avgSpeedKmh !== undefined) avgSpeedNum.textContent = session.avgSpeedKmh;

      const topSpeedNum = document.querySelector('.highlights-grid .hl-card:nth-child(2) .hl-num');
      if (topSpeedNum && session.maxSpeedKmh !== undefined) topSpeedNum.textContent = session.maxSpeedKmh;

      const peakAltNum = document.querySelector('.highlights-grid .hl-card:nth-child(3) .hl-num');
      if (peakAltNum && session.peakAltitudeM !== undefined) peakAltNum.textContent = session.peakAltitudeM;

      const ascNum = document.querySelector('.highlights-grid .hl-card:nth-child(4) .hl-num');
      if (ascNum && session.elevationGainM !== undefined) ascNum.textContent = `+${session.elevationGainM}`;

      const descNum = document.querySelector('.highlights-grid .hl-card:nth-child(5) .hl-num');
      if (descNum && session.elevationLossM !== undefined) descNum.textContent = `-${session.elevationLossM}`;
    } catch (e) {
      console.warn('[Summary] Error cargando sesión:', e);
    }
  }

  // Weather Card Selection Interaction
  weatherCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const isPro = window.ProManager ? window.ProManager.isPro() : false;
      const requiresPro = card.dataset.proRequired === 'true';

      if (requiresPro && !isPro) {
        if (window.ProManager) {
          window.ProManager.openPaywall('Desbloquea telemetría meteorológica continua por kilómetro con PRO');
        }
        return;
      }

      weatherCards.forEach(c => c.classList.remove('active-inspect'));
      card.classList.add('active-inspect');
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    });
  });

  // Export ZIP Simulation (Free vs Pro)
  exportBtn.addEventListener('click', () => {
    if (isExporting) return;

    const isPro = window.ProManager ? window.ProManager.isPro() : false;

    isExporting = true;
    exportBtn.classList.add('exporting');
    const mainLabel = exportBtn.querySelector('.export-main-label');
    const subLabel = exportBtn.querySelector('.export-sub-label');
    
    mainLabel.textContent = 'EMPAQUETANDO...';
    subLabel.textContent = isPro ? 'GENERANDO ZIP HD OFICIAL (PRO)' : 'GENERANDO ZIP (FREE WATERMARK)';

    if (navigator.vibrate) {
      navigator.vibrate(60);
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      exportProgressBar.style.width = `${progress}%`;

      if (progress === 40) {
        subLabel.textContent = isPro ? 'RENDERIZANDO 4K STORY CARDS' : 'PROCESANDO CAPTURAS BÁSICAS';
      } else if (progress === 75) {
        subLabel.textContent = 'COMPRIMIENDO ZIP CON GPX';
      }

      if (progress >= 100) {
        clearInterval(interval);
        
        // Finalized
        mainLabel.textContent = '¡EXPORTADO!';
        subLabel.textContent = isPro ? 'DESCARGA PRO HD INICIADA' : 'DESCARGA FREE INICIADA';
        
        if (navigator.vibrate) {
          navigator.vibrate([80, 50, 80]);
        }

        // Show Toast
        if (isPro) {
          toastFeedback.textContent = '✓ Archivo HD generado sin marcas de agua (Licencia PRO Verificada)';
          toastFeedback.style.borderColor = '#ffdd00';
          toastFeedback.style.color = '#ffdd00';
        } else {
          toastFeedback.textContent = '✓ Archivo generado con marca de agua FREE. ¡Desbloquea PRO para exportación en 4K!';
          toastFeedback.style.borderColor = '#39ff14';
          toastFeedback.style.color = '#39ff14';
        }
        toastFeedback.classList.add('show');

        // Trigger dummy file download simulation
        simulateDownload(isPro ? 'RaceWars_Navacerrada_PRO_4K.zip' : 'RaceWars_Navacerrada_FREE.zip');

        setTimeout(() => {
          exportBtn.classList.remove('exporting');
          mainLabel.textContent = 'EXPORTAR ZIP';
          subLabel.textContent = '(GPX + TELEMETRÍA VISUAL)';
          exportProgressBar.style.width = '0%';
          isExporting = false;
        }, 3000);

        setTimeout(() => {
          toastFeedback.classList.remove('show');
        }, 4500);
      }
    }, 50);
  });

  function simulateDownload(filename) {
    const dummyBlob = new Blob(["Race Wars Tracker GPX & Visual Telemetry Package"], { type: 'application/zip' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dummyBlob);
    link.download = filename;
    document.body.appendChild(link);
    // Silent download simulation
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 1000);
  }
});
