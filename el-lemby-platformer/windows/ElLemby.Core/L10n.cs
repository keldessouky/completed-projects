using System.Text;

namespace ElLemby.Core;

/// <summary>
/// Every user-facing string, mirrored from the macOS build so both
/// platforms speak the same Egyptian Arabic.
/// </summary>
public static class L10n
{
    public const string GameTitle = "اللمبي";
    public const string GameSubtitle = "مغامرات الحارة";
    public const string WindowTitle = "اللمبي — مغامرات الحارة";
    public const string PressStart = "اضغط المسافة للبدء";
    public const string ControlsHint = "الأسهم أو A/D للحركة — المسافة للنط — M للصوت";
    public const string FanDisclaimer = "لعبة معجبين غير رسمية مستوحاة من فيلم «اللمبي» (٢٠٠٢)";
    public const string Stage1Name = "المرحلة ١ — الحارة";

    public const string HudMoney = "الفكة";
    public const string HudLives = "الأرواح";
    public const string HudTime = "الوقت";
    public const string HudPowered = "مفوّل";

    public const string Paused = "وقفة يا معلم — اضغط P للمتابعة";

    public const string StageClear = "مبروك يا لمبي!";
    public const string StageClearSub = "وصلت لنوسة بالسلامة";
    public const string GameOver = "خلصت الأرواح يا لمبي";
    public const string GameOverQuote = "«يا عم فوزي… هو في إيه؟»";
    public const string ScoreLabel = "النقاط";
    public const string MoneyLabel = "الفكة اللي لمّيتها";
    public const string TimeBonusLabel = "مكافأة الوقت";
    public const string HighScoreLabel = "أعلى نقاط";
    public const string RetryHint = "المسافة = من الأول — Enter = شاشة البداية";

    /// <summary>Formats an integer using Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩).</summary>
    public static string Eastern(long value)
    {
        var sb = new StringBuilder();
        foreach (char ch in value.ToString(System.Globalization.CultureInfo.InvariantCulture))
        {
            sb.Append(ch is >= '0' and <= '9' ? (char)('٠' + (ch - '0')) : ch);
        }
        return sb.ToString();
    }

    /// <summary>"×" + Eastern Arabic count, e.g. ×٣</summary>
    public static string Count(long value) => "×" + Eastern(value);
}
