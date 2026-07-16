# تثبيت وتشغيل «اللمبي» على الماك 🍎
# Installing El-Lemby on a Mac (MacBook Air M-series friendly)

هذا الدليل مكتوب لأي ماك بمعالج Apple silicon — من M1 لغاية **MacBook Air M5** —
ويشتغل كذلك على أجهزة Intel. النسخة الجاهزة مبنية Universal (تشتغل أصليًا على
المعالجين بدون Rosetta).

This guide targets any Apple-silicon Mac — M1 through the **MacBook Air M5** —
and Intel Macs too. The prebuilt app is a universal binary, so it runs natively
on both (no Rosetta involved).

---

## المتطلبات | Requirements

| | |
|---|---|
| النظام / macOS | 13 Ventura أو أحدث (أي MacBook Air M5 يجي بأحدث من كده بكتير) |
| المساحة / Disk | أقل من ٥٠ ميجابايت |
| اعتماديات / Dependencies | **لا شيء** للنسخة الجاهزة — اللعبة Swift أصلية بالكامل |
| للبناء من المصدر / Building from source | Xcode Command Line Tools (خطوة واحدة، انظر الطريقة ٢) |

---

## الطريقة ١ — التطبيق الجاهز (الأسهل) | Option 1 — Prebuilt app (easiest)

كل تشغيلة CI ناجحة بترفع نسخة جاهزة للتنزيل. Every green CI run uploads a
ready-to-play build.

1. افتح صفحة GitHub Actions بتاعة المستودع وادخل على أحدث تشغيلة خضراء لـ
   **El-Lemby (macOS)**، ونزّل الـ artifact المسمى **`ElLemby-macos`**
   (لازم تكون مسجّل دخول على GitHub).
   *Open the repo's GitHub Actions page → latest green "El-Lemby (macOS)" run →
   download the **`ElLemby-macos`** artifact (you need to be signed in to GitHub).*

2. فك الضغط مرتين لو لزم (artifact → `ElLemby-macos.zip` → `ElLemby.app`)
   واسحب `ElLemby.app` لمجلد **Applications**.
   *Unzip (the artifact zip contains `ElLemby-macos.zip` → `ElLemby.app`) and
   drag `ElLemby.app` into **Applications**.*

3. **أول تشغيل — Gatekeeper:** التطبيق موقّع ad-hoc (لعبة معجبين، مش موثّقة من
   Apple)، فأول مرة ماك هيعترض. الحل:
   *First launch — Gatekeeper: the app is ad-hoc-signed (a fan game, not
   notarized by Apple), so macOS will object once. Fix it either way:*

   - **بالماوس:** كليك يمين (أو Control-click) على `ElLemby.app` ← **فتح/Open**
     ← **فتح/Open**. لو ظهر زر «تم» بدون خيار فتح: افتح
     **إعدادات النظام ← الخصوصية والأمان** وانزل تحت وهتلاقي
     **«Open Anyway / فتح على أي حال»**، اضغطه ثم أكّد.
     *Right-click → Open → Open. On newer macOS (Sequoia and later) if that's
     blocked: System Settings → Privacy & Security → scroll down →
     **Open Anyway**, then confirm.*

   - **بالطرفية (أسرع):** *Or in Terminal (fastest):*

     ```bash
     xattr -dr com.apple.quarantine /Applications/ElLemby.app
     open /Applications/ElLemby.app
     ```

بعد أول مرة، هيفتح عادي من Launchpad أو Spotlight (اكتب `ElLemby`).
*After the first launch it opens normally from Launchpad or Spotlight.*

---

## الطريقة ٢ — البناء من المصدر | Option 2 — Build from source

مناسبة لو عايز تعدّل في اللعبة أو ماتحبش تنزّل artifacts. خمس دقايق من الصفر
على MacBook Air M5. *Five minutes from scratch on an M5 Air:*

```bash
# ١) أدوات البناء (مرة واحدة في العمر — اضغط Install في النافذة اللي هتظهر)
#    Build tools (one-time — click Install in the dialog that appears)
xcode-select --install

# ٢) هات الكود    Get the code
git clone https://github.com/keldessouky/completed-projects.git
cd completed-projects/el-lemby-platformer

# ٣) العب فورًا    Play immediately
swift run ElLemby
```

أول `swift run` بياخد دقيقة يبني؛ بعدها ثواني. *The first `swift run` takes a
minute to compile; afterwards it's seconds.*

ولتثبيتها كتطبيق عادي في Applications:
*To install it as a regular app in /Applications:*

```bash
make icon app     # يبني dist/ElLemby.app بأيقونتها  (builds the .app + icon)
make install      # ينسخها إلى /Applications
open /Applications/ElLemby.app
```

> ملاحظات | Notes
> - `make UNIVERSAL=1 icon app` يبني نسخة Universal (آبل سيليكون + إنتل).
>   *builds the universal binary.*
> - مستخدمو Xcode: `open Package.swift` واختر سكيم `ElLemby` ثم Run.
>   *Xcode users: open Package.swift, pick the ElLemby scheme, Run.*
> - البناء من المصدر ما بيحتاجش خطوة Gatekeeper إطلاقًا.
>   *Source builds never hit the Gatekeeper prompt.*

---

## التشغيل والتحكم | Launch & controls

- افتح اللعبة من Launchpad أو Spotlight أو `/Applications/ElLemby.app`.
- النافذة قابلة للتكبير، وزر التكبير الأخضر يدخل **ملء الشاشة** — البكسلات
  بتتكبر بحدة (nearest-neighbor) من غير تشويش.
  *Resizable window; the green traffic-light button gives fullscreen with
  crisp integer-ish pixel scaling.*

| المفتاح | الفعل |
|---|---|
| ← → أو A / D | المشي |
| المسافة أو ↑ أو W | النط — اضغط أطول تنط أعلى |
| P أو Esc | إيقاف مؤقت |
| M | كتم/تشغيل الصوت |
| ⌘Q | خروج |

الهدف: انط فوق البلطجية، خبّط صناديق «؟» من تحت عشان الفكة وساندوتش الفول،
وأوصل لنوسة قبل ما الوقت يخلص. *Stomp thugs, bump ؟-crates from below, reach
Nousa before the timer runs out.*

---

## استكشاف الأخطاء | Troubleshooting

**«ElLemby is damaged and can't be opened» / «التطبيق تالف»**
ده مجرد أثر الحجر الصحي (quarantine) على الملفات المنزّلة:
*That's just the download quarantine flag:*

```bash
xattr -dr com.apple.quarantine /Applications/ElLemby.app
```

**«App from an unidentified developer»** — راجع خطوة Gatekeeper في الطريقة ١.
*See the Gatekeeper step in Option 1.*

**مفيش صوت | No sound** — جرّب `M` (كتم داخلي)، وراجع صوت النظام. الموسيقى
بتقف مؤقتًا مع البوز (`P`). *Try `M` (in-game mute) and system volume; music
pauses while paused.*

**إعادة تصفير أعلى النقاط | Reset the high score**

```bash
defaults delete com.keldessouky.ellemby
```

**إلغاء التثبيت | Uninstall** — احذف `/Applications/ElLemby.app` ونفّذ أمر
`defaults delete` اللي فوق. خلاص، مفيش أي ملفات تانية.
*Delete the app and run the defaults command above — nothing else is left
behind.*

**الأداء | Performance** — اللعبة 480×272 بكسل على 60 إطار؛ أي شريحة M-series
(وأي إنتل من العقد الأخير) أكتر من كفاية بمراحل. 🐪
