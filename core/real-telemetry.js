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
      // Hardware state
      this.gpsAvailable = false;
      this.gpsAccuracyMeters = null;
      this.gpsWatchId = null;
      this.wakeLock = null;

      // Estado de grabación
      this.isRecording = false;
      this.recordStartTime = 0;
      this.elapsedMs = 0;
      this.timerInterval = null;
      this.checkpointInterval = null;
      this.recordingSessionId = null;

      // Métricas en tiempo real
      this.currentSpeedKmh = 0;
      this.maxSpeedKmh = 0;
      this.totalDistanceKm = 0;
      this.currentAltitudeMeters = 0;
      this.altitudeAvailable = false;
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
      if (this.gpsWatchId !== null) return;
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
      this.gpsAvailable = true;
      const coords = pos.coords;
      const timestamp = pos.timestamp || Date.now();
      this.gpsAccuracyMeters = Math.round(coords.accuracy);

      const lat = coords.latitude;
      const lng = coords.longitude;
      const rawAlt = Number.isFinite(coords.altitude) ? coords.altitude : null;

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
      if (this.fusion && rawAlt !== null) {
        const fResult = this.fusion.update({
          timestamp: timestamp,
          gpsAltitude: rawAlt,
          gpsAccuracyV: coords.altitudeAccuracy || 8
        });
        this.currentAltitudeMeters = fResult.fusedAltitude;
        this.altitudeAvailable = true;
        if (this.isRecording) {
          this.elevationGainMeters = fResult.elevationGain;
          this.elevationLossMeters = fResult.elevationLoss;
        }
      } else if (rawAlt !== null) {
        this.currentAltitudeMeters = Math.round(rawAlt);
        this.altitudeAvailable = true;
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
          altitudeM: rawAlt !== null ? this.currentAltitudeMeters : null
        });
      } else if (this.isRecording) {
        // The first fix after pressing Start is the route origin.
        this.trackpoints.push({ timestamp, lat, lng, speedKmh: this.currentSpeedKmh, altitudeM: rawAlt !== null ? this.currentAltitudeMeters : null });
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
      if (this.isRecording) return;
      this.isRecording = true;
      this.recordStartTime = Date.now();
      this.recordingSessionId = 'session_' + this.recordStartTime + '_' + Math.random().toString(36).slice(2, 8);
      this.elapsedMs = 0;
      this.trackpoints = [];
      this.totalDistanceKm = 0;
      this.elevationGainMeters = 0;
      this.elevationLossMeters = 0;
      this.maxSpeedKmh = this.currentSpeedKmh;

      // Seed the route with the most recent real fix so the first recorded segment
      // starts at the user's location instead of one GPS interval later.
      if (this.lastPosition) {
        this.trackpoints.push({
          timestamp: this.lastPosition.timestamp,
          lat: this.lastPosition.lat,
          lng: this.lastPosition.lng,
          speedKmh: this.currentSpeedKmh,
          altitudeM: this.altitudeAvailable ? this.currentAltitudeMeters : null
        });
      }

      if (this.fusion) {
        this.fusion.reset();
      }

      // Temporizador de tiempo transcurrido
      this.timerInterval = setInterval(() => {
        if (this.isRecording) {
          this.elapsedMs = Date.now() - this.recordStartTime;
          this._dispatchUpdate();
        }
      }, 100);

      // Persist a recoverable draft during long routes, not only when Stop is pressed.
      this.checkpointInterval = setInterval(() => {
        this._persistRecordingDraft().catch(error => console.warn('[Telemetry] No se pudo guardar el punto de recuperación:', error));
      }, 10000);

      console.log('[Telemetry] Grabación de ruta iniciada con GPS real.');
      this._dispatchUpdate();
    }

    /**
     * Detiene la grabación y persiste la sesión para el Debrief / Resumen
     */
    async stopRecording() {
      if (!this.isRecording) return null;
      this.elapsedMs = Math.max(this.elapsedMs, Date.now() - this.recordStartTime);
      this.isRecording = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.checkpointInterval) {
        clearInterval(this.checkpointInterval);
        this.checkpointInterval = null;
      }

      // Guardar sesión en almacenamiento local para la pantalla de Resumen
      const sessionData = this._createSessionData('COMPLETED');

      if (window.RaceWarsSessionStore) {
        await window.RaceWarsSessionStore.save(sessionData);
        // Preserve compatibility with older app builds that read the previous key.
        try { localStorage.setItem('racewars_last_session', JSON.stringify(sessionData)); } catch (_) { /* IndexedDB is authoritative. */ }
        console.log('[Telemetry] Sesión persistida:', sessionData.id);
      } else {
        localStorage.setItem('racewars_last_session', JSON.stringify(sessionData));
      }

      this._dispatchUpdate();
      return sessionData;
    }

    _createSessionData(status) {
      const altitudePoints = this.trackpoints.filter(point => Number.isFinite(point.altitudeM));
      const peakAltitude = altitudePoints.reduce((value, point) => Math.max(value, point.altitudeM), -Infinity);
      const minAltitude = altitudePoints.reduce((value, point) => Math.min(value, point.altitudeM), Infinity);
      return {
        id: this.recordingSessionId || ('session_' + this.recordStartTime),
        status,
        title: `Ruta GPS Real ${new Date(this.recordStartTime).toLocaleTimeString()}`,
        startedAt: this.recordStartTime,
        endedAt: status === 'COMPLETED' ? Date.now() : null,
        date: new Date(this.recordStartTime || Date.now()).toISOString(),
        durationMs: this.elapsedMs,
        distanceKm: parseFloat(this.totalDistanceKm.toFixed(2)),
        avgSpeedKmh: this.elapsedMs > 0 ? Math.round(this.totalDistanceKm / (this.elapsedMs / 3600000)) : 0,
        maxSpeedKmh: this.maxSpeedKmh,
        elevationGainM: altitudePoints.length ? Math.round(this.elevationGainMeters) : null,
        elevationLossM: altitudePoints.length ? Math.round(this.elevationLossMeters) : null,
        peakAltitudeM: altitudePoints.length ? Math.round(peakAltitude) : null,
        minAltitudeM: altitudePoints.length ? Math.round(minAltitude) : null,
        trackpointsCount: this.trackpoints.length,
        trackpoints: this.trackpoints
      };
    }

    async _persistRecordingDraft() {
      if (!this.isRecording || !window.RaceWarsSessionStore || this.trackpoints.length === 0) return;
      this.elapsedMs = Math.max(this.elapsedMs, Date.now() - this.recordStartTime);
      await window.RaceWarsSessionStore.save(this._createSessionData('INTERRUPTED'));
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
        currentAltitude: this.altitudeAvailable ? Math.round(this.currentAltitudeMeters) : null,
        altitudeAvailable: this.altitudeAvailable,
        elevationGain: Math.round(this.elevationGainMeters),
        altHistory: [...this.altHistory],
        isRecording: this.isRecording,
        gpsAccuracy: this.gpsAccuracyMeters
      };

      this.updateListeners.forEach(fn => fn(payload));
    }
  }

  window.RealTelemetryEngine = RealTelemetryEngine;
})();
