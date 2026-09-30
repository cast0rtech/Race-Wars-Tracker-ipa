/**
 * Race Wars Tracker - Background Manager & Bluetooth Trigger Core
 * 
 * Orquesta la persistencia en segundo plano, la gestión de memoria con buffer por lotes
 * y el disparador automático mediante enlace Bluetooth del vehículo.
 */

const { SensorFusionEngine } = require('./sensor-fusion');

class BackgroundTrackingManager {
  constructor(databaseClient, options = {}) {
    this.db = databaseClient; // Instancia SQLite / Room / IndexedDB
    this.fusionEngine = new SensorFusionEngine(options.fusionOptions || {});
    
    // Configuración Bluetooth
    this.monitoredBluetoothDevices = new Set(options.registeredDevices || []);
    this.autoTriggerEnabled = options.autoTriggerEnabled ?? true;
    this.bluetoothDisconnectGracePeriodMs = options.gracePeriodMs || 45000; // 45 seg de gracia
    this.disconnectTimer = null;

    // Estado del servicio
    this.activeSession = null;
    this.isRecording = false;

    // Buffer de escritura en lote (Batching para no colapsar I/O en disco)
    this.pointBuffer = [];
    this.maxBatchSize = options.maxBatchSize || 25; // Flush cada 25 puntos
    this.batchFlushIntervalMs = options.flushIntervalMs || 4000; // O cada 4 segundos
    this.flushTimer = null;
  }

  /**
   * 1. RECUPERACIÓN ANTE CIERRES INESPERADOS (CRASH RECOVERY)
   * Debe llamarse inmediatamente en el arranque de la app / servicio nativo.
   */
  async recoverOrphanedSessions() {
    console.log('[BackgroundManager] Verificando sesiones huérfanas...');
    // Busca sesiones que se quedaron en 'RECORDING' si el SO mató el proceso
    const query = `
      SELECT id, started_at FROM route_sessions 
      WHERE status = 'RECORDING' 
      ORDER BY started_at DESC LIMIT 1
    `;
    
    // Simulación de consulta a base de datos
    if (this.db && typeof this.db.query === 'function') {
      const rows = await this.db.query(query);
      if (rows && rows.length > 0) {
        const orphan = rows[0];
        console.warn(`[BackgroundManager] Recuperada sesión huérfana: ${orphan.id}`);
        await this.finalizeSession(orphan.id, 'CRASH_RECOVERED');
      }
    }
  }

  /**
   * 2. DISPARADOR AUTOMÁTICO BLUETOOTH (AUTO-ACQUISITION TRIGGER)
   */
  handleBluetoothEvent(event) {
    const { state, deviceMac, deviceName } = event; // 'CONNECTED' | 'DISCONNECTED'
    console.log(`[BluetoothTrigger] Evento: ${state} en dispositivo: ${deviceName} (${deviceMac})`);

    // Validar si el dispositivo es un vehículo conocido o adaptador OBD
    const isTargetDevice = this.monitoredBluetoothDevices.has(deviceMac) || 
                           this.monitoredBluetoothDevices.size === 0; // Si no hay lista, acepta vehículo actual

    if (!isTargetDevice) return;

    if (state === 'CONNECTED') {
      // Cancelar temporizador de desconexión si estaba activo (ej: reinicio rápido del contacto)
      if (this.disconnectTimer) {
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        console.log('[BluetoothTrigger] Cancelado temporizador de gracia. Manteniendo grabación.');
        return;
      }

      if (!this.isRecording && this.autoTriggerEnabled) {
        console.log('[BluetoothTrigger] Disparando inicio automático de ruta...');
        this.startSession({
          triggerSource: 'BLUETOOTH_AUTO',
          vehicleBtMac: deviceMac,
          vehicleBtName: deviceName
        });
      }
    } else if (state === 'DISCONNECTED') {
      if (this.isRecording) {
        console.log(`[BluetoothTrigger] Desconectado. Iniciando periodo de gracia de ${this.bluetoothDisconnectGracePeriodMs / 1000}s...`);
        // No cerramos inmediatamente (el usuario puede repostar gasolina o apagar el motor brevemente)
        this.disconnectTimer = setTimeout(() => {
          console.log('[BluetoothTrigger] Periodo de gracia expirado. Finalizando ruta.');
          this.stopSession();
          this.disconnectTimer = null;
        }, this.bluetoothDisconnectGracePeriodMs);
      }
    }
  }

