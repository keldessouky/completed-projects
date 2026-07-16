namespace ElLemby.Core;

/// <summary>Events the simulation emits for one step; the app maps them to
/// sounds, particles, score, and phase changes.</summary>
public enum GameEventKind
{
    Jumped,
    CoinCollected,
    CratePoppedCoin,
    CratePoppedSandwich,
    CrateBumpedSpent,
    PowerUpCollected,
    Stomped,
    PlayerHit,       // touched a thug while vulnerable (app decides the cost)
    ReachedGoal,
}

public readonly record struct GameEvent(GameEventKind Kind, double X, double Y);

public sealed class PlayerSim
{
    public const double HalfW = 6;    // 12×22 body, like the macOS build
    public const double HalfH = 11;

    public double X, Y, Vx, Vy;
    public double Facing = 1;
    public bool Grounded;
    public double LastGroundedAt = double.NegativeInfinity;
    public double InvulnerableUntil = double.NegativeInfinity;
    public bool IsDead;

    public bool IsInvulnerable(double now) => now < InvulnerableUntil;
    public double Bottom => Y - HalfH;
}

public sealed class ThugSim
{
    public const double HalfW = 6.5;  // 13×22 body
    public const double HalfH = 11;

    public double X, Y, Vx, Vy;
    public double Direction = -1;
    public bool Squashed;
    public double SquashedAt;
    public bool Gone;                  // squashed + faded: stop simulating/drawing
    internal bool HasCommandedMove;
}

public sealed class CoinSim
{
    public const double Half = 5;
    public double X, Y;
    public bool Collected;
}

public sealed class CrateSim
{
    public int Column, Row;
    public TileKind Kind;
    public bool Spent;
    public double NudgeT;              // >0 while playing the bump nudge
}

public sealed class PowerUpSim
{
    public const double HalfW = 7, HalfH = 5.5;
    public const double EmergeDuration = 0.35;
    public const double EmergeRise = 14;

    public double X, StartY;
    public double EmergeT;
    public bool Collected;

    public bool Emerged => EmergeT >= EmergeDuration;
    public double Y => StartY + EmergeRise * Math.Min(1.0, EmergeT / EmergeDuration);
}

/// <summary>
/// The whole gameplay simulation — platform-neutral and deterministic, so it
/// is unit-testable off-Windows. Coordinates are points with Y up (matching
/// the macOS build); the renderer flips to screen space.
/// </summary>
public sealed class World
{
    public readonly LevelData Level;
    public readonly PlayerSim Player = new();
    public readonly List<ThugSim> Thugs = new();
    public readonly List<CoinSim> Coins = new();
    public readonly List<PowerUpSim> PowerUps = new();
    public readonly Dictionary<(int Column, int Row), CrateSim> Crates = new();

    public double GoalX, GoalY;
    public (double X, double Y) PlayerSpawn;
    public bool GoalReached;

    public double WidthPoints => Level.Columns * GameConfig.TileSize;

    private const double Eps = 0.01;
    private readonly List<(int Column, int Row)> _headHits = new();

    public World(LevelData level)
    {
        Level = level;
        double tile = GameConfig.TileSize;

        for (int row = 0; row < level.Rows; row++)
        {
            for (int col = 0; col < level.Columns; col++)
            {
                TileKind? kind = level.Tile(col, row);
                if (kind is { } k && k.IsMystery())
                {
                    Crates[(col, row)] = new CrateSim { Column = col, Row = row, Kind = k };
                }
            }
        }

        foreach (Placement p in level.Entities)
        {
            double centerX = p.Column * tile + tile / 2;
            double cellBottom = (level.Rows - 1 - p.Row) * tile;
            switch (p.Kind)
            {
                case EntityKind.Player:
                    PlayerSpawn = (centerX, cellBottom + PlayerSim.HalfH + 1);
                    break;
                case EntityKind.Thug:
                    Thugs.Add(new ThugSim { X = centerX, Y = cellBottom + ThugSim.HalfH + 1 });
                    break;
                case EntityKind.Coin:
                    Coins.Add(new CoinSim { X = centerX, Y = cellBottom + tile / 2 });
                    break;
                case EntityKind.Nousa:
                    GoalX = centerX;
                    GoalY = cellBottom + 12;
                    break;
            }
        }

        Player.X = PlayerSpawn.X;
        Player.Y = PlayerSpawn.Y;
    }

