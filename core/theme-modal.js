/**
 * Race Wars Tracker - Theme & Light/Dark Mode Manager Modal
 */
(function () {
  'use strict';

  const STORAGE_ACCENT = 'racewars_accent_theme';
  const STORAGE_BG_MODE = 'racewars_bg_mode';

  class ThemeModal {
    constructor() {
      this.activeAccent = localStorage.getItem(STORAGE_ACCENT) || 'neon-green';
      this.activeBgMode = localStorage.getItem(STORAGE_BG_MODE) || 'dark';
      this.backdrop = null;
      this._applyTheme();
      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._buildModal());
      } else {
        this._buildModal();
      }
    }

    _applyTheme() {
      // Remove all theme accent classes
      document.body.classList.remove(
        'theme-racing-red',
        'theme-cyber-cyan',
        'theme-amber-gold',
        'theme-stealth-silver'
      );

      if (this.activeAccent === 'racing-red') {
        document.body.classList.add('theme-racing-red');
      } else if (this.activeAccent === 'cyber-cyan') {
        document.body.classList.add('theme-cyber-cyan');
      } else if (this.activeAccent === 'amber-gold') {
        document.body.classList.add('theme-amber-gold');
      } else if (this.activeAccent === 'stealth-silver') {
        document.body.classList.add('theme-stealth-silver');
      }

      // Apply Light or Dark background mode
      if (this.activeBgMode === 'light') {
        document.body.classList.add('theme-light');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.body.classList.remove('theme-light');
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      window.dispatchEvent(new CustomEvent('racewars:theme_changed', {
        detail: { accent: this.activeAccent, bgMode: this.activeBgMode }
      }));
    }

    _buildModal() {
      if (document.getElementById('rwThemeModalBackdrop')) {
        this.backdrop = document.getElementById('rwThemeModalBackdrop');
        return;
      }

      const backdrop = document.createElement('div');
      backdrop.id = 'rwThemeModalBackdrop';
      backdrop.className = 'theme-modal-backdrop';

      backdrop.innerHTML = `
        <div class="theme-modal-container" role="dialog" aria-modal="true" aria-labelledby="themeModalTitle">
          <div class="theme-modal-header">
            <div class="theme-modal-title-group">
              <span style="font-size: 1.2rem;">🎨</span>
              <h2 class="theme-modal-title" id="themeModalTitle">TEMAS DISPONIBLES</h2>
            </div>
            <button class="theme-modal-close" id="rwThemeClose" aria-label="Cerrar modal">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Section 1: Background Mode (Light vs Dark) -->
          <div>
            <div class="theme-section-label">Fondo del Dashboard</div>
            <div class="bg-mode-grid">
              <div class="bg-mode-card ${this.activeBgMode === 'dark' ? 'is-active' : ''}" id="bgDarkBtn">
                <span class="bg-mode-icon">🌙</span>
                <div class="bg-mode-info">
                  <span class="bg-mode-name">Modo Oscuro</span>
                  <span class="bg-mode-sub">Titanio & Asfalto</span>
                </div>
              </div>
              <div class="bg-mode-card ${this.activeBgMode === 'light' ? 'is-active' : ''}" id="bgLightBtn">
                <span class="bg-mode-icon">☀️</span>
                <div class="bg-mode-info">
                  <span class="bg-mode-name">Modo Claro</span>
                  <span class="bg-mode-sub">Luz de Día GT</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: Accent Colors -->
          <div>
            <div class="theme-section-label">Color de Acento & Telemetría</div>
            <div class="accent-theme-list" id="themeListContainer">
              <!-- Options populated dynamically -->
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;

      this._renderAccentList();
      this._bindEvents();
    }

    _renderAccentList() {
      const container = document.getElementById('themeListContainer');
      if (!container) return;

      const themes = [
        { id: 'neon-green', name: 'Neón Verde (Castor Tech)', desc: 'Verde esmeralda reactivo de alta visibilidad', color: '#39ff14' },
        { id: 'racing-red', name: 'Racing Red', desc: 'Rojo competición agresivo estilo Cockpit GT', color: '#ff1e44' },
        { id: 'cyber-cyan', name: 'Cyber Cyan', desc: 'Azul cian telemétrico ultra-moderno', color: '#00e5ff' },
        { id: 'amber-gold', name: 'Amber Gold', desc: 'Ámbar endurance para carreras nocturnas', color: '#ffdd00' },
        { id: 'stealth-silver', name: 'Stealth Silver', desc: 'Monocromo titanio minimalista de alto contraste', color: '#e2e8f0' }
      ];

      container.innerHTML = '';
      themes.forEach(t => {
        const isActive = this.activeAccent === t.id;
        const card = document.createElement('div');
        card.className = `theme-option-card ${isActive ? 'is-active' : ''}`;
        card.innerHTML = `
          <div class="theme-option-left">
            <span class="theme-color-swatch" style="background: ${t.color}; color: ${t.color};"></span>
            <div class="theme-option-text">
              <span class="theme-option-name">${t.name}</span>
              <span class="theme-option-desc">${t.desc}</span>
            </div>
          </div>
          ${isActive ? '<span class="theme-active-tag">ACTIVO</span>' : ''}
        `;

        card.addEventListener('click', () => {
          this.activeAccent = t.id;
          localStorage.setItem(STORAGE_ACCENT, t.id);
          this._applyTheme();
          this._renderAccentList();
        });

        container.appendChild(card);
      });
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwThemeClose');
      const bgDarkBtn = document.getElementById('bgDarkBtn');
      const bgLightBtn = document.getElementById('bgLightBtn');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      if (bgDarkBtn) {
        bgDarkBtn.addEventListener('click', () => {
          this.activeBgMode = 'dark';
          localStorage.setItem(STORAGE_BG_MODE, 'dark');
          bgDarkBtn.classList.add('is-active');
          if (bgLightBtn) bgLightBtn.classList.remove('is-active');
          this._applyTheme();
        });
      }

      if (bgLightBtn) {
        bgLightBtn.addEventListener('click', () => {
          this.activeBgMode = 'light';
          localStorage.setItem(STORAGE_BG_MODE, 'light');
          bgLightBtn.classList.add('is-active');
          if (bgDarkBtn) bgDarkBtn.classList.remove('is-active');
          this._applyTheme();
        });
      }
    }

    open() {
      if (!this.backdrop) this._buildModal();
      if (!this.backdrop) this.backdrop = document.getElementById('rwThemeModalBackdrop');
      if (this.backdrop) this.backdrop.classList.add('is-visible');
    }

    close() {
      if (!this.backdrop) this.backdrop = document.getElementById('rwThemeModalBackdrop');
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.ThemeModal = new ThemeModal();
})();
