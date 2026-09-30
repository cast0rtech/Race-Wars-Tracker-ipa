/**
 * Race Wars Tracker - Core Data Entities & Telemetry Models
 * 
 * Definición estricta de las entidades para almacenamiento en crudo (Raw Storage)
 * y cálculo determinista sin pérdidas.
 */

/**
 * Estado del ciclo de vida de la sesión
 */
export type SessionStatus = 'PENDING' | 'RECORDING' | 'PAUSED' | 'COMPLETED' | 'CRASH_RECOVERED';

/**
 * Disparador que inició la sesión
 */
export type TriggerSource = 'MANUAL' | 'BLUETOOTH_AUTO' | 'OBD_CONNECT' | 'GEO_FENCE';

/**
 * 1. Entidad Sesión / Ruta (RouteSession)
 */
export interface RouteSession {
  id: string; // UUID v4
  title: string;
  createdAt: number; // Unix timestamp ms
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  triggerSource: TriggerSource;
  vehicleBluetoothMac?: string;
  vehicleBluetoothName?: string;
  
  // Métricas agregadas (calculadas de forma determinista post-cierre)
  totalDistanceMeters: number;
  totalDurationMs: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainMeters: number; // +D
  elevationLossMeters: number; // -D
  minAltitudeMeters: number;
  maxAltitudeMeters: number;
  pointCount: number;
  gpxExportPath?: string;
}

/**
 * 2. Entidad Punto de Telemetría en Crudo (Raw TelemetryPoint)
 * Registrado a 1 Hz - 10 Hz directamente en SQLite con WAL mode.
 */
export interface RawTelemetryPoint {
  id?: number; // Auto-incremental local primary key
  sessionId: string; // Foreign Key -> RouteSession.id
  timestamp: number; // Epoch ms

  // Coordenadas geodésicas (WGS84)
  latitude: number;
  longitude: number;
  
  // GPS Nativo
  gpsAltitude: number; // Altitud elipsoidal GPS (con posible ruido)
  gpsAccuracyH: number; // Precisión horizontal estimada en metros
  gpsAccuracyV: number; // Precisión vertical estimada en metros
  gpsSpeedMps: number; // Velocidad nativa por efecto Doppler (m/s)
  bearingDeg: number; // Dirección en grados (0 - 359.9)
  satellitesUsed?: number;

  // Barómetro
  barometricPressureHpa?: number; // Presión atmosférica en hectopascales
  barometricRawAlt?: number; // Altitud barométrica pura calculada por ISA

  // Fusión Sensorial
  fusedAltitude: number; // Altitud filtrada por Kalman / Filtro Complementario
  verticalSpeedMps: number; // Tasa de ascenso/descenso (m/s)
  
  // Flags de integridad
  isMocked: boolean; // Detección de fake GPS
  batteryLevelPct?: number;
}

/**
 * 3. Entidad Captura Meteorológica Off-Screen (WeatherSnapshot)
 */
export interface WeatherSnapshot {
  id: string;
  sessionId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  distanceKmMarker: number;
  
  // Meteorología
  temperatureC: number;
  humidityPct: number;
  pressureHpa: number;
  weatherConditionCode: string; // 'rain' | 'sun' | 'storm' | 'snow' | 'fog'
  weatherIconName: string;
  
  // Telemetría en el momento exacto
  instantSpeedKmh: number;
  instantAltitudeMeters: number;
  
  // Ruta del archivo generado por el motor off-screen
  renderedImageRelativePath?: string;
}
