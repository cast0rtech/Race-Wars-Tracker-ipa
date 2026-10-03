import Foundation
import CoreLocation
import os.log

// MARK: - Directorio Unificado de Rutas
public struct AppStorageDirectory {
    public static var routes: URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let dir = paths[0].appendingPathComponent("RaceWarsRoutes", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }
}

// MARK: - RouteDataStore (Compatibility Wrapper around RouteRepository)
public actor RouteDataStore {
    
    public static let shared = RouteDataStore()
    private let repository: RouteRepositoryProtocol
    
    public init(repository: RouteRepositoryProtocol = RouteRepository.shared) {
        self.repository = repository
    }
    
    // MARK: - Save Route (Detención del registro)
    public func saveRoute(
        id: UUID,
        title: String? = nil,
        startedAt: Date,
        endedAt: Date = Date(),
        rawPoints: [TrackPoint]
    ) async throws -> Route {
        let route = Route(
            id: id,
            title: title,
            startedAt: startedAt,
            endedAt: endedAt,
            trackpoints: rawPoints
        )
        return try await repository.save(route)
    }
    
    // MARK: - Fetch Route by Exact UUID
    public func fetchRoute(by id: UUID) async throws -> Route? {
        return try await repository.fetch(by: id)
    }
    
    // MARK: - List All Routes
    public func listAllRoutes() async throws -> [Route] {
        return try await repository.listAll()
    }
    
    // MARK: - Delete Route
    public func deleteRoute(by id: UUID) async throws {
        try await repository.delete(by: id)
    }
}
