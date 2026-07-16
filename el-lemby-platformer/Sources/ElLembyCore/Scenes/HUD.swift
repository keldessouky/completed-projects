import SpriteKit

/// Top-of-screen status bar, attached to the camera. Laid out RTL: money on
/// the right, lives centered, timer on the left. Numbers use Eastern Arabic
/// numerals.
final class HUD: SKNode {
    private let moneyLabel = HUD.makeLabel(alignment: .right)
    private let livesLabel = HUD.makeLabel(alignment: .center)
    private let timeLabel = HUD.makeLabel(alignment: .left)
    private let poweredLabel = HUD.makeLabel(alignment: .right)

    override init() {
        super.init()
        zPosition = ZPosition.hud

        let halfWidth = GameConfig.sceneSize.width / 2
        let top = GameConfig.sceneSize.height / 2 - 7

        moneyLabel.position = CGPoint(x: halfWidth - 10, y: top)
        livesLabel.position = CGPoint(x: 0, y: top)
        timeLabel.position = CGPoint(x: -halfWidth + 10, y: top)
        poweredLabel.position = CGPoint(x: halfWidth - 10, y: top - 15)
        poweredLabel.fontColor = Palette.gold
        poweredLabel.text = L10n.hudPowered
        poweredLabel.isHidden = true

        addChild(moneyLabel)
        addChild(livesLabel)
        addChild(timeLabel)
        addChild(poweredLabel)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    func update(money: Int, lives: Int, time: Int, powered: Bool) {
        moneyLabel.text = "\(L10n.hudMoney) \(L10n.count(money))"
        livesLabel.text = "\(L10n.hudLives) \(L10n.count(lives))"
        timeLabel.text = "\(L10n.hudTime) \(L10n.eastern(time))"
        poweredLabel.isHidden = !powered
    }

    private static func makeLabel(alignment: SKLabelHorizontalAlignmentMode) -> SKLabelNode {
        let label = SKLabelNode(fontNamed: Fonts.arabicBold)
        label.fontSize = 11
        label.fontColor = Palette.ink
        label.horizontalAlignmentMode = alignment
        label.verticalAlignmentMode = .top
        return label
    }
}
