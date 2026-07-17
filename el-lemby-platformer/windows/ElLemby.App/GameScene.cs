using ElLemby.Core;

namespace ElLemby.App;

/// <summary>
/// The playable stage: renders the shared level1.txt world and maps
/// simulation events to sounds, score, particles, and phase changes.
/// Side-scrolls left → right, exactly like the macOS build.
/// </summary>
internal sealed class GameScene : IScene
{
    private enum Phase
    {
        Playing,
        Paused,
        Dying,
        Won,
    }

    private struct Particle
    {
        public string[] Frames;
        public double X, Y, VelocityY;
        public double BornAt, Life, Delay;
        public double FrameTime;
    }

    private readonly ISceneHost _host;
    private readonly int _stage;
    private readonly World? _world;
    private readonly string? _loadError;
    private readonly List<Particle> _particles = new();

    private InputState _input = InputState.Empty;
    private Phase _phase = Phase.Playing;
    private double _phaseAt;
    private double _camX = GameConfig.SceneWidth / 2.0;
    private int _timeLeft = GameConfig.StageTimeSeconds;
    private double _clockAccumulator;
    private double _bornAt = -1;
    private int _pendingTimeBonus;
    private double _toastAt = double.NegativeInfinity;
    private string _toastText = "";

    public GameScene(ISceneHost host, int stage = 1)
    {
        _host = host;
        _stage = stage;
        string levelName = $"level{stage}";
        try
        {
            _world = new World(LevelParser.LoadFile(Assets.LevelPath(levelName)));
            _camX = Clamp(_world.PlayerSpawn.X);
        }
        catch (Exception e) when (e is LevelParseException or IOException)
        {
            _loadError = $"تعذّر تحميل المرحلة — {levelName}.txt";
        }
        Audio.Preload();
        Audio.StartMusic();
    }

    // ------------------------------------------------------------------
    // Input
    // ------------------------------------------------------------------

    public void KeyPressed(Keys key, double now)
    {
        switch (key)
        {
            case Keys.Space or Keys.Up or Keys.W:
                _input.JumpPressedAt = now;
                break;
            case Keys.P or Keys.Escape:
                TogglePause(now);
                break;
            case Keys.M:
                Audio.ToggleMute();
                break;
        }
    }

    public void KeyReleased(Keys key, double now) { }

    private void TogglePause(double now)
    {
        if (_phase == Phase.Playing)
        {
            _phase = Phase.Paused;
            Audio.PauseMusic();
        }
        else if (_phase == Phase.Paused)
        {
            _phase = Phase.Playing;
            Audio.ResumeMusic();
        }
    }

    // ------------------------------------------------------------------
    // Update
    // ------------------------------------------------------------------

    public void Update(double dt, double now)
    {
        if (_world is null)
        {
            return;
        }
        if (_bornAt < 0)
        {
            _bornAt = now;
            _phaseAt = now;
        }

        _particles.RemoveAll(p => now - p.BornAt - p.Delay > p.Life);

        switch (_phase)
        {
            case Phase.Paused:
                return;

            case Phase.Playing:
            {
                _input.MoveX = (_host.IsDown(Keys.Left) || _host.IsDown(Keys.A) ? -1 : 0)
                             + (_host.IsDown(Keys.Right) || _host.IsDown(Keys.D) ? 1 : 0);
                _input.JumpHeld = _host.IsDown(Keys.Space) || _host.IsDown(Keys.Up) || _host.IsDown(Keys.W);

                List<GameEvent> events = _world.Step(dt, ref _input, now);
                HandleEvents(events, now);

                TickClock(dt, now);
                if (_phase == Phase.Playing && _world.Player.Y < GameConfig.FallDeathY)
                {
                    StartDeath(now);
                }
                MoveCamera();
                break;
            }

            case Phase.Dying:
            {
                var idle = InputState.Empty;
                _ = _world.Step(dt, ref idle, now);
                if (now - _phaseAt > 1.5)
                {
                    AfterDeath(now);
                }
                break;
            }

            case Phase.Won:
            {
                var idle = InputState.Empty;
                _ = _world.Step(dt, ref idle, now, ambientOnly: true);
                MoveCamera();
                if (now - _phaseAt > 2.0)
                {
                    if (_stage < GameConfig.StageCount)
                    {
                        _host.Switch(new GameScene(_host, _stage + 1));
                    }
                    else
                    {
                        _host.Switch(new ResultScene(_host, ResultKind.StageClear, _pendingTimeBonus));
                    }
                }
                break;
            }
        }
    }

