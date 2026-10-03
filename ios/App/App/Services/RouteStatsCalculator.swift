import Foundation
import CoreLocation

// MARK: - Route Calculated Statistics
public struct RouteStats: Codable, Equatable {
    public let totalDistanceMeters: Double
    public let durationSeconds: TimeInterval
    public let avgSpeedKmh: Double
    public let maxSpeedKmh: Double
    public let elevationGainMeters: Double
    public let elevationLossMeters: Double
    public let peakAltitudeMeters: Double?
    public let minAltitudeMeters: Double?
    
    public init(
        totalDistanceMeters: Double,
        durationSeconds: TimeInterval,
        avgSpeedKmh: Double,
        maxSpeedKmh: Double,
        elevationGainMeters: Double,
        elevationLossMeters: Double,
        peakAltitudeMeters: Double? = nil,
        minAltitudeMeters: Double? = nil
    ) {
        self.totalDistanceMeters = totalDistanceMeters
        self.durationSeconds = durationSeconds
        self.avgSpeedKmh = avgSpeedKmh
        self.maxSpeedKmh = maxSpeedKmh
        self.elevationGainMeters = elevationGainMeters
        self.elevationLossMeters = elevationLossMeters
        self.peakAltitudeMeters = peakAltitudeMeters
        self.minAltitudeMeters = minAltitudeMeters
    }
}

// MARK: - Route Stats Calculator (Shared Single Source of Truth)
public struct RouteStatsCalculator {
    
    /// Calcula determinísticamente todas las métricas de una ruta a partir de sus trackpoints y fechas
    public static func calculate(
        points: [TrackPoint],
        startedAt: Date,
        endedAt: Date? = nil
    ) -> RouteStats {
        guard !points.isEmpty else {
            let duration = max(0.0, (endedAt ?? Date()).timeIntervalSince(startedAt))
            return RouteStats(
                totalDistanceMeters: 0.0,
                durationSeconds: duration,
                avgSpeedKmh: 0.0,
                maxSpeedKmh: 0.0,
                elevationGainMeters: 0.0,
                elevationLossMeters: 0.0,
                peakAltitudeMeters: nil,
                minAltitudeMeters: nil
            )
        }
        
        // 1. Ordenar cronológicamente para garantizar distancias y tiempos estrictos
        let sortedPoints = points.sorted { $0.timestamp < $1.timestamp }
        
        var totalDistMeters: Double = 0.0
        var maxSpeed: Double = 0.0
        var elevationGain: Double = 0.0
        var elevationLoss: Double = 0.0
        
        var peakAlt: Double? = nil
        var minAlt: Double? = nil
        
        // 2. Acumulación geodésica de distancia y desnivel
        if sortedPoints.count > 1 {
            for i in 0..<(sortedPoints.count - 1) {
                let p1 = sortedPoints[i]
                let p2 = sortedPoints[i + 1]
                
                let loc1 = CLLocation(latitude: p1.latitude, longitude: p1.longitude)
                let loc2 = CLLocation(latitude: p2.latitude, longitude: p2.longitude)
                let d = loc2.distance(from: loc1)
                
                // Filtrar ruido estático de fluctuación GPS (< 1 metro)
                if d > 1.0 {
                    totalDistMeters += d
                }
                
                // Cálculo de altitud con umbral de histéresis anti-ruido
                if let alt1 = p1.altitude, let alt2 = p2.altitude {
                    let diff = alt2 - alt1
                    if diff > 1.5 {
                        elevationGain += diff
                    } else if diff < -1.5 {
                        elevationLoss += abs(diff)
                    }
                }
            }
        }
        
        // 3. Velocidades extremas y altitudes extremas
        for pt in sortedPoints {
            if pt.speedKmh > maxSpeed {
                maxSpeed = pt.speedKmh
            }
            if let alt = pt.altitude {
                peakAlt = max(peakAlt ?? alt, alt)
                minAlt = min(minAlt ?? alt, alt)
            }
        }
        
        // 4. Duración y velocidad promedio
        let effectiveEnd = endedAt ?? sortedPoints.last?.timestamp ?? Date()
        let duration = max(1.0, effectiveEnd.timeIntervalSince(startedAt))
        let avgSpeed = duration > 0 ? (totalDistMeters / 1000.0) / (duration / 3600.0) : 0.0
        
        return RouteStats(
            totalDistanceMeters: (totalDistMeters * 100).rounded() / 100,
            durationSeconds: duration,
            avgSpeedKmh: (avgSpeed * 10).rounded() / 10,
            maxSpeedKmh: (maxSpeed * 10).rounded() / 10,
            elevationGainMeters: elevationGain.rounded(),
            elevationLossMeters: elevationLoss.rounded(),
            peakAltitudeMeters: peakAlt?.rounded(),
            minAltitudeMeters: minAlt?.rounded()
        )
    }
}
