import AppKit
import SpriteKit

/// The playable stage: side-scrolling left → right through the حارة until
/// El-Lemby reaches Nousa.
final class GameScene: SKScene, SKPhysicsContactDelegate {
    private enum Phase {
        case playing, paused, dying, won
    }

    private let gameState = GameState.shared
    private let worldNode = SKNode()
    private let player = Player()
    private let hud = HUD()
    private let camNode = SKCameraNode()

    private var thugs: [Thug] = []
    private var farLayer: SKNode?
    private var nearLayer: SKNode?
    private var levelWidth: CGFloat = GameConfig.sceneSize.width
    private var spawnPoint = CGPoint.zero
    private var goalPosition = CGPoint.zero

    private var pressedKeys = Set<UInt16>()
    private var input = InputState()
    private var phase: Phase = .playing
    private var lastUpdateTime: TimeInterval = 0
    private var now: TimeInterval = 0
    private var timeLeft = GameConfig.stageTimeSeconds
    private var clockAccumulator: TimeInterval = 0
    private var pauseOverlay: SKNode?

    override var acceptsFirstResponder: Bool { true }

    // MARK: - Setup

    override func didMove(to view: SKView) {
        backgroundColor = Palette.sky
        physicsWorld.gravity = CGVector(dx: 0, dy: GameConfig.gravity)
        physicsWorld.contactDelegate = self

        buildLevel()

        addChild(worldNode)
        camera = camNode
        camNode.position = CGPoint(x: clampedCameraX(spawnPoint.x), y: size.height / 2)
        addChild(camNode)
        camNode.addChild(hud)
        hud.update(money: gameState.money, lives: gameState.lives,
                   time: timeLeft, powered: gameState.isPowered)

        showStageBanner()
        SoundManager.shared.preload()
        SoundManager.shared.startMusic()
        view.window?.makeFirstResponder(self)
    }

    private func buildLevel() {
        let data: LevelData
        do {
            data = try LevelParser.load(named: "level1")
        } catch {
            // The bundled level should always parse; leave an obvious note
            // on screen instead of crashing if it ever doesn't.
            let label = SKLabelNode(fontNamed: Fonts.arabicBold)
            label.text = "تعذّر تحميل المرحلة — level1.txt"
            label.fontSize = 14
            label.fontColor = Palette.ink
            label.position = CGPoint(x: size.width / 2, y: size.height / 2)
            addChild(label)
            return
        }

        let built = LevelBuilder.build(data: data)
        levelWidth = built.widthInPoints
        spawnPoint = built.playerSpawn
        goalPosition = built.goalPosition
        thugs = built.thugs

        addChild(built.farLayer)
        addChild(built.nearLayer)
        farLayer = built.farLayer
        nearLayer = built.nearLayer

        worldNode.addChild(built.contents)
        player.position = spawnPoint
        worldNode.addChild(player)
    }

    private func showStageBanner() {
        let banner = SKLabelNode(fontNamed: Fonts.arabicBold)
        banner.text = L10n.stage1Name
        banner.fontSize = 18
        banner.fontColor = Palette.ink
        banner.position = CGPoint(x: 0, y: 40)
        banner.zPosition = ZPosition.overlay
        camNode.addChild(banner)
        banner.run(.sequence([
            .wait(forDuration: 1.8),
            .fadeOut(withDuration: 0.5),
            .removeFromParent(),
        ]))
    }

    // MARK: - Input

    override func keyDown(with event: NSEvent) {
        guard !event.isARepeat else { return }
        pressedKeys.insert(event.keyCode)
        switch KeyCode(rawValue: event.keyCode) {
        case .space, .upArrow, .w:
            input.jumpPressedAt = now
        case .p, .escape:
            togglePause()
        case .m:
            SoundManager.shared.toggleMute()
        default:
            break
        }
    }

    override func keyUp(with event: NSEvent) {
        pressedKeys.remove(event.keyCode)
    }

    private func isPressed(_ key: KeyCode) -> Bool {
        pressedKeys.contains(key.rawValue)
    }

    private func horizontalInput() -> CGFloat {
        var x: CGFloat = 0
        if isPressed(.leftArrow) || isPressed(.a) { x -= 1 }
        if isPressed(.rightArrow) || isPressed(.d) { x += 1 }
        return x
    }

    // MARK: - Frame loop

