import XCTest
import CoreLocation
@testable import App

final class RoutePersistenceTests: XCTestCase {

    // MARK: - Test de Integración: Grabación 3 Puntos -> Guardar -> Abrir Resumen
    func testRecordThreePointsSaveAndFetchForSummary() async throws {
        // 1. GIVEN: Simular grabación de 3 puntos en vivo
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
        
        // 2. WHEN: Al pulsar "Detener" -> Construir Route completo en memoria con RouteStatsCalculator
        let inMemoryRoute = Route(
            id: generatedRouteId,
            title: "Ruta Test 3 Puntos",
            startedAt: baseDate,
            endedAt: baseDate.addingTimeInterval(25),
            trackpoints: recordedPoints
        )
        
        // Persistir mediante RouteRepository (fuente única de verdad)
        let repository = RouteRepository.shared
        let savedRoute = try await repository.save(inMemoryRoute)
        
        // 3. Simular navegación al resumen pasando ÚNICAMENTE el ID (no el objeto)
        let navigationParamId: UUID = savedRoute.id
        XCTAssertEqual(navigationParamId, generatedRouteId)
        
        // Flujo del resumen: RouteRepository.fetch(by: id)
        let summaryRoute = try await repository.fetch(by: navigationParamId)
        
        // 4. THEN: Verificaciones del resumen
        XCTAssertNotNil(summaryRoute, "El resumen debe poder cargar la ruta usando únicamente el UUID")
        guard let debrief = summaryRoute else { return }
        
        // a) Verificar 3 puntos persistidos
        XCTAssertEqual(debrief.trackpoints.count, 3, "El resumen debe mostrar exactamente 3 puntos")
        
        // b) Verificar distancia > 0
        XCTAssertGreaterThan(debrief.totalDistanceMeters, 0.0, "La distancia debe ser mayor a 0 metros")
        XCTAssertEqual(debrief.totalDistanceMeters, savedRoute.totalDistanceMeters, "La distancia debe coincidir exactamente")
        
        // c) Verificar duración > 0
        XCTAssertGreaterThan(debrief.durationSeconds, 0.0, "La duración debe ser mayor a 0 segundos")
        XCTAssertEqual(debrief.durationSeconds, 25.0, "La duración debe ser exactamente 25 segundos")
        
        // d) Polyline con 3 coordenadas
        let polylineCoordinates: [CLLocationCoordinate2D] = debrief.trackpoints.map {
            CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
        }
        XCTAssertEqual(polylineCoordinates.count, 3, "La polilínea del mini-mapa debe componerse de 3 coordenadas")
        XCTAssertEqual(polylineCoordinates[0].latitude, 40.4168, accuracy: 0.0001)
        XCTAssertEqual(polylineCoordinates[1].latitude, 40.4180, accuracy: 0.0001)
        XCTAssertEqual(polylineCoordinates[2].latitude, 40.4195, accuracy: 0.0001)
        
        // e) Métricas idénticas entre final de ruta y resumen
        XCTAssertEqual(debrief.maxSpeedKmh, 75.0, "Velocidad máxima debe ser 75 km/h")
        XCTAssertEqual(debrief.elevationGainMeters, 22.0, "Desnivel positivo debe ser 22 m (672 - 650)")
    }

    // MARK: - Test: Error específico si la ruta NO existe en disco
    func testFetchNonExistentRouteReturnsNilForSpecificError() async throws {
        let nonExistentId = UUID()
        let repository = RouteRepository.shared
        
        let result = try await repository.fetch(by: nonExistentId)
        XCTAssertNil(result, "Debe retornar nil para que el resumen presente el mensaje específico: 'No se encontró la ruta'")
    }

    // MARK: - Test: Error específico si la ruta tiene 0 puntos
    func testRouteWithZeroPointsIsIdentifiedSpecifically() async throws {
        let emptyRouteId = UUID()
        let emptyRoute = Route(
            id: emptyRouteId,
            title: "Ruta Sin Coordenadas",
            startedAt: Date(),
            endedAt: Date(),
            trackpoints: []
        )
        
        let repository = RouteRepository.shared
        _ = try await repository.save(emptyRoute)
        
        let fetched = try await repository.fetch(by: emptyRouteId)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.trackpoints.count, 0, "Debe retornar 0 puntos para que el resumen active el banner: 'La ruta no tiene puntos'")
    }
}