    private void MoveCamera()
    {
        double target = Clamp(_world!.Player.X);
        _camX += (target - _camX) * GameConfig.CameraLerp;
    }

    private double Clamp(double x)
    {
        double half = GameConfig.SceneWidth / 2.0;
        return Math.Min(Math.Max(x, half), Math.Max(half, _world!.WidthPoints - half));
    }

    private void TickClock(double dt, double now)
    {
        _clockAccumulator += dt;
        while (_clockAccumulator >= 1)
        {
            _clockAccumulator -= 1;
            _timeLeft -= 1;
            if (_timeLeft <= 0)
            {
                _timeLeft = 0;
                StartDeath(now);
                return;
            }
        }
    }

    private void HandleEvents(List<GameEvent> events, double now)
    {
        GameState state = _host.State;
        foreach (GameEvent e in events)
        {
            switch (e.Kind)
            {
                case GameEventKind.Jumped:
                    Audio.Play("jump");
                    break;

                case GameEventKind.CoinCollected:
                    state.CollectCoin();
                    Audio.Play("coin");
                    break;

                case GameEventKind.CratePoppedCoin:
                    state.CollectCoin();
                    Audio.Play("coin");
                    SpawnCoinPop(e.X, e.Y + 14, now);
                    break;

                case GameEventKind.CratePoppedSandwich:
                case GameEventKind.CrateBumpedSpent:
                    Audio.Play("bump");
                    break;

                case GameEventKind.PowerUpCollected:
                    state.IsPowered = true;
                    state.AddScore(GameConfig.PowerUpScore);
                    Audio.Play("powerup");
                    break;

                case GameEventKind.Stomped:
                    state.AddScore(GameConfig.StompScore);
                    Audio.Play("stomp");
                    break;

                case GameEventKind.PlayerHit:
                    OnPlayerHit(now);
                    break;

                case GameEventKind.CheckpointReached:
                    Audio.Play("checkpoint");
                    _toastAt = now;
                    _toastText = L10n.CheckpointToast;
                    break;

                case GameEventKind.ReachedGoal:
                    WinStage(now);
                    break;
            }
            if (_phase != Phase.Playing)
            {
                break;
            }
        }
    }

    private void OnPlayerHit(double now)
    {
        GameState state = _host.State;
        if (_world!.Player.IsDead || _world.Player.IsInvulnerable(now))
        {
            return;
        }
        if (state.IsPowered)
        {
            state.IsPowered = false;
            Audio.Play("hurt");
            _world.Player.InvulnerableUntil = now + GameConfig.HurtInvulnerabilityTime;
        }
        else
        {
            StartDeath(now);
        }
    }

    private void StartDeath(double now)
    {
        if (_phase != Phase.Playing)
        {
            return;
        }
        GameState state = _host.State;
        _phase = Phase.Dying;
        _phaseAt = now;
        state.Lives -= 1;
        state.IsPowered = false;
        _world!.KillPlayer();
        if (state.Lives <= 0)
        {
            Audio.StopMusic();
            Audio.Play("gameover");
        }
        else
        {
            Audio.Play("hurt");
        }
    }

    private void AfterDeath(double now)
    {
        GameState state = _host.State;
        if (state.Lives > 0)
        {
            _timeLeft = GameConfig.StageTimeSeconds;
            _clockAccumulator = 0;
            _world!.RespawnPlayer(now);
            _camX = Clamp(_world.Player.X);
            _phase = Phase.Playing;
            _phaseAt = now;
        }
        else
        {
            state.CommitHighScore();
            _host.Switch(new ResultScene(_host, ResultKind.GameOver));
        }
    }

    private void WinStage(double now)
    {
        if (_phase != Phase.Playing)
        {
            return;
        }
        _phase = Phase.Won;
        _phaseAt = now;
        _input = InputState.Empty;
        _world!.Player.Vx = 0;

        Audio.StopMusic();
        Audio.Play("win");
        _pendingTimeBonus = _host.State.AwardTimeBonus(_timeLeft);
        _host.State.CommitHighScore();

        for (int i = 0; i < 6; i++)
        {
            _particles.Add(new Particle
            {
                Frames = new[] { "heart" },
                X = _world.GoalX + ((i % 3) - 1) * 12 + i * 2,
                Y = _world.GoalY + 10,
                VelocityY = 29,
                BornAt = now,
                Delay = 0.15 * i,
                Life = 1.15,
                FrameTime = 1,
            });
        }
    }

