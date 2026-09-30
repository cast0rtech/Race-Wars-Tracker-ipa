/**
 * Race Wars Tracker - Sensor Fusion Engine (GPS + Barómetro)
 * 
 * Resuelve el problema del ruido vertical en el GPS y la deriva barométrica
 * mediante un Filtro Complementario Adaptativo y cálculo de +D/-D con Histéresis.
 */

class SensorFusionEngine {
  constructor(options = {}) {
    // Presión a nivel del mar estándar (hPa)
    this.standardSeaLevelPressure = options.seaLevelPressure || 1013.25;

    // Estado interno del filtro
    this.isInitialized = false;
    this.fusedAltitude = 0;
    this.verticalSpeed = 0; // m/s
    this.lastTimestamp = 0;
    this.lastBaroAltitude = null;

    // Parámetros de Histéresis para +D y -D (evitar inflar desnivel por ruido)
    // Se requiere un movimiento acumulado mínimo en una dirección para confirmar cambio de cota
    this.elevationGain = 0; // +D acumulado (m)
    this.elevationLoss = 0; // -D acumulado (m)
    this.lastPeakAltitude = 0;
    this.lastValleyAltitude = 0;
    this.hysteresisThresholdMeters = options.hysteresisThreshold || 3.0; // Umbral de 3 metros
    this.currentTrend = 0; // +1 subiendo, -1 bajando, 0 neutro
  }

  /**
   * Convierte presión barométrica en altitud usando la fórmula hipsométrica ISA
   * @param {number} pressureHpa - Presión atmosférica en hPa
   * @returns {number} Altitud en metros
   */
  pressureToAltitude(pressureHpa) {
    if (!pressureHpa || pressureHpa <= 0) return 0;
    // Fórmula barométrica estándar internacional
    return 44330.0 * (1.0 - Math.pow(pressureHpa / this.standardSeaLevelPressure, 0.190295));
  }

  /**
   * Actualiza la fusión sensorial con una nueva muestra de GPS y Barómetro
   * 
   * @param {Object} sample
   * @param {number} sample.timestamp - Epoch ms
   * @param {number} sample.gpsAltitude - Altitud GPS cruda (m)
   * @param {number} sample.gpsAccuracyV - Precisión vertical GPS (m)
   * @param {number} [sample.baroPressureHpa] - Presión del barómetro si está disponible (hPa)
   * @returns {Object} { fusedAltitude, verticalSpeed, elevationGain, elevationLoss }
   */
  update(sample) {
    const { timestamp, gpsAltitude, gpsAccuracyV = 10, baroPressureHpa } = sample;

    // 1. Inicialización en el primer punto
    if (!this.isInitialized) {
      this.fusedAltitude = gpsAltitude;
      this.lastPeakAltitude = gpsAltitude;
      this.lastValleyAltitude = gpsAltitude;
      this.lastTimestamp = timestamp;
      if (baroPressureHpa) {
        this.lastBaroAltitude = this.pressureToAltitude(baroPressureHpa);
      }
      this.isInitialized = true;
      return {
        fusedAltitude: this.fusedAltitude,
        verticalSpeed: 0,
        elevationGain: 0,
        elevationLoss: 0
      };
    }

    const dt = Math.max(0.05, (timestamp - this.lastTimestamp) / 1000.0); // segundos
    this.lastTimestamp = timestamp;

    let targetAltitude = gpsAltitude;

    // 2. Si hay barómetro disponible, aplicamos el Filtro Complementario de alta precisión
    if (baroPressureHpa && baroPressureHpa > 0) {
      const currentBaroAlt = this.pressureToAltitude(baroPressureHpa);

      if (this.lastBaroAltitude !== null) {
        // El barómetro mide con gran exactitud la DIFERENCIA de altitud relativa (Δh)
        const deltaBaro = currentBaroAlt - this.lastBaroAltitude;
        
        // Ponderación dinámica basada en la precisión del GPS:
        // A mayor error vertical del GPS (ej: 18m), más peso le damos a la inercia barométrica (alpha alto).
        // Si el GPS reporta excelente precisión (ej: 3m), aumentamos la corrección absoluta.
        const gpsWeight = Math.max(0.02, Math.min(0.20, 1.0 / Math.max(1.0, gpsAccuracyV)));
        const alpha = 1.0 - gpsWeight;

        // Fused = Alpha * (Alt_anterior + Delta_baro) + (1 - Alpha) * Alt_GPS
        this.fusedAltitude = alpha * (this.fusedAltitude + deltaBaro) + (1.0 - alpha) * gpsAltitude;
      } else {
        this.fusedAltitude = gpsAltitude;
      }
      this.lastBaroAltitude = currentBaroAlt;
    } else {
      // Fallback solo GPS con filtro de media móvil exponencial para suavizar picos espurios
      const smoothingFactor = Math.max(0.1, Math.min(0.4, 2.0 / Math.max(2.0, gpsAccuracyV)));
      this.fusedAltitude = (this.fusedAltitude * (1.0 - smoothingFactor)) + (gpsAltitude * smoothingFactor);
    }

    // 3. Cálculo de Velocidad Vertical (m/s)
    const prevAlt = sample.prevFusedAlt || this.fusedAltitude;
    this.verticalSpeed = (this.fusedAltitude - prevAlt) / dt;

    // 4. Algoritmo Determinista de Desnivel Acumulado (+D / -D) con Histéresis
    this._accumulateElevation(this.fusedAltitude);

    return {
      fusedAltitude: Number(this.fusedAltitude.toFixed(2)),
      verticalSpeed: Number(this.verticalSpeed.toFixed(2)),
      elevationGain: Math.round(this.elevationGain),
      elevationLoss: Math.round(this.elevationLoss)
    };
  }

