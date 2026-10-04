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

      // Estado de conectividad GPS y regla de velocidad asumida sin señal (máximo 80 km/h)
      this.gpsConnected = false;
      this.lastFixTimestamp = 0;
      this.gpsWatchdogInterval = null;
      this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH = 80; // Al perder conexión GPS, velocidad asumida máx 80 km/h
      this.GPS_TIMEOUT_MS = 2500; // 2.5s sin fix se considera pérdida de señal (túneles, etc.)
      this.isSpeedEstimated = false;
      this._lastEstimatedPtTime = 0;

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

      // 3. Iniciar vigilante (watchdog) de conectividad y timeout GPS
      this._startGpsWatchdog();

      // 4. Escuchar eventos de conectividad del dispositivo
      if (typeof window !== 'undefined') {
        window.addEventListener('offline', () => {
          this._handleGpsConnectionLost('CONEXIÓN A INTERNET / GPS PERDIDA');
        });
        window.addEventListener('online', () => {
          if (this.gpsWatchId !== null) {
            this._notifyStatus('BUSCANDO SATÉLITES GPS...', 'searching');
          }
        });
      }
    }

    /**
     * Vigila la cadencia de señales GPS. Si transcurre más de GPS_TIMEOUT_MS (2.5s) sin
     * una lectura válida, activa el protocolo de pérdida de conexión (asumiendo máx 80 km/h).
     */
    _startGpsWatchdog() {
      if (this.gpsWatchdogInterval) clearInterval(this.gpsWatchdogInterval);
      this.gpsWatchdogInterval = setInterval(() => {
        const now = Date.now();
        if (this.lastFixTimestamp > 0 && (now - this.lastFixTimestamp) > this.GPS_TIMEOUT_MS) {
          if (this.gpsConnected) {
            this._handleGpsConnectionLost('SEÑAL GPS PERDIDA (TÚNEL / SIN COBERTURA)');
          }
        }
      }, 1000);
    }

    /**
     * Protocolo cuando se pierde la conexión GPS:
     * - La velocidad asumida pasa a ser como MÁXIMO 80 km/h.
     * - Si venía más rápido (> 80 km/h), se reduce inmediatamente a 80 km/h.
     * - Si venía a menor velocidad (ej. 60 km/h), se mantiene en 60 km/h.
     */
    _handleGpsConnectionLost(reason = 'SEÑAL GPS NO DISPONIBLE') {
      this.gpsConnected = false;
      this.gpsAvailable = false;
      this.isSpeedEstimated = true;

      // REGLA CLAVE: La velocidad que debe asumir la app es máximo 80 km/h
      if (this.currentSpeedKmh > this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH) {
        console.log(`[Telemetry] Pérdida de GPS. Velocidad acotada de ${this.currentSpeedKmh} km/h a ${this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH} km/h`);
        this.currentSpeedKmh = this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH;
      } else if (this.currentSpeedKmh > 0) {
        this.currentSpeedKmh = Math.min(this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH, this.currentSpeedKmh);
      }

      this._notifyStatus(`SIN GPS (VEL. MÁX ${this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH} km/h)`, 'warning');
      this._dispatchUpdate();
    }

    _handleGpsSuccess(pos) {
      const coords = pos.coords;
      const timestamp = pos.timestamp || Date.now();
      const accuracy = Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null;
      this.gpsAccuracyMeters = accuracy;

      const lat = coords.latitude;
      const lng = coords.longitude;
      const rawAlt = Number.isFinite(coords.altitude) ? coords.altitude : null;

      // Límites físicos de telemetría de automoción
      const MAX_REALISTIC_SPEED_KMH = 350; // Techo físico absoluto para vehículos terrestres
      const MAX_ACCEL_KMH_PER_SEC = 55;   // ~15.3 m/s² (aceleración máxima absoluta de hiperdeportivo)
      const MAX_REASONABLE_ACCURACY_M = 45; // Filtrar triangulaciones pobres (torres celulares / Wi-Fi)
      const MIN_DT_DIFF_SPEED_S = 0.4;    // Intervalo temporal mínimo para derivadas espaciales

      const isAccuracyValid = accuracy !== null && accuracy >= 0 && accuracy <= MAX_REASONABLE_ACCURACY_M;

      // Si la precisión está degradada (> 45m), tratar como pérdida de señal útil: acotar a máx 80 km/h
      if (!isAccuracyValid) {
        if (this.currentSpeedKmh > this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH) {
          this.currentSpeedKmh = this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH;
        }
        this.gpsConnected = false;
        this.gpsAvailable = false;
        this.isSpeedEstimated = true;
        this._notifyStatus(`SEÑAL GPS POBRE (±${accuracy}m - MÁX ${this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH} km/h)`, 'warning');
        this._dispatchUpdate();
        return;
      }

      // Señal GPS válida y conectada
      this.gpsAvailable = true;
      this.gpsConnected = true;
      this.lastFixTimestamp = Date.now();
      this.isSpeedEstimated = false;

      // 1. Cálculo y filtrado de velocidad real (km/h)
      let calculatedSpeed = 0;
      let speedDetermined = false;

      // Prioridad 1: Velocidad nativa por hardware (Doppler GNSS)
      if (coords.speed !== null && !isNaN(coords.speed) && coords.speed >= 0) {
        const hardwareSpeedKmh = coords.speed * 3.6;
        if (hardwareSpeedKmh <= MAX_REALISTIC_SPEED_KMH) {
          calculatedSpeed = hardwareSpeedKmh;
          speedDetermined = true;
        }
      }

      // Prioridad 2: Cálculo diferencial de distancia / tiempo
      if (!speedDetermined && this.lastPosition && isAccuracyValid) {
        const dtMs = timestamp - this.lastPosition.timestamp;
        const dtSeconds = dtMs / 1000;

        if (dtSeconds >= MIN_DT_DIFF_SPEED_S && dtSeconds <= 15.0 && (this.lastPosition.accuracy || 10) <= MAX_REASONABLE_ACCURACY_M) {
          const distKm = this._haversineDistance(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
          const rawDiffSpeed = distKm / (dtSeconds / 3600);

          if (rawDiffSpeed <= MAX_REALISTIC_SPEED_KMH) {
            const accelDelta = Math.abs(rawDiffSpeed - this.currentSpeedKmh);
            const accelRate = accelDelta / dtSeconds;

            if (accelRate <= MAX_ACCEL_KMH_PER_SEC || this.currentSpeedKmh === 0) {
              calculatedSpeed = rawDiffSpeed;
              speedDetermined = true;
            } else {
              // Suavizado adaptativo ante aceleración brusca
              calculatedSpeed = (this.currentSpeedKmh * 0.7) + (rawDiffSpeed * 0.3);
              speedDetermined = true;
            }
          }
        } else if (dtSeconds < MIN_DT_DIFF_SPEED_S) {
          // dt demasiado pequeño: conservar velocidad previa para evitar picos por fluctuaciones temporales
          calculatedSpeed = this.currentSpeedKmh;
          speedDetermined = true;
        }
      }

      if (!speedDetermined) {
        if (this.lastPosition && (timestamp - this.lastPosition.timestamp) < 3000) {
          calculatedSpeed = this.currentSpeedKmh;
        } else {
          calculatedSpeed = 0;
        }
      }

      // Filtro de parada / ruido estacionario cuando el vehículo está detenido
      if (calculatedSpeed < 1.8) {
        calculatedSpeed = 0;
      }

      // Clamp estricto final
      this.currentSpeedKmh = Math.round(Math.min(MAX_REALISTIC_SPEED_KMH, Math.max(0, calculatedSpeed)));
      if (this.currentSpeedKmh > this.maxSpeedKmh && this.currentSpeedKmh <= MAX_REALISTIC_SPEED_KMH) {
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
      let isTeleportJump = false;
      if (this.lastPosition) {
        const deltaKm = this._haversineDistance(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
        const dtSeconds = Math.max(0.001, (timestamp - this.lastPosition.timestamp) / 1000);
        const impliedSpeed = deltaKm / (dtSeconds / 3600);

        if (impliedSpeed > MAX_REALISTIC_SPEED_KMH) {
          isTeleportJump = true;
          console.warn(`[Telemetry] Salto cuántico de GPS descartado: ${deltaKm.toFixed(3)}km en ${dtSeconds.toFixed(2)}s (${Math.round(impliedSpeed)} km/h)`);
        }
      }

      if (this.isRecording && isAccuracyValid && !isTeleportJump) {
        if (this.lastPosition) {
          const deltaKm = this._haversineDistance(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
          // Filtrar micro-saltos de precisión (menos de 3 metros cuando velocidad es 0)
          if (deltaKm > 0.003 || this.currentSpeedKmh > 2) {
            this.totalDistanceKm += deltaKm;
          }
        }

        // Guardar trackpoint limpio
        this.trackpoints.push({
          timestamp: timestamp,
          lat: lat,
          lng: lng,
          speedKmh: this.currentSpeedKmh,
          altitudeM: rawAlt !== null ? this.currentAltitudeMeters : null,
          accuracyM: accuracy
        });
      } else if (this.isRecording && this.trackpoints.length === 0 && isAccuracyValid) {
        // Primer punto de origen
        this.trackpoints.push({
          timestamp: timestamp,
          lat: lat,
          lng: lng,
          speedKmh: this.currentSpeedKmh,
          altitudeM: rawAlt !== null ? this.currentAltitudeMeters : null,
          accuracyM: accuracy
        });
      }

      // Solo actualizar lastPosition si el punto es de precisión válida y no es un salto cuántico
      if (isAccuracyValid && !isTeleportJump) {
        this.lastPosition = { lat, lng, timestamp, accuracy };
      }

      // Notificar estado de GPS activo y enviar datos a la UI
      this._notifyStatus(`GPS EN VIVO (±${this.gpsAccuracyMeters}m)`, 'active');
      this._dispatchUpdate();
    }

    _handleGpsError(err) {
      console.warn('[Telemetry] Error obteniendo GPS:', err ? err.message : '');
      this._handleGpsConnectionLost(err ? err.message : 'Error GPS');
      if (err && err.code === 1) {
        this._notifyStatus('PERMISO GPS DENEGADO', 'error');
      } else if (err && err.code === 2) {
        this._notifyStatus(`SEÑAL GPS NO DISPONIBLE (MÁX ${this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH} km/h)`, 'warning');
      } else {
        this._notifyStatus(`BUSCANDO SATÉLITES (MÁX ${this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH} km/h)`, 'searching');
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

      // Temporizador de tiempo transcurrido y odometría de respaldo ante pérdida de GPS
      this.timerInterval = setInterval(() => {
        if (this.isRecording) {
          this.elapsedMs = Date.now() - this.recordStartTime;

          // Si no hay conexión GPS activa durante la grabación (ej: túnel / subterráneo)
          if (!this.gpsConnected && this.currentSpeedKmh > 0) {
            // REGLA CLAVE: La velocidad asumida nunca debe superar 80 km/h
            if (this.currentSpeedKmh > this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH) {
              this.currentSpeedKmh = this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH;
            }

            // Odometría por estimación (dead reckoning) a velocidad asumida (<= 80 km/h)
            const dtHours = 0.1 / 3600; // cada 100 ms
            this.totalDistanceKm += (this.currentSpeedKmh * dtHours);

            // Guardar punto interpolado cada 1 segundo para continuidad de ruta en túneles
            const now = Date.now();
            if (!this._lastEstimatedPtTime || (now - this._lastEstimatedPtTime) >= 1000) {
              this._lastEstimatedPtTime = now;
              if (this.lastPosition) {
                this.trackpoints.push({
                  timestamp: now,
                  lat: this.lastPosition.lat,
                  lng: this.lastPosition.lng,
                  speedKmh: this.currentSpeedKmh, // Máximo 80 km/h
                  altitudeM: this.altitudeAvailable ? this.currentAltitudeMeters : null,
                  accuracyM: null,
                  isEstimated: true,
                  gpsConnected: false
                });
              }
            }
          }

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

      // Calcular velocidad máxima verificada a partir de los puntos limpios (máx 350 km/h)
      const validSpeeds = this.trackpoints
        .map(p => Number(p.speedKmh))
        .filter(s => Number.isFinite(s) && s > 0 && s <= 350);
      const cleanMaxFromPoints = validSpeeds.length ? Math.round(Math.max(...validSpeeds)) : 0;
      const cleanMaxSpeed = (this.maxSpeedKmh > 0 && this.maxSpeedKmh <= 350)
        ? Math.max(this.maxSpeedKmh, cleanMaxFromPoints)
        : cleanMaxFromPoints;

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
        maxSpeedKmh: cleanMaxSpeed,
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
        gpsAccuracy: this.gpsAccuracyMeters,
        gpsConnected: this.gpsConnected,
        isSpeedEstimated: this.isSpeedEstimated,
        maxAssumedSpeedWithoutGps: this.MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH
      };

      this.updateListeners.forEach(fn => fn(payload));
    }
  }

  window.RealTelemetryEngine = RealTelemetryEngine;
})();
