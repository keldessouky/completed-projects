import Foundation

/// The ASCII level format. One character per 16×16 tile, top row first.
///
///     .   empty air
///     G   ground (cobblestone surface)
///     D   dirt fill (below ground)
///     B   brick block
///     X   wooden crate (solid, inert)
///     =   sandstone block (stairs etc.)
///     ?   mystery crate → coin
///     F   mystery crate → foul-sandwich power-up (فول)
///     o   coin
///     P   player spawn (exactly one)
///     E   thug enemy (بلطجي)
///     N   Nousa — the stage goal (at least one)
///     C   checkpoint (عربية الفول)
///
/// Lines starting with `//` are comments. Short rows are padded with air on
/// the right, so ragged files are fine.
enum TileKind: Character, CaseIterable {
    case ground = "G"
    case dirt = "D"
    case brick = "B"
    case crate = "X"
    case stone = "="
    case mysteryCoin = "?"
    case mysterySandwich = "F"

    /// Every tile blocks movement; mystery crates are additionally
    /// interactive and get their own physics bodies.
    var isMystery: Bool {
        self == .mysteryCoin || self == .mysterySandwich
    }

    var spriteName: String {
        switch self {
        case .ground: return "tile_ground"
        case .dirt: return "tile_dirt"
        case .brick: return "tile_brick"
        case .crate: return "tile_crate"
        case .stone: return "tile_stone"
        case .mysteryCoin, .mysterySandwich: return "tile_mystery"
        }
    }
}

enum EntityKind: Character, CaseIterable {
    case player = "P"
    case thug = "E"
    case coin = "o"
    case nousa = "N"
    case checkpoint = "C"
}

struct LevelData: Equatable {
    struct Placement: Equatable {
        let kind: EntityKind
        let column: Int
        let row: Int    // 0 = top row
    }

    let columns: Int
    let rows: Int
    let tiles: [[TileKind?]]    // [row][column]
    let entities: [Placement]

    func tile(column: Int, row: Int) -> TileKind? {
        guard row >= 0, row < rows, column >= 0, column < columns else { return nil }
        return tiles[row][column]
    }

    func isSolid(column: Int, row: Int) -> Bool {
        tile(column: column, row: row) != nil
    }

    var playerSpawn: Placement? {
        entities.first { $0.kind == .player }
    }

    func placements(of kind: EntityKind) -> [Placement] {
        entities.filter { $0.kind == kind }
    }
}

enum LevelParseError: Error, Equatable {
    case empty
    case unknownCharacter(Character, line: Int, column: Int)
    case missingPlayerSpawn
    case duplicatePlayerSpawn
    case missingGoal
}

enum LevelParser {
    static func parse(_ text: String) throws -> LevelData {
        var lines = text.components(separatedBy: .newlines)
            .filter { !$0.hasPrefix("//") }
        while let first = lines.first, first.trimmingCharacters(in: .whitespaces).isEmpty {
            lines.removeFirst()
        }
        while let last = lines.last, last.trimmingCharacters(in: .whitespaces).isEmpty {
            lines.removeLast()
        }
        guard !lines.isEmpty else { throw LevelParseError.empty }

        let columns = lines.map { $0.count }.max() ?? 0
        guard columns > 0 else { throw LevelParseError.empty }

        var tiles: [[TileKind?]] = []
        var entities: [LevelData.Placement] = []

        for (rowIndex, line) in lines.enumerated() {
            var row: [TileKind?] = Array(repeating: nil, count: columns)
            for (colIndex, ch) in line.enumerated() {
                if ch == "." || ch == " " {
                    continue
                }
                if let tile = TileKind(rawValue: ch) {
                    row[colIndex] = tile
                } else if let entity = EntityKind(rawValue: ch) {
                    entities.append(.init(kind: entity, column: colIndex, row: rowIndex))
                } else {
                    throw LevelParseError.unknownCharacter(ch, line: rowIndex, column: colIndex)
                }
            }
            tiles.append(row)
        }

        let spawns = entities.filter { $0.kind == .player }
        guard !spawns.isEmpty else { throw LevelParseError.missingPlayerSpawn }
        guard spawns.count == 1 else { throw LevelParseError.duplicatePlayerSpawn }
        guard entities.contains(where: { $0.kind == .nousa }) else {
            throw LevelParseError.missingGoal
        }

        return LevelData(columns: columns, rows: lines.count, tiles: tiles, entities: entities)
    }

    /// Loads a level from the package resources (Resources/levels/<name>.txt).
    static func load(named name: String) throws -> LevelData {
        guard let url = Bundle.module.url(forResource: name,
                                          withExtension: "txt",
                                          subdirectory: "Resources/levels") else {
            throw LevelParseError.empty
        }
        let text = try String(contentsOf: url, encoding: .utf8)
        return try parse(text)
    }
}
