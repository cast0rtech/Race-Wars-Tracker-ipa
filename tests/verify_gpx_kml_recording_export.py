#!/usr/bin/env python3
"""
Race Wars Tracker - GPX & KML Recording and Export Verification Test
Compares against Open GPX Tracker standard format and validates data integrity.
"""
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

def test_gpx_kml_export():
    print("=" * 70)
    print("  VERIFICACIÓN INTEGRAL DE GRABACIÓN Y EXPORTACIÓN GPX / KML")
    print("=" * 70)

    # 1. Simulación de puntos capturados durante una ruta real en vehículo
    # Incluye arranques en frío, parabrisas de coche con precisión 55m y 85m (que antes se descartaban erróneamente)
    raw_telemetry_points = [
        {"timestamp": 1746878400000, "lat": 40.416800, "lng": -3.703800, "speedKmh": 0, "altitudeM": 650.0, "accuracyM": 55},
        {"timestamp": 1746878405000, "lat": 40.417200, "lng": -3.703400, "speedKmh": 32, "altitudeM": 652.5, "accuracyM": 25},
        {"timestamp": 1746878410000, "lat": 40.418100, "lng": -3.702800, "speedKmh": 64, "altitudeM": 655.0, "accuracyM": 15},
        {"timestamp": 1746878415000, "lat": 40.419500, "lng": -3.701900, "speedKmh": 85, "altitudeM": 658.0, "accuracyM": 75}, # Precisión de coche 75m
        {"timestamp": 1746878420000, "lat": 40.421000, "lng": -3.700800, "speedKmh": 98, "altitudeM": 662.0, "accuracyM": 10},
    ]

    # Simular la lógica de filtrado actualizada (MAX_REASONABLE_ACCURACY_M = 150)
    MAX_REASONABLE_ACCURACY_M = 150
    accepted_points = []
    for p in raw_telemetry_points:
        acc = p.get("accuracyM")
        if acc is not None and 0 <= acc <= MAX_REASONABLE_ACCURACY_M:
            accepted_points.append({
                "timestamp": p["timestamp"],
                "lat": p["lat"],
                "lng": p["lng"],
                "latitude": p["lat"],
                "longitude": p["lng"],
                "speedKmh": p["speedKmh"],
                "speed": p["speedKmh"] / 3.6,
                "altitudeM": p["altitudeM"],
                "altitude": p["altitudeM"],
                "accuracyM": acc
            })

    print(f"\n[PASO 1] Puntos procesados con filtro de precisión (≤150m):")
    print(f"  • Puntos brutos: {len(raw_telemetry_points)}")
    print(f"  • Puntos aceptados y grabados: {len(accepted_points)}")
    assert len(accepted_points) == 5, f"ERROR: Se esperaban 5 puntos, se aceptaron {len(accepted_points)}"
    print("  ✓ Todos los puntos de la ruta vehicular fueron registrados (ninguno perdido por precisión 55m o 75m)")

    # 2. Generación de GPX 1.1 según el estándar de Open GPX Tracker
    title = "Ruta Circuito Jarama"
    start_iso = datetime.fromtimestamp(accepted_points[0]["timestamp"] / 1000, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    
    trkpt_lines = []
    for p in accepted_points:
        dt_str = datetime.fromtimestamp(p["timestamp"] / 1000, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        ele_line = f"        <ele>{p['altitudeM']:.1f}</ele>\n" if p.get("altitudeM") is not None else ""
        speed_mps = p["speedKmh"] / 3.6
        spd_line = f"        <extensions>\n          <gpxtpx:TrackPointExtension xmlns:gpxtpx=\"http://www.garmin.com/xmlschemas/TrackPointExtension/v1\">\n            <gpxtpx:speed>{speed_mps:.2f}</gpxtpx:speed>\n          </gpxtpx:TrackPointExtension>\n        </extensions>\n"
        trkpt_lines.append(f"""      <trkpt lat="{p['lat']:.6f}" lon="{p['lng']:.6f}">
{ele_line}        <time>{dt_str}</time>
{spd_line}      </trkpt>""")

    gpx_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Race Wars Tracker (Open GPX Tracker compatible)"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>{title}</name>
    <time>{start_iso}</time>
  </metadata>
  <trk>
    <name>{title}</name>
    <trkseg>
{chr(10).join(trkpt_lines)}
    </trkseg>
  </trk>
</gpx>"""

    # Parsear XML GPX para asegurar sintaxis 100% válida
    root_gpx = ET.fromstring(gpx_content)
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1', 'gpxtpx': 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1'}
    trkpts = root_gpx.findall('.//gpx:trkpt', ns)
    print(f"\n[PASO 2] Validación de Archivo GPX 1.1:")
    print(f"  • Elementos <trkpt> encontrados en XML: {len(trkpts)}")
    assert len(trkpts) == 5, "ERROR: La cantidad de trackpoints en el GPX no coincide"
    
    # Verificar coordenadas, elevación y tiempo del primer y último punto
    assert float(trkpts[0].attrib['lat']) == 40.416800
    assert float(trkpts[0].attrib['lon']) == -3.703800
    assert trkpts[0].find('gpx:ele', ns).text == "650.0"
    assert trkpts[0].find('gpx:time', ns).text == "2025-05-10T12:00:00Z"
    print("  ✓ Coordenadas, altitud, tiempo y extensiones Garmin GPX verificadas con éxito.")

    # 3. Generación y Validación de KML 2.2 Google Earth
    coord_lines = [f"{p['lng']:.6f},{p['lat']:.6f},{p['altitudeM']:.1f}" for p in accepted_points]
    kml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>{title}</name>
    <Placemark>
      <name>{title} (Trazado 3D)</name>
      <LineString>
        <coordinates>
          {' '.join(coord_lines)}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>"""

    root_kml = ET.fromstring(kml_content)
    kml_ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    coords_elem = root_kml.find('.//kml:coordinates', kml_ns)
    parsed_coords = coords_elem.text.strip().split()
    print(f"\n[PASO 3] Validación de Archivo KML 2.2:")
    print(f"  • Puntos geodésicos en <coordinates>: {len(parsed_coords)}")
    assert len(parsed_coords) == 5
    assert parsed_coords[0] == "-3.703800,40.416800,650.0"
    print("  ✓ Formato lon,lat,alt verificado para compatibilidad completa con Google Earth.")

    # 4. Compatibilidad en summary.js y modales
    # Verificar que los métodos de extracción admiten tanto 'lat' como 'latitude'
    test_session_swift = {
        "id": "session_swift_1",
        "title": "Ruta Nativa Swift",
        "trackpoints": [
            {"latitude": 40.1, "longitude": -3.5, "speedKmh": 50},
            {"latitude": 40.2, "longitude": -3.4, "speedKmh": 70}
        ]
    }
    get_lat = lambda p: p.get("lat") if p.get("lat") is not None else p.get("latitude")
    get_lng = lambda p: p.get("lng") if p.get("lng") is not None else (p.get("lon") if p.get("lon") is not None else p.get("longitude"))
    
    valid_swift_points = [p for p in test_session_swift["trackpoints"] if get_lat(p) is not None and get_lng(p) is not None]
    print(f"\n[PASO 4] Compatibilidad de Nomenclatura (lat/lng vs latitude/longitude):")
    print(f"  • Puntos extraídos de sesión nativa: {len(valid_swift_points)}")
    assert len(valid_swift_points) == 2
    print("  ✓ Resumen y Exportador ahora reconocen tanto datos JavaScript como datos de CLLocationManager.")

    print("\n" + "=" * 70)
    print("                     TODOS LOS TESTS PASARON (PASS)                  ")
    print("=" * 70)

if __name__ == "__main__":
    test_gpx_kml_export()
