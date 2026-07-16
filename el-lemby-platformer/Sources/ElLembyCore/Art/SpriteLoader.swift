import AppKit
import SpriteKit

/// UI colors shared across scenes (matched to the generated art palette).
enum Palette {
    static let sky = SKColor(red: 166 / 255, green: 204 / 255, blue: 216 / 255, alpha: 1)
    static let ink = SKColor(red: 20 / 255, green: 15 / 255, blue: 18 / 255, alpha: 1)
    static let gold = SKColor(red: 199 / 255, green: 141 / 255, blue: 29 / 255, alpha: 1)
    static let cream = SKColor(red: 243 / 255, green: 236 / 255, blue: 224 / 255, alpha: 1)
    static let night = SKColor(red: 30 / 255, green: 26 / 255, blue: 36 / 255, alpha: 1)
    static let maroon = SKColor(red: 153 / 255, green: 47 / 255, blue: 62 / 255, alpha: 1)
    static let overlay = SKColor(red: 0, green: 0, blue: 0, alpha: 0.55)
}

/// Loads the generated pixel-art PNGs from the package resource bundle and
/// caches nearest-filtered textures. All art is produced by
/// tools/generate_assets.py — see that script to tweak the pixels.
enum SpriteLoader {
    private static var cache: [String: SKTexture] = [:]

    static func texture(_ name: String) -> SKTexture {
        if let cached = cache[name] {
            return cached
        }
        let texture: SKTexture
        if let url = Bundle.module.url(forResource: name,
                                       withExtension: "png",
                                       subdirectory: "Resources/sprites"),
           let image = NSImage(contentsOf: url) {
            texture = SKTexture(image: image)
        } else {
            assertionFailure("missing sprite: \(name)")
            texture = SKTexture(image: Self.placeholderImage)
        }
        texture.filteringMode = .nearest
        cache[name] = texture
        return texture
    }

    static func textures(_ names: [String]) -> [SKTexture] {
        names.map(texture)
    }

    static func animation(_ names: [String], timePerFrame: TimeInterval) -> SKAction {
        .repeatForever(.animate(with: textures(names), timePerFrame: timePerFrame))
    }

    /// Loud magenta stand-in so a missing asset is obvious instead of fatal.
    private static let placeholderImage: NSImage = {
        let image = NSImage(size: NSSize(width: 16, height: 16))
        image.lockFocus()
        NSColor.magenta.setFill()
        NSRect(x: 0, y: 0, width: 16, height: 16).fill()
        image.unlockFocus()
        return image
    }()
}
