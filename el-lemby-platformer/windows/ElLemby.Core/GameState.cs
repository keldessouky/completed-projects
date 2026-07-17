namespace ElLemby.Core;

/// <summary>
/// Run-wide state that survives across scenes (lives, money, score), plus
/// high-score persistence to a plain text file (the App points it at
/// %LocalAppData%; tests point it at a temp file).
/// </summary>
public sealed class GameState
{
    public int Money { get; private set; }
    public int Score { get; private set; }
    public int Lives { get; set; } = GameConfig.StartLives;
    public bool IsPowered { get; set; }

    private readonly string? _highScorePath;
    private int _highScore;

    public GameState(string? highScorePath = null)
    {
        _highScorePath = highScorePath;
        _highScore = ReadHighScore();
    }

    public int HighScore => _highScore;

    public void CollectCoin()
    {
        Money += 1;
        Score += GameConfig.CoinScore;
    }

    public void AddScore(int points) => Score += points;

    /// <summary>Converts remaining time into points; returns the bonus.</summary>
    public int AwardTimeBonus(int secondsLeft)
    {
        int bonus = Math.Max(0, secondsLeft) * GameConfig.TimeBonusPerSecond;
        Score += bonus;
        return bonus;
    }

    public void CommitHighScore()
    {
        if (Score <= _highScore)
        {
            return;
        }
        _highScore = Score;
        if (_highScorePath is null)
        {
            return;
        }
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_highScorePath)!);
            File.WriteAllText(_highScorePath, _highScore.ToString());
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    public void ResetRun()
    {
        Money = 0;
        Score = 0;
        Lives = GameConfig.StartLives;
        IsPowered = false;
    }

    private int ReadHighScore()
    {
        if (_highScorePath is null || !File.Exists(_highScorePath))
        {
            return 0;
        }
        try
        {
            return int.TryParse(File.ReadAllText(_highScorePath).Trim(), out int v) ? Math.Max(0, v) : 0;
        }
        catch (IOException) { return 0; }
        catch (UnauthorizedAccessException) { return 0; }
    }
}
