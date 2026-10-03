import Foundation
import CoreLocation
import os.log

// MARK: - Route Repository Protocol
public protocol RouteRepositoryProtocol: Sendable {
    func save(_ route: Route) async throws -> Route
    func fetch(by id: UUID) async throws -> Route?
    func listAll() async throws -> [Route]
    func delete(by id: UUID) async throws
}

// MARK: - Route Repository (Single Source of Truth for Persistence)
public actor RouteRepository: RouteRepositoryProtocol {
    
    public static let shared = RouteRepository()
    
    private let logger = Logger(subsystem: "com.racewars.tracker", category: "Repository")
    private let fileManager = FileManager.default
    
    private var storageDirectory: URL {
        return AppStorageDirectory.routes
    }
    
    public var onBeforeSave: (@Sendable () async -> Void)?
    
    public init() {}
    
    // MARK: - Save Route
    /// Persiste la ruta calculando estadísticas con RouteStatsCalculator y aplicando copia defensiva
    public func save(_ route: Route) async throws -> Route {
        // 1. ESPERAR FLUSH: Si hay un hook registrado (p.ej. vaciado de journal)
        if let hook = onBeforeSave {
            await hook()
        }
        
        // 2. COPIA DEFENSIVA: Asegurar array inmutable
        let finalPoints = Array(route.trackpoints)
        
        // 3. Cálculo determinista de estadísticas mediante la fuente única de verdad
        let stats = RouteStatsCalculator.calculate(
            points: finalPoints,
            startedAt: route.startedAt,
            endedAt: route.endedAt ?? Date()
        )
        
        let finalizedRoute = Route(
            id: route.id,
            title: route.title,
            startedAt: route.startedAt,
            endedAt: route.endedAt ?? Date(),
            totalDistanceMeters: stats.totalDistanceMeters,
            durationSeconds: stats.durationSeconds,
            avgSpeedKmh: stats.avgSpeedKmh,
            maxSpeedKmh: stats.maxSpeedKmh,
            elevationGainMeters: stats.elevationGainMeters,
            elevationLossMeters: stats.elevationLossMeters,
            peakAltitudeMeters: stats.peakAltitudeMeters,
            minAltitudeMeters: stats.minAltitudeMeters,
            trackpoints: finalPoints
        )
        
        // 4. Serialización y guardado atómico en disco
        let fileURL = storageDirectory.appendingPathComponent("\(finalizedRoute.id.uuidString).json")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(finalizedRoute)
        
        logger.notice("[RouteRepository] 💾 Guardando ruta ID: \(finalizedRoute.id.uuidString, privacy: .public) con \(finalizedRoute.trackpoints.count, privacy: .public) puntos.")
        logger.notice("[RouteRepository] 💾 Archivo: \(fileURL.path, privacy: .public)")
        
        do {
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            logger.notice("[RouteRepository] 💾 Guardado OK.")
        } catch {
            logger.error("[RouteRepository] ❌ Error al escribir ruta: \(error.localizedDescription, privacy: .public)")
            throw error
        }
        
        return finalizedRoute
    }
    
    // MARK: - Fetch Route by Exact UUID
    /// Consulta una ruta guardada por su ID unívoco (UUID)
    public func fetch(by id: UUID) async throws -> Route? {
        let expectedFileName = "\(id.uuidString).json"
        let fileURL = storageDirectory.appendingPathComponent(expectedFileName)
        
        logger.notice("[RouteRepository] 📂 Consultando ruta por ID: \(id.uuidString, privacy: .public)")
        
        guard fileManager.fileExists(atPath: fileURL.path) else {
            logger.error("[RouteRepository] ❌ Ruta NO encontrada en disco para ID: \(id.uuidString, privacy: .public)")
            return nil
        }
        
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let route = try decoder.decode(Route.self, from: data)
            logger.notice("[RouteRepository] ✅ Ruta encontrada con \(route.trackpoints.count, privacy: .public) puntos.")
            return route
        } catch {
            logger.error("[RouteRepository] ❌ Error decodificando ruta: \(error.localizedDescription, privacy: .public)")
            throw error
        }
    }
    
    // MARK: - List All Routes
    public func listAll() async throws -> [Route] {
        let contents = try fileManager.contentsOfDirectory(at: storageDirectory, includingPropertiesForKeys: nil)
        var routes: [Route] = []
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        for file in contents where file.pathExtension == "json" {
            if let data = try? Data(contentsOf: file), let route = try? decoder.decode(Route.self, from: data) {
                routes.append(route)
            }
        }
        
        routes.sort { $0.startedAt > $1.startedAt }
        return routes
    }
    
    // MARK: - Delete Route
    public func delete(by id: UUID) async throws {
        let fileURL = storageDirectory.appendingPathComponent("\(id.uuidString).json")
        if fileManager.fileExists(atPath: fileURL.path) {
            try fileManager.removeItem(at: fileURL)
            logger.notice("[RouteRepository] 🗑️ Ruta eliminada con éxito: \(id.uuidString, privacy: .public)")
        }
    }
}
