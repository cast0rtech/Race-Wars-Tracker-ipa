// Race Wars Tracker - Off-Screen Weather Card Renderer & Export Engine
document.addEventListener('DOMContentLoaded', () => {
  const presetSelector = document.getElementById('presetSelector');
  const tempDigits = document.getElementById('tempDigits');
  const speedNum = document.getElementById('speedNum');
  const altNum = document.getElementById('altNum');
  const timestampNum = document.getElementById('timestampNum');
  const kmTag = document.getElementById('kmTag');
  const weatherIconBox = document.getElementById('weatherIconBox');
  const renderCanvasBtn = document.getElementById('renderCanvasBtn');
  const exportCanvas = document.getElementById('exportCanvas');
  const proStatusBtn = document.getElementById('proStatusBtn');
  const proStatusText = document.getElementById('proStatusText');
  const cardMetaTag = document.getElementById('cardMetaTag');

  // Freemium Status Synchronization
  function updateProUI() {
    if (!window.ProManager) return;
    const isPro = window.ProManager.isPro();
    if (proStatusBtn && proStatusText) {
      if (isPro) {
        proStatusBtn.className = 'pro-status-pill is-pro';
        proStatusText.textContent = 'PRO VIP';
        if (cardMetaTag) {
          cardMetaTag.innerHTML = '★ RACE WARS PRO';
          cardMetaTag.style.color = '#ffdd00';
        }
      } else {
        proStatusBtn.className = 'pro-status-pill is-free';
        proStatusText.textContent = 'FREE';
        if (cardMetaTag) {
          cardMetaTag.textContent = 'RACE WARS TRACKER';
          cardMetaTag.style.color = '';
        }
      }
    }
  }

  if (proStatusBtn) {
    proStatusBtn.addEventListener('click', () => {
      if (window.ProManager) {
        window.ProManager.openPaywall('Desbloquea exportación 4K sin marcas de agua con Race Wars PRO');
      }
    });
  }

  window.addEventListener('racewars:pro_status_changed', updateProUI);
  updateProUI();

  // Meteorological Presets Data
  const presets = {
    rain: {
      temp: '14',
      speed: '168',
      alt: '1,280',
      time: '17:42:18',
      km: '• KM 24.8',
      svg: `
        <svg class="weather-svg" viewBox="0 0 160 140" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path class="cloud-path" d="M 40,85 C 24,85 16,72 22,58 C 26,48 38,44 46,46 C 52,26 72,16 94,22 C 112,27 122,44 120,60 C 134,62 144,74 140,88 C 136,98 124,102 114,100 L 42,100" />
          <g class="raindrops-group" stroke-width="3">
            <path class="drop d1" d="M 46,112 L 40,126" />
            <path class="drop d2" d="M 70,112 L 64,126" />
            <path class="drop d3" d="M 94,112 L 88,126" />
            <path class="drop d4" d="M 118,112 L 112,126" />
          </g>
        </svg>
      `
    },
    sun: {
      temp: '22',
      speed: '194',
      alt: '640',
      time: '16:15:04',
      km: '• KM 08.4',
      svg: `
        <svg class="weather-svg" viewBox="0 0 160 140" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="80" cy="70" r="28" stroke="#ffdd00" stroke-width="4" fill="rgba(255, 221, 0, 0.1)" />
          <g stroke="#ffdd00" stroke-width="3.5" filter="drop-shadow(0 0 8px rgba(255, 221, 0, 0.6))">
            <line x1="80" y1="22" x2="80" y2="34" />
            <line x1="80" y1="106" x2="80" y2="118" />
            <line x1="32" y1="70" x2="44" y2="70" />
            <line x1="116" y1="70" x2="128" y2="70" />
            <line x1="46" y1="36" x2="55" y2="45" />
            <line x1="105" y1="95" x2="114" y2="104" />
            <line x1="46" y1="104" x2="55" y2="95" />
            <line x1="105" y1="45" x2="114" y2="36" />
          </g>
        </svg>
      `
    },
    storm: {
      temp: '11',
      speed: '118',
      alt: '1,420',
      time: '18:02:45',
      km: '• KM 32.1',
      svg: `
        <svg class="weather-svg" viewBox="0 0 160 140" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path class="cloud-path" d="M 40,85 C 24,85 16,72 22,58 C 26,48 38,44 46,46 C 52,26 72,16 94,22 C 112,27 122,44 120,60 C 134,62 144,74 140,88 C 136,98 124,102 114,100 L 42,100" />
          <polygon points="76,96 64,116 80,116 72,136 94,110 78,110" fill="#ffdd00" stroke="#ffdd00" stroke-width="2" filter="drop-shadow(0 0 10px #ffdd00)" />
        </svg>
      `
    },
    snow: {
      temp: '-2',
      speed: '74',
      alt: '1,890',
      time: '18:35:10',
      km: '• KM 39.6',
      svg: `
        <svg class="weather-svg" viewBox="0 0 160 140" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path class="cloud-path" d="M 40,85 C 24,85 16,72 22,58 C 26,48 38,44 46,46 C 52,26 72,16 94,22 C 112,27 122,44 120,60 C 134,62 144,74 140,88 C 136,98 124,102 114,100 L 42,100" />
          <g stroke="#00f0ff" stroke-width="2.5" filter="drop-shadow(0 0 6px #00f0ff)">
            <circle cx="56" cy="118" r="4" fill="#00f0ff" />
            <circle cx="80" cy="122" r="4" fill="#00f0ff" />
            <circle cx="104" cy="118" r="4" fill="#00f0ff" />
          </g>
        </svg>
      `
    },
    fog: {
      temp: '09',
      speed: '88',
      alt: '1,150',
      time: '17:12:30',
      km: '• KM 18.2',
      svg: `
        <svg class="weather-svg" viewBox="0 0 160 140" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path class="cloud-path" d="M 40,75 C 24,75 16,62 22,48 C 26,38 38,34 46,36 C 52,16 72,6 94,12 C 112,17 122,34 120,50 C 134,52 144,64 140,78 C 136,88 124,92 114,90 L 42,90" />
          <g stroke="rgba(255,255,255,0.7)" stroke-width="3.5">
            <line x1="35" y1="104" x2="125" y2="104" />
            <line x1="45" y1="116" x2="115" y2="116" />
            <line x1="55" y1="128" x2="105" y2="128" />
          </g>
        </svg>
      `
    }
  };

  // Change Preset Listener
  presetSelector.addEventListener('change', (e) => {
    const p = presets[e.target.value];
    if (!p) return;

    tempDigits.textContent = p.temp;
    speedNum.textContent = p.speed;
    altNum.textContent = p.alt;
    timestampNum.textContent = p.time;
    kmTag.textContent = p.km;
    weatherIconBox.innerHTML = p.svg;
  });

  // Export Full 1080x1920 Image via Canvas
  renderCanvasBtn.addEventListener('click', () => {
    const ctx = exportCanvas.getContext('2d');
    const width = 1080;
    const height = 1920;

    // 1. Solid Dark Background
    ctx.fillStyle = '#06080b';
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient Glow
    const radGrad = ctx.createRadialGradient(width / 2, 400, 50, width / 2, 400, 500);
    radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
    radGrad.addColorStop(1, 'rgba(6, 8, 11, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Card Frosted Glass Base
    const pad = 60;
    const cardW = width - pad * 2;
    const cardH = height - pad * 2;
    const radius = 64;

    ctx.save();
    roundRect(ctx, pad, pad, cardW, cardH, radius);
    ctx.fillStyle = 'rgba(16, 22, 32, 0.8)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();
    ctx.restore();

    // 4. Header Watermark
    ctx.font = '700 32px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('RACE WARS TRACKER // TELEMETRY SNAPSHOT', width / 2, 170);

    // 5. Weather Temperature
    const curP = presets[presetSelector.value];
    ctx.font = '700 240px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${curP.temp}°C`, width / 2, 720);

    // 6. Draw 3 Telemetry Badges
    const badgeStartY = 960;
    const badgeH = 160;
    const badgeGap = 40;

    const badges = [
      { label: 'Velocidad Actual', val: `${curP.speed} KM/H`, color: '#39ff14' },
      { label: 'Altitud', val: `${curP.alt} M`, color: '#ffffff' },
      { label: 'Timestamp', val: `${curP.time} ${curP.km}`, color: '#00f0ff' }
    ];

    badges.forEach((b, idx) => {
      const y = badgeStartY + idx * (badgeH + badgeGap);
      const bX = pad + 60;
      const bW = cardW - 120;

      ctx.save();
      roundRect(ctx, bX, y, bW, badgeH, 28);
      ctx.fillStyle = 'rgba(20, 28, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.font = '600 38px "Rajdhani", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'left';
      ctx.fillText(b.label, bX + 40, y + 95);

      // Value
      ctx.font = '700 52px "Orbitron", sans-serif';
      ctx.fillStyle = b.color;
      ctx.textAlign = 'right';
      ctx.fillText(b.val, bX + bW - 40, y + 100);
      ctx.restore();
    });

    // 7. Footer GPS Info
    ctx.font = '500 28px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('GPS: 40.7812° N, 4.0156° W • LOGGED DATA OK', width / 2, height - 120);

    // 8. Watermark (Free vs Pro)
    const isPro = window.ProManager ? window.ProManager.isPro() : false;
    ctx.font = '700 24px "Orbitron", sans-serif';
    if (isPro) {
      ctx.fillStyle = 'rgba(255, 221, 0, 0.7)';
      ctx.fillText('★ RACE WARS PRO • VERIFIED TELEMETRY SNAPSHOT', width / 2, height - 70);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillText('RACE WARS TRACKER • FREE EDITION (UNLOCK PRO FOR CLEAN 4K)', width / 2, height - 70);
    }

    // Trigger PNG Download
    const dataUrl = exportCanvas.toDataURL('image/png');
    const dlLink = document.createElement('a');
    dlLink.download = `RaceWars_WeatherCard_${presetSelector.value}_${Date.now()}.png`;
    dlLink.href = dataUrl;
    dlLink.click();
  });

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
});
