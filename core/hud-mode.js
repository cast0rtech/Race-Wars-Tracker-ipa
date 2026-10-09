/**
 * Race Wars Tracker - Gestor del Modo HUD Parabrisas
 * Invierte la pantalla en modo espejo y ajusta el brillo del móvil al 80%.
 */
(function() {
  'use strict';

  class HudModeManager {
    constructor() {
      this.isActive = false;
      this.mirrorAxis = 'y'; // 'y' = vertical (parabrisas), 'x' = horizontal
      this.targetBrightness = 0.8;
      this.wakeLockSentinel = null;
      this.lastTapTime = 0;

      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._setup());
      } else {
        this._setup();
      }
    }

    _setup() {
      this._buildFloatingBar();
      this._bindEvents();
    }

    _buildFloatingBar() {
      if (document.getElementById('hudFloatingBar')) return;

      const bar = document.createElement('div');
      bar.id = 'hudFloatingBar';
      bar.className = 'hud-floating-bar';
      bar.innerHTML = `
        <div class="hud-info-badge">
          <span class="hud-radar-pulse"></span>
          <span>HUD 80% BRILLO</span>
        </div>
        <button class="hud-action-btn" id="hudToggleAxisBtn" title="Invertir eje espejo (Vertical / Horizontal)">
          <span id="hudAxisLabel">↕️ EJE V</span>
        </button>
        <button class="hud-exit-btn" id="hudExitBarBtn" title="Salir del modo HUD">
          <span>✕ SALIR</span>
        </button>
      `;

      document.body.appendChild(bar);
    }

    _bindEvents() {
      // Botón principal en el Header del Cockpit
      const mainBtn = document.getElementById('hudModeBtn');
      if (mainBtn) {
        mainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle();
        });
      }

      // Botón salir en la barra flotante
      const exitBtn = document.getElementById('hudExitBarBtn');
      if (exitBtn) {
        exitBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.disable();
        });
      }

      // Botón para alternar eje de espejo
      const axisBtn = document.getElementById('hudToggleAxisBtn');
      if (axisBtn) {
        axisBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleAxis();
        });
      }

      // Salir con tecla ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isActive) {
          this.disable();
        }
      });

      // Doble toque en cualquier parte de la pantalla para salir fácilmente mientras se conduce
      document.addEventListener('touchend', (e) => {
        if (!this.isActive) return;
        const now = Date.now();
        if (now - this.lastTapTime < 320) {
          // Doble toque detectado
          this.disable();
        }
        this.lastTapTime = now;
      }, { passive: true });
    }

    async enable() {
      if (this.isActive) return;
      this.isActive = true;

      // 1. Ajustar el brillo al 80% en iOS nativo (UIScreen.main.brightness)
      await this._setNativeBrightness(this.targetBrightness);

      // 2. Mantener la pantalla siempre encendida sin apagarse
      await this._keepScreenAwake(true);

      // 3. Aplicar clases CSS de modo HUD y efecto espejo
      document.body.classList.add('hud-mode-active');
      this._updateMirrorClasses();

      // 4. Actualizar estado del botón en la cabecera
      const mainBtn = document.getElementById('hudModeBtn');
      if (mainBtn) mainBtn.classList.add('is-active');

      // 5. Emitir evento global
      window.dispatchEvent(new CustomEvent('racewars:hud_changed', {
        detail: { active: true, axis: this.mirrorAxis, brightness: this.targetBrightness }
      }));
    }

    async disable() {
      if (!this.isActive) return;
      this.isActive = false;

      // 1. Restaurar brillo original del teléfono
      await this._restoreNativeBrightness();

      // 2. Restaurar temporizador de reposo de pantalla
      await this._keepScreenAwake(false);

      // 3. Quitar clases CSS
      document.body.classList.remove('hud-mode-active', 'hud-mirror-y', 'hud-mirror-x');

      // 4. Actualizar estado del botón
      const mainBtn = document.getElementById('hudModeBtn');
      if (mainBtn) mainBtn.classList.remove('is-active');

      // 5. Emitir evento global
      window.dispatchEvent(new CustomEvent('racewars:hud_changed', {
        detail: { active: false }
      }));
    }

    toggle() {
      if (this.isActive) {
        this.disable();
      } else {
        this.enable();
      }
    }

    toggleAxis() {
      this.mirrorAxis = this.mirrorAxis === 'y' ? 'x' : 'y';
      this._updateMirrorClasses();

      const axisLabel = document.getElementById('hudAxisLabel');
      if (axisLabel) {
        axisLabel.textContent = this.mirrorAxis === 'y' ? '↕️ EJE V' : '↔️ EJE H';
      }
    }

    _updateMirrorClasses() {
      if (!this.isActive) return;
      if (this.mirrorAxis === 'y') {
        document.body.classList.remove('hud-mirror-x');
        document.body.classList.add('hud-mirror-y');
      } else {
        document.body.classList.remove('hud-mirror-y');
        document.body.classList.add('hud-mirror-x');
      }
    }

    async _setNativeBrightness(val) {
      // 1. Intentar plugin nativo de iOS (NativeSettingsPlugin)
      const cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.NativeSettings && cap.Plugins.NativeSettings.setBrightness) {
        try {
          await cap.Plugins.NativeSettings.setBrightness({ value: val });
          console.log(`[HudMode] Brillo nativo ajustado al ${val * 100}%`);
          return;
        } catch (err) {
          console.warn('[HudMode] Error ajustando brillo nativo:', err);
        }
      }
    }

    async _restoreNativeBrightness() {
      const cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.NativeSettings && cap.Plugins.NativeSettings.restoreBrightness) {
        try {
          await cap.Plugins.NativeSettings.restoreBrightness();
          console.log('[HudMode] Brillo original de iOS restaurado');
          return;
        } catch (err) {
          console.warn('[HudMode] Error restaurando brillo:', err);
        }
      }
    }

    async _keepScreenAwake(enable) {
      const cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.NativeSettings && cap.Plugins.NativeSettings.setKeepScreenOn) {
        try {
          await cap.Plugins.NativeSettings.setKeepScreenOn({ enabled: enable });
        } catch (err) {
          console.warn('[HudMode] Error con setKeepScreenOn:', err);
        }
      }

      // Fallback navegador Wake Lock API
      if (enable && 'wakeLock' in navigator) {
        try {
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
        } catch (e) {
          // No soportado o denegado
        }
      } else if (!enable && this.wakeLockSentinel) {
        try {
          await this.wakeLockSentinel.release();
          this.wakeLockSentinel = null;
        } catch (e) {}
      }
    }
  }

  window.HudMode = new HudModeManager();
})();
