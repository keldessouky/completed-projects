using ElLemby.Core;

namespace ElLemby.App;

/// <summary>شاشة البداية — mirrors the macOS title scene.</summary>
internal sealed class TitleScene : IScene
{
    private readonly ISceneHost _host;

    public TitleScene(ISceneHost host)
    {
        _host = host;
        Audio.Preload();
        Audio.StartMusic();
    }

    public void Update(double dt, double now) { }

    public void KeyPressed(Keys key, double now)
    {
        switch (key)
        {
            case Keys.Space or Keys.Enter:
                _host.State.ResetRun();
                _host.Switch(new GameScene(_host));
                break;
            case Keys.M:
                Audio.ToggleMute();
                break;
        }
    }

    public void KeyReleased(Keys key, double now) { }

    public void Render(Graphics g, double now)
    {
        g.Clear(Palette.Sky);

        // Backdrop: one alley strip + two tile rows of street.
        Bitmap near = Assets.Sprite("bg_near");
        g.DrawImage(near, 0, GameConfig.SceneHeight - 32 - near.Height);
        Bitmap ground = Assets.Sprite("tile_ground");
        Bitmap dirt = Assets.Sprite("tile_dirt");
        for (int col = 0; col <= GameConfig.SceneWidth / 16; col++)
        {
            g.DrawImage(ground, col * 16, GameConfig.SceneHeight - 32);
            g.DrawImage(dirt, col * 16, GameConfig.SceneHeight - 16);
        }

        // Characters, bobbing on their idle/wave frames — and a floating
        // heart between them, because El-Lemby is smitten.
        string lembyFrame = (int)(now / 0.45) % 2 == 0 ? "lemby_idle_0" : "lemby_idle_1";
        string nousaFrame = (int)(now / 0.5) % 2 == 0 ? "nousa_0" : "nousa_1";
        g.DrawImage(Assets.Sprite(lembyFrame), new Rectangle(240 - 90 - 24, 272 - 32 - 72, 48, 72));
        g.DrawImage(Assets.Sprite(nousaFrame), new Rectangle(240 + 90 - 24, 272 - 32 - 72, 48, 72));
        int beat = (int)(9 + 2.5 * Math.Sin(now * 4.2));
        int bob = (int)(3 * Math.Sin(now * 2.1));
        g.DrawImage(Assets.Sprite("heart"),
                    new Rectangle(240 - beat, 272 - 32 - 58 - bob - beat, beat * 2, beat * 2));

        Draw.TextCenter(g, L10n.GameTitle, Draw.Title, Palette.MaroonBrush, 240, 36);
        Draw.TextCenter(g, L10n.GameSubtitle, Draw.H2, Palette.InkBrush, 240, 92);

        if ((int)(now / 0.55) % 2 == 0)
        {
            Draw.TextCenter(g, L10n.PressStart, Draw.Hud, Palette.InkBrush, 240, 160);
        }
        Draw.TextCenter(g, L10n.ControlsHint, Draw.Body, Palette.InkBrush, 240, 182);
        if (_host.State.HighScore > 0)
        {
            Draw.TextCenter(g, $"{L10n.HighScoreLabel}: {L10n.Eastern(_host.State.HighScore)}",
                            Draw.Body, Palette.InkBrush, 240, 198);
        }
        Draw.TextCenter(g, L10n.FanDisclaimer, Draw.Tiny, Palette.InkBrush, 240, 216);
    }
}
