import Foundation

/// Every user-facing string, centralized — set for the active theme:
/// «اللي بالي بالك» (2003), El-Lemby in prison. (The art side of the theme
/// lives in tools/generate_assets.py.)
enum L10n {
    static let gameTitle = "اللمبي"
    static let gameSubtitle = "اللي بالي بالك"
    static let windowTitle = "اللمبي — اللي بالي بالك"
    static let pressStart = "اضغط المسافة للبدء"
    static let controlsHint = "الأسهم أو A/D للحركة — المسافة للنط — M للصوت"
    static let fanDisclaimer = "لعبة معجبين غير رسمية مستوحاة من فيلم «اللي بالي بالك» (٢٠٠٣)"
    static let stage1Name = "المرحلة ١ — العنبر"
    static let stage2Name = "المرحلة ٢ — فناء السجن"
    static let checkpointToast = "نقطة تفتيش — عند عربية الفول!"

    static func stageName(_ stage: Int) -> String {
        stage == 2 ? stage2Name : stage1Name
    }

    static let hudMoney = "العيش"
    static let hudLives = "الأرواح"
    static let hudTime = "الوقت"
    static let hudPowered = "مفوّل"

    static let paused = "وقفة يا معلم — اضغط P للمتابعة"

    static let stageClear = "مبروك يا لمبي!"
    static let stageClearSub = "وصلت لسونيا في الزيارة بالسلامة"
    static let gameOver = "خلصت الأرواح يا لمبي"
    static let gameOverQuote = "«معلش… واللي بالي بالك»"
    static let scoreLabel = "النقاط"
    static let moneyLabel = "العيش اللي لمّيته"
    static let timeBonusLabel = "مكافأة الوقت"
    static let highScoreLabel = "أعلى نقاط"
    static let retryHint = "المسافة = من الأول — ↩ = شاشة البداية"

    static let quitMenuItem = "إنهاء اللمبي"

    /// Formats an integer using Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩).
    static func eastern(_ value: Int) -> String {
        let digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
        return String(value).map { ch -> String in
            if let d = ch.wholeNumberValue, ch.isNumber, d >= 0, d <= 9 {
                return digits[d]
            }
            return String(ch)
        }.joined()
    }

    /// "×" + Eastern Arabic count, e.g. ×٣
    static func count(_ value: Int) -> String {
        "×" + eastern(value)
    }
}

enum Fonts {
    /// Geeza Pro ships with every macOS install and has full Arabic
    /// coverage. TODO: replace with a bitmap Arabic pixel font for a more
    /// authentic 8-bit look.
    static let arabic = "GeezaPro"
    static let arabicBold = "GeezaPro-Bold"
}
