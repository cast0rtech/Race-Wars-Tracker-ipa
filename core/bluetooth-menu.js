/**
 * Race Wars Tracker - Real Bluetooth Hardware Device Manager
 * 
 * 100% Hardware Real en Android:
 * - Consulta dispositivos reales vinculados en el sistema Android (getBondedDevices)
 * - Escaneo activo de dispositivos Bluetooth físicos cercanos (requestLEScan)
 * - Enlace directo a Ajustes de Bluetooth de Android (openBluetoothSettings)
 * - Selección táctil de cualquier dispositivo real detectado
 * - Auto-arranque de telemetría al detectar el vehículo real seleccionado
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'racewars_real_bt_settings';

  class BluetoothMenu {
    constructor() {
      this.settings = this._loadSettings();
      this.backdrop = null;
      this.isScanning = false;
      this.scanTimer = null;
      this.scanListener = null;
      this.discoveredDevices = []; // Dispositivos encontrados en vivo
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
        devices: [] // Dispositivos memorizados
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
      if (document.getElementById('rwBtModalBackdrop')) {
        this.backdrop = document.getElementById('rwBtModalBackdrop');
        return;
      }

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
            <p class="bt-modal-sub">Detecta tu coche, radio manos libres o adaptador OBD2 físico</p>
          </div>

          <!-- Estado Actual -->
          <div class="bt-status-card">
            <div class="bt-status-info">
              <span class="bt-beacon-pulse ${this.settings.isConnected ? '' : 'is-disconnected'}" id="rwBtPulse"></span>
              <div class="bt-status-labels">
                <span class="bt-active-name" id="rwBtActiveName">${this.settings.selectedDevice || 'SIN DISPOSITIVO SELECCIONADO'}</span>
                <span class="bt-active-state ${this.settings.isConnected ? '' : 'is-disconnected'}" id="rwBtActiveState">
                  ${this.settings.isConnected ? 'CONECTADO Y ACTIVO' : 'DESCONECTADO'}
                </span>
                <span class="bt-dev-mac" id="rwBtActiveMac" style="font-size: 10px; color: #8892b0;">
                  ${this.settings.selectedMac || 'Toca un dispositivo abajo para elegirlo'}
                </span>
              </div>
            </div>
            <button class="bt-toggle-conn-btn" id="rwBtToggleConn">
              ${this.settings.isConnected ? 'Desconectar' : 'Conectar'}
            </button>
          </div>

          <!-- Botones de Acción de Hardware -->
          <div style="display: flex; gap: 8px; flex-direction: column;">
            <button class="bt-save-btn" id="rwBtScanRealBtn" style="background: linear-gradient(90deg, #00e5ff, #39ff14); display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline>
              </svg>
              <span id="rwBtScanBtnText">🔍 ESCANEAR DISPOSITIVOS REALES</span>
            </button>

            <button class="bt-settings-native-btn" id="rwBtOpenAndroidSettings" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: #a0aec0; padding: 8px 12px; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>⚙️ ABRIR AJUSTES BLUETOOTH DE ANDROID</span>
            </button>
          </div>

          <!-- Indicador de Escaneo en Vivo -->
          <div id="rwBtScanningBar" style="display: none; background: rgba(0, 229, 255, 0.1); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
              <span class="bt-radar-spinner"></span>
              <span style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: #00e5ff; font-weight: 700;" id="rwBtScanLiveCount">
                Escaneando hardware Bluetooth...
              </span>
            </div>
            <button id="rwBtStopScanBtn" style="background: transparent; border: none; color: #ff1e44; font-family: 'Share Tech Mono', monospace; font-size: 11px; cursor: pointer; text-decoration: underline;">
              [ Detener Escaneo ]
            </button>
          </div>

          <!-- Lista de Dispositivos Reales Elegibles -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span class="bt-section-label">Dispositivos Reales Disponibles</span>
            <span id="rwBtDevCounter" style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #00e5ff;">0 detectados</span>
          </div>
          <div class="bt-device-list" id="rwBtDeviceList"></div>

          <!-- Añadir / Guardar Dispositivo Manual (Alternativa) -->
          <div class="bt-custom-input-row" style="margin-top: 4px;">
            <input type="text" class="bt-text-input" id="rwBtCustomInput" placeholder="O introduce el nombre de tu coche">
            <button class="bt-add-btn" id="rwBtAddDevBtn">+ Añadir</button>
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
                <span class="bt-toggle-sub">No pausar en paradas breves o semáforos</span>
              </div>
              <select class="bt-text-input" id="rwBtGraceSelect" style="width: 85px; padding: 4px 8px; font-size: 11px;">
                <option value="30" ${this.settings.gracePeriodSec === 30 ? 'selected' : ''}>30 seg</option>
                <option value="45" ${this.settings.gracePeriodSec === 45 ? 'selected' : ''}>45 seg</option>
                <option value="60" ${this.settings.gracePeriodSec === 60 ? 'selected' : ''}>60 seg</option>
              </select>
            </div>
          </div>

          <button class="bt-save-btn" id="rwBtSaveBtn" style="background: linear-gradient(90deg, #112233, #00e5ff);">
            LISTO // VOLVER AL COCKPIT
          </button>
        </div>
      `;

      document.body.appendChild(backdrop);
      this.backdrop = backdrop;

      this._renderDeviceList();
      this._bindEvents();

      // Al inicializar en Android, cargar dispositivos emparejados automáticamente
      setTimeout(() => this.loadBondedDevices(), 400);
    }

    /**
     * Obtiene los dispositivos físicos reales ya vinculados en Android
     */
    async loadBondedDevices() {
      const BlePlugin = window.Capacitor?.Plugins?.BluetoothLe;
      if (!BlePlugin) return;

      try {
        await BlePlugin.initialize({ androidNeverForLocation: false });
        const res = await BlePlugin.getBondedDevices();
        if (res && Array.isArray(res.devices) && res.devices.length > 0) {
          console.log('[Bluetooth] Dispositivos reales vinculados en Android:', res.devices);
          res.devices.forEach(dev => {
            const name = dev.name || `Dispositivo BT (${dev.deviceId.substring(0, 8)})`;
            this._registerDevice(name, dev.deviceId, 'VINCULADO EN ANDROID');
          });
          this._renderDeviceList();
        }
      } catch (err) {
        console.warn('[Bluetooth] getBondedDevices aviso:', err);
      }
    }

    _registerDevice(name, mac, tag = 'DISPOSITIVO REAL') {
      const existing = this.settings.devices.find(d => d.mac === mac || d.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.name = name;
        existing.mac = mac;
        existing.tag = tag;
      } else {
        this.settings.devices.push({ name, mac, tag });
      }
      this._saveSettings();
    }

    _renderDeviceList() {
      const container = document.getElementById('rwBtDeviceList');
      const counter = document.getElementById('rwBtDevCounter');
      if (!container) return;

      container.innerHTML = '';

      // Unir dispositivos guardados y detectados en vivo
      const allDevices = [...this.settings.devices];
      this.discoveredDevices.forEach(d => {
        if (!allDevices.some(x => x.mac === d.mac || x.name === d.name)) {
          allDevices.push(d);
        }
      });

      if (counter) {
        counter.textContent = `${allDevices.length} detectados`;
      }

      if (allDevices.length === 0) {
        container.innerHTML = `
          <div style="padding: 14px; text-align: center; color: #718096; font-family: 'Rajdhani', sans-serif; font-size: 13px; background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.1);">
            <p style="margin: 0 0 6px 0; color: #a0aec0; font-weight: 700;">No hay dispositivos detectados todavía</p>
            Toca el botón verde <strong>🔍 ESCANEAR DISPOSITIVOS REALES</strong> o vincula tu coche en <strong>Ajustes de Android</strong>.
          </div>
        `;
        return;
      }

      allDevices.forEach(dev => {
        const isSelected = dev.name === this.settings.selectedDevice || (dev.mac && dev.mac === this.settings.selectedMac);
        const item = document.createElement('div');
        item.className = `bt-device-item ${isSelected ? 'is-selected' : ''}`;
        item.innerHTML = `
          <div class="bt-dev-info">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="bt-dev-name">${dev.name}</span>
              <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; font-family: 'Orbitron', sans-serif; background: ${dev.tag?.includes('VINCULADO') ? 'rgba(0,229,255,0.2)' : 'rgba(57,255,20,0.2)'}; color: ${dev.tag?.includes('VINCULADO') ? '#00e5ff' : '#39ff14'};">
                ${dev.tag || 'REAL'}
              </span>
            </div>
            <span class="bt-dev-mac">${dev.mac || 'Dirección de Hardware Bluetooth'}</span>
          </div>
          <div class="bt-dev-radio"></div>
        `;

        // SELECCIÓN REAL AL HACER CLIC
        item.addEventListener('click', () => {
          this._selectDevice(dev.name, dev.mac);
        });

        container.appendChild(item);
      });
    }

    _selectDevice(name, mac) {
      this.settings.selectedDevice = name;
      this.settings.selectedMac = mac;
      this.settings.isConnected = true;
      this._registerDevice(name, mac, 'VINCULADO');
      this._saveSettings();
      this._renderDeviceList();
      this._updateStatusUI();
      this._dispatchChange();

      // Intentar conectar al dispositivo si hay cliente nativo
      const BlePlugin = window.Capacitor?.Plugins?.BluetoothLe;
      if (BlePlugin && mac && mac.includes(':')) {
        BlePlugin.connect({ deviceId: mac, timeout: 5000 }).catch(e => {
          console.log('[Bluetooth] Conexión GATT informativa:', e);
        });
      }

      if (window.ProPaywallModal) {
        window.ProPaywallModal.showToast(`✓ Coche seleccionado: "${name}"`);
      }
    }

    _bindEvents() {
      const closeBtn = document.getElementById('rwBtClose');
      const toggleBtn = document.getElementById('rwBtToggleConn');
      const scanBtn = document.getElementById('rwBtScanRealBtn');
      const openSettingsBtn = document.getElementById('rwBtOpenAndroidSettings');
      const stopScanBtn = document.getElementById('rwBtStopScanBtn');
      const addBtn = document.getElementById('rwBtAddDevBtn');
      const customInput = document.getElementById('rwBtCustomInput');
      const autoRecordCb = document.getElementById('rwBtAutoRecord');
      const graceSelect = document.getElementById('rwBtGraceSelect');
      const saveBtn = document.getElementById('rwBtSaveBtn');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      // 1. Escaneo Real de Hardware
      if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
          await this.scanRealHardwareDevices();
        });
      }

      // 2. Abrir Ajustes Nativos de Bluetooth de Android
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', async () => {
          const BlePlugin = window.Capacitor?.Plugins?.BluetoothLe;
          if (BlePlugin && typeof BlePlugin.openBluetoothSettings === 'function') {
            try {
              await BlePlugin.openBluetoothSettings();
            } catch (e) {
              console.warn('[BT] Error abriendo ajustes:', e);
            }
          } else {
            alert('Abre los Ajustes de Bluetooth de tu teléfono Android para vincular tu vehículo.');
          }
        });
      }

      if (stopScanBtn) {
        stopScanBtn.addEventListener('click', () => this.stopHardwareScan());
      }

      // 3. Conectar / Desconectar toggle
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

      // 4. Añadir dispositivo manual si es necesario
      if (addBtn && customInput) {
        addBtn.addEventListener('click', () => {
          const val = customInput.value.trim();
          if (val) {
            this._selectDevice(val, 'Configurado por usuario');
            customInput.value = '';
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
     * Escanea dispositivos Bluetooth reales mediante Capacitor BluetoothLe y Web Bluetooth API
     */
    async scanRealHardwareDevices() {
      if (this.isScanning) return;

      const scanBtnText = document.getElementById('rwBtScanBtnText');
      const scanBar = document.getElementById('rwBtScanningBar');
      const liveCount = document.getElementById('rwBtScanLiveCount');

      this.isScanning = true;
      if (scanBtnText) scanBtnText.textContent = 'ESCANEANDO ONDAS BLUETOOTH...';
      if (scanBar) scanBar.style.display = 'block';

      console.log('[Bluetooth] Iniciando escaneo de hardware real...');

      try {
        const BlePlugin = window.Capacitor?.Plugins?.BluetoothLe;

        // Si estamos en Android con Capacitor
        if (BlePlugin) {
          try {
            await BlePlugin.initialize({ androidNeverForLocation: false });
            
            // Verificar si el Bluetooth está encendido
            const isEnabled = await BlePlugin.isEnabled();
            if (!isEnabled.value) {
              await BlePlugin.requestEnable();
            }

            // Obtener primero todos los dispositivos ya vinculados
            await this.loadBondedDevices();

            // Escuchar los resultados del escaneo activo de ondas
            if (this.scanListener) {
              await this.scanListener.remove();
            }

            this.scanListener = await BlePlugin.addListener('onScanResult', (result) => {
              if (result && result.device) {
                const dev = result.device;
                const name = result.localName || dev.name || `Dispositivo BT (${dev.deviceId.substring(0, 8)})`;
                const mac = dev.deviceId || 'Desconocida';
                const rssi = result.rssi ? `${result.rssi} dBm` : 'EN VIVO';

                const existing = this.discoveredDevices.find(x => x.mac === mac);
                if (!existing) {
                  this.discoveredDevices.push({
                    name: name,
                    mac: mac,
                    tag: `SEÑAL ${rssi}`
                  });
                  this._renderDeviceList();
                  if (liveCount) {
                    liveCount.textContent = `Escaneando... (${this.discoveredDevices.length} en vivo)`;
                  }
                }
              }
            });

            // Iniciar escaneo activo de LE
            await BlePlugin.requestLEScan({
              allowDuplicates: false
            });

            // Detener el escaneo automáticamente a los 10 segundos
            this.scanTimer = setTimeout(() => {
              this.stopHardwareScan();
            }, 10000);

            return;
          } catch (bleErr) {
            console.warn('[Bluetooth] Capacitor requestLEScan error:', bleErr);
          }
        }

        // Web Bluetooth API Fallback (para navegador Chrome/Edge)
        if ('bluetooth' in navigator && typeof navigator.bluetooth.requestDevice === 'function') {
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
          });

          if (device) {
            const devName = device.name || `Dispositivo BT (${device.id.substring(0, 8)})`;
            this._selectDevice(devName, device.id);
            this.stopHardwareScan();
            return;
          }
        }
      } catch (err) {
        console.warn('[Bluetooth] Diálogo o escaneo cancelado:', err);
      }

      this.stopHardwareScan();
    }

    async stopHardwareScan() {
      this.isScanning = false;
      if (this.scanTimer) {
        clearTimeout(this.scanTimer);
        this.scanTimer = null;
      }

      const scanBtnText = document.getElementById('rwBtScanBtnText');
      const scanBar = document.getElementById('rwBtScanningBar');

      if (scanBtnText) scanBtnText.textContent = '🔍 ESCANEAR DISPOSITIVOS REALES';
      if (scanBar) scanBar.style.display = 'none';

      const BlePlugin = window.Capacitor?.Plugins?.BluetoothLe;
      if (BlePlugin) {
        try {
          if (this.scanListener) {
            await this.scanListener.remove();
            this.scanListener = null;
          }
          await BlePlugin.stopLEScan();
        } catch (e) {
          // Ignorar error al detener
        }
      }
    }

    _updateStatusUI() {
      const pulse = document.getElementById('rwBtPulse');
      const activeName = document.getElementById('rwBtActiveName');
      const activeState = document.getElementById('rwBtActiveState');
      const activeMac = document.getElementById('rwBtActiveMac');
      const toggleBtn = document.getElementById('rwBtToggleConn');

      if (activeName) {
        activeName.textContent = this.settings.selectedDevice || 'SIN DISPOSITIVO SELECCIONADO';
      }
      if (activeMac) {
        activeMac.textContent = this.settings.selectedMac || 'Toca un dispositivo abajo para elegirlo';
      }

      if (pulse && activeState && toggleBtn) {
        if (this.settings.isConnected && this.settings.selectedDevice) {
          pulse.className = 'bt-beacon-pulse';
          activeState.className = 'bt-active-state';
          activeState.textContent = 'CONECTADO Y ACTIVO';
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
      if (!this.backdrop) this.backdrop = document.getElementById('rwBtModalBackdrop');
      this._updateStatusUI();
      this._renderDeviceList();
      if (this.backdrop) this.backdrop.classList.add('is-visible');

      // Intentar refrescar la lista de dispositivos vinculados al abrir
      this.loadBondedDevices();
    }

    close() {
      if (this.isScanning) {
        this.stopHardwareScan();
      }
      if (!this.backdrop) this.backdrop = document.getElementById('rwBtModalBackdrop');
      if (this.backdrop) this.backdrop.classList.remove('is-visible');
    }
  }

  window.BluetoothMenu = new BluetoothMenu();
})();
