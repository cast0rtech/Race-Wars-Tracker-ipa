import Foundation
import CoreLocation
import UIKit
#if canImport(Combine)
import Combine
#endif

// NativeTelemetryPoint is defined in RouteModels.swift as `typealias NativeTelemetryPoint = TrackPoint`


// MARK: - Location Manager for Continuous Background Route Recording
public final class LocationManager: NSObject, ObservableObject {
    
    public static let shared = LocationManager()

    // MARK: - CoreLocation
    private let locationManager = CLLocationManager()
    
    #if canImport(CoreLocation)
    // iOS 17+ CLBackgroundActivitySession ensures maximum background reliability
    private var _backgroundActivitySession: Any?
    @available(iOS 17.0, *)
    private var backgroundActivitySession: CLBackgroundActivitySession? {
        get { return _backgroundActivitySession as? CLBackgroundActivitySession }
        set { _backgroundActivitySession = newValue }
    }
    #endif

    // MARK: - Published State
    @Published public private(set) var isRecording: Bool = false
    @Published public private(set) var currentRecordingRouteId: UUID? = nil
    @Published public private(set) var recordingStartedAt: Date? = nil
    @Published public private(set) var authorizationStatus: CLAuthorizationStatus
    @Published public private(set) var currentLocation: CLLocation?
    @Published public private(set) var currentSpeedKmh: Double = 0.0
    @Published public private(set) var totalDistanceMeters: Double = 0.0
    @Published public private(set) var recordedPoints: [NativeTelemetryPoint] = []

    // Regla de conexión GPS: velocidad máxima asumida sin señal (máx 80 km/h)
    public static let maxAssumedSpeedWithoutGPS: Double = 80.0
    @Published public private(set) var isGPSConnected: Bool = false
    private var lastFixDate: Date? = nil
    private var gpsWatchdogTimer: Timer?
    
    // Callbacks for non-SwiftUI consumers (e.g., Capacitor WebView Bridge)
    public var onPointRecorded: ((NativeTelemetryPoint) -> Void)?
    public var onStatusChanged: ((CLAuthorizationStatus) -> Void)?
    
