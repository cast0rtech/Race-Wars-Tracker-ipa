# 🏁 Race Wars Tracker

> **Telemetría de Alta Competición, Odometría Satelital GNSS y Registro de Rutas en Tiempo Real para Dispositivos iOS y Android.**

[![iOS](https://img.shields.io/badge/Platform-iOS%2014.0%2B-000000?logo=apple&logoColor=white)](https://developer.apple.com/ios/)
[![Android](https://img.shields.io/badge/Platform-Android%207.0%2B-3DDC84?logo=android&logoColor=white)](https://developer.android.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Bluetooth](https://img.shields.io/badge/Hardware-Bluetooth%20LE%20Real-0082FC?logo=bluetooth&logoColor=white)](https://github.com/capacitor-community/bluetooth-le)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🏎️ Descripción General

**Race Wars Tracker** es una plataforma móvil multiplataforma diseñada para conductores, pilotos y entusiastas del motorsport. Transforma cualquier smartphone (iOS o Android) en un **Cockpit Digital de Competición** con telemetría de precisión militar, captura continua por satélite, odometría geodésica mediante la fórmula de Haversine y sincronización automática inalámbrica con el vehículo mediante Bluetooth LE.

La aplicación opera con un motor común de interfaz y algoritmos matemáticos en WebKit/Chromium y puentes nativos directos con **CoreLocation** y **CoreBluetooth** en iOS, así como los servicios de ubicación equivalentes en Android.

---

## ✨ Características Principales

### 1. Cockpit Digital HUD en Tiempo Real
* **Velocímetro Digital de Alto Contraste:** Rango 0–240 km/h con arco radial SVG reactivo y memoria de velocidad punta.
* **Odometría Geodésica de Precisión:** Cálculo de distancia acumulada en kilómetros filtrando derivas y movimientos espurios en parado (< 3 km/h).
* **Cronómetro de Carrera:** Contador de tiempo transcurrido en formato `MM:SS.d` con décimas de segundo.
* **Perfil de Altimetría Dinámico:** Gráfico en vivo en canvas con cota actual en metros, cotas mínimas/máximas y línea lumínica de posición del vehículo.
* **Keep-Awake (Screen WakeLock):** Mantiene la pantalla encendida continuamente en el salpicadero del coche.

### 2. Detección y Enlace Bluetooth Real del Vehículo
* **Escaneo de Hardware Nativo:** Conexión directa mediante `@capacitor-community/bluetooth-le` para enlazar el manos libres o adaptadores OBD2.
* **Auto-Arranque de Carrera:** Al detectar el encendido y conexión Bluetooth del coche, la app inicia la grabación de la ruta automáticamente.
* **Ventana de Gracia Inteligente:** Configurable a 30s, 45s o 60s para no cortar la sesión en paradas momentáneas (semáforos o peajes).

### 3. Fusión de Sensores y Desnivel
* **Cálculo de Desnivel (+D y -D):** Medición de ascenso y descenso acumulados con filtrado de histéresis para eliminar ruido de sensores.

### 4. Debrief Post-Carrera y Clima
* **Trazado de Ruta en Mapa SVG Neón:** Proyección de la ruta completada con marcadores de salida y meta.
* **Métricas Oficiales:** Velocidad media, punta máxima, altitud cumbre (+D y -D).
* **Línea Temporal Climática:** Capturas meteorológicas en directo mediante Open-Meteo REST API en diferentes tramos de la ruta.

### 5. Exportación Off-Screen para Redes Sociales
* Generador de tarjetas visuales en ratio **9:16 (1080x1920)** optimizadas para Instagram Stories y TikTok.
* Empaquetado completo en **archivo ZIP** con el track GPX enriquecido y metadatos JSON.

---

## 📁 Estructura del Proyecto

```text
Race Wars Tracker/
├── .github/
│   └── workflows/
│       └── build-ios.yml           # Compilación remota de .IPA en macOS runner (GitHub Actions)
├── android/                        # Proyecto nativo Android (Gradle, Java/Kotlin)
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
├── ios/                            # Proyecto nativo Apple iOS (Xcode Workspace, CocoaPods)
│   └── App/
│       ├── App/
│       │   ├── AppDelegate.swift   # Ciclo de vida y bridge de Capacitor
│       │   ├── Info.plist          # Permisos de privacidad Apple (GPS, BLE, Background)
│       │   └── Assets.xcassets/    # Catálogo de iconos (1024x1024 universal) y splash
│       ├── App.xcodeproj
│       ├── App.xcworkspace
│       └── Podfile
├── core/                           # Motores centrales de telemetría y lógica
│   ├── background-manager.js       # Persistencia y recuperación ante cierres (WAL)
│   ├── bluetooth-menu.js           # Gestor y escáner Bluetooth LE
│   ├── bluetooth-menu.css          # Estilos del menú Bluetooth
│   ├── permissions-modal.js        # Gestor interactivo de permisos
│   ├── permissions-modal.css       # Estilos de la ventana de permisos
│   ├── real-telemetry.js           # Motor de telemetría GPS física y odometría
│   ├── saved-routes-modal.js       # Explorador e historial de rutas guardadas
│   ├── saved-routes-modal.css      # Estilos del historial de rutas
│   ├── schema.sql                  # Esquema relacional para almacenamiento
│   ├── sensor-fusion.js            # Filtro Kalman y procesamiento de altimetría
│   ├── session-store.js            # Persistencia con IndexedDB y fallback local
│   ├── theme-modal.js              # Gestor de temas visuales (Tesla Cyan, Racing Red)
│   ├── theme-modal.css             # Estilos del selector de temas
│   ├── types.ts                    # Modelos y tipos de datos
│   └── weather-snapshot-pipeline.js# Pipeline de capturas de clima
├── docs/                           # Documentación técnica
│   └── background_persistence_architecture.md
├── scripts/                        # Scripts de compilación y preparación
│   ├── generate_app_icons.py
│   └── prepare-web.js
├── tests/                          # Tests y banco de pruebas
│   └── verify-background-pipeline.js
├── www/                            # Distribución web empaquetada para el WebView
├── index.html                      # Vista principal del Cockpit Digital
├── style.css                       # Sistema de diseño con soporte Safe Area Insets
├── app.js                          # Controlador del Cockpit
├── summary.html                    # Pantalla de Debrief y Resumen
├── summary.css                     # Estilos del debrief
├── summary.js                      # Lógica de resumen y exportación
├── card-offscreen.html             # Componente de tarjetas sociales (9:16)
├── card-offscreen.css              # Estilos de la tarjeta offscreen
├── card-offscreen.js               # Renderizador en Canvas 1080x1920
├── app_icon.png                    # Icono maestro de alta resolución
├── capacitor.config.json           # Configuración multiplataforma de Capacitor
└── package.json                    # Dependencias y scripts npm
```

---

## 🛠️ Instalación y Compilación

### Requisitos Previos Generales
* **Node.js** (v18 o superior)
* **npm** (v9 o superior)

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/cast0rtech/Race-Wars-Tracker.git
cd Race-Wars-Tracker
npm install
```

---

### 🍏 Compilación para iOS

#### Opción A: Compilación Automática en la Nube (Recomendada desde Windows)
Dado que Windows no ejecuta Xcode de forma nativa, se incluye un workflow de **GitHub Actions** configurado en `.github/workflows/build-ios.yml`:
1. Sube los cambios a tu repositorio en GitHub (`git push`).
2. En la pestaña **Actions** de GitHub, selecciona el workflow **Build iOS App (.IPA)** y pulsa **Run workflow**.
3. El runner oficial de Apple (`macos-latest`) instalará los Pods, compilará el workspace y empaquetará el archivo `RaceWarsTracker.ipa` para descargar directamente desde la sección de artefactos.
4. Puedes instalar el `.ipa` en tu iPhone físico usando **Sideloadly** o **AltStore**.

#### Opción B: Compilación Local desde macOS (con Xcode)
```bash
# 1. Preparar assets y sincronizar con iOS
npm run cap:sync:ios

# 2. Instalar CocoaPods en el proyecto iOS
cd ios/App
pod install

# 3. Abrir en Xcode
open App.xcworkspace
```
*En Xcode, selecciona tu dispositivo físico o simulador, asigna tu equipo de desarrollo en **Signing & Capabilities** y pulsa **Run (Cmd + R)**.*

---

### 🤖 Compilación para Android

#### Requisitos
* **Java JDK** (versión 17 o 21 LTS)
* **Android SDK** (API Level 34 o superior)

#### 1. Sincronizar assets con Android
```bash
npm run cap:sync
```

#### 2. Compilar APK Debug
```bash
npm run build:apk
```
*El archivo generado estará disponible en `android/app/build/outputs/apk/debug/app-debug.apk`.*

#### 3. Compilar Android App Bundle (.aab) para Google Play
```bash
npm run build:bundle
```
*El bundle estará en `android/app/build/outputs/bundle/debug/app-debug.aab`.*

---

## 📱 Permisos y Capacidades Nativas

| Capacidad | Permiso Android | Clave iOS (Info.plist) | Propósito |
|---|---|---|---|
| **GPS en Uso** | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` | Adquisición GNSS para velocímetro y odómetro en tiempo real. |
| **GPS en 2º Plano** | `ACCESS_BACKGROUND_LOCATION` | `NSLocationAlwaysAndWhenInUseUsageDescription` | Registro continuo con pantalla apagada. |
| **Bluetooth LE** | `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` | `NSBluetoothAlwaysUsageDescription` | Detección y enlace automático con el coche / OBD2. |
| **Modos de Fondo** | `FOREGROUND_SERVICE_LOCATION` | `UIBackgroundModes` -> `location`, `bluetooth-central` | Evita la suspensión del proceso durante la carrera. |
| **Pantalla Activa** | `WAKE_LOCK` | `isIdleTimerDisabled` | Mantiene el HUD visible en el parabrisas. |
| **Compartir Archivos**| `FileProvider` | `UIActivityViewController` (`@capacitor/share`) | Exportación de GPX/ZIP a Strava, iCloud, etc. |

---

## 🔧 Notas de Mantenimiento

1. **Sincronización de Cambios en la Web App:**
   Cada vez que modifiques archivos HTML, CSS o JS en la raíz o en `core/`, ejecuta:
   ```bash
   npm run cap:sync:all
   ```
   Esto compila la carpeta `www/` y replica los cambios simultáneamente en `ios/App/App/public` y `android/app/src/main/assets/public`.

2. **Soporte de Safe Areas:**
   Al crear o ajustar componentes visuales, respeta siempre las variables `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)` definidas en `style.css` para evitar solapamientos con el Notch o Dynamic Island del iPhone.

3. **Generación de Iconos:**
   El icono maestro se encuentra en `app_icon.png`. Si deseas modificar la identidad visual, actualiza la imagen maestra y ejecuta el script de generación correspondiente.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.
Desarrollado para la comunidad del motorsport por **cast0rtech**.
