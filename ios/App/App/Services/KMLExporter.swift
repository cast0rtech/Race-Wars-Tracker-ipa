import Foundation

// MARK: - KML Export Errors
public enum KMLExportError: LocalizedError, Equatable {
    case insufficientTrackPoints(count: Int)
    case fileWriteFailed(underlying: String)

    public var errorDescription: String? {
        switch self {
        case .insufficientTrackPoints(let count):
            return "No se puede generar el archivo KML: se requieren al menos 2 puntos de telemetría válidos (encontrados: \(count))."
        case .fileWriteFailed(let underlying):
            return "No se pudo escribir el archivo KML en el directorio temporal: \(underlying)"
        }
    }
}

// MARK: - KML Exporter Engine
public final class KMLExporter {

    public static let shared = KMLExporter()
    public let appName: String

    private let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    public init(appName: String = "Race Wars Tracker") {
        self.appName = appName
    }

    public static func escapeXML(_ text: String) -> String {
        var escaped = text
        escaped = escaped.replacingOccurrences(of: "&", with: "&amp;")
        escaped = escaped.replacingOccurrences(of: "<", with: "&lt;")
        escaped = escaped.replacingOccurrences(of: ">", with: "&gt;")
        escaped = escaped.replacingOccurrences(of: "\"", with: "&quot;")
        escaped = escaped.replacingOccurrences(of: "'", with: "&apos;")
        return escaped
    }

    /// Construye el contenido KML 2.2 compatible con Google Earth, Google Maps y aplicaciones GIS
    public func generateKMLString(route: Route) throws -> String {
        let points = route.trackpoints
        guard points.count >= 2 else {
            throw KMLExportError.insufficientTrackPoints(count: points.count)
        }

        let escapedTitle = Self.escapeXML(route.title)
        let startTimeStr = iso8601Formatter.string(from: route.startedAt)
        let distKm = String(format: "%.2f", route.totalDistanceMeters / 1000.0)
        let maxSpd = String(format: "%.0f", route.maxSpeedKmh)
        let avgSpd = String(format: "%.0f", route.avgSpeedKmh)
        
        let desc = Self.escapeXML("""
        Ruta registrada con Race Wars Tracker
        Fecha: \(startTimeStr)
        Distancia: \(distKm) km
        Velocidad Máx: \(maxSpd) km/h
        Velocidad Media: \(avgSpd) km/h
        Puntos GPS: \(points.count)
        """)

        var coordList: [String] = []
        var gxTrackWhens: [String] = []
        var gxTrackCoords: [String] = []

        for p in points {
            let lat = String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), p.latitude)
            let lon = String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), p.longitude)
            let alt = String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), p.altitude ?? 0.0)
            let timeStr = iso8601Formatter.string(from: p.timestamp)

            // KML coord: lon,lat,alt
            coordList.append("\(lon),\(lat),\(alt)")
            
            // gx:Track tags
            gxTrackWhens.append("        <when>\(timeStr)</when>")
            gxTrackCoords.append("        <gx:coord>\(lon) \(lat) \(alt)</gx:coord>")
        }

        let firstPoint = points.first!
        let lastPoint = points.last!
        let firstCoord = "\(String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), firstPoint.longitude)),\(String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), firstPoint.latitude)),\(String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), firstPoint.altitude ?? 0.0))"
        let lastCoord = "\(String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), lastPoint.longitude)),\(String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), lastPoint.latitude)),\(String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), lastPoint.altitude ?? 0.0))"

        let kml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
          <Document>
            <name>\(escapedTitle)</name>
            <description>\(desc)</description>
            
            <!-- Estilo de línea de competición Verde Neón Race Wars (#39FF14 -> ff14ff39 en KML) -->
            <Style id="raceTrackStyle">
              <LineStyle>
                <color>ff14ff39</color>
                <width>4</width>
              </LineStyle>
            </Style>
            
            <Style id="startPointStyle">
              <IconStyle>
                <scale>1.2</scale>
                <Icon>
                  <href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href>
                </Icon>
              </IconStyle>
            </Style>
            
            <Style id="finishPointStyle">
              <IconStyle>
                <scale>1.2</scale>
                <Icon>
                  <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
                </Icon>
              </IconStyle>
            </Style>

            <!-- Punto de Salida -->
            <Placemark>
              <name>Salida</name>
              <styleUrl>#startPointStyle</styleUrl>
              <Point>
                <coordinates>\(firstCoord)</coordinates>
              </Point>
            </Placemark>

            <!-- Punto de Meta -->
            <Placemark>
              <name>Meta</name>
              <styleUrl>#finishPointStyle</styleUrl>
              <Point>
                <coordinates>\(lastCoord)</coordinates>
              </Point>
            </Placemark>

            <!-- Trazado 3D de la Ruta -->
            <Placemark>
              <name>\(escapedTitle) (Trazado)</name>
              <styleUrl>#raceTrackStyle</styleUrl>
              <LineString>
                <extrude>1</extrude>
                <tessellate>1</tessellate>
                <altitudeMode>clampToGround</altitudeMode>
                <coordinates>
                  \(coordList.joined(separator: "\n          "))
                </coordinates>
              </LineString>
            </Placemark>

            <!-- Reproducción Temporal para Google Earth -->
            <Placemark>
              <name>\(escapedTitle) (Reproducción Temporal)</name>
              <styleUrl>#raceTrackStyle</styleUrl>
              <gx:Track>
                <altitudeMode>clampToGround</altitudeMode>
        \(gxTrackWhens.joined(separator: "\n"))
        \(gxTrackCoords.joined(separator: "\n"))
              </gx:Track>
            </Placemark>

          </Document>
        </kml>
        """
        return kml
    }

    /// Método de conveniencia estático para crear un archivo .kml
    public static func createKMLFile(from route: Route, customFileName: String? = nil) throws -> URL {
        return try KMLExporter.shared.exportToFile(route: route, customFileName: customFileName)
    }

    /// Genera y escribe el archivo .kml en el directorio temporal
    public func exportToFile(route: Route, customFileName: String? = nil) throws -> URL {
        let kmlString = try generateKMLString(route: route)

        let safeName = (customFileName ?? route.title)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "_")
        let finalFileName = safeName.isEmpty ? "route_\(route.id.uuidString)" : safeName

        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("\(finalFileName).kml")

        do {
            try kmlString.write(to: fileURL, atomically: true, encoding: .utf8)
            return fileURL
        } catch {
            throw KMLExportError.fileWriteFailed(underlying: error.localizedDescription)
        }
    }
}
