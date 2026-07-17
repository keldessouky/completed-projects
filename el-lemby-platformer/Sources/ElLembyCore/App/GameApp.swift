import AppKit
import SpriteKit

/// AppKit bootstrap — builds the window, menu bar, and SKView, then presents
/// the title scene. Run with `swift run` (no storyboard, no xib).
public enum GameApp {
    public static func run() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let scale = GameConfig.defaultWindowScale
        let contentSize = NSSize(width: GameConfig.sceneSize.width * scale,
                                 height: GameConfig.sceneSize.height * scale)
        let window = NSWindow(contentRect: NSRect(origin: .zero, size: contentSize),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered,
                              defer: false)
        window.title = L10n.windowTitle
        window.isReleasedWhenClosed = false   // ARC owns the window
        window.contentAspectRatio = NSSize(width: GameConfig.sceneSize.width,
                                           height: GameConfig.sceneSize.height)
        window.contentMinSize = NSSize(width: GameConfig.sceneSize.width,
                                       height: GameConfig.sceneSize.height)

        let skView = SKView(frame: NSRect(origin: .zero, size: contentSize))
        skView.ignoresSiblingOrder = true
        skView.preferredFramesPerSecond = 60
        window.contentView = skView

        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window

        let title = TitleScene(size: GameConfig.sceneSize)
        title.scaleMode = .aspectFit
        skView.presentScene(title)

        window.makeFirstResponder(skView)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func buildMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: L10n.quitMenuItem,
                        action: #selector(NSApplication.terminate(_:)),
                        keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        NSApplication.shared.mainMenu = mainMenu
    }
}
