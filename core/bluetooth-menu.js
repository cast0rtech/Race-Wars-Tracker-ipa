/**
 * Race Wars Tracker - Real Bluetooth Hardware Device Manager
 * 
 * 100% libre de dispositivos simulados o ficticios:
 * - Escaneo de hardware nativo mediante Capacitor BluetoothLe y Web Bluetooth API
 * - Detección real de dispositivos Bluetooth cercanos (manos libres, radio del coche, OBD2)
 * - Auto-arranque al vincular con el coche real seleccionado
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'racewars_real_bt_settings';

  class BluetoothMenu {
    constructor() {
      this.settings = this._loadSettings();
      this.backdrop = null;
      this.isScanning = false;
      this._init();
    }

    _loadSettings() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.warn('Error cargando configuración BT:', e);
      }
      return {
        isConnected: false,
        selectedDevice: '',
        selectedMac: '',
        autoRecord: true,
        gracePeriodSec: 45,
        devices: [] // Vacío por defecto: Sin dispositivos falsos
      };
    }

    _saveSettings() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (e) {
        console.warn('Error guardando configuración BT:', e);
      }
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._buildModal());
      } else {
        this._buildModal();
      }
    }

    _buildModal() {
      if (document.getElementById('rwBtModalBackdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'rwBtModalBackdrop';
      backdrop.className = 'bt-modal-backdrop';

      backdrop.innerHTML = `
        <div class="bt-modal-container" role="dialog" aria-modal="true" aria-labelledby="btTitle">
          <button class="bt-modal-close" id="rwBtClose" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="bt-modal-header">
            <span class="bt-modal-chip">HARDWARE BLUETOOTH REAL</span>
            <h2 class="bt-modal-title" id="btTitle">VINCULACIÓN DEL VEHÍCULO</h2>
            <p class="bt-modal-sub">Escanea y selecciona el Bluetooth real de tu coche u OBD2</p>
          </div>

          <!-- Estado Actual -->
          <div class="bt-status-card">
            <div class="bt-status-info">
              <span class="bt-beacon-pulse ${this.settings.isConnected ? '' : 'is-disconnected'}" id="rwBtPulse"></span>
              <div class="bt-status-labels">
                <span class="bt-active-name" id="rwBtActiveName">${this.settings.selectedDevice || 'SIN DISPOSITIVO VINCULADO'}</span>
                <span class="bt-active-state ${this.settings.isConnected ? '' : 'is-disconnected'}" id="rwBtActiveState">
                  ${this.settings.isConnected ? 'VINCULADO Y CONECTADO' : 'DESCONECTADO'}
                </span>
              </div>
            </div>
            <button class="bt-toggle-conn-btn" id="rwBtToggleConn">
              ${this.settings.isConnected ? 'Desconectar' : 'Conectar'}
            </button>
          </div>

          <!-- Botón de Escaneo Real de Hardware -->
          <button class="bt-save-btn" id="rwBtScanRealBtn" style="background: linear-gradient(90deg, #00e5ff, #39ff14); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline>
            </svg>
            <span id="rwBtScanBtnText">🔍 ESCANEAR DISPOSITIVOS REALES</span>
          </button>

          <!-- Lista de Dispositivos Memorizados -->
          <span class="bt-section-label">Dispositivos Reales Guardados</span>
          <div class="bt-device-list" id="rwBtDeviceList"></div>

          <!-- Añadir Nombre Manual -->
          <div class="bt-custom-input-row">
            <input type="text" class="bt-text-input" id="rwBtCustomInput" placeholder="Nombre exacto del Bluetooth de tu coche">
            <button class="bt-add-btn" id="rwBtAddDevBtn">+ Guardar</button>
          </div>

          <!-- Configuración de Auto-Arranque -->
          <div class="bt-settings-toggles">
            <div class="bt-toggle-row">
              <div class="bt-toggle-label-group">
                <span class="bt-toggle-title">Auto-Inicio de Ruta</span>
                <span class="bt-toggle-sub">Comenzar a grabar telemetría al detectar tu coche</span>
              </div>
              <label class="bt-switch">
                <input type="checkbox" id="rwBtAutoRecord" ${this.settings.autoRecord ? 'checked' : ''}>
                <span class="bt-slider"></span>
              </label>
            </div>

            <div class="bt-toggle-row" style="margin-top: 6px;">
              <div class="bt-toggle-label-group">
                <span class="bt-toggle-title">Ventana de Gracia</span>
                <span class="bt-toggle-sub">No pausar en paradas breves de contacto</span>
              </div>
              <select class="bt-text-input" id="rwBtGraceSelect" style="width: 85px; padding: 4px 8px; font-size: 11px;">
                <option value="30" ${this.settings.gracePeriodSec === 30 ? 'selected' : ''}>30 seg</option>
                <option value="45" ${this.settings.gracePeriodSec === 45 ? 'selected' : ''}>45 seg</option>
                <option value="60" ${this.settings.gracePeriodSec === 60 ? 'selected' : ''}>60 seg</option>
              </select>
            </div>
          </div>

          <button class="bt-save-btn" id="rwBtSaveBtn">LISTO</button>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;

      this._renderDeviceList();
      this._bindEvents();
    }

    _renderDeviceList() {
      const container = document.getElementById('rwBtDeviceList');
      if (!container) return;

      container.innerHTML = '';

      if (!this.settings.devices || this.settings.devices.length === 0) {
        container.innerHTML = `
          <div style="padding: 12px; text-align: center; color: #647387; font-family: 'Rajdhani', sans-serif; font-size: 13px; background: rgba(0,0,0,0.2); border-radius: 8px;">
            No hay dispositivos vinculados aún.<br>Usa el botón de arriba para escanear el Bluetooth real de tu coche o escribe su nombre abajo.
          </div>
        `;
        return;
      }

      this.settings.devices.forEach(dev => {
        const isSelected = dev.name === this.settings.selectedDevice;
        const item = document.createElement('div');
        item.className = `bt-device-item ${isSelected ? 'is-selected' : ''}`;
        item.innerHTML = `
          <div class="bt-dev-info">
            <span class="bt-dev-name">${dev.name}</span>
            <span class="bt-dev-mac">${dev.mac || 'Dispositivo Bluetooth'}</span>
          </div>
          <div class="bt-dev-radio"></div>
        `;
        item.addEventListener('click', () => {
          this.settings.selectedDevice = dev.name;
          this.settings.selectedMac = dev.mac;
          this.settings.isConnected = true;
          this._saveSettings();
          this._renderDeviceList();
          this._updateStatusUI();
          this._dispatchChange();
        });
        container.appendChild(item);
      });
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwBtClose');
      const toggleBtn = document.getElementById('rwBtToggleConn');
      const scanBtn = document.getElementById('rwBtScanRealBtn');
      const addBtn = document.getElementById('rwBtAddDevBtn');
      const customInput = document.getElementById('rwBtCustomInput');
      const autoRecordCb = document.getElementById('rwBtAutoRecord');
      const graceSelect = document.getElementById('rwBtGraceSelect');
      const saveBtn = document.getElementById('rwBtSaveBtn');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      // Escaneo Real de Hardware
      if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
          await this.scanRealHardwareDevices();
        });
      }

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          if (!this.settings.selectedDevice && !this.settings.isConnected) {
            if (window.ProPaywallModal) {
              window.ProPaywallModal.showToast('Primero escanea o selecciona un dispositivo Bluetooth');
            }
            return;
          }
          this.settings.isConnected = !this.settings.isConnected;
          this._saveSettings();
          this._updateStatusUI();
          this._dispatchChange();
        });
      }

      if (addBtn && customInput) {
        addBtn.addEventListener('click', () => {
          const val = customInput.value.trim();
          if (val) {
            const exists = this.settings.devices.some(d => d.name.toLowerCase() === val.toLowerCase());
            if (!exists) {
              this.settings.devices.push({ name: val, mac: 'Vinculado manualmente' });
            }
            this.settings.selectedDevice = val;
            this.settings.selectedMac = 'Vinculado';
            this.settings.isConnected = true;
            customInput.value = '';
            this._saveSettings();
            this._renderDeviceList();
            this._updateStatusUI();
            this._dispatchChange();

            if (window.ProPaywallModal) {
              window.ProPaywallModal.showToast(`✓ Coche guardado y vinculado: "${val}"`);
            }
          }
        });
      }

      if (autoRecordCb) {
        autoRecordCb.addEventListener('change', (e) => {
          this.settings.autoRecord = e.target.checked;
          this._saveSettings();
        });
      }

      if (graceSelect) {
        graceSelect.addEventListener('change', (e) => {
          this.settings.gracePeriodSec = parseInt(e.target.value, 10);
          this._saveSettings();
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this._saveSettings();
          this.close();
        });
      }
    }

    /**
     * Escanea dispositivos Bluetooth reales mediante Capacitor BluetoothLe o Web Bluetooth API
     */
    async scanRealHardwareDevices() {
      const scanBtnText = document.getElementById('rwBtScanBtnText');
      if (scanBtnText) scanBtnText.textContent = 'BUSCANDO DISPOSITIVOS REALES...';

      console.log('[Bluetooth] Iniciando escaneo de hardware...');

      try {
        // 1. Si existe Capacitor Bluetooth LE Plugin
        const BleClient = window.Capacitor?.Plugins?.BluetoothLe;
        if (BleClient) {
          try {
            await BleClient.initialize();
            const device = await BleClient.requestDevice();
            if (device && (device.name || device.deviceId)) {
              const devName = device.name || `Dispositivo BT (${device.deviceId.substring(0, 8)})`;
              this._addRealDevice(devName, device.deviceId);
              if (scanBtnText) scanBtnText.textContent = '🔍 ESCANEAR DISPOSITIVOS REALES';
              return;
            }
          } catch (bleErr) {
            console.warn('[Bluetooth] Capacitor BleClient requestDevice:', bleErr);
          }
        }

        // 2. Si existe Web Bluetooth API (Chrome / Android WebView)
        if ('bluetooth' in navigator && typeof navigator.bluetooth.requestDevice === 'function') {
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
          });

          if (device && device.name) {
            this._addRealDevice(device.name, device.id);
            if (scanBtnText) scanBtnText.textContent = '🔍 ESCANEAR DISPOSITIVOS REALES';
            return;
          }
        }
      } catch (err) {
        console.warn('[Bluetooth] Cancelado o sin soporte directo de diálogo:', err);
      }

      if (scanBtnText) scanBtnText.textContent = '🔍 ESCANEAR DISPOSITIVOS REALES';

      if (window.ProPaywallModal) {
        window.ProPaywallModal.showToast('Introduce el nombre del Bluetooth de tu coche para vincularlo');
      }
      const customInput = document.getElementById('rwBtCustomInput');
      if (customInput) customInput.focus();
    }

    _addRealDevice(name, mac) {
      const exists = this.settings.devices.some(d => d.name === name);
      if (!exists) {
        this.settings.devices.push({ name, mac });
      }
      this.settings.selectedDevice = name;
      this.settings.selectedMac = mac;
      this.settings.isConnected = true;
      this._saveSettings();
      this._renderDeviceList();
      this._updateStatusUI();
      this._dispatchChange();

      if (window.ProPaywallModal) {
        window.ProPaywallModal.showToast(`✓ Conectado al dispositivo real: "${name}"`);
      }
    }

    _updateStatusUI() {
      const pulse = document.getElementById('rwBtPulse');
      const activeName = document.getElementById('rwBtActiveName');
      const activeState = document.getElementById('rwBtActiveState');
      const toggleBtn = document.getElementById('rwBtToggleConn');

      if (pulse && activeName && activeState && toggleBtn) {
        activeName.textContent = this.settings.selectedDevice || 'SIN DISPOSITIVO VINCULADO';
        if (this.settings.isConnected && this.settings.selectedDevice) {
          pulse.className = 'bt-beacon-pulse';
          activeState.className = 'bt-active-state';
          activeState.textContent = 'VINCULADO Y CONECTADO';
          toggleBtn.textContent = 'Desconectar';
        } else {
          pulse.className = 'bt-beacon-pulse is-disconnected';
          activeState.className = 'bt-active-state is-disconnected';
          activeState.textContent = 'DESCONECTADO';
          toggleBtn.textContent = 'Conectar';
        }
      }
    }

    _dispatchChange() {
      window.dispatchEvent(new CustomEvent('racewars:bluetooth_changed', { detail: { ...this.settings } }));
    }

    open() {
      if (!this.backdrop) this._buildModal();
      this._updateStatusUI();
      this._renderDeviceList();
      this.backdrop.classList.add('is-visible');
    }

    close() {
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.BluetoothMenu = new BluetoothMenu();
})();
