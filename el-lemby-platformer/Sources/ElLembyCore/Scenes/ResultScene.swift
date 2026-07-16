import AppKit
import SpriteKit

enum ResultKind {
    case stageClear(timeBonus: Int)
    case gameOver
}

/// Shared end screen for both «مبروك» and «انتهت اللعبة».
final class ResultScene: SKScene {
    private let kind: ResultKind

    init(size: CGSize, kind: ResultKind) {
        self.kind = kind
        super.init(size: size)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override var acceptsFirstResponder: Bool { true }

    override func didMove(to view: SKView) {
        backgroundColor = Palette.night
        let state = GameState.shared
        let centerX = size.width / 2

        let title = SKLabelNode(fontNamed: Fonts.arabicBold)
        title.fontSize = 30
        title.position = CGPoint(x: centerX, y: size.height - 78)
        addChild(title)

        let subtitle = SKLabelNode(fontNamed: Fonts.arabic)
        subtitle.fontSize = 13
        subtitle.fontColor = Palette.cream
        subtitle.position = CGPoint(x: centerX, y: size.height - 102)
        addChild(subtitle)

        var statLines: [String] = []
        switch kind {
        case let .stageClear(timeBonus):
            title.text = L10n.stageClear
            title.fontColor = Palette.gold
            subtitle.text = L10n.stageClearSub
            statLines.append("\(L10n.timeBonusLabel): \(L10n.eastern(timeBonus))")

            let couple = SKNode()
            let lemby = SKSpriteNode(texture: SpriteLoader.texture("lemby_idle_0"),
                                     size: CGSize(width: 16, height: 24))
            lemby.position = CGPoint(x: -16, y: 0)
            let nousa = SKSpriteNode(texture: SpriteLoader.texture("nousa_0"),
                                     size: CGSize(width: 16, height: 24))
            nousa.position = CGPoint(x: 16, y: 0)
            let heart = SKSpriteNode(texture: SpriteLoader.texture("heart"),
                                     size: CGSize(width: 8, height: 8))
            heart.position = CGPoint(x: 0, y: 18)
            couple.addChild(lemby)
            couple.addChild(nousa)
            couple.addChild(heart)
            couple.setScale(2.5)
            couple.position = CGPoint(x: centerX, y: size.height / 2 + 6)
            addChild(couple)
            heart.run(.repeatForever(.sequence([
                .scale(to: 1.35, duration: 0.4),
                .scale(to: 1.0, duration: 0.4),
            ])))
        case .gameOver:
            title.text = L10n.gameOver
            title.fontColor = Palette.maroon
            subtitle.text = L10n.gameOverQuote

            let lemby = SKSpriteNode(texture: SpriteLoader.texture("lemby_hurt_0"),
                                     size: CGSize(width: 16, height: 24))
            lemby.setScale(2.5)
            lemby.position = CGPoint(x: centerX, y: size.height / 2 + 6)
            addChild(lemby)
        }

        statLines.append("\(L10n.moneyLabel): \(L10n.eastern(state.money))")
        statLines.append("\(L10n.scoreLabel): \(L10n.eastern(state.score))")
        statLines.append("\(L10n.highScoreLabel): \(L10n.eastern(state.highScore))")

        for (i, line) in statLines.enumerated() {
            let label = SKLabelNode(fontNamed: Fonts.arabic)
            label.text = line
            label.fontSize = 12
            label.fontColor = Palette.cream
            label.position = CGPoint(x: centerX, y: 108 - CGFloat(i) * 18)
            addChild(label)
        }

        let hint = SKLabelNode(fontNamed: Fonts.arabic)
        hint.text = L10n.retryHint
        hint.fontSize = 10
        hint.fontColor = Palette.cream
        hint.alpha = 0.8
        hint.position = CGPoint(x: centerX, y: 22)
        addChild(hint)
        hint.run(.repeatForever(.sequence([
            .fadeAlpha(to: 0.3, duration: 0.6),
            .fadeAlpha(to: 0.8, duration: 0.6),
        ])))

        view.window?.makeFirstResponder(self)
    }

    override func keyDown(with event: NSEvent) {
        switch KeyCode(rawValue: event.keyCode) {
        case .space:
            SceneRouter.startGame(in: view)
        case .returnKey, .escape:
            SceneRouter.showTitle(in: view)
        case .m:
            SoundManager.shared.toggleMute()
        default:
            break
        }
    }
}
