using ElLemby.Core;

namespace ElLemby.Tests;

/// <summary>
/// Dependency-free test runner (no xunit/NUnit — the project has zero
/// external packages on every platform). Exit code 0 = all green.
/// Run:  dotnet run --project windows/ElLemby.Tests
/// </summary>
internal static class Program
{
    private static int _passed;
    private static readonly List<string> _failures = new();

    private static void Check(bool condition, string name)
    {
        if (condition)
        {
            _passed++;
        }
        else
        {
            _failures.Add(name);
            Console.WriteLine($"FAIL  {name}");
        }
    }

    private static void CheckEqual<T>(T actual, T expected, string name)
        where T : IEquatable<T>
    {
        if (actual.Equals(expected))
        {
            _passed++;
        }
        else
        {
            _failures.Add(name);
            Console.WriteLine($"FAIL  {name}: expected {expected}, got {actual}");
        }
    }

    private static void CheckThrows(LevelParseErrorKind kind, Func<object> f, string name)
    {
        try
        {
            f();
            _failures.Add(name);
            Console.WriteLine($"FAIL  {name}: no exception");
        }
        catch (LevelParseException e) when (e.Kind == kind)
        {
            _passed++;
        }
        catch (Exception e)
        {
            _failures.Add(name);
            Console.WriteLine($"FAIL  {name}: wrong exception {e}");
        }
    }

    private static int Main()
    {
        ParserTests();
        StateTests();
        L10nTests();
        SimTests();
        for (int stage = 1; stage <= GameConfig.StageCount; stage++)
        {
            StageIntegrityTests(stage);
        }

        Console.WriteLine($"\n{_passed} passed, {_failures.Count} failed");
        return _failures.Count == 0 ? 0 : 1;
    }

    // ------------------------------------------------------------------

    private static void ParserTests()
    {
        var level = LevelParser.Parse("""
            // مثال صغير
            ....o....N
            .P..?..E..
            GGGGGGGGGG
            DDDDDDDDDD
            """);
        CheckEqual(level.Columns, 10, "parser: columns");
        CheckEqual(level.Rows, 4, "parser: rows");
        Check(level.PlayerSpawn == new Placement(EntityKind.Player, 1, 1), "parser: spawn");
        CheckEqual(level.Placements(EntityKind.Coin).Count(), 1, "parser: coins");
        CheckEqual(level.Placements(EntityKind.Thug).Count(), 1, "parser: thugs");
        Check(level.Tile(0, 2) == TileKind.Ground, "parser: ground tile");
        Check(level.Tile(4, 1) == TileKind.MysteryCoin, "parser: mystery tile");
        Check(level.Tile(0, 0) is null, "parser: air");
        Check(level.IsSolid(5, 2), "parser: solid");
        Check(!level.IsSolid(-1, 2) && !level.IsSolid(99, 2), "parser: out of bounds is air");

        var padded = LevelParser.Parse("P.N\nGGGGGG");
        CheckEqual(padded.Columns, 6, "parser: short rows padded");
        Check(padded.Tile(5, 0) is null, "parser: padding is air");

        var withCheckpoint = LevelParser.Parse("P.C.N\nGGGGG");
        CheckEqual(withCheckpoint.Placements(EntityKind.Checkpoint).Count(), 1, "parser: checkpoint entity");

        CheckThrows(LevelParseErrorKind.UnknownCharacter, () => LevelParser.Parse("P.N\nGGZ"), "parser: rejects unknown char");
        CheckThrows(LevelParseErrorKind.MissingPlayerSpawn, () => LevelParser.Parse("..N\nGGG"), "parser: rejects missing spawn");
        CheckThrows(LevelParseErrorKind.DuplicatePlayerSpawn, () => LevelParser.Parse("PPN\nGGG"), "parser: rejects duplicate spawn");
        CheckThrows(LevelParseErrorKind.MissingGoal, () => LevelParser.Parse("P..\nGGG"), "parser: rejects missing goal");
        CheckThrows(LevelParseErrorKind.Empty, () => LevelParser.Parse("\n\n"), "parser: rejects empty");
    }

