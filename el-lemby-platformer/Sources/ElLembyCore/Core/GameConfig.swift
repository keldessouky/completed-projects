import CoreGraphics
import Foundation

/// Tuning constants for the whole game. Physics values are in points and
/// seconds; the internal scene is 480×272 with 16-point tiles (30×17 tiles
/// visible), presented with nearest-neighbor filtering for the pixel look.
enum GameConfig {
    static let tileSize: CGFloat = 16
    static let sceneSize = CGSize(width: 480, height: 272)
    static let defaultWindowScale: CGFloat = 2

    // World gravity is set in SpriteKit's meters/s² (1m ≈ 150 points),
    // so -9.8 ≈ -1470 points/s².
    static let gravity: CGFloat = -9.8
    static let gravityPointsPerSecond: CGFloat = gravity * 150

    // El-Lemby movement (Mario-inspired: acceleration, friction, variable
    // jump height, coyote time, and jump buffering).
    static let maxRunSpeed: CGFloat = 116
    static let runAcceleration: CGFloat = 640
    static let groundFriction: CGFloat = 820
    static let airAcceleration: CGFloat = 470
    static let jumpSpeed: CGFloat = 452
    static let jumpCutSpeed: CGFloat = 145
    static let stompBounceSpeed: CGFloat = 310
    static let coyoteTime: TimeInterval = 0.09
    static let jumpBufferTime: TimeInterval = 0.12
    static let hurtInvulnerabilityTime: TimeInterval = 1.6
    static let stompVelocityThreshold: CGFloat = -30

    // Enemies
    static let thugSpeed: CGFloat = 34

    // Rules
    static let startLives = 3
    static let stageTimeSeconds = 240
    static let coinScore = 100
    static let stompScore = 200
    static let powerUpScore = 400
    static let timeBonusPerSecond = 10

    // Camera
    static let cameraLerp: CGFloat = 0.18

    // Parallax factors: how much of the camera's travel each layer keeps.
    static let parallaxFar: CGFloat = 0.15
    static let parallaxNear: CGFloat = 0.30

    // The player dies when falling below this y.
    static let fallDeathY: CGFloat = -40

    static let skyColor = (red: 166.0 / 255.0, green: 204.0 / 255.0, blue: 216.0 / 255.0)
}

/// Physics contact/collision categories.
enum PhysicsCategory {
    static let none: UInt32 = 0
    static let player: UInt32 = 1 << 0
    static let ground: UInt32 = 1 << 1   // merged solid terrain runs
    static let crate: UInt32 = 1 << 2    // interactive mystery crates (also solid)
    static let enemy: UInt32 = 1 << 3
    static let coin: UInt32 = 1 << 4
    static let powerUp: UInt32 = 1 << 5
    static let goal: UInt32 = 1 << 6

    static let solidWorld: UInt32 = ground | crate
}

/// Draw order.
enum ZPosition {
    static let backgroundFar: CGFloat = -30
    static let backgroundNear: CGFloat = -20
    static let tiles: CGFloat = 0
    static let items: CGFloat = 5
    static let enemies: CGFloat = 8
    static let player: CGFloat = 10
    static let effects: CGFloat = 20
    static let hud: CGFloat = 100
    static let overlay: CGFloat = 200
}

/// macOS virtual key codes (layout-independent — important because the
/// game's audience may well be typing on an Arabic keyboard layout).
enum KeyCode: UInt16 {
    case a = 0
    case s = 1
    case d = 2
    case w = 13
    case p = 35
    case returnKey = 36
    case space = 49
    case escape = 53
    case m = 46
    case leftArrow = 123
    case rightArrow = 124
    case downArrow = 125
    case upArrow = 126
}

/// Per-frame input snapshot handed from the scene to the player.
struct InputState {
    var moveX: CGFloat = 0          // -1, 0, or 1
    var jumpHeld = false
    var jumpPressedAt: TimeInterval = -.infinity
}