    private void SpawnCoinPop(double x, double y, double now)
    {
        _particles.Add(new Particle
        {
            Frames = new[] { "coin_0", "coin_1", "coin_2", "coin_3" },
            X = x,
            Y = y,
            VelocityY = 110,
            BornAt = now,
            Life = 0.34,
            FrameTime = 0.06,
        });
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    public void Render(Graphics g, double now)
    {
        g.Clear(Palette.Sky);
        if (_world is null)
        {
            Draw.TextCenter(g, _loadError ?? "!", Draw.H2, Palette.InkBrush, 240, 128);
            return;
        }

        DrawParallax(g, Assets.Sprite("bg_far"), GameConfig.ParallaxFar, 44);
        DrawParallax(g, Assets.Sprite("bg_near"), GameConfig.ParallaxNear, 32);
        DrawTiles(g);
        DrawEntities(g, now);
        DrawParticles(g, now);
        DrawHud(g, now);
        DrawOverlays(g, now);
    }

    private double CamLeft => _camX - GameConfig.SceneWidth / 2.0;

    /// <summary>Screen rect of a sprite of size (w, h) centered at world point.</summary>
    private Rectangle WorldRect(double wx, double wy, int w, int h) =>
        new((int)Math.Round(wx - CamLeft - w / 2.0),
            (int)Math.Round(GameConfig.SceneHeight - (wy + h / 2.0)),
            w, h);

    private void DrawParallax(Graphics g, Bitmap strip, double parallax, int bottomWorldY)
    {
        int y = GameConfig.SceneHeight - bottomWorldY - strip.Height;
        double phase = ((-CamLeft * parallax) % strip.Width + strip.Width) % strip.Width - strip.Width;
        for (double x = phase; x < GameConfig.SceneWidth; x += strip.Width)
        {
            g.DrawImage(strip, (int)Math.Round(x), y);
        }
    }

    private void DrawTiles(Graphics g)
    {
        LevelData level = _world!.Level;
        int tile = (int)GameConfig.TileSize;
        int first = Math.Max(0, (int)(CamLeft / tile) - 1);
        int last = Math.Min(level.Columns - 1, first + GameConfig.SceneWidth / tile + 2);

        for (int col = first; col <= last; col++)
        {
            int screenX = (int)Math.Round(col * (double)tile - CamLeft);
            for (int row = 0; row < level.Rows; row++)
            {
                TileKind? kind = level.Tile(col, row);
                if (kind is not { } k)
                {
                    continue;
                }
                int screenY = GameConfig.SceneHeight - (level.Rows - row) * tile;
                string sprite = k.SpriteName();
                if (k.IsMystery() && _world.Crates.TryGetValue((col, row), out CrateSim? crate))
                {
                    if (crate.Spent)
                    {
                        sprite = "tile_crate_used";
                    }
                    if (crate.NudgeT > 0)
                    {
                        screenY -= (int)Math.Round(3 * (crate.NudgeT / 0.12));
                    }
                }
                g.DrawImage(Assets.Sprite(sprite), screenX, screenY);
            }
        }
    }

    private void DrawEntities(Graphics g, double now)
    {
        World w = _world!;

        int coinFrame = (int)(now / 0.12) % 4;
        foreach (CoinSim coin in w.Coins)
        {
            if (!coin.Collected)
            {
                g.DrawImage(Assets.Sprite($"coin_{coinFrame}"), WorldRect(coin.X, coin.Y, 12, 12));
            }
        }

        foreach (PowerUpSim power in w.PowerUps)
        {
            if (!power.Collected)
            {
                g.DrawImage(Assets.Sprite("sandwich"), WorldRect(power.X, power.Y, 14, 11));
            }
        }

        string nousa = (int)(now / 0.5) % 2 == 0 ? "nousa_0" : "nousa_1";
        g.DrawImage(Assets.Sprite(nousa), WorldRect(w.GoalX, w.GoalY, 16, 24));

        foreach (CheckpointSim checkpoint in w.Checkpoints)
        {
            string cart = checkpoint.Activated ? "checkpoint_active" : "checkpoint_idle";
            g.DrawImage(Assets.Sprite(cart), WorldRect(checkpoint.X, checkpoint.Y, 16, 24));
        }

        foreach (ThugSim thug in w.Thugs)
        {
            if (thug.Gone)
            {
                continue;
            }
            if (thug.Squashed)
            {
                double age = now - thug.SquashedAt;
                float alpha = age < 0.8 ? 1f : (float)Math.Max(0, 1 - (age - 0.8) / 0.3);
                Rectangle dest = WorldRect(thug.X, thug.Y - ThugSim.HalfH + 5, 16, 10);
                Draw.Alpha(g, Assets.Sprite("thug_squashed"), dest, alpha);
            }
            else
            {
                string frame = (int)(now / 0.22) % 2 == 0 ? "thug_walk_0" : "thug_walk_1";
                Bitmap bmp = thug.Direction > 0 ? Assets.Flipped(frame) : Assets.Sprite(frame);
                g.DrawImage(bmp, WorldRect(thug.X, thug.Y, 16, 24));
            }
        }

        DrawPlayer(g, now);
    }

    private void DrawPlayer(Graphics g, double now)
    {
        PlayerSim p = _world!.Player;

        // Invulnerability blink.
        if (!p.IsDead && p.IsInvulnerable(now) && (int)(now * 10) % 2 == 1)
        {
            return;
        }

        string frame;
        if (p.IsDead)
        {
            frame = "lemby_hurt_0";
        }
        else if (!p.Grounded)
        {
            frame = "lemby_jump_0";
        }
        else if (Math.Abs(p.Vx) > 8)
        {
            int[] cycle = { 0, 1, 2, 1 };
            frame = $"lemby_run_{cycle[(int)(now / 0.09) % 4]}";
        }
        else
        {
            frame = (int)(now / 0.45) % 2 == 0 ? "lemby_idle_0" : "lemby_idle_1";
        }

        Bitmap bmp = p.Facing < 0 ? Assets.Flipped(frame) : Assets.Sprite(frame);
        g.DrawImage(bmp, WorldRect(p.X, p.Y, 16, 24));
    }

    private void DrawParticles(Graphics g, double now)
    {
        foreach (Particle p in _particles)
        {
            double age = now - p.BornAt - p.Delay;
            if (age < 0)
            {
                continue;
            }
            double y = p.Y + p.VelocityY * age;
            string frame = p.Frames[(int)(age / p.FrameTime) % p.Frames.Length];
            Bitmap bmp = Assets.Sprite(frame);
            float alpha = (float)Math.Clamp(1.6 - age / p.Life * 1.6, 0, 1);
            Draw.Alpha(g, bmp, WorldRect(p.X, y, bmp.Width, bmp.Height), alpha);
        }
    }

    private void DrawHud(Graphics g, double now)
    {
        GameState state = _host.State;
        Draw.TextRight(g, $"{L10n.HudMoney} {L10n.Count(state.Money)}", Draw.Hud, Palette.InkBrush, 470, 5);
        Draw.TextCenter(g, $"{L10n.HudLives} {L10n.Count(state.Lives)}", Draw.Hud, Palette.InkBrush, 240, 5);
        Draw.TextLeft(g, $"{L10n.HudTime} {L10n.Eastern(_timeLeft)}", Draw.Hud, Palette.InkBrush, 10, 5);
        if (state.IsPowered)
        {
            Draw.TextRight(g, L10n.HudPowered, Draw.Hud, Palette.GoldBrush, 470, 21);
        }
    }

    private void DrawOverlays(Graphics g, double now)
    {
        // Stage banner for the first moments.
        double age = now - _bornAt;
        if (_bornAt >= 0 && age < 2.3)
        {
            float alpha = (float)Math.Clamp((2.3 - age) / 0.5, 0, 1);
            using var brush = new SolidBrush(Color.FromArgb((int)(alpha * 255), Palette.Ink));
            Draw.TextCenter(g, L10n.StageName(_stage), Draw.H2, brush, 240, 88);
        }

        // Checkpoint toast.
        double toastAge = now - _toastAt;
        if (toastAge >= 0 && toastAge < 1.6)
        {
            float alpha = (float)Math.Clamp((1.6 - toastAge) / 0.4, 0, 1);
            using var brush = new SolidBrush(Color.FromArgb((int)(alpha * 255), Palette.Gold));
            Draw.TextCenter(g, _toastText, Draw.Hud, brush, 240, 44);
        }

        if (_phase == Phase.Paused)
        {
            g.FillRectangle(Palette.OverlayBrush, 0, 0, GameConfig.SceneWidth, GameConfig.SceneHeight);
            Draw.TextCenter(g, L10n.Paused, Draw.H2, Palette.CreamBrush, 240, 124);
        }
    }
}