    private static void StateTests()
    {
        var state = new GameState();
        state.CollectCoin();
        state.CollectCoin();
        CheckEqual(state.Money, 2, "state: money");
        CheckEqual(state.Score, 2 * GameConfig.CoinScore, "state: coin score");
        CheckEqual(state.AwardTimeBonus(30), 30 * GameConfig.TimeBonusPerSecond, "state: time bonus");
        CheckEqual(state.AwardTimeBonus(-5), 0, "state: negative time bonus clamps");

        state.Lives = 1;
        state.IsPowered = true;
        state.ResetRun();
        Check(state.Money == 0 && state.Score == 0 && state.Lives == GameConfig.StartLives && !state.IsPowered,
              "state: reset run");

        string path = Path.Combine(Path.GetTempPath(), $"ellemby-test-{Guid.NewGuid():N}", "hs.txt");
        var persisted = new GameState(path);
        persisted.AddScore(1234);
        persisted.CommitHighScore();
        CheckEqual(new GameState(path).HighScore, 1234, "state: high score persists");
        try { Directory.Delete(Path.GetDirectoryName(path)!, recursive: true); } catch (IOException) { }
    }

    private static void L10nTests()
    {
        CheckEqual(L10n.Eastern(0), "٠", "l10n: zero");
        CheckEqual(L10n.Eastern(240), "٢٤٠", "l10n: 240");
        CheckEqual(L10n.Eastern(1987), "١٩٨٧", "l10n: 1987");
        CheckEqual(L10n.Count(3), "×٣", "l10n: count");
    }

    // ------------------------------------------------------------------

    private static World MakeWorld(string map) => new(LevelParser.Parse(map));

    /// <summary>Steps the world at 60Hz for the given duration.</summary>
    private static double Run(World world, double seconds, ref InputState input, double startNow = 0,
                              Action<World, List<GameEvent>>? onEvents = null)
    {
        const double dt = 1.0 / 60.0;
        double now = startNow;
        int steps = (int)Math.Ceiling(seconds / dt);
        for (int i = 0; i < steps; i++)
        {
            now += dt;
            var events = world.Step(dt, ref input, now);
            onEvents?.Invoke(world, events);
        }
        return now;
    }

