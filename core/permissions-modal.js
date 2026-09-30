/**
 * Race Wars Tracker - Real Hardware Permissions Manager
 * Handles explicit user permission requests for GPS, Motion sensors, and Bluetooth.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'racewars_permissions_granted';

  class PermissionsModal {
    constructor() {
      this.backdrop = null;
      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._checkAutoShow());
      } else {
        this._checkAutoShow();
      }
    }

    _checkAutoShow() {
      const alreadyGranted = localStorage.getItem(STORAGE_KEY) === 'true';
      if (!alreadyGranted) {
        // Mostrar onboarding de permisos tras una breve pausa
        setTimeout(() => this.open(), 500);
      }
    }

    _buildModal() {
      if (document.getElementById('rwPermModalBackdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'rwPermModalBackdrop';
      backdrop.className = 'perm-modal-backdrop';

      backdrop.innerHTML = `
        <div class="perm-modal-container" role="dialog" aria-modal="true" aria-labelledby="permTitle">
          <div class="perm-modal-header">
            <span class="perm-chip">MODO REAL // SENSORES FÍSICOS</span>
            <h2 class="perm-title" id="permTitle">ACTIVAR TELEMETRÍA REAL</h2>
            <p class="perm-sub">Concede acceso a los sensores del teléfono para registrar velocidad, altitud y fuerzas reales en carretera</p>
          </div>

          <div class="perm-list">
            <!-- 1. GPS Satelital -->
            <div class="perm-item">
              <span class="perm-item-icon">🛰️</span>
              <div class="perm-item-body">
                <span class="perm-item-title">Ubicación Precisa (GPS / GNSS)</span>
                <span class="perm-item-desc">Lectura a alta frecuencia de velocidad física en km/h, cálculo métrico de distancia y trazado en tiempo real.</span>
              </div>
            </div>

            <!-- 2. Movimiento & Barómetro -->
            <div class="perm-item">
              <span class="perm-item-icon">🧭</span>
              <div class="perm-item-body">
                <span class="perm-item-title">Sensores de Movimiento & Barómetro</span>
                <span class="perm-item-desc">Fusión sensorial para altitud instantánea exacta y cálculo de desnivel (+D) sin retrasos de red.</span>
              </div>
            </div>

            <!-- 3. Bluetooth -->
            <div class="perm-item">
              <span class="perm-item-icon">📶</span>
              <div class="perm-item-body">
                <span class="perm-item-title">Conexión Bluetooth con el Coche</span>
                <span class="perm-item-desc">Detección de arranque del motor para iniciar la grabación de telemetría sin tocar la pantalla.</span>
              </div>
            </div>
          </div>

          <!-- Botón de Concesión -->
          <button class="perm-grant-btn" id="rwGrantPermsBtn">
            <span>ACTIVAR HARDWARE Y MODO REAL</span>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <button class="perm-dismiss-btn" id="rwPermDismiss">Continuar en modo standby</button>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;

      this._bindEvents();
    }

    _bindEvents() {
      const grantBtn = document.getElementById('rwGrantPermsBtn');
      const dismissBtn = document.getElementById('rwPermDismiss');

      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => this.close());
      }

      if (grantBtn) {
        grantBtn.addEventListener('click', async () => {
          grantBtn.innerHTML = '<span>ACTIVANDO SENSORES...</span>';
          grantBtn.style.pointerEvents = 'none';

          await this.requestAllHardwarePermissions();
          localStorage.setItem(STORAGE_KEY, 'true');

          if (window.ProPaywallModal) {
            window.ProPaywallModal.showToast('✓ Sensores físicos y GPS activados en Modo Real');
          }

          this.close();
        });
      }
    }

    async requestAllHardwarePermissions() {
      console.log('[Permissions] Solicitando permisos nativos...');

      // 1. Capacitor Geolocation
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
        try {
          await window.Capacitor.Plugins.Geolocation.requestPermissions();
        } catch (e) {
          console.warn('[Permissions] Error solicitando geolocalización Capacitor:', e);
        }
      }

      // 2. HTML5 Geolocation Watcher / Trigger
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log('[Permissions] GPS inicializado con precisión de:', pos.coords.accuracy, 'm');
          },
          (err) => {
            console.warn('[Permissions] Esperando señal satélite:', err.message);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }

      // 3. Sensores de Movimiento (iOS / Android 13+)
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          await DeviceMotionEvent.requestPermission();
        } catch (e) {
          console.warn('[Permissions] Error permiso DeviceMotion:', e);
        }
      }

      // 4. Iniciar GPS en el motor de telemetría
      if (window.RealTelemetryEngine) {
        const engine = window.RealTelemetryEngine;
        if (typeof engine.startHardwareGps === 'function') {
          engine.startHardwareGps();
        }
      }
    }

    open() {
      if (!this.backdrop) this._buildModal();
      this.backdrop.classList.add('is-visible');
    }

    close() {
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.PermissionsModal = new PermissionsModal();
})();
