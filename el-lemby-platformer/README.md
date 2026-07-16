# اللمبي: مغامرات الحارة 🎮

لعبة منصّات (platformer) بيكسل-آرت أصلية لنظام macOS، مستوحاة من فيلم الكوميديا المصري
**«اللمبي» (٢٠٠٢)** وبروح ماريو الكلاسيكية. اجري وانط بالـلمبي من أول الحارة لغاية ما
توصل لنوسة — والفكة اللي في السكة، لمّها!

![المرحلة الأولى](docs/screenshot.png)

> لعبة معجبين غير رسمية. كل الرسوم والأصوات مصنوعة من الصفر داخل المشروع —
> لا تستخدم أي مواد من الفيلم.

## التشغيل (macOS 13+)

اللعبة أصلية بالكامل: Swift + SpriteKit + AppKit، بدون أي اعتماديات خارجية.

```bash
cd el-lemby-platformer
swift run ElLemby        # أو: make run
```

لبناء تطبيق `.app` تضغط عليه مرتين:

```bash
make icon   # يبني أيقونة التطبيق (اختياري)
make app    # → dist/ElLemby.app
```

وتقدر تفتح المشروع في Xcode مباشرة: `open Package.swift`.

## التحكم

| المفتاح | الفعل |
|---|---|
| ← → أو A / D | المشي |
| المسافة أو ↑ أو W | النط (اضغط أطول تنط أعلى) |
| P أو Esc | إيقاف مؤقت |
| M | كتم الصوت |
| ⌘Q | خروج |

انط فوق البلطجية عشان تكسّبهم، وخبط الصناديق اللي عليها «؟» من تحت — فيها فكة،
وواحد فيهم فيه **ساندوتش فول** يديك ضربة حماية زيادة.

## The game (English)

A native macOS pixel-art side-scroller (left → right) inspired by the Egyptian
comedy film **El-Lemby (2002)**, with classic Mario feel: run/jump physics with
coyote time & jump buffering, stompable enemies (neighborhood thugs), coin
pickups (الفكة), ؟-crates, a foul-sandwich power-up, a countdown timer, lives,
and a goal NPC (Nousa) at the end of the alley. The MVP is stage 1, «الحارة».

Everything is Arabic-first: HUD, menus, and Eastern Arabic numerals. Input is
keycode-based, so it works identically on Arabic keyboard layouts.

```bash
swift run ElLemby   # macOS 13+, Swift 5.9+
swift test          # level-format & game-state unit tests
```

## بنية المشروع | Project layout

```
el-lemby-platformer/
├── Package.swift                  # SwiftPM: مكتبة ElLembyCore + تنفيذي ElLemby
├── Sources/
│   ├── ElLemby/main.swift         # نقطة الدخول
│   └── ElLembyCore/
│       ├── App/                   # نافذة AppKit والقائمة
│       ├── Core/                  # الثوابت، الحالة، النصوص العربية
│       ├── Art/                   # تحميل الرسوم + الألوان
│       ├── Audio/                 # المؤثرات والموسيقى
│       ├── World/                 # قارئ المراحل + باني العالم
│       ├── Entities/              # اللمبي، البلطجي، الفكة، نوسة…
│       ├── Scenes/                # البداية، اللعب، النتيجة + HUD
│       └── Resources/             # sprites/ sfx/ music/ levels/
├── Tests/ElLembyTests/
├── tools/                         # مولّدات الأصول (Python، بدون اعتماديات)
│   ├── generate_assets.py         # كل البيكسل-آرت → PNG
│   ├── generate_sfx.py            # مؤثرات ومقطع موسيقى «حجاز» → WAV
│   ├── build_level1.py            # يبني المرحلة ١ → level1.txt
│   └── render_level.py            # يرسم المرحلة صورة للمراجعة
└── docs/                          # DESIGN.md + الصور
```

## تعديل المرحلة | Editing the stage

المراحل ملفات نصية بسيطة — حرف واحد لكل بلاطة 16×16
(`Sources/ElLembyCore/Resources/levels/level1.txt`):

```
.  هواء      G  أرضية     D  ردم       B  طوب
X  صندوق     =  حجر رملي   ?  صندوق فكة  F  صندوق فول
o  فكة       P  بداية اللمبي  E  بلطجي   N  نوسة (النهاية)
```

عدّل الملف يدويًا، أو عدّل `tools/build_level1.py` وشغّله من جديد. عاين النتيجة
بدون ماك عن طريق `python3 tools/render_level.py` → ‏`docs/level1.png`:

![المرحلة كاملة](docs/level1.png)

## الأصول | Asset pipeline

كل الرسوم والأصوات **مولّدة برمجيًا** وقابلة لإعادة التوليد:

```bash
make assets   # python3 فقط — بدون Pillow أو numpy
```

![كل الرسوم](docs/sprites.png)

## خارطة الطريق | Roadmap

راجع [docs/DESIGN.md](docs/DESIGN.md) للتصميم الكامل. أبرز الخطوات الجاية:

- [ ] مراحل جديدة: شارع السوق، الميكروباص، الفرح 🎊
- [ ] خط عربي بيكسلي للواجهة بدل Geeza Pro
- [ ] حركات خاصة للمبي (الجري السريع، «اللمبي-ستايل» تعليقات صوتية)
- [ ] زعيم مرحلة (الفتوة) + أنواع أعداء إضافية
- [ ] حفظ التقدّم، وشاشة اختيار مراحل
- [ ] دعم يد التحكم (Game Controller framework)
