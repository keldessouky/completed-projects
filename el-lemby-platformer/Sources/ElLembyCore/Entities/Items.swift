import SpriteKit

/// الفكة — a spinning coin worth 100 points.
final class Coin: SKSpriteNode {
    init() {
        super.init(texture: SpriteLoader.texture("coin_0"),
                   color: .clear,
                   size: CGSize(width: 12, height: 12))
        zPosition = ZPosition.items
        run(SpriteLoader.animation(["coin_0", "coin_1", "coin_2", "coin_3"],
                                   timePerFrame: 0.12))

        let body = SKPhysicsBody(circleOfRadius: 5)
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.coin
        body.collisionBitMask = PhysicsCategory.none
        physicsBody = body
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }
}

/// ساندوتش الفول — the power-up. Emerges from a mystery crate; while
/// "مفوّل" El-Lemby survives one hit.
final class PowerUpSandwich: SKSpriteNode {
    init() {
        super.init(texture: SpriteLoader.texture("sandwich"),
                   color: .clear,
                   size: CGSize(width: 14, height: 11))
        zPosition = ZPosition.tiles - 1  // starts hidden behind its crate
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// Rise out of the crate, then become collectible.
    func emerge() {
        run(.sequence([
            .moveBy(x: 0, y: 14, duration: 0.35),
            .run { [weak self] in
                guard let self else { return }
                self.zPosition = ZPosition.items
                let body = SKPhysicsBody(rectangleOf: self.size)
                body.isDynamic = false
                body.categoryBitMask = PhysicsCategory.powerUp
                body.collisionBitMask = PhysicsCategory.none
                self.physicsBody = body
            },
        ]))
    }
}

/// نوسة — reach her to clear the stage.
final class GoalNPC: SKSpriteNode {
    init() {
        super.init(texture: SpriteLoader.texture("nousa_0"),
                   color: .clear,
                   size: CGSize(width: 16, height: 24))
        zPosition = ZPosition.enemies
        run(SpriteLoader.animation(["nousa_0", "nousa_1"], timePerFrame: 0.5))

        let body = SKPhysicsBody(rectangleOf: size)
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.goal
        body.collisionBitMask = PhysicsCategory.none
        physicsBody = body
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }
}

/// صندوق الحظ — the mystery crate (Arabic ؟ on the face). Bump it from
/// below to pop its reward.
final class MysteryCrate: SKSpriteNode {
    enum Reward {
        case coin, sandwich
    }

    let reward: Reward
    private(set) var isSpent = false

    init(reward: Reward) {
        self.reward = reward
        super.init(texture: SpriteLoader.texture("tile_mystery"),
                   color: .clear,
                   size: CGSize(width: 16, height: 16))
        zPosition = ZPosition.tiles

        let body = SKPhysicsBody(rectangleOf: size)
        body.isDynamic = false
        body.friction = 0
        body.restitution = 0
        body.categoryBitMask = PhysicsCategory.crate
        physicsBody = body
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// Returns the reward on the first hit, nil afterwards.
    func hit() -> Reward? {
        nudge()
        guard !isSpent else { return nil }
        isSpent = true
        texture = SpriteLoader.texture("tile_crate_used")
        return reward
    }

    private func nudge() {
        run(.sequence([
            .moveBy(x: 0, y: 3, duration: 0.06),
            .moveBy(x: 0, y: -3, duration: 0.06),
        ]))
    }
}
