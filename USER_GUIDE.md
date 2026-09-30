# 📖 Guía de Usuario Oficial - Race Wars Tracker

Bienvenido a la **Guía de Usuario de Race Wars Tracker**. En este manual encontrarás todas las instrucciones paso a paso para instalar la aplicación en tu smartphone Android, configurar el Bluetooth de tu vehículo, calibrar los sensores y sacar el máximo partido a tu telemetría en carretera y circuito.

---

## 📑 Índice de Contenidos

1. [Instalación del APK en tu Teléfono](#1-instalación-del-apk-en-tu-teléfono)
2. [Primer Arranque y Permisos de Hardware](#2-primer-arranque-y-permisos-de-hardware)
3. [Configuración de Bluetooth y Auto-Arranque](#3-configuración-de-bluetooth-y-auto-arranque)
4. [Uso del Cockpit en Modo Real](#4-uso-del-cockpit-en-modo-real)
5. [Debrief y Análisis del Trayecto](#5-debrief-y-análisis-del-trayecto)
6. [Exportación en 4K para Redes Sociales](#6-exportación-en-4k-para-redes-sociales)
7. [Desbloqueo de Race Wars PRO con Anuncios](#7-desbloqueo-de-race-wars-pro-con-anuncios)
8. [Preguntas Frecuentes y Solución de Problemas](#8-preguntas-frecuentes-y-solución-de-problemas)

---

## 1. Instalación del APK en tu Teléfono

El archivo compilado de la aplicación se llama `RaceWarsTracker_Final.apk` (o `RaceWarsTracker.apk`).

### Método A: Enviar por Bluetooth desde el PC (Recomendado)
1. En tu ordenador con Windows, haz clic derecho sobre el archivo `RaceWarsTracker_Final.apk`.
2. Selecciona **Enviar a ➔ Dispositivo Bluetooth**.
3. Elige tu teléfono Android en la lista y pulsa **Siguiente**.
4. En tu móvil, pulsa **Aceptar** para recibir la transferencia.
5. Cuando termine, toca la notificación del archivo recibido y pulsa **Instalar**.

### Método B: Transferencia por Cable USB
1. Conecta tu teléfono mediante cable USB al ordenador y selecciona el modo **"Transferencia de archivos (MTP)"**.
2. Copia el archivo `RaceWarsTracker_Final.apk` a la carpeta **Descargas (Download)** de tu teléfono.
3. Abre el administrador de archivos de tu móvil, busca el APK y pulsa **Instalar**.

> 💡 **Nota sobre fuentes desconocidas:** Si Android te muestra el mensaje *"Por seguridad, tu teléfono no tiene permiso para instalar aplicaciones de esta fuente"*, toca en **Ajustes**, activa la casilla **"Permitir desde esta fuente"** y vuelve atrás para completar la instalación.

---

## 2. Primer Arranque y Permisos de Hardware

Al abrir la aplicación por primera vez, verás la pantalla de **"ACTIVAR TELEMETRÍA REAL"**:

1. Pulsa el botón verde **`ACTIVAR HARDWARE Y MODO REAL`**.
2. Android te mostrará el diálogo del sistema solicitando acceso a tu ubicación:
   * **Muy importante:** Selecciona la opción **"Mientas se usa la app"** y asegúrate de que esté marcado **"Ubicación precisa"** (no aproximada). Esto permite que el velocímetro use la antena GPS/GNSS a máxima frecuencia.
3. El chip de estado en la parte superior derecha pasará de `BUSCANDO SATÉLITES GPS...` a `GPS EN VIVO (±3m)`.
4. Todos los indicadores arrancarán en reposo absoluto: **0 km/h, 0.00 km, 00:00.0 y +0m**.

---

## 3. Configuración de Bluetooth y Auto-Arranque

Race Wars Tracker se comunica directamente con el chip Bluetooth de tu teléfono Android para detectar tu coche real:

### Cómo vincular y elegir tu coche:
1. En el Cockpit superior, toca la píldora **`BLUETOOTH`**.
2. Se abrirá la ventana **"VINCULACIÓN DEL VEHÍCULO"**:
   * **Detección Automática de Dispositivos del Teléfono:** La aplicación consulta inmediatamente los dispositivos Bluetooth ya emparejados en tu móvil (la radio de tu coche, manos libres, OBD2 o auriculares) y los muestra en la lista con su nombre real y dirección MAC física.
   * **Escaneo de Ondas en Vivo:** Pulsa **`🔍 ESCANEAR DISPOSITIVOS REALES`** para buscar cualquier dispositivo encendido a tu alrededor. Verás un radar en vivo que lista cada dispositivo con su intensidad de señal (dBm).
   * **Ajustes de Android Directos:** Si tu coche es nuevo o aún no lo has emparejado, pulsa **`⚙️ ABRIR AJUSTES BLUETOOTH DE ANDROID`** para vincularlo en el sistema. Al regresar a la app, aparecerá de inmediato en la lista.
3. **Selección Inmediata:** Simplemente **toca sobre cualquier dispositivo real de la lista** para seleccionarlo. El indicador pasará a verde luminoso con el nombre de tu coche y estado `CONECTADO Y ACTIVO`.

### Auto-Inicio de Ruta:
* Deja activado el interruptor **"Auto-Inicio de Ruta"**.
* Cada vez que entres a tu coche y el móvil se conecte al Bluetooth seleccionado, la telemetría empezará a grabar la ruta automáticamente sin tocar la pantalla.
* **Ventana de gracia (30s, 45s, 60s):** Si te detienes en un semáforo o apagas el motor brevemente para repostar, la app mantiene la sesión abierta sin cortar el track.

---

## 4. Uso del Cockpit en Modo Real

El Cockpit ofrece una lectura limpia y optimizada para el soporte del parabrisas:

* **Velocímetro Central:** Muestra tu velocidad física real calculada vía satélite con filtro de fluctuaciones en parado.
* **Arco de Tacómetro:** Se llena dinámicamente con gradiente neón (Verde ➔ Amarillo ➔ Rojo) conforme aceleras hacia los 240 km/h.
* **Indicador de Velocidad Máxima (TOP):** Registra la punta más alta alcanzada en la tanda.
* **Tarjeta de Distancia:** Odómetro geodésico que acumula los kilómetros reales recorridos.
* **Tarjeta de Tiempo:** Cronómetro de carrera en minutos, segundos y décimas (`MM:SS.d`).
* **Tarjeta de Desnivel Positivo (+D):** Metros de subida acumulados mediante Sensor Fusion (GPS + Barómetro).
* **Altimetría en Vivo (Canvas Inferior):** Muestra el perfil orográfico por el que estás circulando, con cota actual y punto de luz que representa la posición del vehículo.

### Grabación Manual:
Si no utilizas el auto-arranque Bluetooth, pulsa el botón inferior **`START ROUTE`** para iniciar el registro. El botón cambiará a rojo parpadeante con el texto **`STOP RECORDING`**. Al finalizar el tramo, vuelve a pulsarlo para guardar la sesión.

---

## 5. Debrief y Análisis del Trayecto

Tras finalizar tu ruta, pulsa en **`Ver Pantalla 3 ➔`** (o en el botón de resumen):

1. **Mapa del Trazado:** Muestra la ruta realizada con línea neón brillante, indicando el punto de salida en cian y la meta con bandera a cuadros.
2. **Highlights de Competición:**
   * **Velocidad Media (AVG):** Promedio real de la tanda.
   * **Velocidad Máxima (TOP):** La punta más alta alcanzada.
   * **Altitud Máxima (PEAK):** Punto más elevado del recorrido.
   * **Desnivel Positivo (+D) y Negativo (-D):** Metros totales ascendidos y descendidos.
3. **Línea de Tiempo Meteorológica:** Muestra las condiciones atmosféricas (temperatura, lluvia, humedad) capturadas en los distintos puntos kilométricos del tramo.

---

## 6. Exportación en 4K para Redes Sociales

En la parte inferior de la pantalla de resumen encontrarás el botón **`EXPORTAR ZIP`**:

* **Exportación de historias en 9:16:** Genera tarjetas visuales de alta definición (1080x1920) con fondo de cristal ahumado y datos de telemetría, listas para compartir en:
  * **Instagram Stories & Reels**
  * **TikTok**
  * **Strava y Clubes de Motorsport**
* **Archivo GPX Enriquecido:** Incluye todas las coordenadas geográficas, altitudes corregidas y marcas temporales para abrirlas en Google Earth, Garmin Connect o herramientas de telemetría de circuito.

---

## 7. Desbloqueo de Race Wars PRO con Anuncios

Race Wars Tracker utiliza un modelo **100% libre de compras con tarjeta**:

* **Versión Gratuita:** Tienes acceso completo al cockpit, velocímetro, odómetro, altimetría y registro de rutas con un banner publicitario discreto.
* **Cómo Activar el Pase PRO VIP (24 Horas):**
  1. Toca la insignia **`[★ FREE]`** en la cabecera, o intenta activar el tema **Racing Red** o exportar sin marcas de agua.
  2. Se abrirá la ventana de desbloqueo.
  3. Pulsa en **`VER ANUNCIO Y DESBLOQUEAR PRO (24H)`**.
  4. Visualiza el anuncio en vídeo de 15 segundos patrocinado por Google AdMob.
  5. ¡Listo! Recibirás **24 Horas de RACE WARS PRO**:
     * Exportaciones 4K limpias sin marcas de agua.
     * Desbloqueo del tema exclusivo **Racing Red**.
     * Sensor Fusion a 100Hz con filtro Kalman de alta resolución.
     * Eliminación de todos los banners publicitarios.

---

## 8. Preguntas Frecuentes y Solución de Problemas

#### ¿Por qué el velocímetro marca 0 km/h al arrancar?
Porque la aplicación está en **Modo Real**. A diferencia de una simulación, solo marcará velocidad cuando el teléfono se mueva físicamente en el coche o caminando por la calle.

#### ¿La pantalla se apaga mientras conduzco?
No. La aplicación incorpora la tecnología **Screen WakeLock**, que mantiene la pantalla encendida de forma continua mientras el Cockpit esté en pantalla.

#### ¿Funciona sin cobertura de datos móviles en la montaña?
**Sí.** El chip GPS del teléfono recibe las señales directamente de los satélites en el espacio (GPS, GLONASS, Galileo) sin necesidad de datos móviles ni conexión a Internet. La telemetría y el guardado de rutas funcionan completamente offline.

#### ¿Puedo borrar o cambiar el coche vinculado?
Sí. Abre el menú Bluetooth, selecciona el dispositivo que desees o escribe un nombre nuevo y pulsa guardar.