    override func update(_ currentTime: TimeInterval) {
        now = currentTime
        let dt: TimeInterval
        if lastUpdateTime == 0 {
            dt = 1.0 / 60.0
        } else {
            dt = min(currentTime - lastUpdateTime, 1.0 / 30.0)
        }
        lastUpdateTime = currentTime

        guard phase == .playing else { return }

        input.moveX = horizontalInput()
        input.jumpHeld = isPressed(.space) || isPressed(.upArrow) || isPressed(.w)
        player.update(deltaTime: dt, input: &input, currentTime: currentTime,
                      world: physicsWorld)

        for thug in thugs where thug.parent != nil {
            thug.update(deltaTime: dt)
        }

        updateCamera()
        updateParallax()
        tickClock(dt)

        if player.position.y < GameConfig.fallDeathY {
            handlePlayerDeath()
        }

        hud.update(money: gameState.money, lives: gameState.lives,
                   time: timeLeft, powered: gameState.isPowered)
    }

    private func updateCamera() {
        let target = clampedCameraX(player.position.x)
        let x = camNode.position.x + (target - camNode.position.x) * GameConfig.cameraLerp
        camNode.position = CGPoint(x: x, y: size.height / 2)
    }

    private func clampedCameraX(_ x: CGFloat) -> CGFloat {
        let halfWidth = size.width / 2
        return min(max(x, halfWidth), max(halfWidth, levelWidth - halfWidth))
    }

    private func updateParallax() {
        let camX = camNode.position.x - size.width / 2
        farLayer?.position.x = camX * (1 - GameConfig.parallaxFar)
        nearLayer?.position.x = camX * (1 - GameConfig.parallaxNear)
    }

    private func tickClock(_ dt: TimeInterval) {
        clockAccumulator += dt
        while clockAccumulator >= 1 {
            clockAccumulator -= 1
            timeLeft -= 1
            if timeLeft <= 0 {
                timeLeft = 0
                handlePlayerDeath()
                return
            }
        }
    }

    // MARK: - Pause

    private func togglePause() {
        switch phase {
        case .playing:
            phase = .paused
            physicsWorld.speed = 0
            worldNode.isPaused = true
            let overlay = SKNode()
            overlay.zPosition = ZPosition.overlay
            let dim = SKSpriteNode(color: Palette.overlay, size: size)
            let label = SKLabelNode(fontNamed: Fonts.arabicBold)
            label.text = L10n.paused
            label.fontSize = 16
            label.fontColor = Palette.cream
            label.verticalAlignmentMode = .center
            overlay.addChild(dim)
            overlay.addChild(label)
            camNode.addChild(overlay)
            pauseOverlay = overlay
        case .paused:
            phase = .playing
            physicsWorld.speed = 1
            worldNode.isPaused = false
            pauseOverlay?.removeFromParent()
            pauseOverlay = nil
        case .dying, .won:
            break
        }
    }

    // MARK: - Contacts

    func didBegin(_ contact: SKPhysicsContact) {
        guard phase == .playing else { return }

        let other: SKPhysicsBody
        if contact.bodyA.categoryBitMask == PhysicsCategory.player {
            other = contact.bodyB
        } else if contact.bodyB.categoryBitMask == PhysicsCategory.player {
            other = contact.bodyA
        } else {
            return
        }

        switch other.categoryBitMask {
        case PhysicsCategory.coin:
            if let coin = other.node as? Coin, coin.parent != nil {
                collect(coin)
            }
        case PhysicsCategory.powerUp:
            if let sandwich = other.node as? PowerUpSandwich, sandwich.parent != nil {
                collect(sandwich)
            }
        case PhysicsCategory.enemy:
            if let thug = other.node as? Thug, !thug.isSquashed {
                resolveEnemyContact(thug)
            }
        case PhysicsCategory.crate:
            if let crate = other.node as? MysteryCrate {
                resolveCrateContact(crate)
            }
        case PhysicsCategory.goal:
            winStage()
        default:
            break
        }
    }

    private func collect(_ coin: Coin) {
        gameState.collectCoin()
        SoundManager.shared.play(.coin)
        coin.removeFromParent()
    }

    private func collect(_ sandwich: PowerUpSandwich) {
        gameState.isPowered = true
        gameState.addScore(GameConfig.powerUpScore)
        SoundManager.shared.play(.powerup)
        sandwich.removeFromParent()
    }

    private func resolveEnemyContact(_ thug: Thug) {
        let vy = player.physicsBody?.velocity.dy ?? 0
        let playerBottom = player.position.y - Player.bodySize.height / 2
        if vy <= GameConfig.stompVelocityThreshold && playerBottom > thug.position.y {
            thug.squash()
            player.bounce()
            gameState.addScore(GameConfig.stompScore)
            SoundManager.shared.play(.stomp)
        } else {
            damagePlayer()
        }
    }

