import SpriteKit

/// El-Lemby himself. A plain SKNode owns the physics body while a child
/// sprite handles drawing, so flipping the artwork never touches the body.
///
/// Movement is tuned for a Mario-like feel: acceleration + friction,
/// variable jump height (releasing the key cuts the jump short), coyote
/// time, and jump buffering.
final class Player: SKNode {
    enum MoveState {
        case idle, running, jumping
    }

    static let spriteSize = CGSize(width: 16, height: 24)
    static let bodySize = CGSize(width: 12, height: 22)
    static let contactMask: UInt32 = PhysicsCategory.enemy | PhysicsCategory.coin
        | PhysicsCategory.powerUp | PhysicsCategory.goal | PhysicsCategory.crate
        | PhysicsCategory.checkpoint

    private let sprite: SKSpriteNode
    private var moveState: MoveState = .idle
    private var facing: CGFloat = 1
    private var lastGroundedAt: TimeInterval = -.infinity
    private var invulnerableUntil: TimeInterval = -.infinity

    private(set) var isDead = false
    private(set) var isGrounded = false

    private let animKey = "anim"
    private let blinkKey = "blink"
    private lazy var idleAnim = SpriteLoader.animation(
        ["lemby_idle_0", "lemby_idle_1"], timePerFrame: 0.45)
    private lazy var runAnim = SpriteLoader.animation(
        ["lemby_run_0", "lemby_run_1", "lemby_run_2", "lemby_run_1"], timePerFrame: 0.09)

