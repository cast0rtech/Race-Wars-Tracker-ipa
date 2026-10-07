import Foundation
import UIKit
import Capacitor

@objc(NativeSettingsPlugin)
public class NativeSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSettingsPlugin"
    public let jsName = "NativeSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openBluetooth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

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
}
