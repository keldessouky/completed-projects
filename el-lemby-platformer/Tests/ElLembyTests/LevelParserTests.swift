import XCTest
@testable import ElLembyCore

final class LevelParserTests: XCTestCase {
    func testParsesSimpleLevel() throws {
        let text = """
        // مثال صغير
        ....o....N
        .P..?..E..
        GGGGGGGGGG
        DDDDDDDDDD
        """
        let level = try LevelParser.parse(text)

        XCTAssertEqual(level.columns, 10)
        XCTAssertEqual(level.rows, 4)
        XCTAssertEqual(level.playerSpawn, .init(kind: .player, column: 1, row: 1))
        XCTAssertEqual(level.placements(of: .coin).count, 1)
        XCTAssertEqual(level.placements(of: .thug).count, 1)
        XCTAssertEqual(level.placements(of: .nousa).count, 1)
        XCTAssertEqual(level.tile(column: 0, row: 2), .ground)
        XCTAssertEqual(level.tile(column: 0, row: 3), .dirt)
        XCTAssertEqual(level.tile(column: 4, row: 1), .mysteryCoin)
        XCTAssertNil(level.tile(column: 0, row: 0))
        XCTAssertTrue(level.isSolid(column: 5, row: 2))
        XCTAssertFalse(level.isSolid(column: 5, row: 0))
        // out of bounds is air
        XCTAssertFalse(level.isSolid(column: -1, row: 2))
        XCTAssertFalse(level.isSolid(column: 99, row: 2))
    }

    func testShortRowsArePadded() throws {
        let text = """
        P.N
        GGGGGG
        """
        let level = try LevelParser.parse(text)
        XCTAssertEqual(level.columns, 6)
        XCTAssertNil(level.tile(column: 5, row: 0))
    }

    func testRejectsUnknownCharacters() {
        XCTAssertThrowsError(try LevelParser.parse("P.N\nGGZ")) { error in
            XCTAssertEqual(error as? LevelParseError,
                           .unknownCharacter("Z", line: 1, column: 2))
        }
    }

    func testRejectsMissingSpawn() {
        XCTAssertThrowsError(try LevelParser.parse("..N\nGGG")) { error in
            XCTAssertEqual(error as? LevelParseError, .missingPlayerSpawn)
        }
    }

    func testRejectsDuplicateSpawn() {
        XCTAssertThrowsError(try LevelParser.parse("PPN\nGGG")) { error in
            XCTAssertEqual(error as? LevelParseError, .duplicatePlayerSpawn)
        }
    }

    func testRejectsMissingGoal() {
        XCTAssertThrowsError(try LevelParser.parse("P..\nGGG")) { error in
            XCTAssertEqual(error as? LevelParseError, .missingGoal)
        }
    }

    func testRejectsEmptyInput() {
        XCTAssertThrowsError(try LevelParser.parse("\n\n")) { error in
            XCTAssertEqual(error as? LevelParseError, .empty)
        }
    }
}

/// The shipped stage must always load and stay playable.
final class Level1IntegrityTests: XCTestCase {
    func testLevel1LoadsAndIsWellFormed() throws {
        let level = try LevelParser.load(named: "level1")

        XCTAssertGreaterThanOrEqual(level.columns, 150, "stage 1 should be a real stage, not a stub")
        XCTAssertEqual(level.rows, 17, "one screen = 17 rows of 16px tiles")
        XCTAssertNotNil(level.playerSpawn)
        XCTAssertEqual(level.placements(of: .nousa).count, 1)
        XCTAssertGreaterThanOrEqual(level.placements(of: .thug).count, 4)
        XCTAssertGreaterThanOrEqual(level.placements(of: .coin).count, 20)

        // The spawn column must have ground under it.
        let spawn = try XCTUnwrap(level.playerSpawn)
        let hasFloor = (spawn.row..<level.rows).contains { level.isSolid(column: spawn.column, row: $0) }
        XCTAssertTrue(hasFloor, "player must not spawn over a pit")

        // Nousa too.
        let goal = try XCTUnwrap(level.placements(of: .nousa).first)
        let goalFloor = (goal.row..<level.rows).contains { level.isSolid(column: goal.column, row: $0) }
        XCTAssertTrue(goalFloor, "the goal must stand on solid ground")
    }
}
