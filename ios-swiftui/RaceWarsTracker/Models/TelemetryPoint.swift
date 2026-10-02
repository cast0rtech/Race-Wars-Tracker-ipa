import Foundation

public struct TelemetryPoint: Codable, Identifiable {
    public var id: UUID = UUID()
    public let latitude: Double
    public let longitude: Double
    public let altitude: Double      // Metros sobre el nivel del mar
    public let speedKmh: Double      // Velocidad calculada en km/h
    public let timestamp: Date
    public let accuracy: Double?

    enum CodingKeys: String, CodingKey {
        case latitude = "lat"
        case longitude = "lng"
        case altitude = "alt"
        case speedKmh = "speed"
        case timestamp = "timestamp"
        case accuracy = "accuracy"
    }

    public init(latitude: Double, longitude: Double, altitude: Double, speedKmh: Double, timestamp: Date = Date(), accuracy: Double? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.speedKmh = speedKmh
        self.timestamp = timestamp
        self.accuracy = accuracy
    }
}