    // ------------------------------------------------------------------
    // Stepping
    // ------------------------------------------------------------------

    /// <summary>
    /// Advances the world by dt. With <paramref name="ambientOnly"/> the
    /// player still moves and collides (used during the win freeze so he
    /// lands), but enemies and interactions stop.
    /// </summary>
    public List<GameEvent> Step(double dt, ref InputState input, double now, bool ambientOnly = false)
    {
        var events = new List<GameEvent>();

        if (Player.IsDead)
        {
            // Mario-style death: fall through the world, no collision.
            Player.Vy = Math.Max(Player.Vy + GameConfig.GravityPointsPerSecond * dt,
                                 -GameConfig.MaxFallSpeed);
            Player.Y += Player.Vy * dt;
            return events;
        }

        StepPlayer(dt, ref input, now, events);

        foreach (CrateSim crate in Crates.Values)
        {
            if (crate.NudgeT > 0)
            {
                crate.NudgeT = Math.Max(0, crate.NudgeT - dt);
            }
        }

        if (ambientOnly)
        {
            return events;
        }

        foreach (ThugSim thug in Thugs)
        {
            StepThug(thug, dt, now);
        }

        foreach (PowerUpSim p in PowerUps)
        {
            if (!p.Collected && !p.Emerged)
            {
                p.EmergeT += dt;
            }
        }

        ResolveInteractions(now, events);
        return events;
    }

    private void StepPlayer(double dt, ref InputState input, double now, List<GameEvent> events)
    {
        PlayerSim p = Player;

        p.Grounded = ProbeGround(p.X, p.Y, PlayerSim.HalfW - 1, PlayerSim.HalfH);
        if (p.Grounded)
        {
            p.LastGroundedAt = now;
        }

        // Horizontal: accelerate toward input, brake with friction.
        if (input.MoveX != 0)
        {
            double accel = p.Grounded ? GameConfig.RunAcceleration : GameConfig.AirAcceleration;
            p.Vx += input.MoveX * accel * dt;
            p.Vx = Math.Clamp(p.Vx, -GameConfig.MaxRunSpeed, GameConfig.MaxRunSpeed);
            p.Facing = input.MoveX;
        }
        else if (p.Grounded)
        {
            double drop = GameConfig.GroundFriction * dt;
            p.Vx = Math.Abs(p.Vx) <= drop ? 0 : p.Vx - drop * Math.Sign(p.Vx);
        }

        // Gravity.
        p.Vy = Math.Max(p.Vy + GameConfig.GravityPointsPerSecond * dt, -GameConfig.MaxFallSpeed);

        // Buffered + coyote jump.
        bool buffered = now - input.JumpPressedAt <= GameConfig.JumpBufferTime;
        bool coyote = now - p.LastGroundedAt <= GameConfig.CoyoteTime;
        if (buffered && coyote && p.Vy <= 1)
        {
            p.Vy = GameConfig.JumpSpeed;
            p.LastGroundedAt = double.NegativeInfinity;
            input.JumpPressedAt = double.NegativeInfinity;
            p.Grounded = false;
            events.Add(new GameEvent(GameEventKind.Jumped, p.X, p.Y));
        }

        // Variable jump height.
        if (!input.JumpHeld && p.Vy > GameConfig.JumpCutSpeed)
        {
            p.Vy = GameConfig.JumpCutSpeed;
        }

        // Integrate and resolve, axis by axis.
        double x = p.X, y = p.Y, vx = p.Vx, vy = p.Vy;
        MoveAxisX(ref x, y, ref vx, PlayerSim.HalfW, PlayerSim.HalfH, dt, out _);

        _headHits.Clear();
        MoveAxisY(x, ref y, ref vy, PlayerSim.HalfW, PlayerSim.HalfH, dt, _headHits);

        p.X = x;
        p.Y = y;
        p.Vx = vx;
        p.Vy = vy;

        foreach ((int col, int row) in _headHits)
        {
            HandleHeadHit(col, row, events);
        }
    }

