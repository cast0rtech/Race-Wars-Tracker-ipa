import Foundation
import UIKit
import Capacitor

@objc(NativeSettingsPlugin)
public class NativeSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSettingsPlugin"
    public let jsName = "NativeSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openBluetooth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBrightness", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBrightness", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreBrightness", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKeepScreenOn", returnType: CAPPluginReturnPromise)
    ]

    private var previousBrightness: CGFloat?

    @objc func openBluetooth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Esquemas conocidos de iOS para navegar directamente a la configuración Bluetooth
            let candidateUrls = [
                "App-Prefs:root=Bluetooth",
                "App-Prefs:Bluetooth",
                "prefs:root=Bluetooth",
                UIApplication.openSettingsURLString
            ]
            
            for urlString in candidateUrls {
                if let url = URL(string: urlString), UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url, options: [:]) { success in
                        call.resolve(["opened": success, "url": urlString])
                    }
                    return
                }
            }
            
            // Fallback a los ajustes generales de la aplicación
            if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(settingsUrl, options: [:]) { success in
                    call.resolve(["opened": success, "url": "appSettings"])
                }
            } else {
                call.resolve(["opened": false])
            }
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:]) { success in
                    call.resolve(["opened": success])
                }
            } else {
                call.resolve(["opened": false])
            }
        }
    }

    @objc func setBrightness(_ call: CAPPluginCall) {
        let val = call.getFloat("value") ?? 0.8
        DispatchQueue.main.async {
            if self.previousBrightness == nil {
                self.previousBrightness = UIScreen.main.brightness
            }
            let target = CGFloat(min(max(val, 0.0), 1.0))
            UIScreen.main.brightness = target
            call.resolve([
                "success": true,
                "brightness": Float(target),
                "previous": Float(self.previousBrightness ?? target)
            ])
        }
    }

    @objc func getBrightness(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "brightness": Float(UIScreen.main.brightness)
            ])
        }
    }

    @objc func restoreBrightness(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let prev = self.previousBrightness {
                UIScreen.main.brightness = prev
                self.previousBrightness = nil
            }
            call.resolve([
                "success": true,
                "brightness": Float(UIScreen.main.brightness)
            ])
        }
    }

    @objc func setKeepScreenOn(_ call: CAPPluginCall) {
        let enable = call.getBool("enabled") ?? true
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = enable
            call.resolve([
                "success": true,
                "isIdleTimerDisabled": enable
            ])
        }
    }
}
