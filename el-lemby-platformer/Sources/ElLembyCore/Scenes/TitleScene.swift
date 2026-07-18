import AppKit
import SpriteKit

/// Presents scenes and owns cross-scene transitions.
enum SceneRouter {
    static func showTitle(in view: SKView?) {
        let scene = TitleScene(size: GameConfig.sceneSize)
        scene.scaleMode = .aspectFit
        view?.presentScene(scene, transition: .fade(withDuration: 0.4))
    }

    static func startGame(in view: SKView?) {
        GameState.shared.resetRun()
        advance(toStage: 1, in: view)
    }

    /// Moves to a stage without resetting the run (lives/score carry over).
    static func advance(toStage stage: Int, in view: SKView?) {
        let scene = GameScene(size: GameConfig.sceneSize)
        scene.stage = stage
        scene.scaleMode = .aspectFit
        view?.presentScene(scene, transition: .fade(withDuration: 0.6))
    }

    static func showResult(_ kind: ResultKind, in view: SKView?) {
        let scene = ResultScene(size: GameConfig.sceneSize, kind: kind)
        scene.scaleMode = .aspectFit
        view?.presentScene(scene, transition: .fade(withDuration: 0.6))
    }
}

/// شاشة البداية — title, a bobbing Lemby, Nousa waving from across the
/// screen, and the start prompt.
final class TitleScene: SKScene {
    override var acceptsFirstResponder: Bool { true }

    override func didMove(to view: SKView) {
        backgroundColor = Palette.sky
        buildBackdrop()
        buildLabels()
        buildCharacters()
        SoundManager.shared.preload()
        SoundManager.shared.startMusic()
        view.window?.makeFirstResponder(self)
    }

    private func buildBackdrop() {
        let near = SKSpriteNode(texture: SpriteLoader.texture("bg_near"))
        near.anchorPoint = .zero
        near.position = CGPoint(x: 0, y: 2 * GameConfig.tileSize)
        near.zPosition = ZPosition.backgroundNear
        addChild(near)

        let tile = GameConfig.tileSize
        let columns = Int(size.width / tile)
        for (row, texName) in [(1, "tile_ground"), (0, "tile_dirt")] {
            for col in 0...columns {
                let sprite = SKSpriteNode(texture: SpriteLoader.texture(texName),
                                          size: CGSize(width: tile, height: tile))
                sprite.position = CGPoint(x: CGFloat(col) * tile + tile / 2,
                                          y: CGFloat(row) * tile + tile / 2)
                sprite.zPosition = ZPosition.tiles
                addChild(sprite)
            }
        }
    }

    private func buildLabels() {
        let title = SKLabelNode(fontNamed: Fonts.arabicBold)
        title.text = L10n.gameTitle
        title.fontSize = 52
        title.fontColor = Palette.maroon
        title.position = CGPoint(x: size.width / 2, y: size.height - 92)
        addChild(title)

        let subtitle = SKLabelNode(fontNamed: Fonts.arabicBold)
        subtitle.text = L10n.gameSubtitle
        subtitle.fontSize = 18
        subtitle.fontColor = Palette.ink
        subtitle.position = CGPoint(x: size.width / 2, y: size.height - 116)
        addChild(subtitle)

        let start = SKLabelNode(fontNamed: Fonts.arabicBold)
        start.text = L10n.pressStart
        start.fontSize = 14
        start.fontColor = Palette.ink
        start.position = CGPoint(x: size.width / 2, y: 96)
        addChild(start)
        start.run(.repeatForever(.sequence([
            .fadeAlpha(to: 0.25, duration: 0.55),
            .fadeAlpha(to: 1.0, duration: 0.55),
        ])))

        let controls = SKLabelNode(fontNamed: Fonts.arabic)
        controls.text = L10n.controlsHint
        controls.fontSize = 10
        controls.fontColor = Palette.ink
        controls.position = CGPoint(x: size.width / 2, y: 74)
        addChild(controls)

        if GameState.shared.highScore > 0 {
            let high = SKLabelNode(fontNamed: Fonts.arabic)
            high.text = "\(L10n.highScoreLabel): \(L10n.eastern(GameState.shared.highScore))"
            high.fontSize = 10
            high.fontColor = Palette.ink
            high.position = CGPoint(x: size.width / 2, y: 58)
            addChild(high)
        }

        let disclaimer = SKLabelNode(fontNamed: Fonts.arabic)
        disclaimer.text = L10n.fanDisclaimer
        disclaimer.fontSize = 8
        disclaimer.fontColor = Palette.ink
        disclaimer.alpha = 0.7
        disclaimer.position = CGPoint(x: size.width / 2, y: 40)
        addChild(disclaimer)
    }

    private func buildCharacters() {
        let lemby = SKSpriteNode(texture: SpriteLoader.texture("lemby_idle_0"),
                                 size: CGSize(width: 16, height: 24))
        lemby.setScale(3)
        lemby.position = CGPoint(x: size.width / 2 - 90, y: 2 * GameConfig.tileSize + 36)
        lemby.zPosition = ZPosition.player
        lemby.run(SpriteLoader.animation(["lemby_idle_0", "lemby_idle_1"], timePerFrame: 0.45))
        addChild(lemby)

        let nousa = SKSpriteNode(texture: SpriteLoader.texture("nousa_0"),
                                 size: CGSize(width: 16, height: 24))
        nousa.setScale(3)
        nousa.position = CGPoint(x: size.width / 2 + 90, y: 2 * GameConfig.tileSize + 36)
        nousa.zPosition = ZPosition.player
        nousa.run(SpriteLoader.animation(["nousa_0", "nousa_1"], timePerFrame: 0.5))
        addChild(nousa)

        // El-Lemby is smitten: a heart floats between the two of them.
        let heart = SKSpriteNode(texture: SpriteLoader.texture("heart"),
                                 size: CGSize(width: 8, height: 8))
        heart.setScale(2)
        heart.position = CGPoint(x: size.width / 2, y: 2 * GameConfig.tileSize + 58)
        heart.zPosition = ZPosition.effects
        heart.run(.repeatForever(.sequence([
            .group([.moveBy(x: 0, y: 6, duration: 0.7),
                    .scale(to: 2.5, duration: 0.7)]),
            .group([.moveBy(x: 0, y: -6, duration: 0.7),
                    .scale(to: 2.0, duration: 0.7)]),
        ])))
        addChild(heart)
    }

    override func keyDown(with event: NSEvent) {
        switch KeyCode(rawValue: event.keyCode) {
        case .space, .returnKey:
            SceneRouter.startGame(in: view)
        case .m:
            SoundManager.shared.toggleMute()
        default:
            break
        }
    }
}