    private void HandleHeadHit(int column, int row, List<GameEvent> events)
    {
        if (!Crates.TryGetValue((column, row), out CrateSim? crate))
        {
            return;
        }
        double tile = GameConfig.TileSize;
        double cx = column * tile + tile / 2;
        double cy = (Level.Rows - 1 - row) * tile + tile / 2;
        crate.NudgeT = 0.12;
        if (crate.Spent)
        {
            events.Add(new GameEvent(GameEventKind.CrateBumpedSpent, cx, cy));
            return;
        }
        crate.Spent = true;
        if (crate.Kind == TileKind.MysteryCoin)
        {
            events.Add(new GameEvent(GameEventKind.CratePoppedCoin, cx, cy));
        }
        else
        {
            PowerUps.Add(new PowerUpSim { X = cx, StartY = cy + 2 });
            events.Add(new GameEvent(GameEventKind.CratePoppedSandwich, cx, cy));
        }
    }

    private void StepThug(ThugSim thug, double dt, double now)
    {
        if (thug.Gone)
        {
            return;
        }
        if (thug.Squashed)
        {
            if (now - thug.SquashedAt > 1.1)
            {
                thug.Gone = true;
            }
            return;
        }

        bool standing = Math.Abs(thug.Vy) < 5;
        if (standing)
        {
            // Turn before walking off a ledge.
            double probeX = thug.X + thug.Direction * (ThugSim.HalfW + 3);
            double probeY = thug.Y - ThugSim.HalfH - 4;
            if (!IsSolidAtPoint(probeX, probeY))
            {
                thug.Direction = -thug.Direction;
            }
        }

        thug.Vx = thug.Direction * GameConfig.ThugSpeed;
        thug.Vy = Math.Max(thug.Vy + GameConfig.GravityPointsPerSecond * dt, -GameConfig.MaxFallSpeed);

        double x = thug.X, y = thug.Y, vx = thug.Vx, vy = thug.Vy;
        MoveAxisX(ref x, y, ref vx, ThugSim.HalfW, ThugSim.HalfH, dt, out bool hitWall);
        MoveAxisY(x, ref y, ref vy, ThugSim.HalfW, ThugSim.HalfH, dt, headHits: null);
        thug.X = x;
        thug.Y = y;
        thug.Vx = vx;
        thug.Vy = vy;

        if (hitWall && thug.HasCommandedMove)
        {
            thug.Direction = -thug.Direction;
        }
        thug.HasCommandedMove = true;
    }

    private void ResolveInteractions(double now, List<GameEvent> events)
    {
        PlayerSim p = Player;
        double pLeft = p.X - PlayerSim.HalfW, pRight = p.X + PlayerSim.HalfW;
        double pBottom = p.Y - PlayerSim.HalfH, pTop = p.Y + PlayerSim.HalfH;

        bool Overlaps(double cx, double cy, double halfW, double halfH) =>
            pRight > cx - halfW && pLeft < cx + halfW &&
            pTop > cy - halfH && pBottom < cy + halfH;

        foreach (CoinSim coin in Coins)
        {
            if (!coin.Collected && Overlaps(coin.X, coin.Y, CoinSim.Half, CoinSim.Half))
            {
                coin.Collected = true;
                events.Add(new GameEvent(GameEventKind.CoinCollected, coin.X, coin.Y));
            }
        }

        foreach (PowerUpSim power in PowerUps)
        {
            if (!power.Collected && power.Emerged &&
                Overlaps(power.X, power.Y, PowerUpSim.HalfW, PowerUpSim.HalfH))
            {
                power.Collected = true;
                events.Add(new GameEvent(GameEventKind.PowerUpCollected, power.X, power.Y));
            }
        }

        foreach (ThugSim thug in Thugs)
        {
            if (thug.Squashed || thug.Gone)
            {
                continue;
            }
            if (!Overlaps(thug.X, thug.Y, ThugSim.HalfW, ThugSim.HalfH))
            {
                continue;
            }
            if (p.Vy <= GameConfig.StompVelocityThreshold && p.Bottom > thug.Y)
            {
                thug.Squashed = true;
                thug.SquashedAt = now;
                p.Vy = GameConfig.StompBounceSpeed;
                events.Add(new GameEvent(GameEventKind.Stomped, thug.X, thug.Y));
            }
            else if (!p.IsInvulnerable(now))
            {
                events.Add(new GameEvent(GameEventKind.PlayerHit, thug.X, thug.Y));
            }
        }

        if (!GoalReached && Overlaps(GoalX, GoalY, 8, 12))
        {
            GoalReached = true;
            events.Add(new GameEvent(GameEventKind.ReachedGoal, GoalX, GoalY));
        }
    }

