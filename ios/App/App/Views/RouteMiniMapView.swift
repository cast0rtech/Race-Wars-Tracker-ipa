import SwiftUI
import MapKit
import CoreLocation

// MARK: - Componente Mini-Mapa de Ruta Telemetría
public struct RouteMiniMapView: View {
    
    // Entrada de datos
    public let trackpoints: [TrackPoint]
    public let isLoading: Bool
    public let strokeColor: Color
    public let lineWidth: CGFloat
    
    // Coordenadas calculadas y ordenadas por timestamp
    private var sortedCoordinates: [CLLocationCoordinate2D] {
        let sorted = trackpoints.sorted { (p1, p2) -> Bool in
            return p1.timestamp < p2.timestamp
        }
        return sorted.compactMap { pt in
            guard pt.latitude >= -90 && pt.latitude <= 90,
                  pt.longitude >= -180 && pt.longitude <= 180 else { return nil }
            return CLLocationCoordinate2D(latitude: pt.latitude, longitude: pt.longitude)
        }
    }
    
    public init(
        trackpoints: [TrackPoint],
        isLoading: Bool = false,
        strokeColor: Color = Color(red: 0.0, green: 0.9, blue: 1.0), // Tesla/Racing Cyan
        lineWidth: CGFloat = 4.0
    ) {
        self.trackpoints = trackpoints
        self.isLoading = isLoading
        self.strokeColor = strokeColor
        self.lineWidth = lineWidth
    }

    public var body: some View {
        ZStack {
            if isLoading {
                // 1. Estado de Carga
                VStack(spacing: 12) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: strokeColor))
                        .scaleEffect(1.2)
                    Text("Cargando trazado GPS...")
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.05, green: 0.07, blue: 0.10))
            } else if sortedCoordinates.isEmpty {
                // 2. Estado Vacío (Sin datos de ruta)
                VStack(spacing: 8) {
                    Image(systemName: "location.slash.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.secondary)
                    Text("Sin datos de ruta")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.primary)
                    Text("Esta sesión no contiene puntos GPS exportables.")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.05, green: 0.07, blue: 0.10))
            } else {
                // 3. Renderizado del Mapa con Polilínea
                if #available(iOS 17.0, *) {
                    ModernMapKitView(
                        coordinates: sortedCoordinates,
                        strokeColor: strokeColor,
                        lineWidth: lineWidth
                    )
                } else {
                    LegacyMKMapViewRepresentable(
                        coordinates: sortedCoordinates,
                        strokeColor: strokeColor,
                        lineWidth: lineWidth
                    )
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }
}

// MARK: - Implementación iOS 17+ (SwiftUI Map + MapPolyline)
@available(iOS 17.0, *)
fileprivate struct ModernMapKitView: View {
    let coordinates: [CLLocationCoordinate2D]
    let strokeColor: Color
    let lineWidth: CGFloat
    
    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $cameraPosition) {
            // Polilínea del trazado
            if coordinates.count >= 2 {
                MapPolyline(coordinates: coordinates)
                    .stroke(strokeColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))
            }
            
            // Pin de Salida
            if let start = coordinates.first {
                Annotation("Salida", coordinate: start) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 14, height: 14)
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .shadow(color: .green.opacity(0.8), radius: 6)
                }
            }
            
            // Pin de Meta
            if coordinates.count >= 2, let finish = coordinates.last {
                Annotation("Meta", coordinate: finish) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.red)
                            .frame(width: 16, height: 16)
                            .overlay(RoundedRectangle(cornerRadius: 3).stroke(Color.white, lineWidth: 2))
                            .shadow(color: .red.opacity(0.8), radius: 6)
                        Image(systemName: "flag.checkered")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .onAppear {
            updateCamera()
        }
        .onChange(of: coordinates.count) { _ in
            updateCamera()
        }
    }
    
    private func updateCamera() {
        if coordinates.count == 1, let single = coordinates.first {
            cameraPosition = .region(MKCoordinateRegion(
                center: single,
                span: MKCoordinateSpan(latitudeDelta: 0.015, longitudeDelta: 0.015)
            ))
        } else if coordinates.count >= 2 {
            let rect = boundingMapRect(for: coordinates)
            cameraPosition = .rect(rect)
        }
    }
    
    private func boundingMapRect(for coords: [CLLocationCoordinate2D]) -> MKMapRect {
        var minX = Double.infinity
        var maxX = -Double.infinity
        var minY = Double.infinity
        var maxY = -Double.infinity
        
        for coord in coords {
            let point = MKMapPoint(coord)
            minX = min(minX, point.x)
            maxX = max(maxX, point.x)
            minY = min(minY, point.y)
            maxY = max(maxY, point.y)
        }
        
        let width = max(100, maxX - minX)
        let height = max(100, maxY - minY)
        let rawRect = MKMapRect(x: minX, y: minY, width: width, height: height)
        
        // Añadir padding visual del 25% para que los pines no queden pegados a los bordes
        return rawRect.insetBy(dx: -width * 0.15, dy: -height * 0.15)
    }
}

