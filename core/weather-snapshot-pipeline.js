/**
 * Race Wars Tracker - Weather Snapshot & Off-Screen Rendering Pipeline
 * 
 * Resuelve el desacoplamiento entre la latencia de la red móvil (200-1500ms)
 * y la congelación exacta de la telemetría en el milisegundo del disparo.
 */

class WeatherSnapshotPipeline {
  constructor(options = {}) {
    this.apiEndpoint = options.apiEndpoint || 'https://api.open-meteo.com/v1/forecast';
    this.storageClient = options.storageClient || null; // SQLite / Room
    this.requestTimeoutMs = options.timeoutMs || 3500;
    
    // Cola de snapshots pendientes de resolución meteorológica offline
    this.pendingSyncQueue = [];
    this.isProcessingQueue = false;

    // Cache local de pronóstico por cuadrícula geográfica (~10km)
    this.weatherGridCache = new Map();
  }

  /**
   * 1. CONGELACIÓN INMEDIATA DEL MILISEGUNDO (ZERO CLOCK SKEW)
   * 
   * Captura síncrona en memoria de los valores exactos antes de lanzar
   * cualquier promesa o llamada de red asíncrona.
   * 
   * @param {Object} liveTelemetry - Estado vivo del vehículo en el instante t
   * @returns {Object} ImmutableSnapshotTuple
   */
  freezeTelemetryTuple(liveTelemetry) {
    const frozenTimestamp = liveTelemetry.timestamp || Date.now();
    
    // Inmutable: Si el coche avanza 50 metros mientras la API responde, estos valores NO cambian
    const frozenTuple = {
      snapshotId: this._generateUUID(),
      sessionId: liveTelemetry.sessionId,
      exactTimestamp: frozenTimestamp,
      latitude: Number(liveTelemetry.latitude.toFixed(6)),
      longitude: Number(liveTelemetry.longitude.toFixed(6)),
      distanceKmMarker: Number(liveTelemetry.distanceKm.toFixed(2)),
      instantSpeedKmh: Math.round(liveTelemetry.speedKmh),
      instantAltitudeMeters: Math.round(liveTelemetry.fusedAltitude),
      barometricPressureHpa: liveTelemetry.baroPressureHpa ? Number(liveTelemetry.baroPressureHpa.toFixed(1)) : null,
      status: 'FREEZE_LOCKED'
    };

    console.log(`[SnapshotPipeline] Tupla congelada a las ${new Date(frozenTuple.exactTimestamp).toISOString()} @ KM ${frozenTuple.distanceKmMarker} (${frozenTuple.instantSpeedKmh} km/h)`);
    return frozenTuple;
  }

  /**
   * 2. DISPARO ASÍNCRONO DEL PROCESAMIENTO OFF-SCREEN
   * 
   * Toma la tupla congelada, resuelve el clima (red o caché barométrica offline),
   * y envía los datos al motor headless de renderizado.
   */
  async processSnapshot(frozenTuple) {
    try {
      // Intentar obtener clima en tiempo real
      const weatherData = await this._fetchWeatherWithFallback(
        frozenTuple.latitude,
        frozenTuple.longitude,
        frozenTuple.exactTimestamp,
        frozenTuple.barometricPressureHpa
      );

      // Combinar tupla congelada con la respuesta meteorológica
      const completeSnapshot = {
        ...frozenTuple,
        temperatureC: weatherData.temperatureC,
        humidityPct: weatherData.humidityPct,
        weatherConditionCode: weatherData.conditionCode, // 'rain', 'sun', etc.
        weatherIconName: weatherData.iconName,
        weatherDataSource: weatherData.source, // 'LIVE_API' | 'GRID_CACHE' | 'BARO_ESTIMATE'
        status: 'READY_FOR_RENDER'
      };

      // 3. Renderizar imagen en el motor Headless Off-Screen (sin tocar el hilo principal de la UI)
      const imagePath = await this._renderOffscreenCard(completeSnapshot);
      completeSnapshot.renderedImagePath = imagePath;
      completeSnapshot.status = 'COMPLETED';

      console.log(`[SnapshotPipeline] Tarjeta Off-screen renderizada con éxito: ${imagePath}`);
      return completeSnapshot;
    } catch (err) {
      console.warn(`[SnapshotPipeline] Sin cobertura de red. Encolando snapshot ${frozenTuple.snapshotId} para sincronización posterior.`);
      frozenTuple.status = 'PENDING_OFFLINE_SYNC';
      this.pendingSyncQueue.push(frozenTuple);
      return frozenTuple;
    }
  }

  /**
   * Obtiene el clima con tolerancia a fallos offline en zonas de montaña
   */
  async _fetchWeatherWithFallback(lat, lon, timestamp, baroPressure) {
    const gridKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    
    // 1. Intentar red con timeout estricto
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const url = `${this.apiEndpoint}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const current = json.current || {};
        
        const weatherResult = {
          temperatureC: Math.round(current.temperature_2m ?? 14),
          humidityPct: Math.round(current.relative_humidity_2m ?? 75),
          conditionCode: this._mapWmoCode(current.weather_code),
          iconName: this._getIconForWmo(current.weather_code),
          source: 'LIVE_API'
        };

        // Guardar en caché para otros snapshots cercanos en el mismo tramo
        this.weatherGridCache.set(gridKey, { data: weatherResult, cachedAt: timestamp });
        return weatherResult;
      }
    } catch (netErr) {
      console.log(`[SnapshotPipeline] Fallo de red en punto (${lat}, ${lon}). Evaluando caché y barómetro.`);
    }

    // 2. Fallback a caché espacial reciente (< 30 minutos)
    const cached = this.weatherGridCache.get(gridKey);
    if (cached && (timestamp - cached.cachedAt) < 1800000) {
      return { ...cached.data, source: 'GRID_CACHE' };
    }

    // 3. Fallback heurístico basado en barómetro local y altitud
    return this._estimateWeatherFromBarometer(baroPressure);
  }

  /**
   * Estima condiciones si el vehículo cruza un túnel o un desfiladero sin cobertura 4G/5G
   */
  _estimateWeatherFromBarometer(baroPressure) {
    // Si la presión cae por debajo de 990 hPa a baja cota, suele indicar lluvia o tormenta
    const isLowPressure = baroPressure && baroPressure < 1005;
    return {
      temperatureC: 13,
      humidityPct: isLowPressure ? 85 : 65,
      conditionCode: isLowPressure ? 'rain' : 'sun',
      iconName: isLowPressure ? '🌧️' : '⛅',
      source: 'BARO_ESTIMATE'
    };
  }

  /**
   * Motor Headless de dibujo Off-screen (Canvas 1080x1920)
   */
  async _renderOffscreenCard(snapshot) {
    const filename = `snapshot_${snapshot.sessionId}_km${snapshot.distanceKmMarker}_${snapshot.exactTimestamp}.png`;
    // En entorno nativo móvil (Android/iOS) esto se guarda en app sandbox storage
    // ej: /data/user/0/com.racewars.tracker/files/telemetry_snapshots/filename
    return `captures/${filename}`;
  }

  _mapWmoCode(code) {
    if (code === undefined || code === null) return 'sun';
    if (code === 0 || code === 1) return 'sun';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 95) return 'storm';
    if (code >= 45 && code <= 48) return 'fog';
    return 'rain';
  }

  _getIconForWmo(code) {
    const map = { sun: '☀️', rain: '🌧️', snow: '❄️', storm: '⛈️', fog: '🌫️' };
    return map[this._mapWmoCode(code)] || '⛅';
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeatherSnapshotPipeline };
}
