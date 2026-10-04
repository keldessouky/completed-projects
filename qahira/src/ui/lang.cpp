#include "ui/lang.hpp"
#include <unordered_map>
#include <utility>
#include <vector>

namespace q {

namespace {
Lang g_lang = Lang::En;

// whole strings: the menus, the HUD, the title screen, the map and the sky, the settings
const std::vector<std::pair<const char*, const char*>>& whole() {
    static const std::vector<std::pair<const char*, const char*>> d = {
        // the title screen
        {"QAHIRA", "قاهرة"},
        {"Cairo, under an eclipse that never ended", "القاهرة، تحت كسوفٍ لم ينتهِ"},
        {"New character", "شخصية جديدة"},
        {"Play", "العب"},
        {"Delete", "حذف"},
        {"North again to delete", "اضغط الأعلى مرة أخرى للحذف"},
        {"Choose a class", "اختر صنفك"},
        {"Begin", "ابدأ"},
        {"Back", "رجوع"},
        {"Empty", "فارغ"},
        // the menu
        {"Items", "الأغراض"},
        {"Talismans", "الطلاسم"},
        {"Character", "الشخصية"},
        {"Ascendancy", "الارتقاء"},
        {"Journal", "الدفتر"},
        {"Filter", "الفرز"},
        {"Settings", "الإعدادات"},
        {"Your Belongings", "أغراضك"},
        {"Inventory", "الحقيبة"},
        {"LEVEL", "المستوى"},
        {"LIFE", "الحياة"},
        {"ARMOUR", "الدرع"},
        {"DAMAGE", "الضرر"},
        {"EQUIPPED", "مُجهَّز"},
        {"Equip", "جهِّز"},
        {"Drop", "ارمِ"},
        {"Dropped", "رُمي"},
        {"Close", "إغلاق"},
        {"Choose", "اختيار"},
        {"Change", "تغيير"},
        {"Apply", "تطبيق"},
        {"Look", "انظر"},
        {"Leave", "غادر"},
        {"Buy", "اشترِ"},
        {"Tabs", "الألواح"},
        {"Section", "القسم"},
        {"Put back", "أعِد"},
        {"Cancelled", "أُلغي"},
        {"Finished", "انتهى"},
        {"Unknown", "مجهول"},
        {"free", "مجاناً"},
        {"An empty slot", "خانة فارغة"},
        {"Your inventory is full", "حقيبتك ممتلئة"},
        {"Not enough dinars", "لا تكفي الدنانير"},
        {"You hold this already", "هذا معك بالفعل"},
        {"You have none", "ليس معك شيء منه"},
        {"You need something to swing", "تحتاج شيئاً تضرب به"},
        {"Blank Talismans", "طلاسم فارغة"},
        {"No Blank Talismans: monsters drop them", "لا طلاسم فارغة: تسقطها الوحوش"},
        {"Wafq", "وفق"},
        {"An empty Wafq slot", "خانة وفق فارغة"},
        {"Carve", "انقش"},
        {"Carve a slot", "انقش خانة"},
        {"Choose your ascendancy", "اختر ارتقاءك"},
        {"Ascend", "ارتقِ"},
        {"Pass the First Trial at Bab Zuweila to choose", "اجتز الامتحان الأول في باب زويلة لتختار"},
        {"No ascendancy for this class yet", "لا ارتقاء لهذا الصنف بعد"},
        {"Choose what the ground shows you.", "اختر ما تريك الأرض."},
        {"Quick switch in the field: D-pad Right", "للتبديل السريع في الميدان: السهم الأيمن"},
        {"Usta Hassan's Bench", "طاولة الأسطى حسن"},
        {"Amm Ramadan's Antiquities", "عاديات عم رمضان"},
        {"Choose recipe", "اختر الوصفة"},
        {"Craft on item", "اصنع على الغرض"},
        {"Why? ", "لماذا؟ "},
        {"Hide why", "أخفِ السبب"},
        // the HUD and the world
        {"Portal", "بوابة"},
        {"Map", "الخريطة"},
        {"Hide map", "أخفِ الخريطة"},
        {"Pick up", "التقط"},
        {"Waypoints", "المحطات"},
        {"The Rooftop Ahwa", "قهوة السطح"},
        {"You fell in the long night", "سقطتَ في الليل الطويل"},
        {"Rise again", "انهض من جديد"},
        {"MARID RIFT", "صدع المارد"},
        {"EXCAVATION", "حفرية"},
        {"ZAR NIGHT", "ليلة زار"},
        {"IN THE HABOOB", "في الهبوب"},
        {"the storm is south of you", "العاصفة جنوبك"},
        {"Misr", "مصر"},
        // the map of al-Idrisi
        {"The Map of al-Idrisi", "خريطة الإدريسي"},
        {"Drawn for King Roger of Sicily, 1154, with south at the top", "رُسمت لروجر ملك صقلية سنة ١١٥٤، والجنوب في أعلاها"},
        {"Astrolabe", "الأسطرلاب"},
        {"Choose a chart", "اختر خريطة"},
        {"Which chart?", "أيّ خريطة؟"},
        {"Set out", "انطلق"},
        {"Set", "ثبِّت"},
        {"Chart", "خريطة"},
        {"Seal", "الختم"},
        {"Rift Seal", "ختم الصدع"},
        {"Pinnacles", "القمم"},
        {"The Pinnacles", "القمم"},
        {"charts by Clime", "الخرائط حسب الإقليم"},
        {"none yet: monsters drop them", "لا شيء بعد: تسقطها الوحوش"},
        {"Finish a site for another Astrolabe point", "أتمّ موقعاً لتنال نقطة أسطرلاب أخرى"},
        {"Finish a neighbouring site to reveal this one", "أتمّ موقعاً مجاوراً ليظهر هذا"},
        {"Finish a neighbouring site to see where this road leads.", "أتمّ موقعاً مجاوراً لترى إلى أين يمضي هذا الطريق."},
        {"Take the node before it first", "خذ العقدة التي قبلها أولاً"},
        // the Book of Fixed Stars
        {"The Book of Fixed Stars", "كتاب صور الكواكب الثابتة"},
        {"Your class starts here", "صنفك يبدأ من هنا"},
        {"You hold this star already", "هذا النجم لك بالفعل"},
        {"Not enough stars to place", "لا تكفي النجوم"},
        {"No path to plan", "لا طريق للتخطيط"},
        {"No path from your stars to this one", "لا طريق من نجومك إلى هذا النجم"},
        {"Plan the Recommended Path", "خطِّط الطريق المقترح"},
        {"Plan cut here", "قُطعت الخطة هنا"},
        {"Build Code", "رمز البناء"},
        {"Import a code", "استورد رمزاً"},
        {"Type a build code", "اكتب رمز بناء"},
        {"That code is not a build code", "هذا ليس رمز بناء"},
        {"Refunded", "استُرد"},
        {"Refund (Rosewater)", "استرداد (ماء الورد)"},
        {"A refund costs a Rosewater Vial", "الاسترداد يكلّف قارورة ماء ورد"},
        {"Refunding a star after level 20 takes a Rosewater Vial", "استرداد نجم بعد المستوى ٢٠ يكلّف قارورة ماء ورد"},
        {"Nothing changes it: this is the base value.", "لا شيء يغيّره: هذه القيمة الأصلية."},
        // the settings (Slice 11)
        {"Language", "اللغة"},
        {"English", "English"},
        {"Text size", "حجم النص"},
        {"Normal", "عادي"},
        {"Larger", "أكبر"},
        {"Largest", "الأكبر"},
        {"Loot colours", "ألوان الغنائم"},
        {"Standard", "عادية"},
        {"Red-green safe", "آمنة للأحمر والأخضر"},
        {"Blue-yellow safe", "آمنة للأزرق والأصفر"},
        {"Screen shake", "اهتزاز الشاشة"},
        {"Off", "إيقاف"},
        {"Second skill bar", "شريط المهارات الثاني"},
        {"Hold L2", "اضغط مطوّلاً L2"},
        {"Toggle with L2", "بدِّل بـ L2"},
        {"Saved for every character on this device", "تُحفظ لكل الشخصيات على هذا الجهاز"},
        {"Magic", "سحري"},
        {"Choose the toll", "اختر المكس"},
        {"Seal the Veil, or leave the door open", "اختم الحجاب، أو اترك الباب مفتوحاً"},
        {"The far court", "الساحة البعيدة"},
        {"Portal home", "بوابة العودة"},
        {"Upgrade flask", "طوِّر القارورة"},
        {"Your flask is the best there is", "قارورتك أفضل ما يوجد"},
        {"Weapon", "السلاح"},
        {"Helmet", "خوذة"},
        {"Body Armour", "درع الجسد"},
        {"Gloves", "قفازات"},
        {"Boots", "حذاء"},
        {"Belt", "حزام"},
        {"Amulet", "قلادة"},
        {"Ring", "خاتم"},
        {"Weapon Swap", "السلاح البديل"},
        {"No star to place yet", "لا نجم لتضعه بعد"},
        {"Nothing planned: West plans a path", "لا خطة بعد: الزر الأيسر يخطط طريقاً"},
        {"Rare", "نادر"},
        {"Unique", "فريد"},
        // Radio Kafr El-Sheikh
        {"Music", "الموسيقى"},
        {"Music volume", "صوت الموسيقى"},
        {"Effects volume", "صوت المؤثرات"},
        {"Radio volume", "صوت الراديو"},
        {"The game's own music and the sounds of each place", "موسيقى اللعبة نفسها وأصوات كل مكان"},
        {"Spells, blows, footsteps and the menus", "التعاويذ والضربات والخطوات والقوائم"},
        {"Radio Kafr El-Sheikh", "راديو كفر الشيخ"},
        {"RADIO KAFR EL-SHEIKH", "راديو كفر الشيخ"},
        {"The game's music", "موسيقى اللعبة"},
        {"Radio", "الراديو"},
        {"Next episode", "الحلقة التالية"},
        {"Next station", "المحطة التالية"},
        // the Game tab
        {"Game", "اللعبة"},
        {"Resume", "متابعة اللعب"},
        {"Quit to the title", "العودة إلى الشاشة الأولى"},
        {"Quit to the title? Press again", "العودة إلى الشاشة الأولى؟ اضغط مرة أخرى"},
        {"Exit the game", "الخروج من اللعبة"},
        {"Exit the game? Press again", "الخروج من اللعبة؟ اضغط مرة أخرى"},
        {"Check for updates", "البحث عن تحديث"},
        {"Checking for updates...", "جارٍ البحث عن تحديث..."},
        {"Installed. Exit and start the game again", "تم التثبيت. اخرج وشغّل اللعبة من جديد"},
        {"Downloaded: one step left, below", "تم التنزيل: بقيت خطوة واحدة، في الأسفل"},
        {"Exit the game, then in RetroArch:", "اخرج من اللعبة، ثم في RetroArch:"},
        {"Load Core > Install or Restore a Core, and pick", "Load Core > Install or Restore a Core، واختر"},
        {"The new pack goes in by itself when the new core starts", "توضع الحزمة الجديدة وحدها عند تشغيل النواة الجديدة"},
        {"Updates are for the RP6's core", "التحديثات لنواة RP6 فقط"},
        {"Your character is saved as you go", "تُحفظ شخصيتك أولاً بأول"},
        {"Downloads the new core and pack; your characters stay", "يُنزّل النواة والحزمة الجديدتين؛ تبقى شخصياتك"},
        {"You can go on playing while it downloads", "يمكنك مواصلة اللعب أثناء التنزيل"},
        {"The new build starts the next time the game does", "يبدأ الإصدار الجديد عند تشغيل اللعبة في المرة القادمة"},
        {"A new build is ready: Start, then the Game tab", "إصدار جديد جاهز: Start ثم تبويب اللعبة"},
        {"No episodes: put them in a folder named radio beside Qahira.qpk", "لا حلقات: ضعها في مجلد اسمه radio بجانب Qahira.qpk"},
        {"The radio downloads its episodes over Wi-Fi", "يُنزّل الراديو حلقاته عبر الواي فاي"},
    };
    return d;
}

// prefixes: an entry whose English starts the string (a number or a name follows)
const std::vector<std::pair<const char*, const char*>>& prefixes() {
    static const std::vector<std::pair<const char*, const char*>> d = {
        {"Level ", "المستوى "},
        {"Downloading the radio: ", "تنزيل الراديو: "},
        {"Radio: ", "الراديو: "},
        {"Up to date: build ", "محدَّثة: الإصدار "},
        {"Download the update: build ", "تنزيل التحديث: الإصدار "},
        {"Downloading the update: ", "تنزيل التحديث: "},
        {"Update failed: ", "فشل التحديث: "},
        {"Build ", "الإصدار "},
        {"Filter: ", "الفرز: "},
        {"Needs ", "يحتاج "},
        {"Buy for ", "اشترِ بـ "},
        {"Sold for ", "بِيع بـ "},
        {"Bought for ", "اشتُري بـ "},
        {"Crafted: ", "صُنع: "},
        {"Its keys: ", "مفاتيحها: "},
        {"Why? ", "لماذا؟ "},
        {"Planned ", "مُخطَّط "},
        {"Placed ", "موضوع "},
        {"Staged ", "مُعَدّ "},
        {"Ascendancy points: ", "نقاط الارتقاء: "},
        {"Planned the Recommended Path: ", "خُطِّط الطريق المقترح: "},
        {"You carry no chart of ", "لا تحمل خريطة من "},
        {"on the pointer of ", "على مؤشر "},
    };
    return d;
}

// suffixes: a number, then the entry ("23 stars to place")
const std::vector<std::pair<const char*, const char*>>& suffixes() {
    static const std::vector<std::pair<const char*, const char*>> d = {
        {" episodes on the radio", " حلقة على الراديو"},
        {" episode on the radio", " حلقة على الراديو"},
        {" stars to place", " نجمة لتضعها"},
        {" star to place", " نجمة لتضعها"},
        {" dinars", " دينار"},
        {" DPS", " ضرر/ث"},
    };
    return d;
}

const std::unordered_map<std::string, std::string>& table() {
    static const std::unordered_map<std::string, std::string> t = [] {
        std::unordered_map<std::string, std::string> m;
        for (auto& [en, ar] : whole()) m[en] = ar;
        return m;
    }();
    return t;
}
}  // namespace

void set_lang(Lang l) { g_lang = l; }
Lang lang() { return g_lang; }
const char* lang_name(Lang l) { return l == Lang::Ar ? "العربية" : "English"; }
size_t translation_count() { return whole().size() + prefixes().size() + suffixes().size(); }

bool translate(const std::string& en, std::string& out) {
    if (g_lang != Lang::Ar || en.empty()) return false;
    auto& t = table();
    if (auto it = t.find(en); it != t.end()) { out = it->second; return true; }
    for (auto& [p, ar] : prefixes()) {
        const std::string pre = p;
        if (en.size() > pre.size() && en.compare(0, pre.size(), pre) == 0) {
            std::string rest = en.substr(pre.size());
            std::string rt;
            out = std::string(ar) + (translate(rest, rt) ? rt : rest);
            return true;
        }
    }
    for (auto& [sfx, ar] : suffixes()) {   // only after a number
        const std::string x = sfx;
        if (en.size() > x.size() && en.compare(en.size() - x.size(), x.size(), x) == 0) {
            const std::string head = en.substr(0, en.size() - x.size());
            if (head.find_first_not_of("0123456789.,+-% ") == std::string::npos) { out = head + ar; return true; }
        }
    }
    return false;
}

std::string tr(const std::string& en) {
    std::string out;
    return translate(en, out) ? out : en;
}

}  // namespace q