    // MARK: - Disk Persistence & Journaling
    private let fileQueue = DispatchQueue(label: "com.racewars.tracker.location.persistence", qos: .utility)
    private var journalFileHandle: FileHandle?
    private var journalURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("active_recording_journal.jsonl")
    }
    private var completedSessionsURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("completed_sessions")
    }

    // MARK: - Initialization
    private override init() {
        self.authorizationStatus = locationManager.authorizationStatus
        super.init()
        
        setupLocationManager()
        setupNotifications()
        recoverInterruptedSessionIfNeeded()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        closeJournal()
    }

    // MARK: - 1. Configuration of CLLocationManager
    private func setupLocationManager() {
        locationManager.delegate = self
        
        // Alta precisión requerida para telemetría
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        
        // Tipo de actividad físico/deportivo para optimizar los algoritmos de filtrado
        locationManager.activityType = .fitness
        
        // Filtro de distancia en metros (5 metros según especificación)
        locationManager.distanceFilter = 5.0
        
        // No permitir que iOS pause los updates automáticamente en reposo
        locationManager.pausesLocationUpdatesAutomatically = false
    }

    // MARK: - 2. Permissions Hierarchy
    
    /// Paso 1: Solicita autorización básica "Al usar la app"
    public func requestInitialPermission() {
        let status = locationManager.authorizationStatus
        if status == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        }
    }
    
    /// Paso 2: Solicita autorización "Siempre" con explicación previa cuando se va a grabar
    public func requestBackgroundPermission(presentingViewController: UIViewController? = nil, onComplete: (() -> Void)? = nil) {
        let status = locationManager.authorizationStatus
        
        switch status {
        case .authorizedWhenInUse:
            // Mostrar explicación previa antes de solicitar permiso "Siempre"
            if let presenter = presentingViewController ?? topMostViewController() {
                let alert = UIAlertController(
                    title: "Ubicación en Segundo Plano",
                    message: "Race Wars Tracker necesita acceso continuo ('Cambiar a Permitir siempre') para registrar tu telemetría y ruta GPS incluso con la pantalla apagada o en el soporte del vehículo.",
                    preferredStyle: .alert
                )
                alert.addAction(UIAlertAction(title: "Configurar", style: .default) { [weak self] _ in
                    self?.locationManager.requestAlwaysAuthorization()
                    onComplete?()
                })
                alert.addAction(UIAlertAction(title: "Continuar con 'Al usar'", style: .cancel) { _ in
                    onComplete?()
                })
                presenter.present(alert, animated: true)
            } else {
                locationManager.requestAlwaysAuthorization()
                onComplete?()
            }
            
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
            onComplete?()
            
        case .denied, .restricted:
            showSettingsAlert(presentingViewController: presentingViewController)
            onComplete?()
            
        case .authorizedAlways:
            onComplete?()
            
        @unknown default:
            onComplete?()
        }
    }

    private func showSettingsAlert(presentingViewController: UIViewController?) {
        guard let presenter = presentingViewController ?? topMostViewController() else { return }
        let alert = UIAlertController(
            title: "Permiso de Ubicación Necesario",
            message: "Por favor activa los permisos de ubicación en Ajustes para poder registrar rutas de telemetría.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Abrir Ajustes", style: .default) { _ in
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        })
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        presenter.present(alert, animated: true)
    }

    // MARK: - 3. Recording Session (Start / Stop)
    
    /// Inicia la sesión de grabación y activa los modos en segundo plano
    public func startRecording(presentingVC: UIViewController? = nil) {
        guard !isRecording else { return }
        
        // Comprobar permiso Always al empezar a grabar
        requestBackgroundPermission(presentingViewController: presentingVC) { [weak self] in
            guard let self = self else { return }
            
            self.isRecording = true
            self.currentRecordingRouteId = UUID()
            self.recordingStartedAt = Date()
            self.totalDistanceMeters = 0.0
            self.recordedPoints = []
            
            // 1. Inicializar journal en disco (almacenamiento incremental)
            self.initJournal()
            
            // 2. Iniciar sesión de actividad en segundo plano (iOS 17+)
            if #available(iOS 17.0, *) {
                self.backgroundActivitySession = CLBackgroundActivitySession()
                print("[LocationManager] CLBackgroundActivitySession activada (iOS 17+).")
            }
            
            // 3. Iniciar escucha de CLLocationManager con background updates seguro
            if let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String], modes.contains("location") {
                self.locationManager.allowsBackgroundLocationUpdates = true
                self.locationManager.showsBackgroundLocationIndicator = true
            }
            self.locationManager.startUpdatingLocation()
            self.startWatchdog()
            print("[LocationManager] Grabación de ruta iniciada (Background Location Activo). ID: \(self.currentRecordingRouteId?.uuidString ?? "")")
        }
    }
    
    /// Detiene la grabación, cancela la sesión de background y persiste la ruta
    public func stopRecording() {
        guard isRecording else { return }
        
        isRecording = false
        stopWatchdog()
        locationManager.stopUpdatingLocation()
        if locationManager.allowsBackgroundLocationUpdates {
            locationManager.allowsBackgroundLocationUpdates = false
            locationManager.showsBackgroundLocationIndicator = false
        }
        
        // Finalizar sesión de actividad en background (iOS 17+)
        if #available(iOS 17.0, *) {
            backgroundActivitySession?.invalidate()
            backgroundActivitySession = nil
            print("[LocationManager] CLBackgroundActivitySession invalidada.")
        }
        
        // Cerrar y persistir archivo definitivo
        finalizeSession()
        print("[LocationManager] Grabación detenida. Total puntos: \(recordedPoints.count), Distancia: \(totalDistanceMeters / 1000.0) km.")
    }

    // MARK: - GPS Connection Loss Handling
    
    private func startWatchdog() {
        stopWatchdog()
        gpsWatchdogTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self, self.isRecording else { return }
            if let last = self.lastFixDate, Date().timeIntervalSince(last) > 2.5 {
                if self.isGPSConnected {
                    self.handleGPSConnectionLost()
                }
            }
        }
    }
    
    private func stopWatchdog() {
        gpsWatchdogTimer?.invalidate()
        gpsWatchdogTimer = nil
    }
    
    /// Regla: Cuando el GPS deja de tener conexión la velocidad que debe asumir la app es máximo 80 km/h
    public func handleGPSConnectionLost() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isGPSConnected = false
            if self.currentSpeedKmh > Self.maxAssumedSpeedWithoutGPS {
                print("[LocationManager] Pérdida de señal GPS: limitando velocidad de \(self.currentSpeedKmh) a \(Self.maxAssumedSpeedWithoutGPS) km/h")
                self.currentSpeedKmh = Self.maxAssumedSpeedWithoutGPS
            }
        }
    }
    
    /// Flujo de guardado: Construye el Route completo en memoria, lo persiste en RouteRepository y devuelve el UUID para navegación
    public func stopAndSaveRoute(title: String? = nil) async throws -> UUID {
        guard isRecording else {
            throw NSError(domain: "LocationManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "No hay grabación activa"])
        }
        
        let routeId = currentRecordingRouteId ?? UUID()
        let start = recordingStartedAt ?? Date()
        let end = Date()
        let pointsCopy = Array(recordedPoints)
        
        // Detener hardware y journals
        stopRecording()
        
        // Construir modelo de dominio completo en memoria
        let domainRoute = Route(
            id: routeId,
            title: title,
            startedAt: start,
            endedAt: end,
            trackpoints: pointsCopy
        )
        
        // Persistir en RouteRepository (fuente única de verdad)
        _ = try await RouteRepository.shared.save(domainRoute)
        
        return routeId
    }

    // MARK: - 4. Incremental Disk Journaling (Protección ante cierres)
    
    private func initJournal() {
        fileQueue.async { [weak self] in
            guard let self = self else { return }
            self.closeJournal()
            
            let url = self.journalURL
            if !FileManager.default.fileExists(atPath: url.path) {
                FileManager.default.createFile(atPath: url.path, contents: nil)
            } else {
                try? FileManager.default.removeItem(at: url)
                FileManager.default.createFile(atPath: url.path, contents: nil)
            }
            
            self.journalFileHandle = try? FileHandle(forWritingTo: url)
        }
    }
    
    private func appendPointToJournal(_ point: NativeTelemetryPoint) {
        fileQueue.async { [weak self] in
            guard let self = self, let handle = self.journalFileHandle else { return }
            do {
                let data = try JSONEncoder().encode(point)
                handle.seekToEndOfFile()
                handle.write(data)
                handle.write("\n".data(using: .utf8)!)
            } catch {
                print("[LocationManager] Error escribiendo en journal: \(error)")
            }
        }
    }
    
    /// Espera a que la cola de persistencia escriba todos los puntos pendientes a disco
    public func flush() async {
        let handle = self.journalFileHandle
        await withCheckedContinuation { continuation in
            fileQueue.async {
                try? handle?.synchronize()
                continuation.resume()
            }
        }
    }
    
    private func closeJournal() {
        try? journalFileHandle?.synchronize()
        try? journalFileHandle?.close()
        journalFileHandle = nil
    }
    
    private func finalizeSession() {
        closeJournal()
        
        fileQueue.async { [weak self] in
            guard let self = self else { return }
            let journal = self.journalURL
            guard FileManager.default.fileExists(atPath: journal.path) else { return }
            
            // Mover a carpeta de sesiones completadas
            let completedDir = self.completedSessionsURL
            try? FileManager.default.createDirectory(at: completedDir, withIntermediateDirectories: true)
            
            let destination = completedDir.appendingPathComponent("session_\(Int(Date().timeIntervalSince1970)).jsonl")
            try? FileManager.default.moveItem(at: journal, to: destination)
        }
    }
    
    private func recoverInterruptedSessionIfNeeded() {
        let url = journalURL
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        
        fileQueue.async { [weak self] in
            guard let self = self else { return }
            do {
                let content = try String(contentsOf: url, encoding: .utf8)
                let lines = content.components(separatedBy: .newlines).filter { !$0.isEmpty }
                var recovered: [NativeTelemetryPoint] = []
                let decoder = JSONDecoder()
                
                for line in lines {
                    if let data = line.data(using: .utf8), let pt = try? decoder.decode(NativeTelemetryPoint.self, from: data) {
                        recovered.append(pt)
                    }
                }
                
                if !recovered.isEmpty {
                    DispatchQueue.main.async {
                        self.recordedPoints = recovered
                        print("[LocationManager] Sesión previa recuperada de crash con \(recovered.count) puntos.")
                    }
                }
            } catch {
                print("[LocationManager] Error recuperando sesión previa: \(error)")
            }
        }
    }

    // MARK: - Lifecycle Notifications
    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    @objc private func handleDidEnterBackground() {
        if isRecording {
            print("[LocationManager] App entró en background. Manteniendo tracking continuo de CoreLocation.")
            // Forzar flush del journal a disco
            fileQueue.async { [weak self] in
                try? self?.journalFileHandle?.synchronize()
            }
        }
    }

    @objc private func handleWillEnterForeground() {
        if isRecording {
            print("[LocationManager] App regresó a foreground. Sesión activa con \(recordedPoints.count) puntos.")
        }
    }

    private func topMostViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            return nil
        }
        var top = rootVC
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}

