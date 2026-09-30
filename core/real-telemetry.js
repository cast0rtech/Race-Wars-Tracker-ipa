/**
 * Race Wars Tracker - Real Hardware Telemetry Engine
 * 
 * Conecta el Cockpit directamente con el hardware real del teléfono:
 * - GPS de alta precisión (Capacitor Geolocation & HTML5 Geolocation a 1Hz - 5Hz)
 * - Cálculo exacto de velocidad real (km/h) con filtrado de fluctuaciones
 * - Odometría real mediante fórmula Haversine geodésica
 * - Altitud real y Desnivel acumulado (+D / -D) mediante Sensor Fusion
 * - WakeLock para mantener la pantalla activa en el soporte del coche
 * - Persistencia de sesión de ruta en tiempo real
 */

(function () {
  'use strict';

  // Constante de conversión de radio terrestre (km)
  const EARTH_RADIUS_KM = 6371.0;

  class RealTelemetryEngine {
    constructor() {
      // Estado de hardware
      this.gpsAvailable = false;
      this.gpsAccuracyMeters = null;
      this.gpsWatchId = null;
      this.wakeLock = null;

      // Modo de operación: POR DEFECTO MODO REAL (HARDWARE)
      this.isSimulating = false;

      // Estado de grabación
      this.isRecording = false;
      this.recordStartTime = 0;
      this.elapsedMs = 0;
      this.timerInterval = null;

      // Métricas en tiempo real
      this.currentSpeedKmh = 0;
      this.maxSpeedKmh = 0;
      this.totalDistanceKm = 0;
      this.currentAltitudeMeters = 0;
      this.elevationGainMeters = 0;
      this.elevationLossMeters = 0;

      // Buffer de historial de altitud (últimos 35 puntos para el canvas)
      this.altHistory = [];
      this.maxAltPoints = 35;

      // Registro de coordenadas de la ruta
      this.trackpoints = [];
      this.lastPosition = null;

      // Sensor Fusion Engine si está disponible
      this.fusion = window.SensorFusionEngine ? new window.SensorFusionEngine({ hysteresisThreshold: 2.0 }) : null;

      // Callbacks
      this.updateListeners = new Set();
      this.statusListeners = new Set();

      // Inicializar WakeLock y Sensores
      this._requestWakeLock();
      this.startHardwareGps();
    }

    /**
     * Solicita mantener la pantalla encendida mientras la app esté abierta en el coche
     */
    async _requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          console.log('[Telemetry] WakeLock activado (Pantalla encendida continuamente en el vehículo)');
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && !this.wakeLock) {
              this.wakeLock = await navigator.wakeLock.request('screen');
            }
          });
        }
      } catch (err) {
        console.warn('[Telemetry] WakeLock no disponible o denegado:', err);
      }
    }

    /**
     * Inicia la escucha continua del chip GPS del dispositivo
     */
    async startHardwareGps() {
      console.log('[Telemetry] Solicitando permisos e iniciando chip GPS nativo...');
      this._notifyStatus('BUSCANDO SATÉLITES GPS...', 'searching');

      // 1. Si existe plugin Capacitor Geolocation
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
        try {
          const perm = await window.Capacitor.Plugins.Geolocation.requestPermissions();
          console.log('[Telemetry] Permisos de geolocalización Capacitor:', perm);
        } catch (e) {
          console.warn('[Telemetry] Error solicitando permisos Capacitor:', e);
        }
      }

      // 2. Escucha de alta precisión (Hardware GNSS / Galileo / GLONASS)
      const options = {
        enableHighAccuracy: true, // Forzar uso de chip GPS hardware, no solo triangulación WiFi/celular
        maximumAge: 0,            // No usar caché antigua de posición
        timeout: 10000            // Tiempo máximo de espera por muestra
      };

      if ('geolocation' in navigator) {
        this.gpsWatchId = navigator.geolocation.watchPosition(
          (pos) => this._handleGpsSuccess(pos),
          (err) => this._handleGpsError(err),
          options
        );
      } else {
        this._notifyStatus('GPS NO SOPORTADO', 'error');
      }
    }

    _handleGpsSuccess(pos) {
      if (this.isSimulating) return; // Si el usuario forzó modo simulación manual, ignorar hardware

      this.gpsAvailable = true;
      const coords = pos.coords;
      const timestamp = pos.timestamp || Date.now();
      this.gpsAccuracyMeters = Math.round(coords.accuracy);

      const lat = coords.latitude;
      const lng = coords.longitude;
      const rawAlt = coords.altitude !== null ? coords.altitude : (this.currentAltitudeMeters || 650);

      // 1. Cálculo de velocidad real (km/h)
      let calculatedSpeed = 0;

      if (coords.speed !== null && !isNaN(coords.speed) && coords.speed >= 0) {
        // La API devuelve m/s -> multiplicar por 3.6 para km/h
        calculatedSpeed = coords.speed * 3.6;
      } else if (this.lastPosition) {
        // Cálculo diferencial de distancia / tiempo
        const distKm = this._haversineDistance(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
        const dtHours = Math.max(0.0001, (timestamp - this.lastPosition.timestamp) / (1000 * 3600));
        calculatedSpeed = distKm / dtHours;
      }

      // Filtro de ruido cuando el vehículo está detenido
      if (calculatedSpeed < 1.8) {
        calculatedSpeed = 0;
      }

      this.currentSpeedKmh = Math.round(calculatedSpeed);
      if (this.currentSpeedKmh > this.maxSpeedKmh) {
        this.maxSpeedKmh = this.currentSpeedKmh;
      }

      // 2. Fusión de sensores para altitud
      if (this.fusion) {
        const fResult = this.fusion.update({
          timestamp: timestamp,
          gpsAltitude: rawAlt,
          gpsAccuracyV: coords.altitudeAccuracy || 8
        });
        this.currentAltitudeMeters = fResult.fusedAltitude;
        if (this.isRecording) {
          this.elevationGainMeters = fResult.elevationGain;
          this.elevationLossMeters = fResult.elevationLoss;
        }
      } else {
        this.currentAltitudeMeters = Math.round(rawAlt);
      }

      // Actualizar buffer de altitud para el gráfico
      if (this.altHistory.length === 0) {
        for (let i = 0; i < this.maxAltPoints; i++) {
          this.altHistory.push(this.currentAltitudeMeters);
        }
      } else {
        this.altHistory.shift();
        this.altHistory.push(this.currentAltitudeMeters);
      }

      // 3. Odometría y acumulación de distancia (si la grabación está activa)
      if (this.isRecording && this.lastPosition) {
        const deltaKm = this._haversineDistance(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
        // Filtrar micro-saltos de precisión (menos de 3 metros cuando velocidad es 0)
        if (deltaKm > 0.003 || this.currentSpeedKmh > 2) {
          this.totalDistanceKm += deltaKm;
        }

        // Guardar trackpoint
        this.trackpoints.push({
          timestamp: timestamp,
          lat: lat,
          lng: lng,
          speedKmh: this.currentSpeedKmh,
          altitudeM: this.currentAltitudeMeters
        });
      }

      this.lastPosition = { lat, lng, timestamp };

      // Notificar estado de GPS activo y enviar datos a la UI
      this._notifyStatus(`GPS EN VIVO (±${this.gpsAccuracyMeters}m)`, 'active');
      this._dispatchUpdate();
    }

    _handleGpsError(err) {
      console.warn('[Telemetry] Error obteniendo GPS:', err.message);
      if (err.code === 1) {
        this._notifyStatus('PERMISO GPS DENEGADO', 'error');
      } else if (err.code === 2) {
        this._notifyStatus('SEÑAL GPS NO DISPONIBLE', 'warning');
      } else {
        this._notifyStatus('BUSCANDO SATÉLITES...', 'searching');
      }
    }

    /**
     * Distancia ortodrómica en kilómetros entre dos coordenadas
     */
    _haversineDistance(lat1, lon1, lat2, lon2) {
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return EARTH_RADIUS_KM * c;
    }

    /**
     * Inicia la grabación oficial de ruta
     */
    startRecording() {
      this.isRecording = true;
      this.recordStartTime = Date.now();
      this.trackpoints = [];
      this.totalDistanceKm = 0;
      this.elevationGainMeters = 0;
      this.elevationLossMeters = 0;
      this.maxSpeedKmh = this.currentSpeedKmh;

      if (this.fusion) {
        this.fusion.elevationGain = 0;
        this.fusion.elevationLoss = 0;
      }

      // Temporizador de tiempo transcurrido
      this.timerInterval = setInterval(() => {
        if (this.isRecording) {
          this.elapsedMs = Date.now() - this.recordStartTime;
          this._dispatchUpdate();
        }
      }, 100);

      console.log('[Telemetry] Grabación de ruta iniciada con GPS real.');
      this._dispatchUpdate();
    }

    /**
     * Detiene la grabación y persiste la sesión para el Debrief / Resumen
     */
    stopRecording() {
      this.isRecording = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      // Guardar sesión en almacenamiento local para la pantalla de Resumen
      const sessionData = {
        id: 'session_' + Date.now(),
        date: new Date().toISOString(),
        durationMs: this.elapsedMs,
        distanceKm: parseFloat(this.totalDistanceKm.toFixed(2)),
        avgSpeedKmh: this.elapsedMs > 0 ? Math.round((this.totalDistanceKm / (this.elapsedMs / 3600000))) : 0,
        maxSpeedKmh: this.maxSpeedKmh,
        elevationGainM: Math.round(this.elevationGainMeters),
        elevationLossM: Math.round(this.elevationLossMeters),
        peakAltitudeM: Math.max(...(this.altHistory.length ? this.altHistory : [this.currentAltitudeMeters])),
        trackpointsCount: this.trackpoints.length,
        trackpoints: this.trackpoints
      };

      try {
        localStorage.setItem('racewars_last_session', JSON.stringify(sessionData));
        console.log('[Telemetry] Sesión guardada con éxito en almacenamiento:', sessionData);
      } catch (e) {
        console.error('[Telemetry] Error guardando sesión:', e);
      }

      this._dispatchUpdate();
      return sessionData;
    }

    /**
     * Activa o desactiva el modo simulación manual para pruebas en estático
     */
    setSimulation(enabled) {
      this.isSimulating = enabled;
      if (!enabled) {
        this.startHardwareGps();
      }
    }

    onUpdate(callback) {
      this.updateListeners.add(callback);
      return () => this.updateListeners.delete(callback);
    }

    onStatusChange(callback) {
      this.statusListeners.add(callback);
      return () => this.statusListeners.delete(callback);
    }

    _notifyStatus(statusText, state) {
      this.statusListeners.forEach(fn => fn({ text: statusText, state }));
    }

    _dispatchUpdate() {
      const payload = {
        speed: this.currentSpeedKmh,
        maxSpeed: this.maxSpeedKmh,
        distanceKm: parseFloat(this.totalDistanceKm.toFixed(2)),
        elapsedMs: this.elapsedMs,
        currentAltitude: Math.round(this.currentAltitudeMeters),
        elevationGain: Math.round(this.elevationGainMeters),
        altHistory: [...this.altHistory],
        isRecording: this.isRecording,
        isSimulating: this.isSimulating,
        gpsAccuracy: this.gpsAccuracyMeters
      };

      this.updateListeners.forEach(fn => fn(payload));
    }
  }

  window.RealTelemetryEngine = RealTelemetryEngine;
})();