    override init() {
        sprite = SKSpriteNode(texture: SpriteLoader.texture("lemby_idle_0"), size: Self.spriteSize)
        super.init()
        addChild(sprite)
        zPosition = ZPosition.player

        let body = SKPhysicsBody(rectangleOf: Self.bodySize)
        body.isDynamic = true
        body.allowsRotation = false
        body.friction = 0
        body.restitution = 0
        body.linearDamping = 0
        body.usesPreciseCollisionDetection = true
        body.categoryBitMask = PhysicsCategory.player
        body.collisionBitMask = PhysicsCategory.solidWorld
        body.contactTestBitMask = Self.contactMask
        physicsBody = body

        setAnimation(idleAnim)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    // MARK: - Per-frame update

    func update(deltaTime dt: TimeInterval,
                input: inout InputState,
                currentTime: TimeInterval,
                world: SKPhysicsWorld) {
        guard let body = physicsBody, !isDead else { return }

        isGrounded = checkGrounded(world: world)
        if isGrounded {
            lastGroundedAt = currentTime
        }

        // Horizontal: accelerate toward the input, brake with friction.
        // Reversing on the ground uses the stronger skid deceleration so
        // turnarounds feel immediate.
        var vx = body.velocity.dx
        if input.moveX != 0 {
            let reversing = vx != 0 && (input.moveX > 0) != (vx > 0) && abs(vx) > 30
            let accel: CGFloat
            if !isGrounded {
                accel = GameConfig.airAcceleration
            } else if reversing {
                accel = GameConfig.skidDeceleration
            } else {
                accel = GameConfig.runAcceleration
            }
            vx += input.moveX * accel * CGFloat(dt)
            vx = max(-GameConfig.maxRunSpeed, min(GameConfig.maxRunSpeed, vx))
            facing = input.moveX
        } else if isGrounded {
            let drop = GameConfig.groundFriction * CGFloat(dt)
            if abs(vx) <= drop {
                vx = 0
            } else {
                vx -= drop * (vx > 0 ? 1 : -1)
            }
        }

        // Falling pulls harder than the world gravity alone, so jumps feel
        // snappy instead of floaty (the extra is applied on top of
        // physicsWorld.gravity while descending).
        var vy = body.velocity.dy
        if vy < 0 {
            vy += GameConfig.gravityPointsPerSecond
                * (GameConfig.fallGravityMultiplier - 1) * CGFloat(dt)
        }
        let buffered = currentTime - input.jumpPressedAt <= GameConfig.jumpBufferTime
        let coyote = currentTime - lastGroundedAt <= GameConfig.coyoteTime
        if buffered && coyote && vy <= 1 {
            vy = GameConfig.jumpSpeed
            lastGroundedAt = -.infinity
            input.jumpPressedAt = -.infinity
            isGrounded = false
            SoundManager.shared.play(.jump)
        }

        // Variable height: releasing the key caps the upward speed.
        if !input.jumpHeld && vy > GameConfig.jumpCutSpeed {
            vy = GameConfig.jumpCutSpeed
        }

        body.velocity = CGVector(dx: vx, dy: vy)
        updateAnimation(vx: vx)
        sprite.xScale = facing < 0 ? -1 : 1
    }

    /// Two short downward rays from the feet corners; contact-state counting
    /// is easy to leak, rays are deterministic every frame.
    private func checkGrounded(world: SKPhysicsWorld) -> Bool {
        let halfWidth = Self.bodySize.width / 2 - 1
        let bottom = position.y - Self.bodySize.height / 2
        for offset in [-halfWidth, halfWidth] {
            let start = CGPoint(x: position.x + offset, y: bottom + 2)
            let end = CGPoint(x: position.x + offset, y: bottom - 3)
            var hit = false
            world.enumerateBodies(alongRayStart: start, end: end) { body, _, _, stop in
                if body.categoryBitMask & PhysicsCategory.solidWorld != 0 {
                    hit = true
                    stop.pointee = true
                }
            }
            if hit {
                return true
            }
        }
        return false
    }

    private func updateAnimation(vx: CGFloat) {
        let newState: MoveState
        if !isGrounded {
            newState = .jumping
        } else if abs(vx) > 8 {
            newState = .running
        } else {
            newState = .idle
        }
        guard newState != moveState else { return }
        moveState = newState
        switch newState {
        case .idle:
            setAnimation(idleAnim)
        case .running:
            setAnimation(runAnim)
        case .jumping:
            sprite.removeAction(forKey: animKey)
            sprite.texture = SpriteLoader.texture("lemby_jump_0")
        }
    }

    private func setAnimation(_ action: SKAction) {
        sprite.removeAction(forKey: animKey)
        sprite.run(action, withKey: animKey)
    }

    // MARK: - Reactions

    func bounce() {
        physicsBody?.velocity.dy = GameConfig.stompBounceSpeed
    }

    func isInvulnerable(at time: TimeInterval) -> Bool {
        time < invulnerableUntil
    }

    func grantInvulnerability(until time: TimeInterval, duration: TimeInterval) {
        invulnerableUntil = time
        sprite.removeAction(forKey: blinkKey)
        let cycles = Int(duration / 0.2)
        let blink = SKAction.sequence([
            .fadeAlpha(to: 0.35, duration: 0.1),
            .fadeAlpha(to: 1.0, duration: 0.1),
        ])
        sprite.run(.sequence([.repeat(blink, count: max(1, cycles)),
                              .fadeAlpha(to: 1.0, duration: 0.05)]),
                   withKey: blinkKey)
    }

    /// Mario-style death: hop up, then fall through the world.
    func die() {
        guard !isDead else { return }
        isDead = true
        moveState = .idle
        sprite.removeAction(forKey: animKey)
        sprite.removeAction(forKey: blinkKey)
        sprite.alpha = 1
        sprite.texture = SpriteLoader.texture("lemby_hurt_0")
        physicsBody?.collisionBitMask = PhysicsCategory.none
        physicsBody?.contactTestBitMask = PhysicsCategory.none
        physicsBody?.velocity = CGVector(dx: 0, dy: 330)
    }

    func respawn(at point: CGPoint, currentTime: TimeInterval) {
        isDead = false
        position = point
        facing = 1
        sprite.xScale = 1
        physicsBody?.velocity = .zero
        physicsBody?.collisionBitMask = PhysicsCategory.solidWorld
        physicsBody?.contactTestBitMask = Self.contactMask
        moveState = .idle
        setAnimation(idleAnim)
        grantInvulnerability(until: currentTime + GameConfig.hurtInvulnerabilityTime,
                             duration: GameConfig.hurtInvulnerabilityTime)
    }
}
