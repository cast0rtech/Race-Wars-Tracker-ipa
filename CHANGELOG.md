# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-10-02

### Fixed
- Fixed unhandled syntax error in `app.js` caused by missing closing braces in `overrideBtn` click handler which prevented the entire script from initializing event listeners.
- Fixed Theme and Bluetooth modals not opening by safeguarding `_buildModal()`, `open()`, and `close()` against null backdrop references across `theme-modal.js`, `bluetooth-menu.js`, and `saved-routes-modal.js`.
- Fixed missing null check on `btStatusBtn` before attaching event listener.

### Added
- Added dedicated `Bluetooth` button directly to the bottom menu bar (`#btMenuNavBtn`), giving direct access to vehicle Bluetooth pairing alongside Rutas, Temas, and Resumen.
- Added responsive mobile styles for bottom navigation items with optimized padding, gap, and vertical flex layout on narrow screens.

## [1.0.2] - 2025-10-02

### Changed
- Incremented `versionCode` to `4` and `versionName` to `"1.0.2"` in `app/build.gradle`.
- Generated updated debug APK build with all latest web, Android 14 compatibility, distributed bottom navigation, and pure real-GPS telemetry changes.

## [1.0.1] - 2025-10-02

### Added
- Added `res/xml/network_security_config.xml` to explicitly disable cleartext HTTP traffic across the application.
- Added `ACCESS_NETWORK_STATE` and `androidx.car.app.ACCESS_SURFACE` permissions to `AndroidManifest.xml`.
- Added distributed modern bottom navigation bar (`.bottom-menu-bar`) with equalized touch items for Routes, Themes, and Summary.

### Removed
- Removed Google Play In-App Billing permission (`com.android.vending.BILLING`) from `AndroidManifest.xml`.
- Removed all PRO / Freemium paywall concepts, badges, unlock buttons, and scripts (`pro-manager.js`, `pro-paywall.js`, `pro-paywall.css`, `ad-manager.js`, `ad-manager.css`). All features and themes are completely unlocked and available.
- Removed Simulation Mode and Synthetic Demo Mode (`gpx-replay-engine.js`, `simToggle`, `gpxReplayBtn`, and simulated telemetry generators) across the entire application; telemetry runs exclusively on real GPS hardware.

### Fixed
- Fixed fatal runtime `SecurityException` on Android 14 (API 34) caused by calling `context.registerReceiver` without explicit export flags in `BluetoothLe.kt` by migrating to `ContextCompat.registerReceiver` with `ContextCompat.RECEIVER_EXPORTED`.
- Corrected `<uses-permission>` and `<uses-feature>` ordering in `AndroidManifest.xml` by relocating them before the `<application>` block.
- Constrained legacy Bluetooth permissions (`BLUETOOTH`, `BLUETOOTH_ADMIN`) with `android:maxSdkVersion="30"` in `AndroidManifest.xml`.

### Changed
- Incremented `versionCode` from `2` to `3` and updated `versionName` to `"1.0.1"` in `app/build.gradle`.
- Enabled hardware acceleration (`android:hardwareAccelerated="true"`) in `AndroidManifest.xml`.

### Security
- Enforced Android 14 (API 34) broadcast receiver security policies by specifying `ContextCompat.RECEIVER_EXPORTED` on dynamic receivers listening for system Bluetooth state transitions.
- Disabled cleartext network traffic via `android:usesCleartextTraffic="false"` and `network_security_config.xml`.
