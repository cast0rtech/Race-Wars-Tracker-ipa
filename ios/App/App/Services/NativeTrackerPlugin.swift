import Foundation
import UIKit
import Capacitor
import CoreLocation

@objc(NativeTrackerPlugin)
public class NativeTrackerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTrackerPlugin"
    public let jsName = "NativeTracker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecordedPoints", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportGPX", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportKML", returnType: CAPPluginReturnPromise)
    ]

    private var registeredCallback: Bool = false

    override public func load() {
        super.load()
        setupPointObserver()
    }

    private func setupPointObserver() {
        guard !registeredCallback else { return }
        registeredCallback = true
        LocationManager.shared.onPointRecorded = { [weak self] point in
            guard let self = self else { return }
            let pointDict: [String: Any] = [
                "lat": point.latitude,
                "lng": point.longitude,
                "latitude": point.latitude,
                "longitude": point.longitude,
                "altitude": point.altitude ?? 0.0,
                "altitudeM": point.altitude ?? 0.0,
                "speedKmh": point.speedKmh,
                "speed": point.speedKmh / 3.6,
                "timestamp": Int(point.timestamp.timeIntervalSince1970 * 1000),
                "horizontalAccuracy": point.horizontalAccuracy ?? 5.0
            ]
            self.notifyListeners("pointRecorded", data: pointDict)
        }
    }

    @objc func startRecording(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.setupPointObserver()
            LocationManager.shared.startRecording()
            let routeId = LocationManager.shared.currentRecordingRouteId?.uuidString ?? UUID().uuidString
            call.resolve([
                "success": true,
                "isRecording": true,
                "routeId": routeId
            ])
        }
    }

    @objc func stopRecording(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let points = LocationManager.shared.recordedPoints
            LocationManager.shared.stopRecording()
            
            var pointsArray: [[String: Any]] = []
            for point in points {
                pointsArray.append([
                    "lat": point.latitude,
                    "lng": point.longitude,
                    "latitude": point.latitude,
                    "longitude": point.longitude,
                    "altitude": point.altitude ?? 0.0,
                    "altitudeM": point.altitude ?? 0.0,
                    "speedKmh": point.speedKmh,
                    "speed": point.speedKmh / 3.6,
                    "timestamp": Int(point.timestamp.timeIntervalSince1970 * 1000),
                    "horizontalAccuracy": point.horizontalAccuracy ?? 5.0
                ])
            }
            
            call.resolve([
                "success": true,
                "isRecording": false,
                "pointsCount": pointsArray.count,
                "points": pointsArray,
                "totalDistanceMeters": LocationManager.shared.totalDistanceMeters
            ])
        }
    }

    @objc func getRecordedPoints(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let points = LocationManager.shared.recordedPoints
            var pointsArray: [[String: Any]] = []
            for point in points {
                pointsArray.append([
                    "lat": point.latitude,
                    "lng": point.longitude,
                    "latitude": point.latitude,
                    "longitude": point.longitude,
                    "altitude": point.altitude ?? 0.0,
                    "altitudeM": point.altitude ?? 0.0,
                    "speedKmh": point.speedKmh,
                    "speed": point.speedKmh / 3.6,
                    "timestamp": Int(point.timestamp.timeIntervalSince1970 * 1000),
                    "horizontalAccuracy": point.horizontalAccuracy ?? 5.0
                ])
            }
            call.resolve([
                "points": pointsArray,
                "count": pointsArray.count
            ])
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "isRecording": LocationManager.shared.isRecording,
                "pointsCount": LocationManager.shared.recordedPoints.count,
                "currentSpeedKmh": LocationManager.shared.currentSpeedKmh,
                "totalDistanceMeters": LocationManager.shared.totalDistanceMeters,
                "isGPSConnected": LocationManager.shared.isGPSConnected
            ])
        }
    }

    @objc func exportGPX(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let routeName = call.getString("routeName") ?? "Ruta Race Wars Tracker"
            
            var trackPoints: [TrackPoint] = []
            if let rawPoints = call.getArray("points") as? [[String: Any]], !rawPoints.isEmpty {
                for dict in rawPoints {
                    let lat = (dict["lat"] as? Double) ?? (dict["latitude"] as? Double) ?? 0.0
                    let lon = (dict["lng"] as? Double) ?? (dict["lon"] as? Double) ?? (dict["longitude"] as? Double) ?? 0.0
                    let alt = (dict["altitudeM"] as? Double) ?? (dict["altitude"] as? Double)
                    let spd = (dict["speedKmh"] as? Double) ?? ((dict["speed"] as? Double ?? 0.0) * 3.6)
                    let tsMs = (dict["timestamp"] as? Double) ?? (dict["timestamp"] as? Int).map { Double($0) } ?? (Date().timeIntervalSince1970 * 1000)
                    let date = Date(timeIntervalSince1970: tsMs / 1000.0)
                    trackPoints.append(TrackPoint(
                        latitude: lat,
                        longitude: lon,
                        altitude: alt,
                        timestamp: date,
                        speedKmh: spd
                    ))
                }
            } else {
                trackPoints = LocationManager.shared.recordedPoints
            }

            guard !trackPoints.isEmpty else {
                call.reject("No hay puntos GPS para exportar en GPX")
                return
            }

            do {
                let xmlString: String
                if trackPoints.count >= 2 {
                    xmlString = try GPXExporter.shared.generateGPXString(
                        routeName: routeName,
                        startTime: trackPoints.first?.timestamp ?? Date(),
                        points: trackPoints
                    )
                } else {
                    xmlString = try GPXExporter.shared.generateOpenGPXTrackerFormat(
                        points: trackPoints,
                        creator: "Race Wars Tracker for iOS"
                    )
                }
                
                let safeName = routeName.components(separatedBy: CharacterSet.alphanumerics.inverted)
                    .filter { !$0.isEmpty }.joined(separator: "_")
                let fileName = "\(safeName.isEmpty ? "RaceWars_Track" : safeName)_\(Int(Date().timeIntervalSince1970)).gpx"
                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                try xmlString.write(to: tempURL, atomically: true, encoding: .utf8)
                
                self.presentShareSheet(fileURL: tempURL)
                call.resolve(["success": true, "filePath": tempURL.path])
            } catch {
                call.reject("Error generando GPX: \(error.localizedDescription)")
            }
        }
    }

    @objc func exportKML(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let routeName = call.getString("routeName") ?? "Ruta Race Wars Tracker"
            
            var trackPoints: [TrackPoint] = []
            if let rawPoints = call.getArray("points") as? [[String: Any]], !rawPoints.isEmpty {
                for dict in rawPoints {
                    let lat = (dict["lat"] as? Double) ?? (dict["latitude"] as? Double) ?? 0.0
                    let lon = (dict["lng"] as? Double) ?? (dict["lon"] as? Double) ?? (dict["longitude"] as? Double) ?? 0.0
                    let alt = (dict["altitudeM"] as? Double) ?? (dict["altitude"] as? Double)
                    let spd = (dict["speedKmh"] as? Double) ?? ((dict["speed"] as? Double ?? 0.0) * 3.6)
                    let tsMs = (dict["timestamp"] as? Double) ?? (dict["timestamp"] as? Int).map { Double($0) } ?? (Date().timeIntervalSince1970 * 1000)
                    let date = Date(timeIntervalSince1970: tsMs / 1000.0)
                    trackPoints.append(TrackPoint(
                        latitude: lat,
                        longitude: lon,
                        altitude: alt,
                        timestamp: date,
                        speedKmh: spd
                    ))
                }
            } else {
                trackPoints = LocationManager.shared.recordedPoints
            }

            guard !trackPoints.isEmpty else {
                call.reject("No hay puntos GPS para exportar en KML")
                return
            }

            do {
                // Si solo hay 1 punto, duplicamos para formar una línea válida mínima de 2 puntos
                var finalPoints = trackPoints
                if finalPoints.count == 1 {
                    finalPoints.append(finalPoints[0])
                }
                
                let route = Route(
                    title: routeName,
                    startedAt: finalPoints.first?.timestamp ?? Date(),
                    endedAt: finalPoints.last?.timestamp ?? Date(),
                    trackpoints: finalPoints
                )
                let kmlString = try KMLExporter.shared.generateKMLString(route: route)
                
                let safeName = routeName.components(separatedBy: CharacterSet.alphanumerics.inverted)
                    .filter { !$0.isEmpty }.joined(separator: "_")
                let fileName = "\(safeName.isEmpty ? "RaceWars_Track" : safeName)_\(Int(Date().timeIntervalSince1970)).kml"
                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                try kmlString.write(to: tempURL, atomically: true, encoding: .utf8)
                
                self.presentShareSheet(fileURL: tempURL)
                call.resolve(["success": true, "filePath": tempURL.path])
            } catch {
                call.reject("Error generando KML: \(error.localizedDescription)")
            }
        }
    }

    private func presentShareSheet(fileURL: URL) {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            return
        }
        var presenter = rootVC
        while let presented = presenter.presentedViewController {
            presenter = presented
        }
        let activityVC = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        presenter.present(activityVC, animated: true)
    }
}