  /**
   * Algoritmo de filtrado de histéresis (Deadband Filter)
   * Evita registrar desnivel por vibraciones del vehículo o turbulencias barométricas en cabina.
   */
  _accumulateElevation(currentAlt) {
    if (this.currentTrend === 0) {
      if (currentAlt - this.lastValleyAltitude >= this.hysteresisThresholdMeters) {
        this.currentTrend = 1;
        this.elevationGain += (currentAlt - this.lastValleyAltitude);
        this.lastPeakAltitude = currentAlt;
      } else if (this.lastPeakAltitude - currentAlt >= this.hysteresisThresholdMeters) {
        this.currentTrend = -1;
        this.elevationLoss += (this.lastPeakAltitude - currentAlt);
        this.lastValleyAltitude = currentAlt;
      }
    } else if (this.currentTrend === 1) {
      // Estamos en tendencia de subida (+D)
      if (currentAlt > this.lastPeakAltitude) {
        this.elevationGain += (currentAlt - this.lastPeakAltitude);
        this.lastPeakAltitude = currentAlt;
      } else if (this.lastPeakAltitude - currentAlt >= this.hysteresisThresholdMeters) {
        // Se confirma cambio de tendencia a bajada (-D)
        this.currentTrend = -1;
        this.lastValleyAltitude = currentAlt;
        this.elevationLoss += (this.lastPeakAltitude - currentAlt);
      }
    } else if (this.currentTrend === -1) {
      // Estamos en tendencia de bajada (-D)
      if (currentAlt < this.lastValleyAltitude) {
        this.elevationLoss += (this.lastValleyAltitude - currentAlt);
        this.lastValleyAltitude = currentAlt;
      } else if (currentAlt - this.lastValleyAltitude >= this.hysteresisThresholdMeters) {
        // Se confirma cambio de tendencia a subida (+D)
        this.currentTrend = 1;
        this.lastPeakAltitude = currentAlt;
        this.elevationGain += (currentAlt - this.lastValleyAltitude);
      }
    }
  }

  reset() {
    this.isInitialized = false;
    this.fusedAltitude = 0;
    this.verticalSpeed = 0;
    this.lastTimestamp = 0;
    this.lastBaroAltitude = null;
    this.elevationGain = 0;
    this.elevationLoss = 0;
    this.currentTrend = 0;
  }
}

// Exportación modular universal (Node + Browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SensorFusionEngine };
} else {
  window.SensorFusionEngine = SensorFusionEngine;
}