    private func resolveCrateContact(_ crate: MysteryCrate) {
        // Only a head-bump from below pops the crate.
        let vy = player.physicsBody?.velocity.dy ?? 0
        guard vy > 20, player.position.y < crate.position.y - 12 else { return }

        guard let reward = crate.hit() else {
            SoundManager.shared.play(.bump)
            return
        }
        switch reward {
        case .coin:
            gameState.collectCoin()
            SoundManager.shared.play(.coin)
            spawnCoinPop(above: crate)
        case .sandwich:
            SoundManager.shared.play(.bump)
            let sandwich = PowerUpSandwich()
            sandwich.position = CGPoint(x: crate.position.x, y: crate.position.y + 2)
            crate.parent?.addChild(sandwich)
            sandwich.emerge()
        }
    }

    private func spawnCoinPop(above crate: MysteryCrate) {
        let pop = SKSpriteNode(texture: SpriteLoader.texture("coin_0"),
                               size: CGSize(width: 12, height: 12))
        pop.position = CGPoint(x: crate.position.x, y: crate.position.y + 14)
        pop.zPosition = ZPosition.effects
        crate.parent?.addChild(pop)
        pop.run(.group([
            SpriteLoader.animation(["coin_0", "coin_1", "coin_2", "coin_3"],
                                   timePerFrame: 0.06),
            .sequence([
                .moveBy(x: 0, y: 24, duration: 0.22),
                .fadeOut(withDuration: 0.12),
                .removeFromParent(),
            ]),
        ]))
    }

    // MARK: - Damage / death / win

    private func damagePlayer() {
        guard !player.isDead, !player.isInvulnerable(at: now) else { return }
        if gameState.isPowered {
            gameState.isPowered = false
            SoundManager.shared.play(.hurt)
            player.grantInvulnerability(until: now + GameConfig.hurtInvulnerabilityTime,
                                        duration: GameConfig.hurtInvulnerabilityTime)
        } else {
            handlePlayerDeath()
        }
    }

    private func handlePlayerDeath() {
        guard phase == .playing else { return }
        phase = .dying
        gameState.lives -= 1
        gameState.isPowered = false
        player.die()
        if gameState.lives <= 0 {
            SoundManager.shared.stopMusic()
            SoundManager.shared.play(.gameover)
        } else {
            SoundManager.shared.play(.hurt)
        }
        run(.sequence([
            .wait(forDuration: 1.5),
            .run { [weak self] in self?.afterDeath() },
        ]))
    }

    private func afterDeath() {
        if gameState.lives > 0 {
            timeLeft = GameConfig.stageTimeSeconds
            clockAccumulator = 0
            player.respawn(at: spawnPoint, currentTime: now)
            camNode.position = CGPoint(x: clampedCameraX(spawnPoint.x), y: size.height / 2)
            phase = .playing
        } else {
            gameState.commitHighScore()
            SceneRouter.showResult(.gameOver, in: view)
        }
    }

    private func winStage() {
        guard phase == .playing else { return }
        phase = .won
        input = InputState()
        pressedKeys.removeAll()
        player.physicsBody?.velocity.dx = 0

        SoundManager.shared.stopMusic()
        SoundManager.shared.play(.win)
        let bonus = gameState.awardTimeBonus(secondsLeft: timeLeft)
        gameState.commitHighScore()
        spawnHearts(around: goalPosition)

        run(.sequence([
            .wait(forDuration: 2.0),
            .run { [weak self] in
                SceneRouter.showResult(.stageClear(timeBonus: bonus), in: self?.view)
            },
        ]))
    }

    private func spawnHearts(around point: CGPoint) {
        for i in 0..<6 {
            let heart = SKSpriteNode(texture: SpriteLoader.texture("heart"),
                                     size: CGSize(width: 8, height: 8))
            let dx = CGFloat((i % 3) - 1) * 12 + CGFloat(i) * 2
            heart.position = CGPoint(x: point.x + dx, y: point.y + 10)
            heart.zPosition = ZPosition.effects
            heart.alpha = 0
            worldNode.addChild(heart)
            heart.run(.sequence([
                .wait(forDuration: 0.15 * Double(i)),
                .group([
                    .fadeIn(withDuration: 0.15),
                    .moveBy(x: 0, y: 26, duration: 0.9),
                ]),
                .fadeOut(withDuration: 0.25),
                .removeFromParent(),
            ]))
        }
    }
}