    private static void SimTests()
    {
        // A flat runway: player at col 2, goal far right.
        const string flat = """
            ..............................
            ..............................
            ..............................
            ..............................
            ..P..........................N
            GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
            DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
            """;

        // Lands on the ground and stays there.
        {
            var w = MakeWorld(flat);
            var input = InputState.Empty;
            Run(w, 0.5, ref input);
            double surface = 2 * GameConfig.TileSize;   // two solid rows
            Check(Math.Abs(w.Player.Bottom - surface) < 0.5, "sim: player rests on ground");
            Check(w.Player.Grounded, "sim: grounded flag");
        }

        // Accelerates to max speed, never beyond.
        {
            var w = MakeWorld(flat);
            var input = InputState.Empty;
            input.MoveX = 1;
            Run(w, 1.0, ref input);
            Check(Math.Abs(w.Player.Vx - GameConfig.MaxRunSpeed) < 1, "sim: reaches max run speed");
        }

        // Jump apex is ~4.3 tiles — high enough for 4-tile ledges, not 6.
        {
            var w = MakeWorld(flat);
            var input = InputState.Empty;
            Run(w, 0.3, ref input);                     // settle
            input.JumpHeld = true;
            input.JumpPressedAt = 0.3;
            double apex = 0;
            Run(w, 1.0, ref input, 0.3, (world, _) => apex = Math.Max(apex, world.Player.Bottom));
            double tiles = (apex - 2 * GameConfig.TileSize) / GameConfig.TileSize;
            Check(tiles > 3.9 && tiles < 4.8, $"sim: jump apex ≈4.3 tiles (got {tiles:F2})");
        }

        // Variable jump: a tapped jump is much shorter.
        {
            var w = MakeWorld(flat);
            var input = InputState.Empty;
            Run(w, 0.3, ref input);
            input.JumpHeld = false;                     // tap: buffer without holding
            input.JumpPressedAt = 0.3;
            double apex = 0;
            Run(w, 1.0, ref input, 0.3, (world, _) => apex = Math.Max(apex, world.Player.Bottom));
            double tiles = (apex - 2 * GameConfig.TileSize) / GameConfig.TileSize;
            Check(tiles < 2.5, $"sim: tapped jump stays low (got {tiles:F2})");
        }

        // Clears a 3-tile pit at full speed; the pit kills at walking-off.
        {
            const string pit = """
                ..............................
                ..............................
                ..............................
                ..............................
                .P...........................N
                GGGGGGGG...GGGGGGGGGGGGGGGGGGG
                DDDDDDDD...DDDDDDDDDDDDDDDDDDD
                """;
            var w = MakeWorld(pit);
            var input = InputState.Empty;
            input.MoveX = 1;
            double now = Run(w, 0.8, ref input);        // run up to the pit edge…
            input.JumpHeld = true;
            input.JumpPressedAt = now;                  // …and jump roughly there
            bool everFell = false;
            Run(w, 1.5, ref input, now, (world, _) => everFell |= world.Player.Y < 0);
            Check(!everFell && w.Player.X > 12 * GameConfig.TileSize,
                  "sim: clears a 3-tile pit at speed");
        }

        // Stomping a thug squashes it and bounces the player.
        {
            const string stompMap = """
                ..........
                ..........
                ..........
                ..P.......
                ..........
                ...E.....N
                GGGGGGGGGG
                DDDDDDDDDD
                """;
            var w = MakeWorld(stompMap);
            var input = InputState.Empty;
            bool stomped = false, hit = false;
            Run(w, 1.2, ref input, 0, (world, events) =>
            {
                foreach (var e in events)
                {
                    stomped |= e.Kind == GameEventKind.Stomped;
                    hit |= e.Kind == GameEventKind.PlayerHit;
                }
            });
            Check(stomped, "sim: falling on a thug stomps it");
            Check(!hit, "sim: stomp is not a hit");
            Check(w.Thugs[0].Squashed, "sim: thug squashed");
        }

        // Walking into a thug hurts.
        {
            const string hurtMap = """
                ..........
                .P....E..N
                GGGGGGGGGG
                DDDDDDDDDD
                """;
            var w = MakeWorld(hurtMap);
            var input = InputState.Empty;
            input.MoveX = 1;
            bool hit = false;
            Run(w, 1.5, ref input, 0, (world, events) =>
            {
                foreach (var e in events)
                {
                    hit |= e.Kind == GameEventKind.PlayerHit;
                }
            });
            Check(hit, "sim: walking into a thug hurts");
        }

        // Thug turns at ledges and walls instead of falling or sticking.
        {
            const string patrolMap = """
                ..........
                ..P....E..
                .....GGGGG
                .....DDDDN
                """;
            // Thug on a small ledge (cols 5-9); it must stay on it.
            var w = MakeWorld(patrolMap);
            var input = InputState.Empty;
            double minX = double.MaxValue, maxX = 0;
            Run(w, 6.0, ref input, 0, (world, _) =>
            {
                minX = Math.Min(minX, world.Thugs[0].X);
                maxX = Math.Max(maxX, world.Thugs[0].X);
            });
            double tile = GameConfig.TileSize;
            Check(minX > 5 * tile - 1 && maxX < 10 * tile + 1,
                  $"sim: thug patrols its ledge (x ∈ [{minX:F0}, {maxX:F0}])");
            Check(!w.Thugs[0].Squashed && Math.Abs(w.Thugs[0].Vy) < 5, "sim: thug stays standing");
        }

        // Head-bumping a ؟ crate pops a coin once, then bumps as spent.
        {
            const string crateMap = """
                ..........
                ...?......
                ..........
                ..........
                ...P.....N
                GGGGGGGGGG
                DDDDDDDDDD
                """;
            var w = MakeWorld(crateMap);
            var input = InputState.Empty;
            int popped = 0, spentBumps = 0;
            double now = Run(w, 0.3, ref input);
            for (int attempt = 0; attempt < 2; attempt++)
            {
                input.MoveX = 0;                            // stay under the crate
                input.JumpHeld = true;
                input.JumpPressedAt = now;
                now = Run(w, 1.2, ref input, now, (world, events) =>
                {
                    foreach (var e in events)
                    {
                        if (e.Kind == GameEventKind.CratePoppedCoin) popped++;
                        if (e.Kind == GameEventKind.CrateBumpedSpent) spentBumps++;
                    }
                });
                input.JumpHeld = false;
            }
            CheckEqual(popped, 1, "sim: ؟ crate pops exactly once");
            Check(spentBumps >= 1, "sim: spent crate still bumps");
        }

        // Reaching Nousa fires the goal exactly once.
        {
            const string goalMap = """
                ..........
                .P....N...
                GGGGGGGGGG
                DDDDDDDDDD
                """;
            var w = MakeWorld(goalMap);
            var input = InputState.Empty;
            input.MoveX = 1;
            int reached = 0;
            Run(w, 2.0, ref input, 0, (world, events) =>
            {
                foreach (var e in events)
                {
                    if (e.Kind == GameEventKind.ReachedGoal) reached++;
                }
            });
            CheckEqual(reached, 1, "sim: goal fires once");
        }

        // Death hop: killed player rises, then falls below the world.
        {
            var w = MakeWorld(flat);
            var input = InputState.Empty;
            Run(w, 0.3, ref input);
            w.KillPlayer();
            double startY = w.Player.Y;
            double apex = startY;
            Run(w, 2.5, ref input, 0.3, (world, _) => apex = Math.Max(apex, world.Player.Y));
            Check(apex > startY + 10, "sim: death hop rises");
            Check(w.Player.Y < GameConfig.FallDeathY, "sim: dead player falls through the world");
        }

        // Checkpoint: activates once when touched; deaths respawn there.
        {
            const string checkpointMap = """
                ..........
                .P...C...N
                GGGGGGGGGG
                DDDDDDDDDD
                """;
            var w = MakeWorld(checkpointMap);
            var input = InputState.Empty;
            input.MoveX = 1;
            int reached = 0;
            double now = Run(w, 1.0, ref input, 0, (world, events) =>
            {
                foreach (var e in events)
                {
                    if (e.Kind == GameEventKind.CheckpointReached) reached++;
                }
            });
            CheckEqual(reached, 1, "sim: checkpoint fires once");
            Check(w.Checkpoints[0].Activated, "sim: checkpoint marked active");

            w.KillPlayer();
            w.RespawnPlayer(now);
            double tile = GameConfig.TileSize;
            Check(Math.Abs(w.Player.X - (5 * tile + tile / 2)) < 1,
                  $"sim: respawn at the foul cart (x={w.Player.X:F1})");
            Check(!w.Player.IsDead && w.Player.IsInvulnerable(now + 0.1),
                  "sim: respawn grants i-frames");

            // Without a checkpoint, respawn goes back to the start.
            var w2 = MakeWorld(flat);
            var idle = InputState.Empty;
            double now2 = Run(w2, 0.3, ref idle);
            w2.KillPlayer();
            w2.RespawnPlayer(now2);
            Check(Math.Abs(w2.Player.X - w2.PlayerSpawn.X) < 0.01,
                  "sim: no checkpoint → respawn at spawn");
        }
    }

