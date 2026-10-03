import Foundation
import UIKit

// MARK: - GPX Export Errors
public enum GPXExportError: LocalizedError, Equatable {
    case insufficientTrackPoints(count: Int)
    case xmlValidationFailed(reason: String)
    case fileWriteFailed(underlying: String)

    public var errorDescription: String? {
        switch self {
        case .insufficientTrackPoints(let count):
            return "No se puede generar el archivo GPX: se requieren al menos 2 puntos de telemetría válidos (encontrados: \(count))."
        case .xmlValidationFailed(let reason):
            return "Validación XML fallida: el contenido GPX no cumple con el estándar 1.1 (\(reason))."
        case .fileWriteFailed(let underlying):
            return "No se pudo escribir el archivo GPX en el directorio temporal: \(underlying)"
        }
    }
}

// MARK: - Extension Data for Garmin TrackPointExtension
public struct GarminTelemetryExtension: Equatable {
    public var heartRateBpm: Int?
    public var cadenceRpm: Int?
    public var airTempCelsius: Double?
    public var speedMps: Double?

    public init(
        heartRateBpm: Int? = nil,
        cadenceRpm: Int? = nil,
        airTempCelsius: Double? = nil,
        speedMps: Double? = nil
    ) {
        self.heartRateBpm = heartRateBpm
        self.cadenceRpm = cadenceRpm
        self.airTempCelsius = airTempCelsius
        self.speedMps = speedMps
    }
}

// MARK: - GPX Exporter Engine
public final class GPXExporter {

    public static let shared = GPXExporter()
    public let appName: String

