// Arabic for the UI (GDD §11: English and Arabic, the text engine shapes Arabic). No HarfBuzz: the letters are mapped
// to their contextual forms in the Presentation Forms-B block (isolated, final, initial, medial), lam-alef becomes
// its ligature, and a line is put in visual order by the simple rules of the bidi algorithm: Arabic runs right to
// left, Latin words and numbers left to right inside them, neutrals taking the side of their neighbours.
#pragma once
#include <string>

namespace q {

std::u32string utf8_to_u32(const std::string& s);
std::string u32_to_utf8(const std::u32string& s);
bool is_arabic(char32_t c);                 // letters, harakat, Arabic punctuation and digits
bool has_arabic(const std::string& s);
std::u32string shape_arabic(const std::u32string& logical);   // contextual forms and lam-alef; harakat dropped
std::u32string visual_order(const std::u32string& shaped);    // left-to-right drawing order of one line
std::u32string arabic_line(const std::string& utf8);          // both, for drawing

}  // namespace q
