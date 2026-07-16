using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;

namespace ElLemby.App;

/// <summary>UI colors matched to the generated art palette.</summary>
internal static class Palette
{
    internal static readonly Color Sky = Color.FromArgb(166, 204, 216);
    internal static readonly Color Ink = Color.FromArgb(20, 15, 18);
    internal static readonly Color Gold = Color.FromArgb(199, 141, 29);
    internal static readonly Color Cream = Color.FromArgb(243, 236, 224);
    internal static readonly Color Maroon = Color.FromArgb(153, 47, 62);
    internal static readonly Color Night = Color.FromArgb(30, 26, 36);

    internal static readonly Brush InkBrush = new SolidBrush(Ink);
    internal static readonly Brush GoldBrush = new SolidBrush(Gold);
    internal static readonly Brush CreamBrush = new SolidBrush(Cream);
    internal static readonly Brush MaroonBrush = new SolidBrush(Maroon);
    internal static readonly Brush OverlayBrush = new SolidBrush(Color.FromArgb(140, 0, 0, 0));
}

/// <summary>
/// Drawing helpers for the 480×272 backbuffer. GDI+ shapes Arabic text
/// natively — Segoe UI ships with Windows and has full Arabic coverage.
/// TODO (roadmap): bitmap Arabic pixel font, shared with the macOS build.
/// </summary>
internal static class Draw
{
    internal static readonly Font Title = new("Segoe UI", 40f, FontStyle.Bold, GraphicsUnit.Pixel);
    internal static readonly Font H1 = new("Segoe UI", 24f, FontStyle.Bold, GraphicsUnit.Pixel);
    internal static readonly Font H2 = new("Segoe UI", 15f, FontStyle.Bold, GraphicsUnit.Pixel);
    internal static readonly Font Hud = new("Segoe UI", 11f, FontStyle.Bold, GraphicsUnit.Pixel);
    internal static readonly Font Body = new("Segoe UI", 10f, FontStyle.Regular, GraphicsUnit.Pixel);
    internal static readonly Font Tiny = new("Segoe UI", 8.5f, FontStyle.Regular, GraphicsUnit.Pixel);

    private static readonly StringFormat RtlNear = Make(StringAlignment.Near);     // flush RIGHT
    private static readonly StringFormat RtlCenter = Make(StringAlignment.Center);
    private static readonly StringFormat RtlFar = Make(StringAlignment.Far);       // flush LEFT

    private static readonly ImageAttributes AlphaAttributes = new();

    private static StringFormat Make(StringAlignment alignment) => new()
    {
        FormatFlags = StringFormatFlags.DirectionRightToLeft | StringFormatFlags.NoWrap,
        Alignment = alignment,
        LineAlignment = StringAlignment.Near,
        Trimming = StringTrimming.None,
    };

    internal static void Configure(Graphics g)
    {
        g.InterpolationMode = InterpolationMode.NearestNeighbor;
        g.PixelOffsetMode = PixelOffsetMode.Half;
        g.SmoothingMode = SmoothingMode.None;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
    }

    /// <summary>Arabic text with its RIGHT edge at x.</summary>
    internal static void TextRight(Graphics g, string s, Font font, Brush brush, float x, float y)
        => g.DrawString(s, font, brush, new RectangleF(x - 460, y, 460, 60), RtlNear);

    /// <summary>Arabic text centered on x.</summary>
    internal static void TextCenter(Graphics g, string s, Font font, Brush brush, float x, float y)
        => g.DrawString(s, font, brush, new RectangleF(x - 230, y, 460, 60), RtlCenter);

    /// <summary>Arabic text with its LEFT edge at x.</summary>
    internal static void TextLeft(Graphics g, string s, Font font, Brush brush, float x, float y)
        => g.DrawString(s, font, brush, new RectangleF(x, y, 460, 60), RtlFar);

    internal static void Alpha(Graphics g, Image image, Rectangle dest, float alpha)
    {
        var matrix = new ColorMatrix { Matrix33 = Math.Clamp(alpha, 0f, 1f) };
        AlphaAttributes.SetColorMatrix(matrix);
        g.DrawImage(image, dest, 0, 0, image.Width, image.Height,
                    GraphicsUnit.Pixel, AlphaAttributes);
    }
}
