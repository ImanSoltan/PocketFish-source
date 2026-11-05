// Tips (in-app purchases) with Apple's StoreKit 2. A small plugin of our own instead of a third-party SDK,
// so only Apple sees a purchase, and no server: StoreKit checks each transaction on the device.
import Capacitor
import StoreKit

@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise)
    ]
    private var updates: Task<Void, Never>?

    override public func load() {
        // purchases that complete later, e.g. approved through Ask to Buy: finish them and say thanks. They can
        // arrive right after launch, before the page listens, so the event waits for the listener. A tip that
        // StoreKit can't verify is finished too (tips unlock nothing), without a thank-you, so it isn't
        // delivered again on every launch.
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                switch result {
                case .verified(let transaction):
                    await transaction.finish()
                    self?.notifyListeners("purchased", data: ["id": transaction.productID], retainUntilConsumed: true)
                case .unverified(let transaction, _):
                    await transaction.finish()
                }
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    /// Name and price of the products, in the customer's App Store language and currency.
    @objc public func products(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { ["id": $0.id, "title": $0.displayName, "price": $0.displayPrice] }])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Buys a product; resolves with state purchased, pending (Ask to Buy) or cancelled.
    @objc public func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("no product id")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("product not found", "NOT_FOUND")
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("the purchase could not be verified", "UNVERIFIED")
                        return
                    }
                    await transaction.finish()
                    call.resolve(["state": "purchased"])
                case .pending:
                    call.resolve(["state": "pending"])
                case .userCancelled:
                    call.resolve(["state": "cancelled"])
                @unknown default:
                    call.resolve(["state": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