    // ------------------------------------------------------------------
    // Death / respawn hooks for the scene
    // ------------------------------------------------------------------

    public void KillPlayer()
    {
        Player.IsDead = true;
        Player.Vx = 0;
        Player.Vy = 330;   // the classic hop before the fall
    }

    public void RespawnPlayer(double now)
    {
        Player.IsDead = false;
        Player.X = PlayerSpawn.X;
        Player.Y = PlayerSpawn.Y;
        Player.Vx = 0;
        Player.Vy = 0;
        Player.Facing = 1;
        Player.InvulnerableUntil = now + GameConfig.HurtInvulnerabilityTime;
    }

    // ------------------------------------------------------------------
    // Tile collision
    // ------------------------------------------------------------------

    private bool IsSolidCell(int column, int rowFromBottom)
    {
        int row = Level.Rows - 1 - rowFromBottom;
        return Level.IsSolid(column, row);
    }

    public bool IsSolidAtPoint(double x, double y)
    {
        if (x < 0 || y < 0)
        {
            return false;
        }
        double tile = GameConfig.TileSize;
        return IsSolidCell((int)Math.Floor(x / tile), (int)Math.Floor(y / tile));
    }

    private bool ProbeGround(double x, double y, double halfW, double halfH)
    {
        double below = y - halfH - 1;
        return IsSolidAtPoint(x - halfW, below) || IsSolidAtPoint(x + halfW, below);
    }

    private (int C0, int C1, int R0, int R1) OverlappedCells(double x, double y, double halfW, double halfH)
    {
        double tile = GameConfig.TileSize;
        int c0 = (int)Math.Floor((x - halfW) / tile);
        int c1 = (int)Math.Floor((x + halfW - Eps) / tile);
        int r0 = (int)Math.Floor((y - halfH) / tile);          // rows from bottom
        int r1 = (int)Math.Floor((y + halfH - Eps) / tile);
        return (c0, c1, r0, r1);
    }

    private void MoveAxisX(ref double x, double y, ref double vx,
                           double halfW, double halfH, double dt, out bool hitWall)
    {
        hitWall = false;
        x += vx * dt;

        // Stage bounds act as invisible walls (parity with macOS).
        if (x < halfW)
        {
            x = halfW;
            vx = 0;
            hitWall = true;
        }
        else if (x > WidthPoints - halfW)
        {
            x = WidthPoints - halfW;
            vx = 0;
            hitWall = true;
        }

        if (vx == 0)
        {
            return;
        }

        var (c0, c1, r0, r1) = OverlappedCells(x, y, halfW, halfH);
        double tile = GameConfig.TileSize;
        for (int c = c0; c <= c1; c++)
        {
            for (int r = r0; r <= r1; r++)
            {
                if (r < 0 || !IsSolidCell(c, r))
                {
                    continue;
                }
                if (vx > 0)
                {
                    x = c * tile - halfW - Eps;
                }
                else
                {
                    x = (c + 1) * tile + halfW + Eps;
                }
                vx = 0;
                hitWall = true;
                return;
            }
        }
    }

    private void MoveAxisY(double x, ref double y, ref double vy,
                           double halfW, double halfH, double dt,
                           List<(int Column, int Row)>? headHits)
    {
        y += vy * dt;
        if (vy == 0)
        {
            return;
        }

        var (c0, c1, r0, r1) = OverlappedCells(x, y, halfW, halfH);
        double tile = GameConfig.TileSize;
        bool hit = false;

        if (vy < 0)
        {
            for (int c = c0; c <= c1 && !hit; c++)
            {
                if (r0 >= 0 && IsSolidCell(c, r0))
                {
                    y = (r0 + 1) * tile + halfH + Eps;
                    hit = true;
                }
            }
        }
        else
        {
            for (int c = c0; c <= c1; c++)
            {
                if (r1 >= 0 && IsSolidCell(c, r1))
                {
                    if (!hit)
                    {
                        y = r1 * tile - halfH - Eps;
                        hit = true;
                    }
                    headHits?.Add((c, Level.Rows - 1 - r1));
                }
            }
        }

        if (hit)
        {
            vy = 0;
        }
    }
}
