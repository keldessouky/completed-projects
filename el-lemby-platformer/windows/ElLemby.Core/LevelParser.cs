namespace ElLemby.Core;

/// <summary>
/// The ASCII level format — a straight port of the macOS parser
/// (World/LevelParser.swift). One character per 16×16 tile, top row first;
/// `//` lines are comments; short rows are padded with air.
///
///     .  air          G  ground        D  dirt fill     B  brick
///     X  crate        =  sandstone     ?  crate → coin  F  crate → sandwich
///     o  coin         P  player        E  thug          N  Nousa (goal)
///     C  checkpoint (عربية الفول)
/// </summary>
public enum TileKind
{
    Ground,
    Dirt,
    Brick,
    Crate,
    Stone,
    MysteryCoin,
    MysterySandwich,
}

public enum EntityKind
{
    Player,
    Thug,
    Coin,
    Nousa,
    Checkpoint,
}

public static class TileKindExtensions
{
    public static bool IsMystery(this TileKind kind) =>
        kind is TileKind.MysteryCoin or TileKind.MysterySandwich;

    public static string SpriteName(this TileKind kind) => kind switch
    {
        TileKind.Ground => "tile_ground",
        TileKind.Dirt => "tile_dirt",
        TileKind.Brick => "tile_brick",
        TileKind.Crate => "tile_crate",
        TileKind.Stone => "tile_stone",
        TileKind.MysteryCoin or TileKind.MysterySandwich => "tile_mystery",
        _ => "tile_crate",
    };
}

public sealed record Placement(EntityKind Kind, int Column, int Row);

public sealed class LevelData
{
    public int Columns { get; }
    public int Rows { get; }
    public IReadOnlyList<Placement> Entities { get; }
    private readonly TileKind?[,] _tiles;   // [row, column], row 0 = top

    internal LevelData(int columns, int rows, TileKind?[,] tiles, List<Placement> entities)
    {
        Columns = columns;
        Rows = rows;
        _tiles = tiles;
        Entities = entities;
    }

    public TileKind? Tile(int column, int row)
    {
        if (row < 0 || row >= Rows || column < 0 || column >= Columns)
        {
            return null;
        }
        return _tiles[row, column];
    }

    public bool IsSolid(int column, int row) => Tile(column, row) is not null;

    public Placement? PlayerSpawn => Entities.FirstOrDefault(p => p.Kind == EntityKind.Player);

    public IEnumerable<Placement> Placements(EntityKind kind) =>
        Entities.Where(p => p.Kind == kind);
}

public enum LevelParseErrorKind
{
    Empty,
    UnknownCharacter,
    MissingPlayerSpawn,
    DuplicatePlayerSpawn,
    MissingGoal,
}

public sealed class LevelParseException : Exception
{
    public LevelParseErrorKind Kind { get; }
    public char Character { get; }
    public int Line { get; }
    public int Column { get; }

    public LevelParseException(LevelParseErrorKind kind, char character = '\0',
                               int line = -1, int column = -1)
        : base($"{kind} '{character}' at line {line}, column {column}")
    {
        Kind = kind;
        Character = character;
        Line = line;
        Column = column;
    }
}

public static class LevelParser
{
    public static LevelData Parse(string text)
    {
        var lines = text.Replace("\r\n", "\n").Split('\n')
            .Where(l => !l.StartsWith("//", StringComparison.Ordinal))
            .ToList();
        while (lines.Count > 0 && lines[0].Trim().Length == 0)
        {
            lines.RemoveAt(0);
        }
        while (lines.Count > 0 && lines[^1].Trim().Length == 0)
        {
            lines.RemoveAt(lines.Count - 1);
        }
        if (lines.Count == 0)
        {
            throw new LevelParseException(LevelParseErrorKind.Empty);
        }

        int columns = lines.Max(l => l.Length);
        if (columns == 0)
        {
            throw new LevelParseException(LevelParseErrorKind.Empty);
        }

        var tiles = new TileKind?[lines.Count, columns];
        var entities = new List<Placement>();

        for (int row = 0; row < lines.Count; row++)
        {
            string line = lines[row];
            for (int col = 0; col < line.Length; col++)
            {
                char ch = line[col];
                switch (ch)
                {
                    case '.' or ' ':
                        break;
                    case 'G': tiles[row, col] = TileKind.Ground; break;
                    case 'D': tiles[row, col] = TileKind.Dirt; break;
                    case 'B': tiles[row, col] = TileKind.Brick; break;
                    case 'X': tiles[row, col] = TileKind.Crate; break;
                    case '=': tiles[row, col] = TileKind.Stone; break;
                    case '?': tiles[row, col] = TileKind.MysteryCoin; break;
                    case 'F': tiles[row, col] = TileKind.MysterySandwich; break;
                    case 'P': entities.Add(new Placement(EntityKind.Player, col, row)); break;
                    case 'E': entities.Add(new Placement(EntityKind.Thug, col, row)); break;
                    case 'o': entities.Add(new Placement(EntityKind.Coin, col, row)); break;
                    case 'N': entities.Add(new Placement(EntityKind.Nousa, col, row)); break;
                    case 'C': entities.Add(new Placement(EntityKind.Checkpoint, col, row)); break;
                    default:
                        throw new LevelParseException(LevelParseErrorKind.UnknownCharacter, ch, row, col);
                }
            }
        }

        int spawns = entities.Count(p => p.Kind == EntityKind.Player);
        if (spawns == 0)
        {
            throw new LevelParseException(LevelParseErrorKind.MissingPlayerSpawn);
        }
        if (spawns > 1)
        {
            throw new LevelParseException(LevelParseErrorKind.DuplicatePlayerSpawn);
        }
        if (!entities.Any(p => p.Kind == EntityKind.Nousa))
        {
            throw new LevelParseException(LevelParseErrorKind.MissingGoal);
        }

        return new LevelData(columns, lines.Count, tiles, entities);
    }

    public static LevelData LoadFile(string path) => Parse(File.ReadAllText(path));
}
