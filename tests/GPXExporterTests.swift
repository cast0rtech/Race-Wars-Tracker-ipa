import XCTest
@testable import App

final class GPXExporterTests: XCTestCase {

    var exporter: GPXExporter!

    override func setUp() {
        super.setUp()
        exporter = GPXExporter(appName: "Race Wars Tracker Tests")
    }

    override func tearDown() {
        exporter = nil
        super.tearDown()
    }

    // MARK: - Test 1: Ruta con 0 puntos debe fallar con error explícito
    func testExportWithZeroPointsThrowsError() {
        let emptyPoints: [TrackPoint] = []
        
        XCTAssertThrowsError(
            try exporter.generateGPXString(
                routeName: "Ruta Vacía",
                startTime: Date(),
                points: emptyPoints
            )
        ) { error in
            guard let gpxError = error as? GPXExportError else {
                XCTFail("El tipo de error debería ser GPXExportError")
                return
            }
            XCTAssertEqual(gpxError, GPXExportError.insufficientTrackPoints(count: 0))
        }
    }

    // MARK: - Test 2: Ruta con 1 punto debe fallar (mínimo 2 puntos requeridos)
    func testExportWithSinglePointThrowsError() {
        let singlePoint = [
            TrackPoint(latitude: 40.4168, longitude: -3.7038, altitude: 650.0)
        ]
        
        XCTAssertThrowsError(
            try exporter.generateGPXString(
                routeName: "Un solo punto",
                startTime: Date(),
                points: singlePoint
            )
        ) { error in
            XCTAssertEqual(error as? GPXExportError, GPXExportError.insufficientTrackPoints(count: 1))
        }
    }

    // MARK: - Test 3: Ruta con 3 puntos genera XML válido y parseable con 3 <trkpt>
    func testExportWithThreePointsGeneratesValidParseableXML() throws {
        let baseDate = ISO8601DateFormatter().date(from: "2025-05-10T12:00:00Z")!
        let p1 = TrackPoint(latitude: 40.1234567, longitude: -3.6543210, altitude: 600.5, timestamp: baseDate, speedKmh: 50.0)
        let p2 = TrackPoint(latitude: 40.1245678, longitude: -3.6532109, altitude: 610.2, timestamp: baseDate.addingTimeInterval(10), speedKmh: 75.0)
        let p3 = TrackPoint(latitude: 40.1256789, longitude: -3.6521098, altitude: 620.8, timestamp: baseDate.addingTimeInterval(20), speedKmh: 90.0)

        let points = [p1, p2, p3]
        let xmlString = try exporter.generateGPXString(
            routeName: "Circuito Jarama Tramo 1",
            startTime: baseDate,
            points: points
        )

        // 1. Debe ser parseable sin errores mediante XMLParser
        XCTAssertNoThrow(try exporter.validateXML(xmlString: xmlString, expectedPointsCount: 3))

        // 2. Debe contener la cabecera GPX 1.1 oficial y namespaces
        XCTAssertTrue(xmlString.contains("<gpx version=\"1.1\""))
        XCTAssertTrue(xmlString.contains("xmlns=\"http://www.topografix.com/GPX/1/1\""))
        XCTAssertTrue(xmlString.contains("xmlns:gpxtpx=\"http://www.garmin.com/xmlschemas/TrackPointExtension/v1\""))

        // 3. Debe contener exactamente 3 aperturas de <trkpt y cierres </trkpt>
        let trkptMatches = xmlString.components(separatedBy: "<trkpt ").count - 1
        XCTAssertEqual(trkptMatches, 3)
    }

