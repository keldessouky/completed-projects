#include "game/skills.hpp"
#include <cmath>

namespace q {

// Append only: a Talisman stores its skill's index, so reordering would change saved characters.
const std::vector<SkillDef>& skill_defs() {
    static const std::vector<SkillDef> d = [] {
        std::vector<SkillDef> v;
        auto add = [&](SkillDef s) { v.push_back(s); return &v.back(); };
        // ---- the Warrior's kit (Slice 1)
        add({"crushing_blow", "Crushing Blow", "Strike in an arc. Every third hit in a row cracks the ground.",
             T_ATTACK | T_MELEE | T_STRIKE, "swing", 1.1f, 0, 0, DT_PHYS, 0, 0, Shape::Cone, 2.5f, 0, 1.05f, 1.0f, 0, ATTR_STR, "warrior"});
        add({"earthshatter", "Earthshatter", "Slam the ground ahead, leaving three cracks.",
             T_ATTACK | T_MELEE | T_SLAM | T_AREA, "slam", 1.7f, 0, 0, DT_PHYS, 7, 0, Shape::Circle, 1.7f, 2.0f, 0, 1.6f, 1, ATTR_STR, "warrior"});
        add({"rallying_shout", "Rallying Shout", "Nearby enemies build Break. Your next 3 hits deal 40% more damage.",
             T_WARCRY | T_AREA, "warcry", 0, 0, 0, DT_PHYS, 9, 6.0f, Shape::Warcry, 0, 5.5f, 0, 1.0f, 2, ATTR_STR, "warrior"});
        add({"aftershock", "Aftershock", "Every crack within 7 m erupts. With no cracks, slam around yourself.",
             T_ATTACK | T_MELEE | T_SLAM | T_AREA, "slam", 1.25f, 0, 0, DT_PHYS, 11, 0, Shape::Detonate, 7.0f, 2.3f, 0, 1.3f, 3, ATTR_STR, "warrior"});
        // ---- the Sorcerer's kit (Slice 3): set up with cold and lightning, pay off with a falling star
        SkillDef* s;
        s = add({"ember_bolt", "Ember Bolt", "Hurl a bolt of fire. It can Ignite, burning the target over time.",
                 T_SPELL | T_PROJECTILE | T_FIRE, "cast", 0, 7, 11, DT_FIRE, 5, 0, Shape::Projectile, 15.f, 0.35f, 0, 0.6f, 4, ATTR_INT, "sorcerer"});
        s->proj_speed = 17.f;
        s->ignite = 25;
        s = add({"frost_glyph", "Frost Glyph", "Inscribe a glyph of frost that Chills and pulses cold for 6 s. Your spells cast "
                 "while standing in it deal 30% more damage.",
                 T_SPELL | T_AREA | T_COLD | T_DURATION | T_GLYPH, "cast_ground", 0, 4, 6, DT_COLD, 11, 3.5f, Shape::Glyph, 6.f, 3.0f, 0, 0.5f, 5, ATTR_INT, "sorcerer"});
        s->duration = 6.f;
        s = add({"arc", "Arc", "A bolt of lightning leaps to a nearby enemy and chains to three more. It can Shock, so they take more damage.",
                 T_SPELL | T_LIGHTNING | T_CHAINING, "cast", 0, 3, 16, DT_LIGHTNING, 7, 0, Shape::Chain, 11.f, 5.5f, 0, 0.5f, 6, ATTR_INT, "sorcerer"});
        s->chains = 3;
        s->shock = 30;
        s = add({"falling_star", "Falling Star", "Call a star down on the target. Chilled or Frozen enemies take 60% more damage, "
                 "and a Frost Glyph it lands in bursts.",
                 T_SPELL | T_AREA | T_FIRE, "cast_ground", 0, 20, 30, DT_FIRE, 16, 2.5f, Shape::Meteor, 9.f, 2.6f, 0, 1.5f, 7, ATTR_INT, "sorcerer"});
        // ---- the Ranger's kit (Slice 6): mark the strongest, then rain on the rest; poison what will not die
        s = add({"split_arrow", "Split Arrow", "Loose a fan of three arrows.",
                 T_ATTACK | T_PROJECTILE | T_BOW, "shoot", 0.82f, 0, 0, DT_PHYS, 0, 0, Shape::Projectile, 13.f, 0.3f, 0, 0.7f, 8, ATTR_DEX, "ranger"});
        s->projectiles = 3;
        s->proj_speed = 24.f;
        s = add({"falcons_mark", "Falcon's Mark", "Mark the enemy you aim at for 8 s. Its next 3 hits from your attacks are Critical Strikes.",
                 T_MARK | T_DURATION, "cast", 0, 0, 0, DT_PHYS, 6, 3.f, Shape::Mark, 14.f, 0, 0, 0.f, 9, ATTR_DEX, "ranger"});
        s = add({"rain_of_arrows", "Rain of Arrows", "Arrows fall on the spot you aim at, in three volleys.",
                 T_ATTACK | T_PROJECTILE | T_AREA | T_BOW, "shoot_up", 0.6f, 0, 0, DT_PHYS, 9, 0, Shape::Rain, 11.f, 2.8f, 0, 0.6f, 10, ATTR_DEX, "ranger"});
        s = add({"scorpion_sting", "Scorpion Sting", "A heavy arrow that pierces and has a 60% chance to Poison, which deals Chaos "
                 "damage over time and stacks.",
                 T_ATTACK | T_PROJECTILE | T_CHAOS | T_BOW, "shoot", 1.35f, 0, 0, DT_PHYS, 7, 1.2f, Shape::Projectile, 15.f, 0.35f, 0, 1.0f, 11, ATTR_DEX, "ranger"});
        s->proj_speed = 30.f;
        s->poison = 60;
        s->pierce = 1;   // its card always said it pierces; from Slice 7, projectiles can
        // ---- the Mercenary's kit (Slice 7): cut them bleeding, finish the bleeding; a crossbow and a pot of naphtha for the rest
        s = add({"crescent_cut", "Crescent Cut", "Cut in an arc with a sword. Hits build a combo: every third cut in a row is a "
                 "crescent that deals 60% more damage and always causes Bleeding.",
                 T_ATTACK | T_MELEE | T_STRIKE | T_SWORD, "swing", 1.1f, 0, 0, DT_PHYS, 0, 0, Shape::Cone, 2.4f, 0, 1.1f, 0.9f, 12, ATTR_STR, "mercenary"});
        s->bleed = 20;
        s = add({"riposte", "Riposte", "Two quick thrusts at one enemy. Against a Bleeding enemy they deal 80% more damage, and "
                 "the second makes its Bleeding burst: all the damage it had left, at once.",
                 T_ATTACK | T_MELEE | T_STRIKE | T_SWORD, "combo", 0.85f, 0, 0, DT_PHYS, 5, 1.5f, Shape::Cone, 2.6f, 0, 0.45f, 1.1f, 13, ATTR_DEX, "mercenary"});
        s = add({"naffata", "Naffata", "Throw a clay pot of naphtha. It bursts where it lands, burning everything near it, and can "
                 "Ignite.",
                 T_GRENADE | T_AREA | T_FIRE | T_PROJECTILE, "throw", 0, 14, 22, DT_FIRE, 9, 2.0f, Shape::Grenade, 10.f, 2.6f, 0, 1.2f, 14, ATTR_STR, "mercenary"});
        s->ignite = 30;
        s = add({"quarrel", "Quarrel", "Loose a heavy crossbow bolt that pierces two enemies. It can cause Bleeding.",
                 T_ATTACK | T_PROJECTILE | T_CROSSBOW, "shoot", 1.3f, 0, 0, DT_PHYS, 4, 0, Shape::Projectile, 15.f, 0.35f, 0, 1.2f, 15, ATTR_DEX, "mercenary"});
        s->proj_speed = 34.f;
        s->pierce = 2;
        s->bleed = 25;
        return v;
    }();
    return d;
}

int find_skill(const char* id) {
    auto& d = skill_defs();
    for (size_t i = 0; i < d.size(); i++) if (std::string(d[i].id) == id) return int(i);
    return -1;
}

uint32_t skill_weapon_need(const SkillDef& d) { return d.tags & (T_BOW | T_SWORD | T_CROSSBOW); }

const char* weapon_need_name(uint32_t need) {
    return need & T_BOW ? "a bow" : need & T_SWORD ? "a sword" : need & T_CROSSBOW ? "a crossbow" : "";
}

int skill_requirement(const SkillDef&, int level) { return level <= 1 ? 0 : int(8 + 3.4f * level); }

// ---- Wafq --------------------------------------------------------------------
const WafqDef& wafq_def(int w) {
    // the seven planetary squares of the old books; the Moon's (order 9) comes later
    static const WafqDef d[WQ_COUNT] = {
        {"saturn", "Wafq of Saturn", 3, "Supports any skill: 30% more damage", 0, 1.3f},
        {"jupiter", "Wafq of Jupiter", 4, "Supports any skill: gain 25% of damage as extra Fire damage", 0, 1.2f},
        {"mars", "Wafq of Mars", 5, "Supports any skill: 20% more attack and cast speed", 0, 1.15f},
        {"sun", "Wafq of the Sun", 6, "Supports area skills: 40% increased area of effect, 10% more area damage", T_AREA, 1.2f},
        {"venus", "Wafq of Venus", 7, "Supports projectiles and chains: +2 projectiles or chains, 20% less damage",
         T_PROJECTILE | T_CHAINING, 1.25f},
        {"mercury", "Wafq of Mercury", 8, "Supports any skill: 50% more Break, Freeze and Shock, and a 50% higher chance to Ignite", 0, 1.15f},
    };
    return d[w >= 0 && w < WQ_COUNT ? w : 0];
}

static void wafq_mods(int w, Stats& s) {
    const uint16_t src = uint16_t(SRC_WAFQ + w);
    switch (w) {
        case WQ_SATURN: s.add(S_DAMAGE, MK_MORE, 30, 0, src); break;
        case WQ_JUPITER: s.add(S_GAIN_FIRE, MK_FLAT, 25, 0, src); break;
        case WQ_MARS: s.add(S_ATTACK_SPEED, MK_MORE, 20, 0, src); s.add(S_CAST_SPEED, MK_MORE, 20, 0, src); break;
        case WQ_SUN: s.add(S_AREA, MK_INC, 40, 0, src); s.add(S_DAMAGE, MK_MORE, 10, T_AREA, src); break;
        case WQ_VENUS:
            s.add(S_PROJECTILES, MK_FLAT, 2, T_PROJECTILE, src);
            s.add(S_CHAINS, MK_FLAT, 2, T_CHAINING, src);
            s.add(S_DAMAGE, MK_MORE, -20, 0, src);
            break;
        case WQ_MERCURY:
            s.add(S_BREAK, MK_MORE, 50, 0, src);
            s.add(S_FREEZE, MK_MORE, 50, 0, src);
            s.add(S_SHOCK, MK_MORE, 50, 0, src);
            s.add(S_IGNITE, MK_MORE, 50, 0, src);
            break;
        default: break;
    }
}

std::vector<int> magic_square(int n) {
    std::vector<int> m(size_t(n * n), 0);
    auto at = [&](int r, int c) -> int& { return m[size_t(r * n + c)]; };
    if (n % 2 == 1) {  // the Siamese method: up and right, down on a collision
        int r = 0, c = n / 2;
        for (int k = 1; k <= n * n; k++) {
            at(r, c) = k;
            int nr = (r - 1 + n) % n, nc = (c + 1) % n;
            if (at(nr, nc)) { nr = (r + 1) % n; nc = c; }
            r = nr;
            c = nc;
        }
    } else if (n % 4 == 0) {  // doubly even: count up, and complement the cells on the diagonals of each 4x4 block
        for (int r = 0; r < n; r++)
            for (int c = 0; c < n; c++) {
                int k = r * n + c + 1;
                bool diag = (r % 4 == c % 4) || ((r % 4) + (c % 4) == 3);
                at(r, c) = diag ? n * n + 1 - k : k;
            }
    } else {  // singly even (the Sun's 6x6): Strachey's method from four odd squares
        int h = n / 2, sub = h * h, k = (n - 2) / 4;
        std::vector<int> o = magic_square(h);
        for (int r = 0; r < h; r++)
            for (int c = 0; c < h; c++) {
                int v = o[size_t(r * h + c)];
                at(r, c) = v;
                at(r + h, c + h) = v + sub;
                at(r, c + h) = v + 2 * sub;
                at(r + h, c) = v + 3 * sub;
            }
        for (int r = 0; r < h; r++) {
            for (int c = 0; c < n; c++) {
                bool swap = c < k || c >= n - k + 1;
                if (r == h / 2) swap = (c >= 1 && c <= k) || c >= n - k + 1;
                if (swap) std::swap(at(r, c), at(r + h, c));
            }
        }
    }
    return m;
}

// ---- Talismans ------------------------------------------------------------------
int Talisman::wafq_count() const {
    int n = 0;
    for (int i = 0; i < slots && i < 5; i++) n += wafq[i] >= 0;
    return n;
}

SkillCtx skill_ctx(const Talisman& t, const Stats& hero, const WeaponStats& w) {
    SkillCtx c;
    if (t.empty()) return c;
    const SkillDef& d = t.def();
    c.def = &d;
    c.stats = hero;
    c.level = std::clamp(int(t.level) + int(hero.sum(S_SKILL_LEVEL).flat), 1, 30);
    float mana_mult = 1;
    for (int i = 0; i < t.slots && i < 5; i++) {
        int wq = t.wafq[i];
        if (wq < 0 || wq >= WQ_COUNT) continue;
        const WafqDef& wd = wafq_def(wq);
        if (wd.needs && !(d.tags & wd.needs)) continue;  // it does not fit this Talisman
        wafq_mods(wq, c.stats);
        mana_mult *= wd.mana_mult;
    }
    const Stats& s = c.stats;
    const float lv = float(c.level - 1);
    c.ss.tags = d.tags;
    c.ss.effectiveness = (d.tags & T_ATTACK) ? d.effectiveness * (1.f + 0.04f * lv) : 1.f;  // spells: base damage carries the level
    c.ss.base_min = d.base_min * std::pow(1.12f, lv);
    c.ss.base_max = d.base_max * std::pow(1.12f, lv);
    c.ss.base_type = d.base_type;
    c.ss.crit = (d.tags & T_SPELL) ? 6.f : 5.f;
    c.ss.break_mult = d.break_mult;
    c.hit = compute_hit(s, w, c.ss);
    c.mana = std::round(d.mana * (1.f + 0.05f * lv) * mana_mult * std::max(0.1f, 1.f + s.sum(S_MANA_COST, d.tags).inc / 100.f));
    c.cooldown = d.cooldown / std::max(0.1f, 1.f + s.sum(S_COOLDOWN_RECOVERY, d.tags).inc / 100.f);
    c.speed = c.hit.speed;  // attacks per second (a 1.0 aps maul plays its clip at speed 1), or casts per second
    c.area = std::sqrt(std::max(0.2f, s.sum(S_AREA, d.tags).apply(1.f)));
    c.projectiles = d.projectiles + int(s.sum(S_PROJECTILES, d.tags).flat);
    c.chains = d.chains + int(s.sum(S_CHAINS, d.tags).flat);
    c.proj_speed = d.proj_speed * std::max(0.3f, 1.f + s.sum(S_PROJ_SPEED, d.tags).inc / 100.f);
    StatSum ig = s.sum(S_IGNITE, d.tags);
    c.ignite = clampf((d.ignite + ig.flat) * (1.f + ig.inc / 100.f) * ig.more / 100.f, 0.f, 1.f);
    c.shock_effect = s.sum(S_SHOCK, d.tags).apply(1.f);
    c.shock = clampf(d.shock / 100.f * c.shock_effect, 0.f, 1.f);
    c.freeze = s.sum(S_FREEZE, d.tags).apply(1.f);
    c.break_mult = d.break_mult * s.sum(S_BREAK, d.tags).apply(1.f);
    StatSum po = s.sum(S_POISON, d.tags);
    c.poison = clampf((d.poison + po.flat) * (1.f + po.inc / 100.f) * po.more / 100.f, 0.f, 1.f);
    c.poison_mult = s.sum(S_POISON_DAMAGE, d.tags).apply(1.f) * s.sum(S_DAMAGE, d.tags | T_CHAOS).apply(1.f);
    StatSum mk = s.sum(S_MARK, d.tags);
    c.mark_hits = 3 + int(mk.flat);
    c.mark_duration = 8.f * (1.f + mk.inc / 100.f);
    StatSum bl = s.sum(S_BLEED, d.tags);
    c.bleed = clampf((d.bleed + bl.flat) * (1.f + bl.inc / 100.f) * bl.more / 100.f, 0.f, 1.f);
    c.bleed_mult = s.sum(S_BLEED_DAMAGE, d.tags).apply(1.f);   // the hit it comes from already carries the damage mods
    c.pierce = d.pierce + int(s.sum(S_PIERCE, d.tags).flat);
    static const Stat attr_stat[3] = {S_STR, S_DEX, S_INT};
    const uint32_t need = skill_weapon_need(d);
    c.needs_weapon = need && !(w.tags & need);
    c.weapon_needed = weapon_need_name(need);
    c.usable = hero.value(attr_stat[d.attr]) >= float(skill_requirement(d, t.level)) && !c.needs_weapon;
    return c;
}

}  // namespace q
