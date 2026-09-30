# 🏁 Race Wars Tracker

> **Telemetría de Alta Competición, Odometría Satelital GNSS y Registro de Rutas en Tiempo Real para Dispositivos Android.**

[![Android](https://img.shields.io/badge/Platform-Android%207.0%2B-3DDC84?logo=android&logoColor=white)](https://developer.android.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Bluetooth](https://img.shields.io/badge/Hardware-Bluetooth%20LE%20Real-0082FC?logo=bluetooth&logoColor=white)](https://github.com/capacitor-community/bluetooth-le)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Google Play](https://img.shields.io/badge/Google%20Play-AAB%20Ready-414141?logo=google-play&logoColor=white)](https://play.google.com/)

---

## 🏎️ Descripción General

**Race Wars Tracker** es una plataforma móvil diseñada para conductores, pilotos y entusiastas del motorsport. Transforma cualquier smartphone Android en un **Cockpit Digital de Competición** con telemetría de precisión militar, captura continua por satélite, fusión de sensores inerciales y barométricos, y sincronización automática inalámbrica con el vehículo.

A diferencia de las aplicaciones convencionales de tracking, **Race Wars Tracker opera en Modo 100% Real**, midiendo la física del vehículo directamente mediante su chip GNSS de alta frecuencia y calculando la altitud exacta mediante un **filtro Kalman complementario**, eliminando falsas derivas térmicas en puertos de montaña y circuitos.

---

## ✨ Características Principales

### 1. Cockpit Digital HUD en Tiempo Real
* **Velocímetro Digital de Alto Contraste:** Rango 0–240 km/h con arco radial dinámico y marcador de velocidad máxima registrada.
* **Odometría Geodésica de Precisión:** Cálculo de distancia acumulada en kilómetros mediante la fórmula de Haversine con filtrado de fluctuaciones en parado.
* **Cronómetro de Carrera:** Contador de tiempo transcurrido con precisión de décimas de segundo (`MM:SS.d`).
* **Perfil de Altimetría Dinámico:** Gráfico en vivo en canvas con cota actual en metros, cotas mínimas/máximas y línea lumínica de posición del vehículo.
* **Keep-Awake (Screen WakeLock):** Mantiene la pantalla encendida continuamente en el soporte del vehículo sin entrar en reposo.

### 2. Detección y Enlace Bluetooth Real del Vehículo
* **Escaneo de Hardware Nativo:** Conexión directa mediante `@capacitor-community/bluetooth-le` y Web Bluetooth para descubrir y vincular el manos libres de tu coche, radio o adaptador OBD2 real.
* **Auto-Arranque de Carrera:** Al detectar el encendido y conexión Bluetooth del coche, la app inicia la grabación de la ruta automáticamente sin necesidad de tocar la pantalla.
* **Ventana de Gracia Inteligente:** Configurable a 30s, 45s o 60s para no detener la sesión en paradas breves (semáforos o repostajes).

### 3. Fusión de Sensores (Sensor Fusion Engine)
* **GPS + Barómetro a 100Hz:** Fusión sensorial adaptativa para calcular altitud vertical precisa.
* **Cálculo de Desnivel (+D y -D) con Histéresis:** Umbral de histéresis de 2.0m para evitar inflar el desnivel acumulado por vibraciones o ruido del sensor.

### 4. Debrief Post-Carrera y Línea de Tiempo Meteorológica
* **Trazado de Ruta en Mapa Neón:** Visualización de la ruta completada con puntos de salida y meta.
* **Métricas Oficiales:** Velocidad media, punta máxima, altitud cumbre (+D ganado y -D descendido).
* **Línea Temporal Climática:** Capturas meteorológicas en directo con condiciones térmicas, lluvia y presión atmosférica por tramo.

### 5. Exportación Off-Screen en 4K para Redes Sociales
* Generador de tarjetas visuales en ratio **9:16 (1080x1920)** optimizadas para Instagram Stories, TikTok, Reels y Strava.
* Empaquetado completo en **archivo ZIP** con el track GPX enriquecido y las tarjetas visuales.

### 6. Modelo Freemium con Anuncios Bonificados (Google AdMob)
* **100% Gratuito:** Sin suscripciones obligatorias ni pagos con tarjeta de crédito.
* **Pase PRO VIP:** Desbloqueo de 24 horas (o 72 horas) viendo un breve vídeo patrocinado para disfrutar de exportaciones 4K limpias sin marcas de agua, tema exclusivo **Racing Red** y sensor fusion avanzado.

---

## 📁 Estructura del Proyecto

```text
Race Wars Tracker/
├── android/                        # Proyecto nativo Android (Gradle, Capacitor, Kotlin/Java)
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
├── core/                           # Motores centrales de telemetría y lógica
│   ├── ad-manager.js               # Reproductor de anuncios bonificados Google AdMob
│   ├── ad-manager.css              # Estilos del reproductor de anuncios y banner
│   ├── background-manager.js       # Persistencia y recuperación ante cierres (WAL)
│   ├── bluetooth-menu.js           # Gestor y escáner de hardware Bluetooth real
│   ├── bluetooth-menu.css          # Estilos del menú de configuración Bluetooth
│   ├── gpx-replay-engine.js        # Motor de replay de telemetría real (Navacerrada 42km)
│   ├── permissions-modal.js        # Gestor de permisos de GPS y sensores físicos
│   ├── permissions-modal.css       # Estilos de la ventana modal de permisos
│   ├── pro-manager.js              # Gestor del pase PRO por anuncios bonificados
│   ├── pro-paywall.js              # Diálogo de desbloqueo PRO con AdMob
│   ├── pro-paywall.css             # Estilos de la ventana de desbloqueo
│   ├── real-telemetry.js           # Motor de telemetría GPS física y odometría
│   ├── schema.sql                  # Esquema relacional SQLite para telemetría
│   ├── sensor-fusion.js            # Filtro Kalman para GPS + Barómetro
│   └── weather-snapshot-pipeline.js# Pipeline de capturas meteorológicas por tramo
├── docs/                           # Documentación de arquitectura técnica
│   └── background_persistence_architecture.md
├── scripts/                        # Scripts de compilación y empaquetado web
│   └── prepare-web.js
├── tests/                          # Tests de integración y banco de pruebas
│   └── verify-background-pipeline.js
├── www/                            # Distribución web empaquetada para WebView
├── index.html                      # Vista principal del Cockpit Digital
├── style.css                       # Sistema de diseño Cyberpunk / Motorsport
├── app.js                          # Controlador del Cockpit
├── summary.html                    # Pantalla de Debrief y Resumen de Trayecto
├── summary.css                     # Estilos del debrief
├── summary.js                      # Lógica de resumen y exportación ZIP
├── card-offscreen.html             # Componente aislado para tarjetas sociales (9:16)
├── card-offscreen.css              # Estilos de la tarjeta offscreen
├── card-offscreen.js               # Renderizador en Canvas 1080x1920
├── capacitor.config.json           # Configuración del contenedor Capacitor
├── package.json                    # Dependencias y scripts npm
└── USER_GUIDE.md                   # Guía completa de uso paso a paso
```

---

## 🛠️ Instalación y Compilación

### Requisitos Previos
* **Node.js** (v18 o superior)
* **Java JDK** (versión 17 o 21 LTS - Eclipse Adoptium Temurin recomendado)
* **Android SDK** (API Level 34 o superior)

### 1. Clonar el repositorio
```bash
git clone https://github.com/cast0rtech/Race-Wars-Tracker.git
cd Race-Wars-Tracker
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Sincronizar assets con Android
```bash
npm run cap:sync
```

### 4. Compilar archivo APK para tu teléfono
```bash
npm run build:apk
```
*El archivo generado estará disponible en `android/app/build/outputs/apk/debug/app-debug.apk`.*

### 5. Compilar Android App Bundle (.aab) para Google Play Console
```bash
npm run build:bundle
```
*El archivo generado estará disponible en `android/app/build/outputs/bundle/debug/app-debug.aab`.*

---

## 📱 Permisos de Android Utilizados

| Permiso | Finalidad |
|---|---|
| `ACCESS_FINE_LOCATION` | Lectura directa del chip GPS/GNSS para velocímetro y odometría de precisión. |
| `ACCESS_COARSE_LOCATION` | Red de ubicación celular/WiFi de respaldo en túneles. |
| `ACCESS_BACKGROUND_LOCATION` | Registro ininterrumpido con la pantalla apagada o en segundo plano. |
| `FOREGROUND_SERVICE_LOCATION` | Notificación persistente de servicio de telemetría activo. |
| `BLUETOOTH` / `BLUETOOTH_CONNECT` | Conexión con el manos libres del coche o adaptador OBD2. |
| `BLUETOOTH_SCAN` | Escaneo y descubrimiento de dispositivos Bluetooth reales en el vehículo. |
| `HIGH_SAMPLING_RATE_SENSORS` | Lectura a alta frecuencia (100Hz) de acelerómetros y barómetros. |
| `WAKE_LOCK` | Mantiene el procesador y la pantalla activa en el soporte del parabrisas. |

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.
Desarrollado para la comunidad del motorsport por **cast0rtech**.