    private static void StageIntegrityTests(int stage)
    {
        string name = $"level{stage}";
        string path = Path.Combine(AppContext.BaseDirectory, "Resources", "levels", name + ".txt");
        if (!File.Exists(path))
        {
            Check(false, $"{name}: file present at {path}");
            return;
        }
        var level = LevelParser.LoadFile(path);
        Check(level.Columns >= 150, $"{name}: real stage, not a stub");
        CheckEqual(level.Rows, 17, $"{name}: 17 rows");
        Check(level.PlayerSpawn is not null, $"{name}: has spawn");
        CheckEqual(level.Placements(EntityKind.Nousa).Count(), 1, $"{name}: one goal");
        Check(level.Placements(EntityKind.Thug).Count() >= 4, $"{name}: enough thugs");
        Check(level.Placements(EntityKind.Coin).Count() >= 20, $"{name}: enough coins");
        int expectedCheckpoints = stage >= 2 ? 1 : 0;
        CheckEqual(level.Placements(EntityKind.Checkpoint).Count(), expectedCheckpoints,
                   $"{name}: checkpoint count");

        Placement spawn = level.PlayerSpawn!;
        bool floorUnderSpawn = Enumerable.Range(spawn.Row, level.Rows - spawn.Row)
            .Any(r => level.IsSolid(spawn.Column, r));
        Check(floorUnderSpawn, $"{name}: spawn has floor");

        Placement goal = level.Placements(EntityKind.Nousa).First();
        bool floorUnderGoal = Enumerable.Range(goal.Row, level.Rows - goal.Row)
            .Any(r => level.IsSolid(goal.Column, r));
        Check(floorUnderGoal, $"{name}: goal has floor");

        // The whole stage must be completable in principle: simulate a
        // simple "run right and jump when blocked or at a pit edge" bot.
        var world = new World(level);
        var input = InputState.Empty;
        input.MoveX = 1;
        double now = 0;
        const double dt = 1.0 / 60.0;
        bool won = false, died = false;
        double lastX = world.Player.X;
        double stuckSince = 0;
        for (int i = 0; i < 60 * 120 && !won && !died; i++)
        {
            now += dt;
            // Hop walls (holding only until the feet clear them), and take
            // full-height edge jumps when the ground ahead is a real pit —
            // an air gap at foot level with no floor at ground level within
            // landing range. Coyote time in the sim makes those edge jumps.
            double px = world.Player.X, py = world.Player.Y, bottom = world.Player.Bottom;
            bool wallAhead = world.IsSolidAtPoint(px + 14, bottom + 2)
                          || world.IsSolidAtPoint(px + 14, py + 8);
            bool nearGround = world.Player.Grounded
                           || now - world.Player.LastGroundedAt <= GameConfig.CoyoteTime;
            bool GapBelow(double x) => !world.IsSolidAtPoint(x, GameConfig.TileSize);
            bool deadlyAhead = GapBelow(px + 8) || GapBelow(px + 24) || GapBelow(px + 40);
            // Press only at the true edge: air at the feet AND the very next
            // ground column void — otherwise descending from a stall with a
            // pit on the horizon wastes the coyote jump mid-fall.
            bool edgeAtFeet = nearGround
                           && !world.IsSolidAtPoint(px + 8, bottom - 6)
                           && GapBelow(px + 8);
            if (wallAhead || edgeAtFeet)
            {
                input.JumpPressedAt = now;
            }
            input.JumpHeld = wallAhead || deadlyAhead;

            if (Environment.GetEnvironmentVariable("LEMBY_BOT_TRACE") is { Length: > 0 } range &&
                range.Split(':') is [var lo, var hi] &&
                world.Player.X >= double.Parse(lo) && world.Player.X <= double.Parse(hi))
            {
                Console.WriteLine($"t={now:F2} x={world.Player.X:F1} bottom={world.Player.Bottom:F1} " +
                                  $"vx={world.Player.Vx:F0} vy={world.Player.Vy:F0} " +
                                  $"grounded={world.Player.Grounded} wall={wallAhead} " +
                                  $"edge={edgeAtFeet} deadly={deadlyAhead}");
            }

            var events = world.Step(dt, ref input, now);
            foreach (var e in events)
            {
                if (e.Kind == GameEventKind.ReachedGoal) won = true;
            }
            if (world.Player.Y < GameConfig.FallDeathY) died = true;

            if (Math.Abs(world.Player.X - lastX) > 0.5)
            {
                lastX = world.Player.X;
                stuckSince = now;
            }
            else if (now - stuckSince > 4)
            {
                break;   // hopelessly stuck — fail below
            }
        }
        Check(won && !died, $"{name}: naive runner bot completes the stage (won={won}, died={died}, x={world.Player.X:F0}/{world.WidthPoints})");
    }
}
