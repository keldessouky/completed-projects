// The UI's two languages (GDD §11): English, and Arabic with a right-to-left layout. The UI draws English strings;
// in Arabic, Ui::text looks each one up here, whole or by a leading prefix ("Level " + a number), and draws the
// Arabic. Strings with no entry (item, zone and monster names, the codex) stay English.
#pragma once
#include <string>

namespace q {

enum class Lang : unsigned char { En, Ar };
void set_lang(Lang l);
Lang lang();
const char* lang_name(Lang l);                  // in its own language
bool translate(const std::string& en, std::string& out);   // false: no entry (or English)
std::string tr(const std::string& en);          // the translation, or the string as it is
size_t translation_count();

}  // namespace q
