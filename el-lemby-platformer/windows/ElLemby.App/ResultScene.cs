using ElLemby.Core;

namespace ElLemby.App;

internal enum ResultKind
{
    StageClear,
    GameOver,
}

/// <summary>Shared end screen for «مبروك» and «انتهت اللعبة».</summary>
internal sealed class ResultScene : IScene
{
    private readonly ISceneHost _host;
    private readonly ResultKind _kind;
    private readonly int _timeBonus;

    public ResultScene(ISceneHost host, ResultKind kind, int timeBonus = 0)
    {
        _host = host;
        _kind = kind;
        _timeBonus = timeBonus;
    }

    public void Update(double dt, double now) { }

    public void KeyPressed(Keys key, double now)
    {
        switch (key)
        {
            case Keys.Space:
                _host.State.ResetRun();
                _host.Switch(new GameScene(_host));
                break;
            case Keys.Enter or Keys.Escape:
                _host.Switch(new TitleScene(_host));
                break;
            case Keys.M:
                Audio.ToggleMute();
                break;
        }
    }

    public void KeyReleased(Keys key, double now) { }

    public void Render(Graphics g, double now)
    {
        g.Clear(Palette.Night);
        GameState state = _host.State;

        var stats = new List<string>();
        if (_kind == ResultKind.StageClear)
        {
            Draw.TextCenter(g, L10n.StageClear, Draw.H1, Palette.GoldBrush, 240, 44);
            Draw.TextCenter(g, L10n.StageClearSub, Draw.Body, Palette.CreamBrush, 240, 78);
            stats.Add($"{L10n.TimeBonusLabel}: {L10n.Eastern(_timeBonus)}");

            // The happy couple, with a pulsing heart.
            g.DrawImage(Assets.Sprite("lemby_idle_0"), new Rectangle(240 - 60, 112, 40, 60));
            g.DrawImage(Assets.Sprite("nousa_0"), new Rectangle(240 + 20, 112, 40, 60));
            int beat = (int)(6 + 4 * Math.Abs(Math.Sin(now * 3.5)));
            g.DrawImage(Assets.Sprite("heart"),
                        new Rectangle(240 - beat, 100 - beat, beat * 2, beat * 2));
        }
        else
        {
            Draw.TextCenter(g, L10n.GameOver, Draw.H1, Palette.MaroonBrush, 240, 44);
            Draw.TextCenter(g, L10n.GameOverQuote, Draw.Body, Palette.CreamBrush, 240, 78);
            g.DrawImage(Assets.Sprite("lemby_hurt_0"), new Rectangle(240 - 20, 112, 40, 60));
        }

        stats.Add($"{L10n.MoneyLabel}: {L10n.Eastern(state.Money)}");
        stats.Add($"{L10n.ScoreLabel}: {L10n.Eastern(state.Score)}");
        stats.Add($"{L10n.HighScoreLabel}: {L10n.Eastern(state.HighScore)}");

        for (int i = 0; i < stats.Count; i++)
        {
            Draw.TextCenter(g, stats[i], Draw.Body, Palette.CreamBrush, 240, 184 + i * 17);
        }

        if ((int)(now / 0.6) % 2 == 0)
        {
            Draw.TextCenter(g, L10n.RetryHint, Draw.Tiny, Palette.CreamBrush, 240, 250);
        }
    }
}