    // Formateador ISO 8601 estricto en UTC con sufijo 'Z'
    private let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(secondsFromGMT: 0) // UTC obligatorio
        return formatter
    }()

    public init(appName: String = "Race Wars Tracker") {
        self.appName = appName
    }

    // MARK: - XML Escaping
    
    /// Escapa caracteres reservados de XML para prevenir documentos malformados o inyecciones
    public static func escapeXML(_ text: String) -> String {
        var escaped = text
        // Reemplazar '&' primero para evitar re-escapar entidades subsecuentes
        escaped = escaped.replacingOccurrences(of: "&", with: "&amp;")
        escaped = escaped.replacingOccurrences(of: "<", with: "&lt;")
        escaped = escaped.replacingOccurrences(of: ">", with: "&gt;")
        escaped = escaped.replacingOccurrences(of: "\"", with: "&quot;")
        escaped = escaped.replacingOccurrences(of: "'", with: "&apos;")
        return escaped
    }

    // MARK: - Generación de String GPX 1.1
    
    /// Construye el contenido GPX 1.1 completo cumpliendo con el esquema oficial de Topografix y Garmin
    public func generateGPXString(
        routeName: String,
        startTime: Date,
        points: [TrackPoint],
        garminExtensions: [GarminTelemetryExtension]? = nil
    ) throws -> String {
        
        // Validación 1: Verificar que haya al menos 2 puntos para un track válido
        guard points.count >= 2 else {
            throw GPXExportError.insufficientTrackPoints(count: points.count)
        }

        let escapedRouteName = Self.escapeXML(routeName)
        let formattedStartTime = iso8601Formatter.string(from: startTime)

        var xml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" creator="\(Self.escapeXML(appName))"
             xmlns="http://www.topografix.com/GPX/1/1"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
             xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
          <metadata>
            <name>\(escapedRouteName)</name>
            <time>\(formattedStartTime)</time>
          </metadata>
          <trk>
            <name>\(escapedRouteName)</name>
            <trkseg>

        """

        for (index, point) in points.enumerated() {
            // Formateo geodésico con punto decimal forzado y al menos 6 decimales
            let latString = String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), point.latitude)
            let lonString = String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), point.longitude)
            let timeString = iso8601Formatter.string(from: point.timestamp)

            xml += "      <trkpt lat=\"\(latString)\" lon=\"\(lonString)\">\n"

            // Altitud elipsoidal/barométrica en metros si existe
            if let alt = point.altitude {
                let altString = String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), alt)
                xml += "        <ele>\(altString)</ele>\n"
            }

            // Timestamp ISO 8601 UTC
            xml += "        <time>\(timeString)</time>\n"

            // Extensiones Garmin TrackPointExtension (speed, temp, hr, cad)
            var extensionLines: [String] = []
            
            // Si el punto trae velocidad, la añadimos a las extensiones (convertida a m/s)
            if point.speedKmh > 0 {
                let speedMps = point.speedKmh / 3.6
                let spdString = String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), speedMps)
                extensionLines.append("            <gpxtpx:speed>\(spdString)</gpxtpx:speed>")
            }

            if let extensions = garminExtensions, index < extensions.count {
                let ext = extensions[index]
                if let hr = ext.heartRateBpm {
                    extensionLines.append("            <gpxtpx:hr>\(hr)</gpxtpx:hr>")
                }
                if let cad = ext.cadenceRpm {
                    extensionLines.append("            <gpxtpx:cad>\(cad)</gpxtpx:cad>")
                }
                if let temp = ext.airTempCelsius {
                    let tempStr = String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), temp)
                    extensionLines.append("            <gpxtpx:atemp>\(tempStr)</gpxtpx:atemp>")
                }
            }

            if !extensionLines.isEmpty {
                xml += "        <extensions>\n"
                xml += "          <gpxtpx:TrackPointExtension>\n"
                xml += extensionLines.joined(separator: "\n") + "\n"
                xml += "          </gpxtpx:TrackPointExtension>\n"
                xml += "        </extensions>\n"
            }

            xml += "      </trkpt>\n"
        }

        xml += """
            </trkseg>
          </trk>
        </gpx>
        """

        // Validación 2: Validar el XML resultante con XMLParser antes de exportar
        try validateXML(xmlString: xml, expectedPointsCount: points.count)

        return xml
    }

    // MARK: - Validación con XMLParser
    
    /// Comprueba que el archivo sea XML sintácticamente válido y contenga los trackpoints esperados
    public func validateXML(xmlString: String, expectedPointsCount: Int) throws {
        guard let data = xmlString.data(using: .utf8) else {
            throw GPXExportError.xmlValidationFailed(reason: "No se pudo codificar el XML a bytes UTF-8")
        }

        let validator = GPXValidatorDelegate()
        let parser = XMLParser(data: data)
        parser.delegate = validator

        guard parser.parse() else {
            let errorMsg = parser.parserError?.localizedDescription ?? "Error sintáctico desconocido"
            throw GPXExportError.xmlValidationFailed(reason: errorMsg)
        }

        if validator.trkptCount != expectedPointsCount {
            throw GPXExportError.xmlValidationFailed(
                reason: "Discrepancia de puntos: se esperaban \(expectedPointsCount), se parsearon \(validator.trkptCount)"
            )
        }
    }

    // MARK: - Exportación a Disco Temporal (.gpx)
    
    /// Método de conveniencia estático
    public static func createGPXFile(from route: Route, customFileName: String? = nil) throws -> URL {
        return try GPXExporter.shared.exportToFile(route: route, customFileName: customFileName)
    }
    
    /// Genera y escribe el archivo .gpx en el directorio temporal listo para compartir
    public func exportToFile(
        route: Route,
        customFileName: String? = nil
    ) throws -> URL {
        let xmlString = try generateGPXString(
            routeName: route.title,
            startTime: route.startedAt,
            points: route.trackpoints
        )

        let safeName = (customFileName ?? route.title)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "_")
        let finalFileName = safeName.isEmpty ? "route_\(route.id.uuidString)" : safeName
        
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("\(finalFileName).gpx")

        do {
            try xmlString.write(to: fileURL, atomically: true, encoding: .utf8)
            return fileURL
        } catch {
            throw GPXExportError.fileWriteFailed(underlying: error.localizedDescription)
        }
    }

    // MARK: - UIActivityViewController Share Sheet
    
    /// Crea el UIActivityViewController nativo de iOS para AirDrop, Mail, Archivos, Strava, etc.
    @MainActor
    public func createShareSheet(fileURL: URL) -> UIActivityViewController {
        let activityVC = UIActivityViewController(
            activityItems: [fileURL],
            applicationActivities: nil
        )
        return activityVC
    }
}

// MARK: - XML Parser Delegate para Validación Sintáctica
fileprivate final class GPXValidatorDelegate: NSObject, XMLParserDelegate {
    var trkptCount: Int = 0
    var hasMetadata: Bool = false
    var hasTrk: Bool = false
    var hasTrkseg: Bool = false

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String : String] = [:]
    ) {
        switch elementName {
        case "metadata":
            hasMetadata = true
        case "trk":
            hasTrk = true
        case "trkseg":
            hasTrkseg = true
        case "trkpt":
            trkptCount += 1
        default:
            break
        }
    }
}
