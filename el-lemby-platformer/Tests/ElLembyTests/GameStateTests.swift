import XCTest
@testable import ElLembyCore

final class GameStateTests: XCTestCase {
    func testCoinCollectionScores() {
        let state = GameState()
        state.collectCoin()
        state.collectCoin()
        XCTAssertEqual(state.money, 2)
        XCTAssertEqual(state.score, 2 * GameConfig.coinScore)
    }

    func testTimeBonus() {
        let state = GameState()
        let bonus = state.awardTimeBonus(secondsLeft: 30)
        XCTAssertEqual(bonus, 30 * GameConfig.timeBonusPerSecond)
        XCTAssertEqual(state.score, bonus)
        XCTAssertEqual(state.awardTimeBonus(secondsLeft: -5), 0)
    }

    func testResetRun() {
        let state = GameState()
        state.collectCoin()
        state.lives = 1
        state.isPowered = true
        state.resetRun()
        XCTAssertEqual(state.money, 0)
        XCTAssertEqual(state.score, 0)
        XCTAssertEqual(state.lives, GameConfig.startLives)
        XCTAssertFalse(state.isPowered)
    }
}

final class L10nTests: XCTestCase {
    func testEasternArabicNumerals() {
        XCTAssertEqual(L10n.eastern(0), "٠")
        XCTAssertEqual(L10n.eastern(240), "٢٤٠")
        XCTAssertEqual(L10n.eastern(1987), "١٩٨٧")
        XCTAssertEqual(L10n.count(3), "×٣")
    }
}
