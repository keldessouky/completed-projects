using System.Drawing.Imaging;

namespace ElLemby.App;

/// <summary>
/// Loads the shared PNG sprites (copied beside the exe under Resources/)
/// and caches them, plus pre-flipped variants for facing left.
/// </summary>
internal static class Assets
{
    private static readonly Dictionary<string, Bitmap> Cache = new();
    private static readonly Dictionary<string, Bitmap> FlippedCache = new();

    internal static string ResourceRoot { get; } =
        Path.Combine(AppContext.BaseDirectory, "Resources");

    internal static Bitmap Sprite(string name)
    {
        if (Cache.TryGetValue(name, out Bitmap? cached))
        {
            return cached;
        }
        string path = Path.Combine(ResourceRoot, "sprites", name + ".png");
        Bitmap bmp;
        if (File.Exists(path))
        {
            // Load through a copy so the file handle is released.
            using var fromDisk = new Bitmap(path);
            bmp = new Bitmap(fromDisk);
        }
        else
        {
            bmp = Placeholder();
        }
        Cache[name] = bmp;
        return bmp;
    }

    internal static Bitmap Flipped(string name)
    {
        if (FlippedCache.TryGetValue(name, out Bitmap? cached))
        {
            return cached;
        }
        var flipped = new Bitmap(Sprite(name));
        flipped.RotateFlip(RotateFlipType.RotateNoneFlipX);
        FlippedCache[name] = flipped;
        return flipped;
    }

    internal static string SfxPath(string name) =>
        Path.Combine(ResourceRoot, "sfx", name + ".wav");

    internal static string MusicPath =>
        Path.Combine(ResourceRoot, "music", "harah_loop.wav");

    internal static string LevelPath(string name) =>
        Path.Combine(ResourceRoot, "levels", name + ".txt");

    /// <summary>Loud magenta stand-in so a missing sprite is obvious.</summary>
    private static Bitmap Placeholder()
    {
        var bmp = new Bitmap(16, 16, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(bmp);
        g.Clear(Color.Magenta);
        return bmp;
    }
}
