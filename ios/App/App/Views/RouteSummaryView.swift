import SwiftUI
import MapKit

// MARK: - Route Summary View (Debrief de Ruta Persistida)
public struct RouteSummaryView: View {
    
    public let routeId: UUID
    private let repository: RouteRepositoryProtocol
    
    @State private var isLoading: Bool = true
    @State private var route: Route? = nil
    @State private var specificError: String? = nil
    
    // Estado para exportación GPX
    @State private var exportFileURL: URL? = nil
    @State private var showShareSheet: Bool = false
    @State private var exportErrorMessage: String? = nil
    
    public init(
        routeId: UUID,
        repository: RouteRepositoryProtocol = RouteRepository.shared
    ) {
        self.routeId = routeId
        self.repository = repository
    }

    public var body: some View {
        ZStack {
            // Fondo Cockpit / Dark Carbon
            Color(red: 0.04, green: 0.05, blue: 0.08)
                .ignoresSafeArea()
            
            if isLoading {
                // 1. Estado de carga de la base de datos
                VStack(spacing: 16) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color(red: 0.0, green: 0.9, blue: 1.0)))
                        .scaleEffect(1.3)
                    Text("Cargando resumen de ruta...")
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundColor(.gray)
                    Text("ID: \(routeId.uuidString)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                .padding()
            } else if let error = specificError, route == nil {
                // 2. Error específico: Ruta no encontrada en disco
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.orange)
                    Text("No se encontró la ruta")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button(action: { Task { await loadRoute() } }) {
                        Label("Reintentar lectura", systemImage: "arrow.clockwise")
                            .font(.system(size: 14, weight: .semibold))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(8)
                    }
                    .foregroundColor(.white)
                }
                .padding()
            } else if let route = route {
                // 3. Resumen cargado con la fuente única de verdad
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        
                        // Header de Ruta
                        headerSection(route: route)
                        
                        // Error específico si la ruta existe pero tiene 0 puntos
                        if route.trackpoints.isEmpty {
                            emptyPointsWarningSection()
                        } else {
                            // Mini-mapa con la polilínea completa
                            miniMapSection(route: route)
                        }
                        
                        // Tarjetas de Telemetría (Estadísticas congeladas del modelo)
                        metricsGridSection(route: route)
                        
                        // Botones de acción (Exportar GPX)
                        actionsSection(route: route)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 32)
                }
            }
        }
        .onAppear {
            Task {
                await loadRoute()
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = exportFileURL {
                ShareSheet(activityItems: [url])
            }
        }
    }
    
    // MARK: - Carga de Ruta por ID
    private func loadRoute() async {
        isLoading = true
        specificError = nil
        
        do {
            if let fetched = try await repository.fetch(by: routeId) {
                self.route = fetched
                if fetched.trackpoints.isEmpty {
                    self.specificError = "La ruta no tiene puntos GPS registrados. Esta sesión se guardó sin coordenadas."
                }
            } else {
                self.specificError = "No se encontró la ruta (ID: \(routeId.uuidString)). Comprueba que la sesión se guardó correctamente en disco."
            }
        } catch {
            self.specificError = "Error al leer la ruta desde almacenamiento: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    // MARK: - Subvistas
    
    private func headerSection(route: Route) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(route.title)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                Spacer()
                Text("RESUMEN")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.2))
                    .foregroundColor(.green)
                    .cornerRadius(6)
            }
            
            Text(formattedDate(route.startedAt))
                .font(.system(size: 13))
                .foregroundColor(.gray)
        }
    }
    
    private func emptyPointsWarningSection() -> some View {
        HStack(spacing: 12) {
            Image(systemName: "location.slash.fill")
                .foregroundColor(.orange)
                .font(.system(size: 24))
            VStack(alignment: .leading, spacing: 2) {
                Text("La ruta no tiene puntos")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                Text("No hay coordenadas para dibujar el trazado en el mapa.")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.12))
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.orange.opacity(0.3), lineWidth: 1))
    }
    
    private func miniMapSection(route: Route) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("TRAZADO GPS", systemImage: "map.fill")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(Color(red: 0.0, green: 0.9, blue: 1.0))
                Spacer()
                Text("\(route.trackpoints.count) PUNTOS")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)
            }
            
            RouteMiniMapView(
                trackpoints: route.trackpoints,
                isLoading: false,
                strokeColor: Color(red: 0.0, green: 0.9, blue: 1.0),
                lineWidth: 4.0
            )
            .frame(height: 240)
        }
    }
    
    private func metricsGridSection(route: Route) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                metricCard(
                    title: "DISTANCIA",
                    value: String(format: "%.2f", route.totalDistanceMeters / 1000.0),
                    unit: "KM",
                    icon: "point.topleft.down.to.point.bottomright.curvepath",
                    tint: Color(red: 0.0, green: 0.9, blue: 1.0)
                )
                metricCard(
                    title: "TIEMPO",
                    value: formatDuration(route.durationSeconds),
                    unit: "",
                    icon: "timer",
                    tint: .yellow
                )
            }
            
            HStack(spacing: 12) {
                metricCard(
                    title: "VELOCIDAD MEDIA",
                    value: String(format: "%.1f", route.avgSpeedKmh),
                    unit: "KM/H",
                    icon: "speedometer",
                    tint: .green
                )
                metricCard(
                    title: "VELOCIDAD MÁXIMA",
                    value: String(format: "%.1f", route.maxSpeedKmh),
                    unit: "KM/H",
                    icon: "bolt.fill",
                    tint: .red
                )
            }
            
            HStack(spacing: 12) {
                metricCard(
                    title: "DESNIVEL POSITIVO",
                    value: "+\(Int(route.elevationGainMeters))",
                    unit: "M",
                    icon: "arrow.up.right",
                    tint: .blue
                )
                metricCard(
                    title: "DESNIVEL NEGATIVO",
                    value: "-\(Int(route.elevationLossMeters))",
                    unit: "M",
                    icon: "arrow.down.right",
                    tint: Color(red: 0.35, green: 0.35, blue: 0.85)
                )
            }
        }
    }
    
    private func metricCard(
        title: String,
        value: String,
        unit: String,
        icon: String,
        tint: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(.gray)
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundColor(tint)
            }
            
            HStack(alignment: .lastTextBaseline, spacing: 3) {
                Text(value)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                if !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.08, green: 0.10, blue: 0.14))
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.06), lineWidth: 1))
    }
    
    private func actionsSection(route: Route) -> some View {
        VStack(spacing: 10) {
            Button(action: { exportGPX(route: route) }) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Exportar Archivo GPX 1.1")
                        .fontWeight(.semibold)
                }
                .font(.system(size: 15))
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(red: 0.0, green: 0.9, blue: 1.0))
                .cornerRadius(12)
            }
            .disabled(route.trackpoints.isEmpty)
            .opacity(route.trackpoints.isEmpty ? 0.4 : 1.0)

            Button(action: { exportKML(route: route) }) {
                HStack {
                    Image(systemName: "globe.americas.fill")
                    Text("Exportar Archivo KML (Google Earth)")
                        .fontWeight(.semibold)
                }
                .font(.system(size: 15))
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(red: 0.22, green: 1.0, blue: 0.08)) // Neon racing green
                .cornerRadius(12)
            }
            .disabled(route.trackpoints.isEmpty)
            .opacity(route.trackpoints.isEmpty ? 0.4 : 1.0)
            
            if let err = exportErrorMessage {
                Text(err)
                    .font(.system(size: 12))
                    .foregroundColor(.red)
            }
        }
        .padding(.top, 8)
    }
    
    // MARK: - Export GPX Action
    private func exportGPX(route: Route) {
        do {
            let fileURL = try GPXExporter.createGPXFile(from: route)
            self.exportFileURL = fileURL
            self.showShareSheet = true
            self.exportErrorMessage = nil
        } catch {
            self.exportErrorMessage = "Error al exportar GPX: \(error.localizedDescription)"
        }
    }

    // MARK: - Export KML Action
    private func exportKML(route: Route) {
        do {
            let fileURL = try KMLExporter.createKMLFile(from: route)
            self.exportFileURL = fileURL
            self.showShareSheet = true
            self.exportErrorMessage = nil
        } catch {
            self.exportErrorMessage = "Error al exportar KML: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Formatters
    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func formatDuration(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        let hrs = total / 3600
        let mins = (total % 3600) / 60
        let secs = total % 60
        if hrs > 0 {
            return String(format: "%02d:%02d:%02d", hrs, mins, secs)
        } else {
            return String(format: "%02d:%02d", mins, secs)
        }
    }
}

// MARK: - UIActivityViewController Bridge
fileprivate struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]
    let applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
