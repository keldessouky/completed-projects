import SpriteKit

/// World-space queries against the tile grid (used by enemies for ledge
/// detection). Row 0 of the level file is the top of the world.
struct Terrain {
    let data: LevelData

    func isSolid(at point: CGPoint) -> Bool {
        guard point.x >= 0, point.y >= 0 else { return false }
        let column = Int(point.x / GameConfig.tileSize)
        let rowFromBottom = Int(point.y / GameConfig.tileSize)
        let row = data.rows - 1 - rowFromBottom
        return data.isSolid(column: column, row: row)
    }
}

/// Everything LevelBuilder produced, ready for a scene to adopt.
struct BuiltLevel {
    let contents: SKNode        // tiles, physics, items, enemies, goal
    let farLayer: SKNode        // parallax skyline
    let nearLayer: SKNode       // parallax alley buildings
    let thugs: [Thug]
    let playerSpawn: CGPoint
    let goalPosition: CGPoint
    let widthInPoints: CGFloat
    let terrain: Terrain
}

/// Turns parsed LevelData into SpriteKit nodes. Contiguous solid tiles are
/// merged into single physics bodies per row so the player never snags on
/// tile seams while running.
enum LevelBuilder {
    static func build(data: LevelData) -> BuiltLevel {
        let tile = GameConfig.tileSize
        let container = SKNode()
        let terrain = Terrain(data: data)
        let widthInPoints = CGFloat(data.columns) * tile

        func cellCenter(column: Int, row: Int) -> CGPoint {
            CGPoint(x: CGFloat(column) * tile + tile / 2,
                    y: CGFloat(data.rows - 1 - row) * tile + tile / 2)
        }

        // Tile visuals; mystery crates are interactive nodes of their own.
        for row in 0..<data.rows {
            for column in 0..<data.columns {
                guard let kind = data.tile(column: column, row: row) else { continue }
                if kind.isMystery {
                    let crate = MysteryCrate(reward: kind == .mysteryCoin ? .coin : .sandwich)
                    crate.position = cellCenter(column: column, row: row)
                    container.addChild(crate)
                } else {
                    let sprite = SKSpriteNode(texture: SpriteLoader.texture(kind.spriteName),
                                              size: CGSize(width: tile, height: tile))
                    sprite.position = cellCenter(column: column, row: row)
                    sprite.zPosition = ZPosition.tiles
                    container.addChild(sprite)
                }
            }
        }

        // Merged static bodies for plain solid runs.
        for row in 0..<data.rows {
            var column = 0
            while column < data.columns {
                guard let kind = data.tile(column: column, row: row), !kind.isMystery else {
                    column += 1
                    continue
                }
                _ = kind
                var end = column
                while end + 1 < data.columns,
                      let next = data.tile(column: end + 1, row: row),
                      !next.isMystery {
                    end += 1
                }
                let runWidth = CGFloat(end - column + 1) * tile
                let node = SKNode()
                node.position = CGPoint(x: CGFloat(column) * tile + runWidth / 2,
                                        y: CGFloat(data.rows - 1 - row) * tile + tile / 2)
                let body = SKPhysicsBody(rectangleOf: CGSize(width: runWidth, height: tile))
                body.isDynamic = false
                body.friction = 0
                body.restitution = 0
                body.categoryBitMask = PhysicsCategory.ground
                node.physicsBody = body
                container.addChild(node)
                column = end + 1
            }
        }

        // Invisible walls at both ends of the stage.
        let wallHeight = CGFloat(data.rows) * tile + 240
        for x in [CGFloat(-2), widthInPoints + 2] {
            let wall = SKNode()
            wall.position = CGPoint(x: x, y: wallHeight / 2)
            let body = SKPhysicsBody(rectangleOf: CGSize(width: 4, height: wallHeight))
            body.isDynamic = false
            body.friction = 0
            body.categoryBitMask = PhysicsCategory.ground
            wall.physicsBody = body
            container.addChild(wall)
        }

        // Entities.
        var thugs: [Thug] = []
        var playerSpawn = CGPoint(x: 3 * tile, y: 4 * tile)
        var goalPosition = CGPoint(x: widthInPoints - 3 * tile, y: 3 * tile)
        for placement in data.entities {
            let center = cellCenter(column: placement.column, row: placement.row)
            let cellBottom = center.y - tile / 2
            switch placement.kind {
            case .player:
                playerSpawn = CGPoint(x: center.x,
                                      y: cellBottom + Player.bodySize.height / 2 + 1)
            case .thug:
                let thug = Thug(terrain: terrain)
                thug.position = CGPoint(x: center.x,
                                        y: cellBottom + Thug.bodySize.height / 2 + 1)
                container.addChild(thug)
                thugs.append(thug)
            case .coin:
                let coin = Coin()
                coin.position = center
                container.addChild(coin)
            case .nousa:
                let goal = GoalNPC()
                goal.position = CGPoint(x: center.x, y: cellBottom + 12)
                goalPosition = goal.position
                container.addChild(goal)
            }
        }

        let farLayer = makeParallaxLayer(spriteName: "bg_far",
                                         parallax: GameConfig.parallaxFar,
                                         bottomY: 44,
                                         zPosition: ZPosition.backgroundFar,
                                         levelWidth: widthInPoints)
        let nearLayer = makeParallaxLayer(spriteName: "bg_near",
                                          parallax: GameConfig.parallaxNear,
                                          bottomY: 2 * tile,
                                          zPosition: ZPosition.backgroundNear,
                                          levelWidth: widthInPoints)

        return BuiltLevel(contents: container,
                          farLayer: farLayer,
                          nearLayer: nearLayer,
                          thugs: thugs,
                          playerSpawn: playerSpawn,
                          goalPosition: goalPosition,
                          widthInPoints: widthInPoints,
                          terrain: terrain)
    }

    /// A row of repeated strips wide enough to cover the layer's apparent
    /// travel: the scene repositions the layer to `cameraX * (1 - parallax)`
    /// each frame, so the visible span reaches `levelWidth * parallax` plus
    /// one screen.
    private static func makeParallaxLayer(spriteName: String,
                                          parallax: CGFloat,
                                          bottomY: CGFloat,
                                          zPosition: CGFloat,
                                          levelWidth: CGFloat) -> SKNode {
        let layer = SKNode()
        layer.zPosition = zPosition
        let texture = SpriteLoader.texture(spriteName)
        let stripWidth = max(1, texture.size().width)
        let coverage = levelWidth * parallax + GameConfig.sceneSize.width * 2
        let count = Int(ceil(coverage / stripWidth)) + 1
        for i in 0..<count {
            let strip = SKSpriteNode(texture: texture)
            strip.anchorPoint = .zero
            strip.position = CGPoint(x: CGFloat(i) * stripWidth, y: bottomY)
            layer.addChild(strip)
        }
        return layer
    }
}
