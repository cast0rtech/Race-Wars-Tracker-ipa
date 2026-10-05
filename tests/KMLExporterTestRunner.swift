import Foundation

@main
struct KMLExporterTestRunner {
    static func main() throws {
        print("==================================================================")
        print("                 TEST DE EXPORTADOR KML 2.2                       ")
        print("==================================================================")

        let baseDate = Date()
        let p1 = TrackPoint(latitude: 47.407365, longitude: 8.547411, altitude: 453.4, timestamp: baseDate, speedKmh: 45.0)
        let p2 = TrackPoint(latitude: 47.407325, longitude: 8.547419, altitude: 454.1, timestamp: baseDate.addingTimeInterval(5), speedKmh: 65.0)
        let p3 = TrackPoint(latitude: 47.407306, longitude: 8.547450, altitude: 455.0, timestamp: baseDate.addingTimeInterval(10), speedKmh: 80.0)

        let testRoute = Route(
            id: UUID(),
            title: "Prueba KML Nurburgring",
            startedAt: baseDate,
            endedAt: baseDate.addingTimeInterval(10),
            totalDistanceMeters: 550.0,
            durationSeconds: 10.0,
            avgSpeedKmh: 63.3,
            maxSpeedKmh: 80.0,
            trackpoints: [p1, p2, p3]
        )

        // 1. Generar KML
        let kml = try KMLExporter.shared.generateKMLString(route: testRoute)
        
        assert(kml.contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"), "FAIL: Falta header XML")
        assert(kml.contains("<kml xmlns=\"http://www.opengis.net/kml/2.2\""), "FAIL: Falta xmlns KML 2.2")
        assert(kml.contains("<gx:Track>"), "FAIL: Falta gx:Track para Google Earth")
        assert(kml.contains("<LineString>"), "FAIL: Falta LineString")
        assert(kml.contains("ff14ff39"), "FAIL: Falta color de trazado verde neón (#39FF14)")
        assert(kml.contains("Salida"), "FAIL: Falta pin de salida")
        assert(kml.contains("Meta"), "FAIL: Falta pin de meta")
        assert(kml.contains("8.547411,47.407365,453.4"), "FAIL: Coordenada KML incorrecta (formato lon,lat,alt)")

        print("  ✓ 1. Header XML y namespaces correctos (KML 2.2 + gx:Track)")
        print("  ✓ 2. Estilo de competición verde neón (#39FF14)")
        print("  ✓ 3. Pines de Salida y Meta incluidos")
        print("  ✓ 4. Trazado 3D LineString y animación temporal gx:Track verificados")
        print("  ✓ 5. Formato geodésico KML correcto: lon,lat,alt")

        // 2. Exportar archivo a disco temporal
        let fileURL = try KMLExporter.createKMLFile(from: testRoute)
        assert(FileManager.default.fileExists(atPath: fileURL.path), "FAIL: No se creó el archivo KML en disco")
        let content = try String(contentsOf: fileURL, encoding: .utf8)
        assert(content.count > 100, "FAIL: Archivo KML vacío o corrupto")
        try? FileManager.default.removeItem(at: fileURL)

        print("  ✓ 6. Creación y escritura de archivo .kml en disco exitosa")
        print("==================================================================")
        print("                     TODOS LOS TESTS PASARON                      ")
        print("==================================================================")
    }
}
