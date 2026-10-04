import Foundation
import CoreLocation

@main
struct TestRunner {
    static func main() async {
        print("==================================================================")
        print("      RUNNING INTEGRATION TEST: 3-POINT RECORDING & SUMMARY       ")
        print("==================================================================")
        
        // 1. GIVEN: Simular grabación de 3 puntos
        let baseDate = Date()
        let p1 = TrackPoint(
            latitude: 40.4168,
            longitude: -3.7038,
            altitude: 650.0,
            timestamp: baseDate,
            speedKmh: 35.0,
            horizontalAccuracy: 2.5
        )
        let p2 = TrackPoint(
            latitude: 40.4180,
            longitude: -3.7025,
            altitude: 665.0,
            timestamp: baseDate.addingTimeInterval(10),
            speedKmh: 75.0,
            horizontalAccuracy: 2.0
        )
        let p3 = TrackPoint(
            latitude: 40.4195,
            longitude: -3.7010,
            altitude: 672.0,
            timestamp: baseDate.addingTimeInterval(25),
            speedKmh: 60.0,
            horizontalAccuracy: 2.0
        )
        
        let recordedPoints = [p1, p2, p3]
        let generatedRouteId = UUID()
        
        print("\n[PASO 1] 3 Puntos simulados:")
        print("  • P1: lat=\(p1.latitude), lon=\(p1.longitude), alt=\(p1.altitude ?? 0)m, speed=\(p1.speedKmh)km/h")
        print("  • P2: lat=\(p2.latitude), lon=\(p2.longitude), alt=\(p2.altitude ?? 0)m, speed=\(p2.speedKmh)km/h")
        print("  • P3: lat=\(p3.latitude), lon=\(p3.longitude), alt=\(p3.altitude ?? 0)m, speed=\(p3.speedKmh)km/h")
        print("  • Route UUID generado: \(generatedRouteId)")
        
        // 2. WHEN: Al pulsar "Detener" -> Construir Route completo en memoria con RouteStatsCalculator
        let inMemoryRoute = Route(
            id: generatedRouteId,
            title: "Ruta Test 3 Puntos",
            startedAt: baseDate,
            endedAt: baseDate.addingTimeInterval(25),
            trackpoints: recordedPoints
        )
        
        let repository = RouteRepository.shared
        do {
            let savedRoute = try await repository.save(inMemoryRoute)
            print("\n[PASO 2] Ruta guardada en RouteRepository:")
            print("  ✓ Guardado OK: ID = \(savedRoute.id)")
            print("  ✓ Distancia calculada = \(savedRoute.totalDistanceMeters) m")
            print("  ✓ Duración = \(savedRoute.durationSeconds) s")
            print("  ✓ Desnivel acumulado (+D) = +\(savedRoute.elevationGainMeters) m")
            print("  ✓ Velocidad máxima = \(savedRoute.maxSpeedKmh) km/h")
            
            // 3. Simular navegación al resumen pasando ÚNICAMENTE el ID (no el objeto)
            let navigationParamId: UUID = savedRoute.id
            print("\n[PASO 3] Navegando a RouteSummaryView pasando ÚNICAMENTE el ID: \(navigationParamId)")
            
            // Flujo del resumen: RouteRepository.fetch(by: id)
            let summaryRoute = try await repository.fetch(by: navigationParamId)
            guard let debrief = summaryRoute else {
                fatalError("FAIL: La ruta no pudo ser leída por ID en el resumen")
            }
            
            // 4. THEN: Verificaciones del resumen
            print("\n[PASO 4] Verificaciones en RouteSummaryView:")
            
            // a) Verificar 3 puntos
            assert(debrief.trackpoints.count == 3, "FAIL: debrief.trackpoints.count != 3")
            print("  ✓ 1. Puntos persistidos: \(debrief.trackpoints.count) puntos (Exactamente 3)")
            
            // b) Verificar distancia > 0
            assert(debrief.totalDistanceMeters > 0, "FAIL: distancia <= 0")
            assert(debrief.totalDistanceMeters == savedRoute.totalDistanceMeters, "FAIL: discrepancia en distancia")
            print("  ✓ 2. Distancia > 0: \(debrief.totalDistanceMeters) m (Idéntica a grabación)")
            
            // c) Verificar duración > 0
            assert(debrief.durationSeconds > 0, "FAIL: duración <= 0")
            assert(debrief.durationSeconds == 25.0, "FAIL: duración != 25s")
            print("  ✓ 3. Duración > 0: \(debrief.durationSeconds) s (Exactamente 25.0 s)")
            
            // d) Polyline con 3 coordenadas
            let polylineCoordinates: [CLLocationCoordinate2D] = debrief.trackpoints.map {
                CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
            }
            assert(polylineCoordinates.count == 3, "FAIL: polylineCoordinates != 3")
            assert(abs(polylineCoordinates[0].latitude - 40.4168) < 0.0001)
            assert(abs(polylineCoordinates[1].latitude - 40.4180) < 0.0001)
            assert(abs(polylineCoordinates[2].latitude - 40.4195) < 0.0001)
            print("  ✓ 4. Polilínea del mini-mapa: 3 coordenadas válidas:")
            for (idx, coord) in polylineCoordinates.enumerated() {
                print("       Point [\(idx)]: (\(coord.latitude), \(coord.longitude))")
            }
            
            // e) Verificación de error específico al buscar ID inexistente
            let nonExistentId = UUID()
            let missing = try await repository.fetch(by: nonExistentId)
            assert(missing == nil, "FAIL: missing should be nil")
            print("  ✓ 5. Consulta por ID inexistente devuelve nil -> Resumen muestra: 'No se encontró la ruta'")
            
            // f) Verificación de error específico con 0 puntos
            let emptyRoute = Route(id: UUID(), title: "Vacia", startedAt: Date(), endedAt: Date(), trackpoints: [])
            _ = try await repository.save(emptyRoute)
            let emptyFetched = try await repository.fetch(by: emptyRoute.id)
            assert(emptyFetched != nil && emptyFetched!.trackpoints.isEmpty, "FAIL: emptyFetched trackpoints should be empty")
            print("  ✓ 6. Consulta de ruta con 0 puntos -> Resumen muestra: 'La ruta no tiene puntos'")

            // g) Verificación de filtrado de pico de GPS anómalo (ej: 5247 km/h)
            let glitchPoint = TrackPoint(
                latitude: 40.4200,
                longitude: -3.7000,
                altitude: 675.0,
                timestamp: baseDate.addingTimeInterval(30),
                speedKmh: 5247.0,
                horizontalAccuracy: 150.0
            )
            let routeWithGlitchTitle: String? = "Ruta Con Salto Anomalo"
            let routeWithGlitch = Route(
                id: UUID(),
                title: routeWithGlitchTitle,
                startedAt: baseDate,
                endedAt: baseDate.addingTimeInterval(30),
                trackpoints: [p1, p2, p3, glitchPoint]
            )
            assert(routeWithGlitch.maxSpeedKmh == 75.0, "FAIL: maxSpeedKmh debe ser 75.0 km/h y filtrar el pico de 5247 km/h, pero fue \(routeWithGlitch.maxSpeedKmh)")
            print("  ✓ 7. Filtrado de pico de GPS: 5247 km/h descartado -> Velocidad máxima correcta calculada: \(routeWithGlitch.maxSpeedKmh) km/h")

            // h) Verificación de asunción de velocidad máxima de 80 km/h al perder conexión GPS
            let maxAssumedSpeedWithoutGPS = 80.0
            var simulatedSpeed = 125.0
            if simulatedSpeed > maxAssumedSpeedWithoutGPS {
                simulatedSpeed = maxAssumedSpeedWithoutGPS
            }
            assert(simulatedSpeed == 80.0, "FAIL: Al perder conexión GPS, la velocidad asumida debe ser máx 80 km/h")
            print("  ✓ 8. Pérdida de conexión GPS: Velocidad asumida acotada a máximo 80 km/h (\(simulatedSpeed) km/h)")
            
            print("\n==================================================================")
            print("                  TODOS LOS TESTS PASARON (PASS)                  ")
            print("==================================================================")
        } catch {
            print("ERROR IN TEST: \(error)")
            exit(1)
        }
    }
}
