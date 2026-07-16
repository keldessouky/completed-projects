import SpriteKit

/// البلطجي — the neighborhood thug. Patrols like a Goomba: walks until he
/// hits a wall or would step off a ledge, then turns around. Stomp him from
/// above to squash him; touch him from the side and El-Lemby gets hurt.
final class Thug: SKNode {
    static let spriteSize = CGSize(width: 16, height: 24)
    static let bodySize = CGSize(width: 13, height: 22)

    private let visual: SKSpriteNode
    private let terrain: Terrain
    private var direction: CGFloat = -1
    private var hasCommandedMove = false

    private(set) var isSquashed = false

    init(terrain: Terrain) {
        self.terrain = terrain
        visual = SKSpriteNode(texture: SpriteLoader.texture("thug_walk_0"), size: Self.spriteSize)
        super.init()
        addChild(visual)
        zPosition = ZPosition.enemies
        visual.run(SpriteLoader.animation(["thug_walk_0", "thug_walk_1"], timePerFrame: 0.22),
                   withKey: "walk")

        let body = SKPhysicsBody(rectangleOf: Self.bodySize)
        body.isDynamic = true
        body.allowsRotation = false
        body.friction = 0
        body.restitution = 0
        body.linearDamping = 0
        body.categoryBitMask = PhysicsCategory.enemy
        body.collisionBitMask = PhysicsCategory.solidWorld
        body.contactTestBitMask = PhysicsCategory.player
        physicsBody = body
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    func update(deltaTime dt: TimeInterval) {
        guard !isSquashed, let body = physicsBody else { return }

        let standing = abs(body.velocity.dy) < 5
        if standing {
            // About to walk off a ledge? Turn around.
            let probe = CGPoint(x: position.x + direction * (Self.bodySize.width / 2 + 3),
                                y: position.y - Self.bodySize.height / 2 - 4)
            if !terrain.isSolid(at: probe) {
                direction *= -1
            } else if hasCommandedMove, abs(body.velocity.dx) < GameConfig.thugSpeed * 0.2 {
                // Commanded to move but stuck: a wall. Turn around.
                direction *= -1
            }
        }

        body.velocity = CGVector(dx: direction * GameConfig.thugSpeed, dy: body.velocity.dy)
        hasCommandedMove = true
        visual.xScale = direction > 0 ? -1 : 1
    }

    func squash() {
        guard !isSquashed else { return }
        isSquashed = true
        physicsBody = nil
        visual.removeAllActions()
        visual.texture = SpriteLoader.texture("thug_squashed")
        visual.size = CGSize(width: 16, height: 10)
        visual.position = CGPoint(x: 0, y: -(Self.bodySize.height / 2) + 5)
        run(.sequence([
            .wait(forDuration: 0.8),
            .fadeOut(withDuration: 0.3),
            .removeFromParent(),
        ]))
    }
}
