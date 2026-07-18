using System.Text;

namespace ElLemby.Core;

/// <summary>
/// Every user-facing string, mirrored from the macOS build so both
/// platforms speak the same Egyptian Arabic.
/// </summary>
public static class L10n
{
    public const string GameTitle = "اللمبي";
    public const string GameSubtitle = "اللي بالي بالك";
    public const string WindowTitle = "اللمبي — اللي بالي بالك";
    public const string PressStart = "اضغط المسافة للبدء";
    public const string ControlsHint = "الأسهم أو A/D للحركة — المسافة للنط — M للصوت";
    public const string FanDisclaimer = "لعبة معجبين غير رسمية مستوحاة من فيلم «اللي بالي بالك» (٢٠٠٣)";
    public const string Stage1Name = "المرحلة ١ — العنبر";
    public const string Stage2Name = "المرحلة ٢ — فناء السجن";
    public const string CheckpointToast = "نقطة تفتيش — عند عربية الفول!";

    public static string StageName(int stage) => stage switch
    {
        2 => Stage2Name,
        _ => Stage1Name,
    };

    public const string HudMoney = "العيش";
    public const string HudLives = "الأرواح";
    public const string HudTime = "الوقت";
    public const string HudPowered = "مفوّل";

    public const string Paused = "وقفة يا معلم — اضغط P للمتابعة";

    public const string StageClear = "مبروك يا لمبي!";
    public const string StageClearSub = "وصلت لسونيا في الزيارة بالسلامة";
    public const string GameOver = "خلصت الأرواح يا لمبي";
    public const string GameOverQuote = "«معلش… واللي بالي بالك»";
    public const string ScoreLabel = "النقاط";
    public const string MoneyLabel = "العيش اللي لمّيته";
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