  /**
   * 3. INICIO DE SESIÓN Y ASIGNACIÓN DE FOREGROUND SERVICE
   */
  async startSession(meta = {}) {
    const sessionId = this._generateUUID();
    const now = Date.now();

    this.activeSession = {
      id: sessionId,
      title: `Ruta ${new Date(now).toLocaleDateString()} ${new Date(now).toLocaleTimeString()}`,
      createdAt: now,
      startedAt: now,
      endedAt: null,
      status: 'RECORDING',
      triggerSource: meta.triggerSource || 'MANUAL',
      vehicleBluetoothMac: meta.vehicleBtMac || null,
      vehicleBluetoothName: meta.vehicleBtName || null,
      pointCount: 0
    };

    this.fusionEngine.reset();
    this.pointBuffer = [];
    this.isRecording = true;

    // Iniciar temporizador de volcado periódico
    this.flushTimer = setInterval(() => this.flushPointBuffer(), this.batchFlushIntervalMs);

    console.log(`[BackgroundManager] Sesión iniciada: ${sessionId}`);
    return this.activeSession;
  }

  /**
   * 4. INGESTIÓN DE PUNTOS EN CRUDO Y FUSIÓN SENSORIAL
   */
  ingestLocationSample(rawSample) {
    if (!this.isRecording || !this.activeSession) return null;

    // Fusión GPS + Barómetro en tiempo real
    const fusionResult = this.fusionEngine.update({
      timestamp: rawSample.timestamp,
      gpsAltitude: rawSample.altitude,
      gpsAccuracyV: rawSample.accuracyV || 8,
      baroPressureHpa: rawSample.barometerHpa
    });

    const point = {
      sessionId: this.activeSession.id,
      timestamp: rawSample.timestamp,
      latitude: rawSample.latitude,
      longitude: rawSample.longitude,
      gpsAltitude: rawSample.altitude,
      gpsAccuracyH: rawSample.accuracyH,
      gpsAccuracyV: rawSample.accuracyV || 8,
      gpsSpeedMps: rawSample.speedMps || 0,
      bearingDeg: rawSample.bearing || 0,
      satellitesUsed: rawSample.satellites || 0,
      baroPressureHpa: rawSample.barometerHpa || null,
      fusedAltitude: fusionResult.fusedAltitude,
      verticalSpeedMps: fusionResult.verticalSpeed,
      isMocked: rawSample.isMocked ? 1 : 0
    };

    // Añadir al buffer en memoria
    this.pointBuffer.push(point);
    this.activeSession.pointCount++;

    // Si el buffer supera el límite, forzar escritura en disco
    if (this.pointBuffer.length >= this.maxBatchSize) {
      this.flushPointBuffer();
    }

    return {
      point,
      fusion: fusionResult
    };
  }

  /**
   * 5. ESCRITURA EN DISCO POR LOTES (TRANSACTION BATCHING)
   */
  async flushPointBuffer() {
    if (this.pointBuffer.length === 0) return;

    const pointsToWrite = [...this.pointBuffer];
    this.pointBuffer = [];

    try {
      if (this.db && typeof this.db.insertPointsBatch === 'function') {
        await this.db.insertPointsBatch(pointsToWrite);
      }
      // console.log(`[BackgroundManager] Volcados ${pointsToWrite.length} puntos a SQLite.`);
    } catch (err) {
      console.error('[BackgroundManager] Error al volcar puntos:', err);
      // Reinsertar puntos no guardados para evitar pérdida de datos
      this.pointBuffer = pointsToWrite.concat(this.pointBuffer);
    }
  }

  /**
   * 6. FINALIZACIÓN Y CÁLCULO AGREGADO DETERMINISTA
   */
  async stopSession() {
    if (!this.isRecording || !this.activeSession) return;

    this.isRecording = false;
    if (this.flushTimer) clearInterval(this.flushTimer);

    // Vaciar los últimos puntos pendientes
    await this.flushPointBuffer();

    const sessionId = this.activeSession.id;
    await this.finalizeSession(sessionId, 'COMPLETED');
    this.activeSession = null;
    console.log(`[BackgroundManager] Sesión ${sessionId} cerrada con éxito.`);
  }

  async finalizeSession(sessionId, status = 'COMPLETED') {
    // Cálculo final determinista consultando la tabla en SQLite:
    // SELECT COUNT(*), MAX(gps_speed_mps), AVG(gps_speed_mps), MIN(fused_altitude), MAX(fused_altitude)
    console.log(`[BackgroundManager] Consolidando métricas deterministas para sesión ${sessionId}...`);
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
  module.exports = { BackgroundTrackingManager };
}
