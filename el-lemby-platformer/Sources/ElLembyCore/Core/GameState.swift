import Foundation

/// Run-wide state that survives across scenes (lives, money, score).
final class GameState {
    static let shared = GameState()

    private(set) var money = 0
    private(set) var score = 0
    var lives = GameConfig.startLives
    var isPowered = false

    private let highScoreKey = "com.keldessouky.ellemby.highscore"

    var highScore: Int {
        get { UserDefaults.standard.integer(forKey: highScoreKey) }
        set { UserDefaults.standard.set(newValue, forKey: highScoreKey) }
    }

    init() {}

    func collectCoin() {
        money += 1
        score += GameConfig.coinScore
    }

    func addScore(_ points: Int) {
        score += points
    }

    /// Called when a stage is cleared: converts remaining time into points
    /// and returns the awarded bonus.
    func awardTimeBonus(secondsLeft: Int) -> Int {
        let bonus = max(0, secondsLeft) * GameConfig.timeBonusPerSecond
        score += bonus
        return bonus
    }

    func commitHighScore() {
        if score > highScore {
            highScore = score
        }
    }

    func resetRun() {
        money = 0
        score = 0
        lives = GameConfig.startLives
        isPowered = false
    }
}