// MARK: - CLLocationManagerDelegate
extension LocationManager: CLLocationManagerDelegate {
    
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let newStatus = manager.authorizationStatus
        DispatchQueue.main.async { [weak self] in
            self?.authorizationStatus = newStatus
            self?.onStatusChanged?(newStatus)
            print("[LocationManager] Cambio de autorización: \(newStatus.rawValue)")
        }
    }
    
    // Compatibilidad iOS < 14
    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        locationManagerDidChangeAuthorization(manager)
    }
    
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations {
            // Filtrar lecturas antiguas o con precisión horizontal negativa/excesiva (> 50m)
            guard location.horizontalAccuracy >= 0 && location.horizontalAccuracy <= 50.0 else { continue }
            let ageSeconds = abs(location.timestamp.timeIntervalSinceNow)
            guard ageSeconds < 10.0 else { continue }
            
            let point = NativeTelemetryPoint(location: location)
            guard point.speedKmh <= RouteStatsCalculator.maxRealisticSpeedKmh else { continue }
            
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                
                // Conexión GPS activa y confirmada
                self.isGPSConnected = true
                self.lastFixDate = Date()

                // Actualizar velocidad actual en km/h
                self.currentSpeedKmh = point.speedKmh
                
                // Acumular distancia si estamos grabando
                if self.isRecording {
                    if let last = self.currentLocation {
                        let stepMeters = location.distance(from: last)
                        if stepMeters > 1.0 { // Filtrar micro-derivas de ruido estacionario
                            self.totalDistanceMeters += stepMeters
                        }
                    }
                    
                    self.recordedPoints.append(point)
                    self.appendPointToJournal(point)
                    self.onPointRecorded?(point)
                }
                
                self.currentLocation = location
            }
        }
    }
    
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError, clError.code == .denied {
            print("[LocationManager] Acceso denegado por el usuario.")
            stopRecording()
        } else {
            print("[LocationManager] Error de CoreLocation: \(error.localizedDescription)")
            self.handleGPSConnectionLost()
        }
    }
}
