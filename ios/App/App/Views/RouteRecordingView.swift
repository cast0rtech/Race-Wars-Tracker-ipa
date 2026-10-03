import SwiftUI

// MARK: - Route Recording Cockpit View (SwiftUI)
public struct RouteRecordingView: View {
    
    @ObservedObject private var locationManager = LocationManager.shared
    
    // ID de la ruta para navegación (únicamente se pasa el ID al resumen)
    @State private var summaryRouteId: UUID? = nil
    @State private var isNavigatingToSummary: Bool = false
    @State private var isSaving: Bool = false
    @State private var errorMessage: String? = nil
    
    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.04, green: 0.05, blue: 0.08)
                    .ignoresSafeArea()
                
                VStack(spacing: 20) {
                    
                    // Estado GPS y Autorización
                    gpsStatusHeader
                    
                    // Cockpit de Telemetría en Vivo
                    liveTelemetryGrid
                    
                    // Mini mapa en vivo si hay puntos
                    if !locationManager.recordedPoints.isEmpty {
                        RouteMiniMapView(
                            trackpoints: locationManager.recordedPoints,
                            isLoading: false,
                            strokeColor: Color(red: 0.0, green: 0.9, blue: 1.0),
                            lineWidth: 3.5
                        )
                        .frame(height: 200)
                        .padding(.horizontal, 16)
                    } else {
                        Spacer()
                    }
                    
                    // Botón Principal: START / STOP ROUTE
                    controlButton
                }
                .padding(.vertical, 16)
                
                if isSaving {
                    savingOverlay
                }
            }
            .navigationTitle("Cockpit")
            .navigationBarTitleDisplayMode(.inline)
            // Navegación obligatoria pasando ÚNICAMENTE el UUID
            .navigationDestination(isPresented: $isNavigatingToSummary) {
                if let id = summaryRouteId {
                    RouteSummaryView(routeId: id)
                }
            }
        }
    }
    
    // MARK: - UI Components
    
    private var gpsStatusHeader: some View {
        HStack {
            Circle()
                .fill(locationManager.isRecording ? Color.green : Color.yellow)
                .frame(width: 10, height: 10)
            Text(locationManager.isRecording ? "GRABANDO GPS (BACKGROUND ACTIVO)" : "EN ESPERA (STANDBY)")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
            Spacer()
            Text("\(locationManager.recordedPoints.count) PTS")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.gray)
        }
        .padding(.horizontal, 20)
    }
    
    private var liveTelemetryGrid: some View {
        VStack(spacing: 12) {
            // Velocímetro Central
            VStack(spacing: 2) {
                Text("\(Int(locationManager.currentSpeedKmh))")
                    .font(.system(size: 64, weight: .heavy, design: .rounded))
                    .foregroundColor(locationManager.currentSpeedKmh > 100 ? .red : .white)
                Text("KM/H")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(.gray)
            }
            .padding(.vertical, 8)
            
            // Distancia
            HStack(spacing: 16) {
                VStack(alignment: .leading) {
                    Text("DISTANCIA")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.gray)
                    Text(String(format: "%.2f km", locationManager.totalDistanceMeters / 1000.0))
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(.cyan)
                }
                Spacer()
            }
            .padding(.horizontal, 24)
        }
    }
    
    private var controlButton: some View {
        VStack(spacing: 8) {
            Button(action: handleRecordingToggle) {
                HStack {
                    Image(systemName: locationManager.isRecording ? "stop.fill" : "play.fill")
                    Text(locationManager.isRecording ? "DETENER Y VER RESUMEN" : "INICIAR RUTA GPS")
                        .fontWeight(.bold)
                }
                .font(.system(size: 16))
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(locationManager.isRecording ? Color.red : Color(red: 0.0, green: 0.9, blue: 1.0))
                .cornerRadius(14)
            }
            .padding(.horizontal, 20)
            
            if let err = errorMessage {
                Text(err)
                    .font(.system(size: 12))
                    .foregroundColor(.red)
            }
        }
    }
    
    private var savingOverlay: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
                    .scaleEffect(1.4)
                Text("Persistiendo ruta en disco...")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
            }
        }
    }
    
    // MARK: - Actions
    
    private func handleRecordingToggle() {
        if !locationManager.isRecording {
            errorMessage = nil
            locationManager.startRecording()
        } else {
            // Flujo de guardado solicitado:
            // 1. Construir Route completo en memoria
            // 2. Persistir con RouteRepository.save(_:)
            // 3. Navegar al resumen pasando SOLO el ID
            Task {
                isSaving = true
                do {
                    let savedId = try await locationManager.stopAndSaveRoute(title: "Ruta Cockpit")
                    self.summaryRouteId = savedId
                    self.isNavigatingToSummary = true
                } catch {
                    self.errorMessage = "Error guardando ruta: \(error.localizedDescription)"
                }
                isSaving = false
            }
        }
    }
}