// MARK: - Implementación iOS 14 - 16 (UIViewRepresentable con MKMapView)
fileprivate struct LegacyMKMapViewRepresentable: UIViewRepresentable {
    let coordinates: [CLLocationCoordinate2D]
    let strokeColor: Color
    let lineWidth: CGFloat

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.showsCompass = false
        mapView.showsScale = false
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.strokeColor = UIColor(strokeColor)
        context.coordinator.lineWidth = lineWidth
        
        // Limpiar overlays y anotaciones anteriores para evitar duplicados
        mapView.removeOverlays(mapView.overlays)
        mapView.removeAnnotations(mapView.annotations)
        
        guard !coordinates.isEmpty else { return }
        
        if coordinates.count == 1 {
            let center = coordinates[0]
            let region = MKCoordinateRegion(
                center: center,
                span: MKCoordinateSpan(latitudeDelta: 0.015, longitudeDelta: 0.015)
            )
            mapView.setRegion(region, animated: false)
            
            let pin = MKPointAnnotation()
            pin.coordinate = center
            pin.title = "Ubicación"
            mapView.addAnnotation(pin)
            return
        }

        // Crear MKPolyline con el array de coordenadas
        let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
        mapView.addOverlay(polyline, level: .aboveRoads)
        
        // Añadir pines de inicio y fin
        if let startCoord = coordinates.first {
            let startPin = RouteEndpointAnnotation(coordinate: startCoord, isStart: true)
            mapView.addAnnotation(startPin)
        }
        if let finishCoord = coordinates.last {
            let finishPin = RouteEndpointAnnotation(coordinate: finishCoord, isStart: false)
            mapView.addAnnotation(finishPin)
        }

        // Ajustar encuadre de cámara con padding
        let mapRect = polyline.boundingMapRect
        let edgePadding = UIEdgeInsets(top: 32, left: 32, bottom: 32, right: 32)
        mapView.setVisibleMapRect(mapRect, edgePadding: edgePadding, animated: false)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(strokeColor: UIColor(strokeColor), lineWidth: lineWidth)
    }

    class Coordinator: NSObject, MKMapViewDelegate {
        var strokeColor: UIColor
        var lineWidth: CGFloat

        init(strokeColor: UIColor, lineWidth: CGFloat) {
            self.strokeColor = strokeColor
            self.lineWidth = lineWidth
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let polyline = overlay as? MKPolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                renderer.strokeColor = strokeColor
                renderer.lineWidth = lineWidth
                renderer.lineCap = .round
                renderer.lineJoin = .round
                return renderer
            }
            return MKOverlayRenderer(overlay: overlay)
        }
        
        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let endpoint = annotation as? RouteEndpointAnnotation else { return nil }
            let identifier = endpoint.isStart ? "StartPin" : "FinishPin"
            var view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
            if view == nil {
                view = MKAnnotationView(annotation: endpoint, reuseIdentifier: identifier)
                view?.canShowCallout = false
            } else {
                view?.annotation = endpoint
            }
            
            let circleSize: CGFloat = endpoint.isStart ? 14 : 16
            let circle = UIView(frame: CGRect(x: 0, y: 0, width: circleSize, height: circleSize))
            circle.backgroundColor = endpoint.isStart ? .systemGreen : .systemRed
            circle.layer.cornerRadius = circleSize / 2
            circle.layer.borderColor = UIColor.white.cgColor
            circle.layer.borderWidth = 2
            circle.layer.shadowColor = circle.backgroundColor?.cgColor
            circle.layer.shadowRadius = 4
            circle.layer.shadowOpacity = 0.8
            view?.addSubview(circle)
            view?.frame = circle.frame
            return view
        }
    }
}

// MARK: - Anotación para pines de Inicio y Fin
fileprivate class RouteEndpointAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let isStart: Bool
    
    init(coordinate: CLLocationCoordinate2D, isStart: Bool) {
        self.coordinate = coordinate
        self.isStart = isStart
    }
}
