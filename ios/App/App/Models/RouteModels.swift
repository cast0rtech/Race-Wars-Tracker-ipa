import Foundation
import CoreLocation

// MARK: - Entidad Punto de Track (TrackPoint)
public struct TrackPoint: Codable, Identifiable, Equatable {
    public var id: UUID
    public let latitude: Double
    public let longitude: Double
    public let altitude: Double?
    public let timestamp: Date
    public let speedKmh: Double
    public let horizontalAccuracy: Double?
    public let courseDegrees: Double?

    public init(
        id: UUID = UUID(),
        latitude: Double,
        longitude: Double,
        altitude: Double? = nil,
        timestamp: Date = Date(),
        speedKmh: Double = 0.0,
        horizontalAccuracy: Double? = nil,
        courseDegrees: Double? = nil
    ) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.timestamp = timestamp
        self.speedKmh = speedKmh
        self.horizontalAccuracy = horizontalAccuracy
        self.courseDegrees = courseDegrees
    }
    
    public init(location: CLLocation) {
        self.id = UUID()
        self.latitude = location.coordinate.latitude
        self.longitude = location.coordinate.longitude
        self.altitude = location.altitude > -100 ? location.altitude : nil
        self.timestamp = location.timestamp
        self.speedKmh = location.speed >= 0 ? location.speed * 3.6 : 0.0
        self.horizontalAccuracy = location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil
        self.courseDegrees = location.course >= 0 ? location.course : nil
    }
}

// Compatibilidad 100% con referencias previas en LocationManager
public typealias NativeTelemetryPoint = TrackPoint

// MARK: - Entidad Ruta Persistida (Route)
public struct Route: Codable, Identifiable, Equatable {
    public var id: UUID
    public var title: String
    public var startedAt: Date
    public var endedAt: Date?
    
    // Estadísticas calculadas exclusivamente por RouteStatsCalculator
    public var totalDistanceMeters: Double
    public var durationSeconds: TimeInterval
    public var avgSpeedKmh: Double
    public var maxSpeedKmh: Double
    public var elevationGainMeters: Double
    public var elevationLossMeters: Double
    public var peakAltitudeMeters: Double?
    public var minAltitudeMeters: Double?
    
    // Relación 1:N con TrackPoint (Array embebido persistido)
    public var trackpoints: [TrackPoint]

    public init(
        id: UUID = UUID(),
        title: String = "Ruta de Telemetría",
        startedAt: Date = Date(),
        endedAt: Date? = nil,
        totalDistanceMeters: Double = 0.0,
        durationSeconds: TimeInterval = 0.0,
        avgSpeedKmh: Double = 0.0,
        maxSpeedKmh: Double = 0.0,
        elevationGainMeters: Double = 0.0,
        elevationLossMeters: Double = 0.0,
        peakAltitudeMeters: Double? = nil,
        minAltitudeMeters: Double? = nil,
        trackpoints: [TrackPoint] = []
    ) {
        self.id = id
        self.title = title
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.totalDistanceMeters = totalDistanceMeters
        self.durationSeconds = durationSeconds
        self.avgSpeedKmh = avgSpeedKmh
        self.maxSpeedKmh = maxSpeedKmh
        self.elevationGainMeters = elevationGainMeters
        self.elevationLossMeters = elevationLossMeters
        self.peakAltitudeMeters = peakAltitudeMeters
        self.minAltitudeMeters = minAltitudeMeters
        self.trackpoints = trackpoints
    }
    
    /// Inicializador de conveniencia que utiliza estrictamente RouteStatsCalculator
    public init(
        id: UUID = UUID(),
        title: String? = nil,
        startedAt: Date,
        endedAt: Date? = nil,
        trackpoints: [TrackPoint]
    ) {
        let stats = RouteStatsCalculator.calculate(
            points: trackpoints,
            startedAt: startedAt,
            endedAt: endedAt
        )
        let resolvedTitle = title ?? "Ruta \(DateFormatter.localizedString(from: startedAt, dateStyle: .short, timeStyle: .short))"
        
        self.init(
            id: id,
            title: resolvedTitle,
            startedAt: startedAt,
            endedAt: endedAt,
            totalDistanceMeters: stats.totalDistanceMeters,
            durationSeconds: stats.durationSeconds,
            avgSpeedKmh: stats.avgSpeedKmh,
            maxSpeedKmh: stats.maxSpeedKmh,
            elevationGainMeters: stats.elevationGainMeters,
            elevationLossMeters: stats.elevationLossMeters,
            peakAltitudeMeters: stats.peakAltitudeMeters,
            minAltitudeMeters: stats.minAltitudeMeters,
            trackpoints: trackpoints
        )
    }
}
