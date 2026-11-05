import UIKit
import Capacitor

/// The app's web view, with PocketFish's own native plugin (in-app purchases) registered.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorePlugin())
    }
}