    // MARK: - Test 4: Verificación estricta de precisión de coordenadas (mínimo 6 decimales y punto decimal)
    func testCoordinatePrecisionAndDecimalSeparator() throws {
        let baseDate = Date()
        let p1 = TrackPoint(latitude: 40.123456, longitude: -3.987654, altitude: 720.0, timestamp: baseDate)
        let p2 = TrackPoint(latitude: 40.0, longitude: -3.0, altitude: 720.0, timestamp: baseDate.addingTimeInterval(5))

        let xmlString = try exporter.generateGPXString(
            routeName: "Test Precisión",
            startTime: baseDate,
            points: [p1, p2]
        )

        // Comprobar que contiene el punto flotante en formato estadounidense (no coma) y 6 decimales
        XCTAssertTrue(xmlString.contains("lat=\"40.123456\" lon=\"-3.987654\""))
        XCTAssertTrue(xmlString.contains("lat=\"40.000000\" lon=\"-3.000000\""))
        XCTAssertFalse(xmlString.contains("lat=\"40,123456\""), "No debe contener comas decimales")
    }

    // MARK: - Test 5: Verificación de escape seguro de caracteres XML en títulos
    func testSpecialCharactersXMLEscaping() throws {
        let baseDate = Date()
        let p1 = TrackPoint(latitude: 40.1, longitude: -3.1, timestamp: baseDate)
        let p2 = TrackPoint(latitude: 40.2, longitude: -3.2, timestamp: baseDate.addingTimeInterval(5))

        let rawTitle = "Ruta & Competición <Madrid> \"Fast & Furious\" 'Pro'"
        let xmlString = try exporter.generateGPXString(
            routeName: rawTitle,
            startTime: baseDate,
            points: [p1, p2]
        )

        // Comprobar que los caracteres han sido convertidos en entidades XML
        XCTAssertTrue(xmlString.contains("&amp;"), "Debe escapar el ampersand")
        XCTAssertTrue(xmlString.contains("&lt;Madrid&gt;"), "Debe escapar los corchetes angulares")
        XCTAssertTrue(xmlString.contains("&quot;Fast &amp; Furious&quot;"), "Debe escapar las comillas dobles")
        XCTAssertTrue(xmlString.contains("&apos;Pro&apos;"), "Debe escapar las comillas simples")

        // El XML debe seguir siendo 100% válido y parseable
        XCTAssertNoThrow(try exporter.validateXML(xmlString: xmlString, expectedPointsCount: 2))
    }

    // MARK: - Test 6: Verificación de timestamps UTC ISO 8601 con 'Z'
    func testTimestampISO8601UTCWithZ() throws {
        let specificDate = Date(timeIntervalSince1970: 1735689600) // 2025-01-01 00:00:00 UTC
        let p1 = TrackPoint(latitude: 40.0, longitude: -3.0, timestamp: specificDate)
        let p2 = TrackPoint(latitude: 40.1, longitude: -3.1, timestamp: specificDate.addingTimeInterval(30))

        let xmlString = try exporter.generateGPXString(
            routeName: "Test UTC",
            startTime: specificDate,
            points: [p1, p2]
        )

        XCTAssertTrue(xmlString.contains("<time>2025-01-01T00:00:00Z</time>"))
        XCTAssertTrue(xmlString.contains("<time>2025-01-01T00:00:30Z</time>"))
    }

    // MARK: - Test 7: Exportación a archivo físico temporal (.gpx)
    func testExportToFileWritesValidGPX() throws {
        let baseDate = Date()
        let p1 = TrackPoint(latitude: 40.4168, longitude: -3.7038, altitude: 650.0, timestamp: baseDate, speedKmh: 60.0)
        let p2 = TrackPoint(latitude: 40.4178, longitude: -3.7048, altitude: 655.0, timestamp: baseDate.addingTimeInterval(10), speedKmh: 80.0)

        let route = Route(
            id: UUID(),
            title: "Ruta Exportable Temporal",
            startedAt: baseDate,
            endedAt: baseDate.addingTimeInterval(10),
            trackpoints: [p1, p2]
        )

        let fileURL = try exporter.exportToFile(route: route)

        XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path))
        XCTAssertEqual(fileURL.pathExtension, "gpx")

        let content = try String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertTrue(content.contains("<gpx version=\"1.1\""))
        XCTAssertTrue(content.contains("Ruta Exportable Temporal"))

        // Limpieza del archivo temporal de prueba
        try? FileManager.default.removeItem(at: fileURL)
    }
}
