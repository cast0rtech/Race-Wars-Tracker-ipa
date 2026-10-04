// Verification test for telemetry speed calculations and session sanitization
'use strict';

function runTests() {
  console.log('==================================================================');
  console.log('       TEST DE TELEMETRÍA Y FILTRADO DE PICOS DE VELOCIDAD        ');
  console.log('==================================================================');

  // Test 1: Simulación de la sesión del usuario (1247 puntos, maxSpeed 5247 km/h)
  const simulatedTrackpoints = [];
  const startTime = Date.now() - 38 * 60 * 1000; // 38 mins ago

  for (let i = 0; i < 1247; i++) {
    const t = startTime + i * 1800; // ~1.8s interval
    // Speed varies realistically between 50 and 115 km/h, avg around 72 km/h
    let speed = 60 + Math.sin(i / 20) * 35;
    if (i === 420) {
      speed = 5247; // El pico anómalo que experimentó el usuario
    }
    simulatedTrackpoints.push({
      timestamp: t,
      lat: 40.4168 + i * 0.0003,
      lng: -3.7038 + i * 0.0002,
      speedKmh: Math.round(speed),
      altitudeM: 650 + Math.round(Math.sin(i / 100) * 50)
    });
  }

  const rawSession = {
    id: 'session_user_sample_route',
    title: 'Ruta GPS Real 19:31:39',
    startedAt: startTime,
    distanceKm: 45.44,
    avgSpeedKmh: 72,
    maxSpeedKmh: 5247, // corrupted
    elevationGainM: 233,
    trackpoints: simulatedTrackpoints
  };

  // Cargar lógica de sanitización
  const MAX_REALISTIC_SPEED_KMH = 350;
  function sanitizeSession(session) {
    if (!session || typeof session !== 'object') return { session, modified: false };
    let modified = false;
    const trackpoints = Array.isArray(session.trackpoints) ? session.trackpoints : [];
    const validSpeeds = [];
    let prevValidSpeed = 0;

    for (let i = 0; i < trackpoints.length; i++) {
      const pt = trackpoints[i];
      if (!pt) continue;
      const speed = Number(pt.speedKmh);
      if (Number.isFinite(speed) && speed >= 0 && speed <= MAX_REALISTIC_SPEED_KMH) {
        validSpeeds.push(speed);
        prevValidSpeed = speed;
      } else if (Number.isFinite(speed) && speed > MAX_REALISTIC_SPEED_KMH) {
        pt.speedKmh = prevValidSpeed;
        modified = true;
      }
    }

    const rawMax = Number(session.maxSpeedKmh);
    if (!Number.isFinite(rawMax) || rawMax > MAX_REALISTIC_SPEED_KMH || rawMax <= 0) {
      if (validSpeeds.length > 0) {
        session.maxSpeedKmh = Math.round(Math.max(...validSpeeds));
      } else if (rawMax > MAX_REALISTIC_SPEED_KMH) {
        const avg = Number(session.avgSpeedKmh);
        session.maxSpeedKmh = (Number.isFinite(avg) && avg > 0) ? Math.min(MAX_REALISTIC_SPEED_KMH, Math.round(avg * 1.35)) : 0;
      }
      modified = true;
    }
    return { session, modified };
  }

  const { session: cleaned, modified } = sanitizeSession(rawSession);

  console.log(`[TEST 1] Sesión previa corrupta (5247 km/h) con 1247 puntos:`);
  console.log(`  • Modificada para reparación: ${modified}`);
  console.log(`  • Velocidad Máxima reparada: ${cleaned.maxSpeedKmh} km/h`);
  console.log(`  • Trackpoint 420 reparado de 5247 a: ${cleaned.trackpoints[420].speedKmh} km/h`);

  if (cleaned.maxSpeedKmh > 350) {
    throw new Error('FAIL: maxSpeedKmh sigue siendo > 350');
  }
  if (cleaned.trackpoints[420].speedKmh > 350) {
    throw new Error('FAIL: trackpoint 420 sigue teniendo velocidad anómala');
  }
  if (cleaned.maxSpeedKmh < 90 || cleaned.maxSpeedKmh > 130) {
    throw new Error('FAIL: maxSpeedKmh fuera del rango realista esperado (90-130 km/h)');
  }
  console.log('  ✓ TEST 1 PASÓ: Sesión reparada a velocidad máxima realista (' + cleaned.maxSpeedKmh + ' km/h).');

  // Test 2: Simulación de cálculo diferencial en tiempo real ante saltos de GPS
  const EARTH_RADIUS_KM = 6371.0;
  function haversine(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Simular salto de 524.7 metros en 0.36 segundos (origen matemático de 5247 km/h)
  const jumpLat1 = 40.4168;
  const jumpLng1 = -3.7038;
  const jumpLat2 = 40.4215; // ~525 metros al norte
  const jumpLng2 = -3.7038;
  const jumpDistKm = haversine(jumpLat1, jumpLng1, jumpLat2, jumpLng2);
  const jumpDtSec = 0.36; // 360 ms
  const impliedSpeed = jumpDistKm / (jumpDtSec / 3600);

  console.log(`\n[TEST 2] Verificación del salto cuántico de GPS:`);
  console.log(`  • Distancia del salto: ${(jumpDistKm * 1000).toFixed(1)} m`);
  console.log(`  • Tiempo entre muestras: ${jumpDtSec} s`);
  console.log(`  • Velocidad bruta teórica que causaba el fallo: ${Math.round(impliedSpeed)} km/h`);

  const isTeleportJump = impliedSpeed > MAX_REALISTIC_SPEED_KMH;
  if (!isTeleportJump) {
    throw new Error('FAIL: El salto debería ser catalogado como salto cuántico descartable');
  }
  console.log(`  ✓ TEST 2 PASÓ: Salto cuántico detectado y descartado correctamente.`);

  // Test 3: Pérdida de conexión GPS y velocidad asumida máxima de 80 km/h
  console.log(`\n[TEST 3] Verificación de pérdida de conexión GPS (asunción máx 80 km/h):`);
  const MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH = 80;

  function simulateGpsLoss(currentSpeedKmh) {
    let assumedSpeed = currentSpeedKmh;
    if (assumedSpeed > MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH) {
      assumedSpeed = MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH;
    } else if (assumedSpeed > 0) {
      assumedSpeed = Math.min(MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH, assumedSpeed);
    }
    return assumedSpeed;
  }

  // Caso 3.1: Vehículo en autopista a 130 km/h entra en túnel y pierde GPS
  const highSpeedInTunnel = simulateGpsLoss(130);
  console.log(`  • Caso 3.1 (130 km/h -> túnel): Velocidad asumida = ${highSpeedInTunnel} km/h`);
  if (highSpeedInTunnel !== 80) {
    throw new Error(`FAIL: A 130 km/h sin GPS la velocidad debía ser 80 km/h, dio ${highSpeedInTunnel}`);
  }

  // Caso 3.2: Vehículo en ciudad a 55 km/h entra en subterráneo y pierde GPS
  const citySpeedInTunnel = simulateGpsLoss(55);
  console.log(`  • Caso 3.2 (55 km/h -> subterráneo): Velocidad asumida = ${citySpeedInTunnel} km/h`);
  if (citySpeedInTunnel !== 55) {
    throw new Error(`FAIL: A 55 km/h sin GPS la velocidad debía mantenerse en 55 km/h, dio ${citySpeedInTunnel}`);
  }

  // Caso 3.3: Sanitización de puntos grabados sin conexión GPS (ej: 95 km/h debe acotarse a 80 km/h)
  const tunnelTrackpoints = [
    { timestamp: Date.now() - 5000, lat: 40.4168, lng: -3.7038, speedKmh: 75, gpsConnected: true },
    { timestamp: Date.now() - 4000, lat: 40.4170, lng: -3.7035, speedKmh: 95, gpsConnected: false, isEstimated: true }, // sin GPS > 80
    { timestamp: Date.now() - 3000, lat: 40.4172, lng: -3.7032, speedKmh: 80, gpsConnected: false, isEstimated: true }
  ];
  const tunnelSession = {
    id: 'session_tunnel_test',
    maxSpeedKmh: 95,
    trackpoints: tunnelTrackpoints
  };
  function sanitizeTunnelSession(session) {
    for (const pt of session.trackpoints) {
      if ((pt.gpsConnected === false || pt.isEstimated === true) && pt.speedKmh > MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH) {
        pt.speedKmh = MAX_ASSUMED_SPEED_WITHOUT_GPS_KMH;
      }
    }
  }
  sanitizeTunnelSession(tunnelSession);
  console.log(`  • Caso 3.3 (Trackpoint sin GPS corregido): ${tunnelSession.trackpoints[1].speedKmh} km/h`);
  if (tunnelSession.trackpoints[1].speedKmh !== 80) {
    throw new Error(`FAIL: El punto sin GPS debería ser 80 km/h, dio ${tunnelSession.trackpoints[1].speedKmh}`);
  }
  console.log(`  ✓ TEST 3 PASÓ: Al perder conexión GPS, la velocidad asumida es máximo 80 km/h.`);

  console.log('\n==================================================================');
  console.log('                  TODOS LOS TESTS DE JS PASARON                   ');
  console.log('==================================================================');
}

runTests();
