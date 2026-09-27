#include "game/stats.hpp"
#include <algorithm>

namespace q {

uint32_t damage_type_tags(int dt) {
    switch (dt) {
        case DT_PHYS: return T_PHYSICAL;
        case DT_FIRE: return T_FIRE | T_ELEMENTAL;
        case DT_COLD: return T_COLD | T_ELEMENTAL;
        case DT_LIGHTNING: return T_LIGHTNING | T_ELEMENTAL;
        default: return T_CHAOS;
    }
}

const char* damage_type_name(int dt) {
    static const char* n[] = {"Physical", "Fire", "Cold", "Lightning", "Chaos"};
    return dt >= 0 && dt < DT_COUNT ? n[dt] : "?";
}

const char* stat_name(Stat s) {
    static const char* n[S_COUNT] = {
        "Strength", "Dexterity", "Intelligence", "Life", "Mana", "Life Regeneration", "Mana Regeneration", "Life Leech",
        "Armour", "Evasion", "Block", "Fire Resistance", "Cold Resistance", "Lightning Resistance", "Chaos Resistance",
        "Damage", "Added Damage", "Added Damage", "Attack Speed", "Cast Speed", "Critical Strike Chance",
        "Critical Strike Multiplier", "Area of Effect", "Movement Speed", "Break", "Cooldown Recovery", "Mana Cost",
        "Damage Taken", "Flask Recovery", "Accuracy", "Hirz", "Hirz Recharge", "Freeze Buildup", "Shock Effect", "Chains",
        "Projectile Speed", "Warcry Effect", "Projectiles", "Damage Gained as Fire", "Chance to Ignite", "Talisman Level"};
    return s < S_COUNT ? n[s] : "?";
}

bool stat_from_key(const std::string& k, Stat& out) {
    static const struct { const char* key; Stat s; } t[] = {
        {"str", S_STR}, {"dex", S_DEX}, {"int", S_INT}, {"life", S_LIFE}, {"mana", S_MANA}, {"life_regen", S_LIFE_REGEN},
        {"mana_regen", S_MANA_REGEN}, {"life_leech", S_LIFE_LEECH}, {"armour", S_ARMOUR}, {"evasion", S_EVASION},
        {"block", S_BLOCK}, {"fire_res", S_FIRE_RES}, {"cold_res", S_COLD_RES}, {"lightning_res", S_LIGHTNING_RES},
        {"chaos_res", S_CHAOS_RES}, {"damage", S_DAMAGE}, {"added_min", S_ADDED_MIN}, {"added_max", S_ADDED_MAX},
        {"attack_speed", S_ATTACK_SPEED}, {"cast_speed", S_CAST_SPEED}, {"crit_chance", S_CRIT_CHANCE},
        {"crit_multi", S_CRIT_MULTI}, {"area", S_AREA}, {"move_speed", S_MOVE_SPEED}, {"break", S_BREAK},
        {"cooldown", S_COOLDOWN_RECOVERY}, {"mana_cost", S_MANA_COST}, {"damage_taken", S_DAMAGE_TAKEN},
        {"flask", S_FLASK_RECOVERY}, {"accuracy", S_ACCURACY}, {"es", S_ES}, {"es_recharge", S_ES_RECHARGE},
        {"freeze", S_FREEZE}, {"shock", S_SHOCK}, {"chains", S_CHAINS}, {"proj_speed", S_PROJ_SPEED}, {"warcry", S_WARCRY},
        {"projectiles", S_PROJECTILES}, {"gain_fire", S_GAIN_FIRE}, {"ignite", S_IGNITE}, {"skill_level", S_SKILL_LEVEL},
    };
    for (auto& e : t) if (k == e.key) { out = e.s; return true; }
    return false;
}

bool tag_from_key(const std::string& k, uint32_t& out) {
    static const struct { const char* key; uint32_t t; } t[] = {
        {"attack", T_ATTACK}, {"spell", T_SPELL}, {"melee", T_MELEE}, {"area", T_AREA}, {"projectile", T_PROJECTILE},
        {"slam", T_SLAM}, {"strike", T_STRIKE}, {"warcry", T_WARCRY}, {"duration", T_DURATION}, {"minion", T_MINION},
        {"physical", T_PHYSICAL}, {"fire", T_FIRE}, {"cold", T_COLD}, {"lightning", T_LIGHTNING}, {"chaos", T_CHAOS},
        {"elemental", T_ELEMENTAL}, {"two_hand", T_TWO_HAND}, {"mace", T_MACE}, {"ailment", T_AILMENT}, {"channel", T_CHANNEL},
        {"chaining", T_CHAINING}, {"staff", T_STAFF}, {"glyph", T_GLYPH},
    };
    for (auto& e : t) if (k == e.key) { out = e.t; return true; }
    return false;
}

void Stats::remove_source(uint16_t src) {
    mods.erase(std::remove_if(mods.begin(), mods.end(), [&](const Mod& m) { return m.source == src; }), mods.end());
}

std::vector<Mod> Stats::why(Stat s, uint32_t context) const {
    std::vector<Mod> out;
    for (const Mod& m : mods)
        if (m.stat == s && (m.tags & ~context) == 0) out.push_back(m);
    return out;
}

StatSum Stats::sum(Stat s, uint32_t context) const {
    StatSum r;
    for (const Mod& m : mods) {
        if (m.stat != s || (m.tags & ~context) != 0) continue;
        switch (m.kind) {
            case MK_FLAT: r.flat += m.value; break;
            case MK_INC: r.inc += m.value; break;
            case MK_MORE: r.more *= 1.f + m.value / 100.f; break;
        }
    }
    return r;
}

float HitDamage::average() const {
    float t = 0;
    for (int i = 0; i < DT_COUNT; i++) t += (min[size_t(i)] + max[size_t(i)]) * 0.5f;
    return t;
}

float HitDamage::dps() const {
    float crit_factor = 1.f + crit_chance * (crit_multi - 1.f);
    return average() * crit_factor * speed;
}

HitDamage compute_hit(const Stats& a, const WeaponStats& w, const SkillStats& sk) {
    HitDamage h;
    const bool attack = (sk.tags & T_ATTACK) != 0;
    const uint32_t ctx = sk.tags | (attack ? w.tags : 0u);
    // base and added damage per type, then "gain as extra Fire" on the total (GDD §8 step 3)
    std::array<float, DT_COUNT> blo{}, bhi{};
    for (int t = 0; t < DT_COUNT; t++) {
        uint32_t c = ctx | damage_type_tags(t);
        float lo = 0, hi = 0;
        if (attack) {
            if (t == DT_PHYS) { lo = w.phys_min; hi = w.phys_max; }
            lo += w.add_min[size_t(t)];
            hi += w.add_max[size_t(t)];
        } else if (sk.base_type == t) {
            lo = sk.base_min;
            hi = sk.base_max;
        }
        lo += a.sum(S_ADDED_MIN, c).flat;
        hi += a.sum(S_ADDED_MAX, c).flat;
        blo[size_t(t)] = lo * sk.effectiveness;
        bhi[size_t(t)] = std::max(lo, hi) * sk.effectiveness;
    }
    float gain = a.sum(S_GAIN_FIRE, ctx).flat / 100.f;
    if (gain > 0) {
        float slo = 0, shi = 0;
        for (int t = 0; t < DT_COUNT; t++) { slo += blo[size_t(t)]; shi += bhi[size_t(t)]; }
        blo[DT_FIRE] += slo * gain;
        bhi[DT_FIRE] += shi * gain;
    }
    for (int t = 0; t < DT_COUNT; t++) {
        uint32_t c = ctx | damage_type_tags(t);
        StatSum dmg = a.sum(S_DAMAGE, c);
        float k = std::max(0.f, 1.f + dmg.inc / 100.f) * dmg.more;
        h.min[size_t(t)] = blo[size_t(t)] * k;
        h.max[size_t(t)] = bhi[size_t(t)] * k;
    }
    float base_crit = attack ? w.crit : sk.crit;
    h.crit_chance = clampf(a.value(S_CRIT_CHANCE, base_crit, ctx) / 100.f, 0.f, 1.f);
    h.crit_multi = 1.5f + a.sum(S_CRIT_MULTI, ctx).flat / 100.f;
    if (attack) h.speed = a.value(S_ATTACK_SPEED, w.aps, ctx);
    else h.speed = a.value(S_CAST_SPEED, 1.f, ctx);
    return h;
}

Defences defences_of(const Stats& s, float penalty) {
    Defences d;
    d.armour = std::max(0.f, s.value(S_ARMOUR));
    d.evasion = std::max(0.f, s.value(S_EVASION));
    d.res[DT_FIRE] = s.value(S_FIRE_RES) - penalty;
    d.res[DT_COLD] = s.value(S_COLD_RES) - penalty;
    d.res[DT_LIGHTNING] = s.value(S_LIGHTNING_RES) - penalty;
    d.res[DT_CHAOS] = s.value(S_CHAOS_RES) - penalty;
    d.damage_taken_inc = s.sum(S_DAMAGE_TAKEN).inc;
    return d;
}

float armour_reduction(float armour, float raw) {
    if (armour <= 0 || raw <= 0) return 0;
    return std::min(0.9f, armour / (armour + 10.f * raw));
}

HitResult roll_hit(const HitDamage& d, const Defences& def, Rng& rng) {
    HitResult r;
    r.crit = rng.uniform() < d.crit_chance;
    float mult = r.crit ? d.crit_multi : 1.f;
    for (int t = 0; t < DT_COUNT; t++) {
        float lo = d.min[size_t(t)], hi = d.max[size_t(t)];
        if (hi <= 0) continue;
        float v = rng.range(lo, hi) * mult;
        if (t == DT_PHYS) v *= 1.f - armour_reduction(def.armour, v);
        else v *= 1.f - clampf(def.res[size_t(t)], -200.f, def.max_res) / 100.f;
        v *= 1.f + def.damage_taken_inc / 100.f;
        r.by_type[size_t(t)] = v;
        r.total += v;
    }
    return r;
}

}  // namespace q
