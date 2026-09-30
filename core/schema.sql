-- ============================================================================
-- RACE WARS TRACKER - SQLITE PERSISTENCE SCHEMA (HIGH-FREQUENCY RAW TELEMETRY)
-- Optimizado para WAL (Write-Ahead Logging) y escrituras continuas a 1-10 Hz
-- ============================================================================

-- 1. Activación de rendimiento para evitar bloqueos de I/O en segundo plano
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;

-- 2. Tabla de Sesiones de Ruta
CREATE TABLE IF NOT EXISTS route_sessions (
  id TEXT PRIMARY KEY NOT NULL,                     -- UUID v4
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,                      -- Unix timestamp ms
  started_at INTEGER NOT NULL,
  ended_at INTEGER,                                 -- NULL mientras esté activa
  status TEXT NOT NULL DEFAULT 'RECORDING',         -- RECORDING, COMPLETED, CRASH_RECOVERED
  trigger_source TEXT NOT NULL,                     -- MANUAL, BLUETOOTH_AUTO, OBD_CONNECT
  vehicle_bt_mac TEXT,
  vehicle_bt_name TEXT,
  
  -- Métricas consolidadas calculadas post-sesión
  total_distance_m REAL DEFAULT 0.0,
  total_duration_ms INTEGER DEFAULT 0,
  avg_speed_kmh REAL DEFAULT 0.0,
  max_speed_kmh REAL DEFAULT 0.0,
  elevation_gain_m REAL DEFAULT 0.0,               -- +D
  elevation_loss_m REAL DEFAULT 0.0,               -- -D
  min_altitude_m REAL DEFAULT 0.0,
  max_altitude_m REAL DEFAULT 0.0,
  point_count INTEGER DEFAULT 0,
  gpx_export_path TEXT
);

-- 3. Tabla de Puntos de Telemetría en Crudo (Raw Telemetry Series)
CREATE TABLE IF NOT EXISTS telemetry_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,                       -- Epoch ms
  
  -- Posicionamiento GPS WGS84
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  gps_altitude REAL NOT NULL,                       -- Altitud cruda GPS (m)
  gps_accuracy_h REAL NOT NULL,                     -- Precisión horizontal (m)
  gps_accuracy_v REAL NOT NULL,                     -- Precisión vertical (m)
  gps_speed_mps REAL NOT NULL,                      -- Velocidad Doppler (m/s)
  bearing_deg REAL DEFAULT 0.0,                     -- Rumbo (0 - 359.9)
  satellites_used INTEGER DEFAULT 0,
  
  -- Barómetro
  baro_pressure_hpa REAL,                           -- Presión atmosférica (hPa)
  baro_raw_alt REAL,                                -- Altitud barométrica pura (m)
  
  -- Fusión de Sensores (Kalman / Complementario)
  fused_altitude REAL NOT NULL,                     -- Altitud filtrada final
  vertical_speed_mps REAL DEFAULT 0.0,              -- Tasa de ascenso/descenso
  
  -- Diagnóstico de integridad
  is_mocked INTEGER DEFAULT 0,                      -- 1 si es GPS falseado
  battery_level_pct INTEGER,

  FOREIGN KEY (session_id) REFERENCES route_sessions(id) ON DELETE CASCADE
);

-- Índices de alto rendimiento para consultas temporales y generación de GPX
CREATE INDEX IF NOT EXISTS idx_points_session_timestamp 
ON telemetry_points (session_id, timestamp ASC);

-- 4. Tabla de Capturas Meteorológicas Off-Screen (Weather Snapshots)
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id TEXT PRIMARY KEY NOT NULL,                     -- UUID v4
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  distance_km_marker REAL NOT NULL,
  
  -- Clima
  temperature_c REAL NOT NULL,
  humidity_pct REAL NOT NULL,
  pressure_hpa REAL NOT NULL,
  weather_condition_code TEXT NOT NULL,             -- rain, sun, storm, snow, fog
  weather_icon_name TEXT NOT NULL,
  
  -- Telemetría puntual
  instant_speed_kmh REAL NOT NULL,
  instant_altitude_m REAL NOT NULL,
  
  -- Imagen de salida generada
  rendered_image_path TEXT,

  FOREIGN KEY (session_id) REFERENCES route_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weather_session_timestamp 
ON weather_snapshots (session_id, timestamp ASC);
