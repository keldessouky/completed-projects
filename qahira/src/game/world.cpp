#include "game/world.hpp"
#include "core/log.hpp"
#include "game/classes.hpp"
#include <algorithm>
#include <cstdio>

namespace q {

// ============================================================ data tables
const std::vector<MonsterDef>& monster_defs() {
    static const std::vector<MonsterDef> d = {
        {"ghoul", "Ghoul", "ghoul", 1.0f, {1, 1, 1}, 38, 4.3f, 0.42f, AttackKind::Claw, 1.5f, 1.3f, 5, 9, DT_PHYS, 10, 12, 0},
        {"ghoul_bruiser", "Grave Bruiser", "ghoul", 1.38f, {0.62f, 0.55f, 0.6f}, 110, 3.1f, 0.62f, AttackKind::Slam, 2.3f, 2.4f, 13, 19, DT_PHYS, 80, 40, 0},
        {"ghoul_spitter", "Bile Spitter", "ghoul", 0.95f, {0.72f, 0.95f, 0.62f}, 46, 3.7f, 0.4f, AttackKind::Spit, 9.0f, 2.0f, 7, 12, DT_CHAOS, 5, 16, 6.5f},
        {"umm_al_ghula", "Umm al-Ghula, Mother of the Ghouls", "ghoula", 1.25f, {1, 1, 1}, 760, 3.9f, 0.85f, AttackKind::Boss, 3.2f, 1.5f, 11, 17, DT_PHYS, 150, 420, 0},
    };
    return d;
}

int find_monster(const char* id) {
    auto& d = monster_defs();
    for (size_t i = 0; i < d.size(); i++) if (std::string(d[i].id) == id) return int(i);
    return 0;
}

const char* monster_mod_name(int m) {
    static const char* n[] = {"Hasted", "Armoured", "Frenzied", "Vampiric"};
    return m >= 0 && m < MM_COUNT ? n[m] : "";
}

// ============================================================ hero
static std::string g_hero_model = "warrior";
const char* hero_model() { return g_hero_model.c_str(); }

void apply_class_base(Hero& H, const std::string& cls) {
    const ClassDef& c = class_def(cls);
    Stats& b = H.base;
    b = Stats{};
    b.add(S_STR, MK_FLAT, c.str, 0, SRC_CLASS);
    b.add(S_DEX, MK_FLAT, c.dex, 0, SRC_CLASS);
    b.add(S_INT, MK_FLAT, c.intel, 0, SRC_CLASS);
    b.add(S_LIFE, MK_FLAT, c.life, 0, SRC_CLASS);
    b.add(S_MANA, MK_FLAT, c.mana, 0, SRC_CLASS);
    b.add(S_MANA_REGEN, MK_FLAT, 2.5f, 0, SRC_CLASS);
    if (c.armour > 0) b.add(S_ARMOUR, MK_FLAT, c.armour, 0, SRC_CLASS);
    if (c.es > 0) b.add(S_ES, MK_FLAT, c.es, 0, SRC_CLASS);
    g_hero_model = c.model;
}

void give_class_kit(Hero& H) {
    // four Talismans on the first bar, each with the two Wafq slots every Talisman starts with
    const ClassDef& c = class_def(H.passives.cls);
    H.talismans.clear();
    for (auto& b : H.bar) b = -1;
    for (int i = 0; i < 4; i++) {
        int sk = c.kit[i] && *c.kit[i] ? find_skill(c.kit[i]) : -1;
        if (sk < 0) continue;
        Talisman t;
        t.skill = int16_t(sk);
        H.talismans.push_back(t);
        H.bar[i] = int8_t(H.talismans.size() - 1);
    }
}

void World::reset_hero(const std::string& cls) {
    hero = Hero{};
    tree().load();
    const ClassDef& c = class_def(cls);
    hero.passives.reset(c.id);
    apply_class_base(hero, c.id);
    hero.weapon() = make_item(find_base(c.weapon), Rarity::Normal, 1, rng);
    give_class_kit(hero);
    Actor h;
    h.id = next_id++;
    h.team = TEAM_HERO;
    h.radius = 0.45f;
    h.speed = 5.2f;
    h.name = c.name;
    actors.clear();
    actors.push_back(h);
    recompute_hero();
    actors[0].life = actors[0].life_max;
    actors[0].mana = actors[0].mana_max;
}

void compute_hero_stats(Hero& H) {
    H.stats = H.base;
    H.stats.add(S_LIFE, MK_FLAT, 12.f * (H.level - 1), 0, SRC_LEVEL);
    H.stats.add(S_MANA, MK_FLAT, 6.f * (H.level - 1), 0, SRC_LEVEL);
    for (int e = 0; e < EQ_COUNT; e++)
        if (!H.equip[e].empty()) H.equip[e].add_global_mods(H.stats, uint16_t(1 + e));
    H.passives.apply(H.stats);
    H.keystones = H.passives.keystones();
    // attributes: Strength gives life and melee damage, Dexterity evasion, Intelligence mana and Hirz
    float str = H.stats.value(S_STR), dex = H.stats.value(S_DEX), in = H.stats.value(S_INT);
    H.stats.add(S_LIFE, MK_FLAT, str * 0.5f, 0, SRC_ATTRIBUTES);
    H.stats.add(S_DAMAGE, MK_INC, str / 5.f, T_MELEE | T_PHYSICAL, SRC_ATTRIBUTES);
    H.stats.add(S_EVASION, MK_INC, dex / 5.f, 0, SRC_ATTRIBUTES);
    H.stats.add(S_MANA, MK_FLAT, in * 0.5f, 0, SRC_ATTRIBUTES);
    H.stats.add(S_ES, MK_INC, in / 5.f, 0, SRC_ATTRIBUTES);
}

HeroSummary summarize(const Hero& hero) {
    HeroSummary s;
    Hero H = hero;
    compute_hero_stats(H);
    s.life = std::round(H.stats.value(S_LIFE));
    s.mana = std::round(H.stats.value(S_MANA));
    s.es = std::round(std::max(0.f, H.stats.value(S_ES)));
    s.armour = H.stats.value(S_ARMOUR);
    Defences d = defences_of(H.stats);
    for (int t = 0; t < DT_COUNT; t++) s.res[size_t(t)] = std::min(d.res[size_t(t)], d.max_res);
    s.str = H.stats.value(S_STR);
    s.dex = H.stats.value(S_DEX);
    s.intel = H.stats.value(S_INT);
    for (int slot = 0; slot < 10; slot++) {
        const Talisman* t = H.slot_talisman(slot);
        if (!t || (t->def().tags & (T_ATTACK | T_SPELL)) == 0) continue;
        SkillCtx c = skill_ctx(*t, H.stats, H.weapon().weapon());
        s.dps = c.hit.dps() * float(std::max(1, c.projectiles));
        s.skill = c.def->name;
        break;
    }
    // effective hit points against a mixed hit: life and Hirz through armour and average resistance
    // (half physical at 40 a hit, half elemental), so armour and resistances both count
    float avg_res = (s.res[DT_FIRE] + s.res[DT_COLD] + s.res[DT_LIGHTNING]) / 300.f;
    float taken = 0.5f * (1.f - armour_reduction(s.armour, 40.f)) + 0.5f * (1.f - avg_res);
    s.ehp = (s.life + s.es) / std::max(0.05f, taken);
    return s;
}

void World::recompute_hero() {
    Hero& H = hero;
    compute_hero_stats(H);
    Actor& a = actors[0];
    float old_max = a.life_max;
    a.life_max = std::round(H.stats.value(S_LIFE));
    a.mana_max = std::round(H.stats.value(S_MANA));
    a.armour = H.stats.value(S_ARMOUR);
    float old_es = H.es_max;
    H.es_max = std::round(std::max(0.f, H.stats.value(S_ES)));
    H.es = old_es > 0 ? std::min(H.es_max, H.es * H.es_max / old_es) : H.es_max;
    a.speed = 5.2f * (1 + H.stats.sum(S_MOVE_SPEED).inc / 100.f);
    if (old_max > 0 && old_max != a.life_max) a.life = std::min(a.life_max, a.life * a.life_max / old_max);
    a.mana = std::min(a.mana, a.mana_max);
}

SkillCtx World::slot_ctx(int slot) const {
    const Talisman* t = hero.slot_talisman(slot);
    return t ? skill_ctx(*t, hero.stats, hero_weapon()) : SkillCtx{};
}

float World::skill_cost(int slot) const { return slot_ctx(slot).mana; }

int World::main_slot() const {
    for (int slot = 0; slot < 10; slot++) {
        const Talisman* t = hero.slot_talisman(slot);
        if (t && (t->def().tags & (T_ATTACK | T_SPELL))) return slot;
    }
    return -1;
}

float World::hero_dps(const Item& weapon) const {
    int slot = main_slot();
    const Talisman* t = hero.slot_talisman(slot);
    if (!t) return 0;
    Stats s = hero.stats;
    s.remove_source(1);
    weapon.add_global_mods(s, 1);
    SkillCtx c = skill_ctx(*t, s, weapon.weapon());
    return c.hit.dps() * float(std::max(1, c.projectiles));
}

// ============================================================ monsters
Actor& World::spawn_monster(int def, vec2 pos, Rarity rarity, int lvl) {
    const MonsterDef& d = monster_defs()[size_t(def)];
    Actor m;
    m.id = next_id++;
    m.team = TEAM_ENEMY;
    m.def = def;
    m.rarity = rarity;
    m.name = d.name;
    m.pos = pos;
    m.facing = -kPi / 2;
    m.scale = d.scale;
    m.tint = d.tint;
    m.radius = d.radius;
    float lvl_k = 1.f + 0.14f * (lvl - 1);
    m.life_max = d.life * lvl_k;
    m.armour = d.armour * lvl_k;
    m.speed = d.speed * rng.range(0.92f, 1.08f);
    m.attack_cd = rng.range(0.2f, 1.2f);
    if (rarity == Rarity::Magic) { m.life_max *= 1.8f; m.dmg_mult = 1.2f; }
    if (d.attack == AttackKind::Boss) { m.rarity = Rarity::Unique; m.cd2 = 3.f; m.cd3 = 1e9f; m.home = pos; }
    if (rarity == Rarity::Rare) {
        m.life_max *= 2.6f;
        m.dmg_mult = 1.25f;
        m.scale *= 1.08f;
        static const char* a[] = {"Hollow", "Grave", "Dust", "Bone", "Salt", "Night"};
        static const char* b[] = {"Gnaw", "Hunger", "Mouth", "Keeper", "Rot", "Widow"};
        m.name = std::string(a[rng.next() % 6]) + " " + b[rng.next() % 6];
        int n = 2;
        for (int i = 0; i < n; i++) {
            uint8_t mm;
            do { mm = uint8_t(rng.next() % MM_COUNT); } while (i > 0 && mm == m.mods[0]);
            m.mods[i] = mm;
            if (mm == MM_HASTED) m.speed_mult = 1.35f;
            if (mm == MM_ARMOURED) m.armour += 400;
            if (mm == MM_FRENZIED) m.dmg_mult *= 1.3f;
        }
    }
    m.speed *= m.speed_mult;
    m.life = m.life_max;
    m.model = assets().character(d.model);
    m.anim.bind(m.model.skel, m.model.anims);
    m.anim.play("idle", 0);
    m.anim.t = rng.range(0, 2);
    actors.push_back(m);
    return actors.back();
}

int World::enemies_alive() const {
    int n = 0;
    for (size_t i = 1; i < actors.size(); i++) if (actors[i].alive()) n++;
    return n;
}

const Actor* World::focus_enemy() const {
    const Actor* best = nullptr;
    float bd = 1e9f;
    const Actor& h = actors[0];
    for (size_t i = 1; i < actors.size(); i++) {
        const Actor& a = actors[i];
        if (!a.alive() || a.rarity < Rarity::Rare) continue;
        float d = length(a.pos - h.pos) - (a.rarity == Rarity::Unique ? 6.f : 0.f);
        if (d < 14 && d < bd) { bd = d; best = &a; }
    }
    return best;
}

// ============================================================ step
void World::step(const Input& in, float dt) {
    events.clear();
    used_interact = -1;
    time += dt;
    fx_step(dt);
    if (hitstop > 0) { hitstop -= dt; return; }
    hero_step(in, dt);
    for (size_t i = 1; i < actors.size(); i++) monster_step(actors[i], dt);
    separate();
    // projectiles: the monsters' bile and the hero's bolts
    Actor& h = actors[0];
    for (auto& p : projectiles) {
        p.pos += p.vel * dt;
        p.life -= dt;
        if (fx_rng.chance(0.6f)) {
            Particle q{vec3(p.pos, p.z), {0, 0, 0}, 0.3f, 0.3f, 0.25f, 0.05f, 0, 1, vec4(p.color, 0.8f), vec4(p.color * 0.5f, 0), 0, true};
            particles.push_back(q);
        }
        if (p.team == TEAM_ENEMY && h.alive() && length(p.pos - h.pos) < p.radius + h.radius) {
            damage_hero(p.dmg_min, p.dmg_max, p.dmg_type, p.pos - p.vel, 8, p.owner);
            p.life = 0;
        }
        if (p.team == TEAM_HERO && p.life > 0)
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                if (!e.alive() || length(e.pos - p.pos) > p.radius + e.radius) continue;
                hit_enemy(e, p.hh, p.pos - normalize(p.vel), 1.5f);
                emit(Ev::FireHit, p.pos);
                p.life = 0;
                break;
            }
        if (level.blocked(p.pos, 0.05f)) p.life = 0;
        if (p.life <= 0) {
            burst(vec3(p.pos, 0.3f), 12, vec4(p.color, 1), vec4(p.color * 0.3f, 0), 3.f, 0.18f, 0.5f, true);
            if (p.team == TEAM_ENEMY) emit(Ev::Splash, p.pos);
        }
    }
    projectiles.erase(std::remove_if(projectiles.begin(), projectiles.end(), [](const Projectile& p) { return p.life <= 0; }), projectiles.end());
    // ground effects: glyphs pulse, stars land
    for (size_t i = 0; i < ground.size(); i++) {
        GroundFx& g = ground[i];
        g.t += dt;
        if (g.kind == GroundFx::Glyph && g.t >= g.pulse && g.t < g.life) { g.pulse += 1.f; glyph_pulse(ground[i]); }
        if (g.kind == GroundFx::Meteor && g.t >= g.life) star_fall(ground[i]);
    }
    ground.erase(std::remove_if(ground.begin(), ground.end(), [](const GroundFx& g) { return g.t >= g.life; }), ground.end());
    // remove fully dissolved corpses
    actors.erase(std::remove_if(actors.begin() + 1, actors.end(), [](const Actor& a) { return a.act == Act::Dead && a.dead_t > 2.2f; }), actors.end());
    // the interactable in reach, if any
    near_interact = -1;
    float bi = 1e9f;
    for (size_t i = 0; i < interacts.size(); i++) {
        if (interacts[i].spent) continue;
        float d = length(interacts[i].pos - h.pos);
        if (d < interacts[i].radius && d < bi) { bi = d; near_interact = int(i); }
    }
    for (auto& n : npcs) n.anim.update(dt);
    // loot selection: the nearest item within reach
    selected_loot = -1;
    float bd = 2.2f;
    for (size_t i = 0; i < loot.size(); i++) {
        GroundItem& g = loot[i];
        g.t += dt;
        float d = length(g.pos - h.pos);
        if (g.kind != GroundItem::Gear) {
            if (d < 1.3f && g.t > 0.4f && h.alive()) {
                if (g.kind == GroundItem::Gold) {
                    hero.gold += g.amount;
                    texts.push_back({vec3(g.pos, 1.2f), "+" + std::to_string(g.amount) + " dinars", 0xF5D76E, 0, 28});
                    emit(Ev::Gold, g.pos);
                } else if (g.kind == GroundItem::Wafq) {
                    hero.wafq[g.currency % WQ_COUNT]++;
                    texts.push_back({vec3(g.pos, 1.2f), wafq_def(g.currency).name, 0x2BB5AE, 0, 30});
                    emit(Ev::Currency, g.pos);
                } else if (g.kind == GroundItem::Blank) {
                    hero.blanks.push_back(uint8_t(g.amount));
                    std::sort(hero.blanks.begin(), hero.blanks.end());
                    texts.push_back({vec3(g.pos, 1.2f), "Blank Talisman (" + std::to_string(g.amount) + ")", 0xD4A84B, 0, 30});
                    emit(Ev::Currency, g.pos);
                } else {
                    hero.currency[g.currency] += g.amount;
                    texts.push_back({vec3(g.pos, 1.2f), currency_def(g.currency).name, currency_def(g.currency).color, 0, 30});
                    emit(Ev::Currency, g.pos);
                }
                g.t = -1;
            }
            continue;
        }
        if (d < bd && loot_visible(g)) { bd = d; selected_loot = int(i); }
    }
    loot.erase(std::remove_if(loot.begin(), loot.end(), [](const GroundItem& g) { return g.t < 0; }), loot.end());
    if (selected_loot >= int(loot.size())) selected_loot = -1;
}

// ============================================================ belongings
bool World::pick_up(int i) {
    if (i < 0 || i >= int(loot.size()) || loot[size_t(i)].kind != GroundItem::Gear) return false;
    Actor& h = actors[0];
    if (!hero.inv.add(loot[size_t(i)].item)) {
        texts.push_back({vec3(h.pos, 2.4f), "Inventory full", 0xE0B0A0, 0, 32});
        emit(Ev::InvFull, h.pos);
        return false;
    }
    loot.erase(loot.begin() + i);
    selected_loot = -1;
    emit(Ev::Pickup, h.pos);
    return true;
}

bool World::equip_from_inventory(int i) {
    if (i < 0 || i >= int(hero.inv.items.size())) return false;
    InvItem entry = hero.inv.items[size_t(i)];
    int slot = equip_slot_for(entry.item, hero.equip);
    if (slot < 0) return false;
    hero.inv.take(i);
    Item old = hero.equip[slot];
    hero.equip[slot] = entry.item;
    // the old piece goes where the new one was if it fits, otherwise anywhere
    if (!old.empty() && !hero.inv.place(old, entry.x, entry.y) && !hero.inv.add(old)) {
        hero.equip[slot] = old;
        hero.inv.items.insert(hero.inv.items.begin() + i, entry);
        emit(Ev::InvFull, actors[0].pos);
        return false;
    }
    recompute_hero();
    emit(Ev::Pickup, actors[0].pos);
    return true;
}

bool World::unequip(int slot) {
    if (slot < 0 || slot >= EQ_COUNT || hero.equip[slot].empty() || slot == EQ_WEAPON) return false;
    if (!hero.inv.add(hero.equip[slot])) { emit(Ev::InvFull, actors[0].pos); return false; }
    hero.equip[slot] = Item{};
    recompute_hero();
    emit(Ev::Pickup, actors[0].pos);
    return true;
}

void World::drop_from_inventory(int i) {
    if (i < 0 || i >= int(hero.inv.items.size())) return;
    GroundItem g;
    g.item = hero.inv.take(i);
    Actor& h = actors[0];
    g.pos = level.resolve(h.pos + from_angle(h.facing) * 1.2f + vec2{fx_rng.range(-0.3f, 0.3f), fx_rng.range(-0.3f, 0.3f)}, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

bool World::craft(int c, Item& target, std::string* why) {
    if (c < 0 || c >= CUR_COUNT || hero.currency[c] <= 0) { if (why) *why = "You have none left"; return false; }
    if (!apply_currency(c, target, rng, why)) return false;
    hero.currency[c]--;
    recompute_hero();
    emit(Ev::Craft, actors[0].pos);
    return true;
}

void World::drop_currency(vec2 at, int c, int amount) {
    GroundItem g;
    g.kind = GroundItem::Currency;
    g.currency = uint8_t(c);
    g.amount = amount;
    g.pos = level.resolve(at, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

void World::drop_special(vec2 at, GroundItem::Kind kind, int value) {
    GroundItem g;
    g.kind = kind;
    if (kind == GroundItem::Wafq) { g.currency = uint8_t(value); g.amount = 1; }
    else g.amount = value;
    g.pos = level.resolve(at, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

void World::drop_gold(vec2 at, int amount) {
    GroundItem g;
    g.kind = GroundItem::Gold;
    g.amount = std::max(1, amount);
    g.pos = level.resolve(at, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

void World::anim_step(Actor& a, float dt) {
    a.anim.update(dt);
    a.hit_flash = std::max(0.f, a.hit_flash - dt * 6.f);
}

vec2 World::aim_assist(vec2 dir, float range, float cone) {
    const Actor& h = actors[0];
    float best = 1e9f;
    vec2 out = dir;
    for (size_t i = 1; i < actors.size(); i++) {
        const Actor& e = actors[i];
        if (!e.alive()) continue;
        vec2 d = e.pos - h.pos;
        float dist = length(d);
        if (dist > range + e.radius || dist < 1e-3f) continue;
        float ang = std::fabs(wrap_angle(angle_of(d) - angle_of(dir)));
        if (ang > cone) continue;
        float score = dist + ang * 2.f;
        if (score < best) { best = score; out = d / dist; }
    }
    return out;
}

void World::start_skill(int slot, vec2 stick) {
    Actor& h = actors[0];
    const Talisman* t = hero.slot_talisman(slot);
    if (!t) return;
    SkillCtx c = slot_ctx(slot);
    const SkillDef& sk = *c.def;
    if (!c.usable) {
        if (hero.cooldowns[slot] <= 0) {
            texts.push_back({vec3(h.pos, 2.4f), "Not enough " + std::string(sk.attr == ATTR_STR ? "Strength" : sk.attr == ATTR_DEX ? "Dexterity" : "Intelligence"),
                             0xE0B0A0, 0, 30});
            hero.cooldowns[slot] = 1.f;
        }
        return;
    }
    if (hero.cooldowns[slot] > 0 || h.mana < c.mana) return;
    h.mana -= c.mana;
    hero.cooldowns[slot] = c.cooldown;
    h.act = Act::Skill;
    h.act_t = 0;
    h.skill = slot;
    h.struck = false;
    // aim where the stick points (after a dodge the body still faces the roll), else where we face
    vec2 dir = length(stick) > 0.25f ? normalize(stick) : from_angle(h.facing);
    float reach = sk.shape == Shape::Circle ? sk.range + sk.radius : sk.shape == Shape::Cone ? sk.range : sk.range;
    if (sk.shape == Shape::Warcry || sk.shape == Shape::Detonate || sk.shape == Shape::Nova) reach = 4.f;
    dir = aim_assist(dir, reach + 1.5f, radians(sk.tags & T_SPELL ? 30 : 40));
    h.facing = angle_of(dir);
    // ground-targeted spells land on the enemy they were aimed at, or short of full reach
    h.target = h.pos + dir * std::min(sk.range, 5.5f);
    const Actor* best = nullptr;
    float bd = 1e9f;
    for (size_t i = 1; i < actors.size(); i++) {
        const Actor& e = actors[i];
        vec2 d = e.pos - h.pos;
        float dist = length(d);
        if (!e.alive() || dist > sk.range + e.radius || std::fabs(wrap_angle(angle_of(d) - h.facing)) > radians(35)) continue;
        if (dist < bd) { bd = dist; best = &e; }
    }
    if (best) h.target = best->pos;
    // a Warrior's clip set has no cast, a Sorcerer's no slam: fall back to the nearest gesture
    float spd = clampf(c.speed, 0.5f, 2.5f);
    if (!h.anim.play(sk.clip, 0.06f, true, spd)) {
        const char* alt = (sk.tags & T_SPELL) ? (sk.shape == Shape::Glyph || sk.shape == Shape::Meteor ? "slam" : "swing")
                                              : (sk.shape == Shape::Warcry ? "cast_ground" : sk.tags & T_SLAM ? "cast_ground" : "cast");
        h.anim.play(alt, 0.06f, true, spd);
    }
    if (sk.tags & T_SPELL) emit(Ev::Cast, h.pos, float(sk.base_type));
    else emit(Ev::Swing, h.pos, sk.tags & T_SLAM ? 1.5f : 1.f);
}

void World::hero_step(const Input& in, float dt) {
    Actor& h = actors[0];
    Hero& H = hero;
    for (float& c : H.cooldowns) c = std::max(0.f, c - dt);
    if (!h.alive()) {
        h.dead_t += dt;
        anim_step(h, dt);
        return;
    }
    // regeneration and flask
    h.mana = std::min(h.mana_max, h.mana + H.stats.value(S_MANA_REGEN, h.mana_max * 0.03f) * dt);
    // Hirz recharges after two seconds without taking damage
    H.overload_t = std::max(0.f, H.overload_t - dt);
    if (H.es_wait > 0) H.es_wait -= dt;
    else if (H.es < H.es_max) H.es = std::min(H.es_max, H.es + H.es_max * 0.2f * (1 + H.stats.sum(S_ES_RECHARGE).inc / 100.f) * dt);
    h.life = std::min(h.life_max, h.life + H.stats.value(S_LIFE_REGEN) * dt);
    if (H.flask_heal_t > 0) {
        float rate = h.life_max * 0.5f / 1.5f;
        h.life = std::min(h.life_max, h.life + rate * dt);
        H.flask_heal_t -= dt;
    }
    if (in.hit(BTN_L3) && H.flask >= 1 && h.life < h.life_max) {
        H.flask -= 1;
        H.flask_heal_t = 1.5f;
        emit(Ev::Drink, h.pos);
    }
    vec2 stick = in.lstick;
    bool busy = h.act == Act::Skill || h.act == Act::Dodge;
    // actions
    if (!busy) {
        // bar one on South / West / North / R1 / R2; holding L2 swaps in bar two
        static const Btn slot_btn[5] = {BTN_SOUTH, BTN_WEST, BTN_NORTH, BTN_R1, BTN_R2};
        const int bar = in.held(BTN_L2) ? 5 : 0;
        bool near_loot = selected_loot >= 0;
        bool calm = true;
        for (size_t i = 1; i < actors.size(); i++)
            if (actors[i].alive() && length(actors[i].pos - h.pos) < 6.f) calm = false;
        if (in.hit(BTN_SOUTH) && near_interact >= 0 && calm && !bar) {
            used_interact = near_interact;
        } else if ((in.hit(BTN_LEFT) || (in.hit(BTN_SOUTH) && calm && !bar)) && near_loot) {
            pick_up(selected_loot);
        } else if (in.hit(BTN_EAST)) {
            h.act = Act::Dodge;
            h.act_t = 0;
            if (length(stick) > 0.25f) h.facing = angle_of(stick);
            h.anim.play("dodge", 0.04f, true);
            emit(Ev::Dodge, h.pos);
        } else {
            for (int s = 0; s < 5; s++)
                if (in.hit(slot_btn[s])) { start_skill(bar + s, length(in.rstick) > 0.3f ? in.rstick : stick); break; }
        }
    }
    // movement
    vec2 want{0, 0};
    h.act_t += dt;
    if (h.act == Act::Idle) {
        want = stick * h.speed;
        if (length(stick) > 0.1f) h.facing = wrap_angle(h.facing + wrap_angle(angle_of(stick) - h.facing) * std::min(1.f, dt * 14.f));
        if (length(h.vel) > 0.6f) h.anim.play("run", 0.15f, false, clampf(length(h.vel) / 5.2f, 0.6f, 1.3f));
        else h.anim.play("idle", 0.25f);
    } else if (h.act == Act::Dodge) {
        want = from_angle(h.facing) * 9.5f * (1.f - h.anim.progress() * 0.6f);
        if (h.anim.done()) h.act = Act::Idle;
    } else if (h.act == Act::Skill) {
        want = stick * h.speed * 0.2f;
        const Talisman* t = H.slot_talisman(h.skill);
        const char* ev = t && t->def().shape == Shape::Warcry ? "cry" : "hit";
        if (!h.struck && (h.anim.event(ev) || h.anim.event("hit") || h.anim.event("cry"))) { h.struck = true; resolve_skill(h); }
        if (!t || h.anim.done() || h.anim.progress() > 0.92f) h.act = Act::Idle;

    } else if (h.act == Act::Hit) {
        if (h.anim.done()) h.act = Act::Idle;
    }
    h.vel = lerp(h.vel, want, std::min(1.f, dt * 16.f));
    h.pos = level.resolve(h.pos + h.vel * dt, h.radius);
    anim_step(h, dt);
}

// ============================================================ combat
bool World::in_glyph(vec2 p) const {
    for (const auto& g : ground)
        if (g.kind == GroundFx::Glyph && length(g.pos - p) < g.radius) return true;
    return false;
}

float World::hit_enemy(Actor& e, const HeroHit& hh, vec2 from, float knock, float extra_more) {
    Hero& H = hero;
    Actor& h = actors[0];
    HitDamage he = hh.hit;
    float k = extra_more;
    if (H.keystones & KS_FOLLOWER) k *= e.id == H.last_attacker ? 1.4f : 0.8f;   // al-Dabaran
    for (int t = 0; t < DT_COUNT; t++) { he.min[size_t(t)] *= k; he.max[size_t(t)] *= k; }
    Defences def;
    def.armour = e.armour;
    def.damage_taken_inc = (e.broken_t > 0 ? 50.f : 0.f) + (e.shock_t > 0 ? e.shock : 0.f);
    HitResult res = roll_hit(he, def, rng);
    if (res.crit && (H.keystones & KS_OVERLOAD)) H.overload_t = 6.f;
    e.life -= res.total;
    e.hit_flash = 1.f;
    vec2 d = e.pos - from;
    if (length(d) > 1e-4f) e.knock += normalize(d) * knock * (e.frozen_t > 0 ? 0.2f : 1.f);
    float leech = H.stats.value(S_LIFE_LEECH);
    if (leech > 0) h.life = std::min(h.life_max, h.life + leech);
    if (res.crit) {
        char b[32];
        snprintf(b, sizeof b, "%d", int(res.total));
        texts.push_back({vec3(e.pos, 2.2f), b, 0xF2A541, 0, 46});
        emit(Ev::Crit, e.pos);
    }
    vec3 hp = vec3(e.pos, 1.0f * e.scale);
    burst(hp, 7, vec4(1.f, 0.7f, 0.4f, 0.8f), vec4(0.9f, 0.3f, 0.1f, 0), 5.f, 0.08f, 0.3f, true, -9.f);
    burst(hp, 3, vec4(0.2f, 0.17f, 0.18f, 0.55f), vec4(0.15f, 0.13f, 0.14f, 0), 2.f, 0.22f, 0.5f, false, -4.f, 1);
    if (e.life <= 0) { kill(e); return res.total; }
    const bool unique = e.rarity == Rarity::Unique;
    // ailments: fire can Ignite, cold always Chills and builds Freeze, lightning can Shock
    float fire = res.by_type[DT_FIRE], cold = res.by_type[DT_COLD], light = res.by_type[DT_LIGHTNING];
    if (fire > 0 && hh.ignite > 0 && rng.chance(hh.ignite)) {
        float dps = fire * 0.9f;
        if (dps > e.ignite_dps || e.ignite_t <= 0) e.ignite_dps = dps;
        e.ignite_t = 4.f;
    }
    if (cold > 0) {
        e.chill = std::max(e.chill, clampf(0.3f * hh.freeze, 0.1f, 0.5f));
        e.chill_t = std::max(e.chill_t, 2.f);
        e.freeze_meter += cold / e.life_max * 100.f * 1.6f * hh.freeze * (unique ? 0.4f : 1.f);
        if (e.freeze_meter >= 100.f) {
            e.freeze_meter = 0;
            e.frozen_t = unique ? 0.8f : 1.6f;
            emit(Ev::Frozen, e.pos);
            texts.push_back({vec3(e.pos, 2.4f), "FROZEN", 0x9FD8FF, 0, 34});
        }
    }
    if (light > 0 && hh.shock > 0 && rng.chance(hh.shock)) {
        e.shock = std::max(e.shock, 20.f * hh.shock_effect);
        e.shock_t = 4.f;
    }
    // Break
    float rally = res.total > 0 && H.rally_hit ? 1.5f : 1.f;
    e.break_meter += res.total / e.life_max * 100.f * 1.7f * hh.brk * rally * (unique ? 0.5f : 1.f);
    if (e.break_meter >= 100.f) {
        e.break_meter = 0;
        e.stun_t = unique ? 2.5f : 1.4f;
        e.broken_t = unique ? 5.f : 3.0f;
        e.act = Act::Stun;
        e.anim.play("stagger", 0.08f, true);
        emit(Ev::Break, e.pos);
        texts.push_back({vec3(e.pos, 2.4f), "BROKEN", 0xFF2E88, 0, 34});
    } else if (e.act != Act::Stun && res.total > e.life_max * 0.12f && e.rarity < Rarity::Rare && e.frozen_t <= 0) {
        e.act = Act::Hit;
        e.act_t = 0;
        e.anim.play("hit", 0.04f, true);
    }
    emit(Ev::EnemyHit, e.pos, res.total);
    return res.total;
}

void World::glyph_pulse(GroundFx& g) {
    HeroHit hh = g.hh;
    for (size_t i = 1; i < actors.size(); i++) {
        Actor& e = actors[i];
        if (e.alive() && length(e.pos - g.pos) < g.radius + e.radius) hit_enemy(e, hh, g.pos, 0.3f);
    }
    burst(vec3(g.pos, 0.2f), 10, vec4(0.6f, 0.85f, 1.f, 0.8f), vec4(0.3f, 0.5f, 1.f, 0), 2.5f, 0.12f, 0.6f, true, 1.f);
    emit(Ev::Glyph, g.pos, 0.5f);
}

void World::star_fall(GroundFx& g) {
    for (size_t i = 1; i < actors.size(); i++) {
        Actor& e = actors[i];
        if (!e.alive() || length(e.pos - g.pos) > g.radius + e.radius) continue;
        float more = (e.chill_t > 0 || e.frozen_t > 0) ? 1.6f : 1.f;   // the payoff for setting up with cold
        hit_enemy(e, g.hh, g.pos, 4.f, more);
    }
    // a Frost Glyph it lands in bursts: its cold hits everything inside at three times a pulse
    for (auto& gl : ground) {
        if (gl.kind != GroundFx::Glyph || gl.t >= gl.life || length(gl.pos - g.pos) > gl.radius + g.radius * 0.5f) continue;
        HeroHit burst_hit = gl.hh;
        for (int t = 0; t < DT_COUNT; t++) { burst_hit.hit.min[size_t(t)] *= 3; burst_hit.hit.max[size_t(t)] *= 3; }
        burst_hit.freeze *= 2;
        for (size_t i = 1; i < actors.size(); i++) {
            Actor& e = actors[i];
            if (e.alive() && length(e.pos - gl.pos) < gl.radius + e.radius) hit_enemy(e, burst_hit, gl.pos, 3.f);
        }
        burst(vec3(gl.pos, 0.2f), 40, vec4(0.7f, 0.9f, 1.f, 1), vec4(0.3f, 0.5f, 1.f, 0), 7.f, 0.16f, 0.8f, true, -4.f);
        gl.t = gl.life;
        emit(Ev::Glyph, gl.pos, 2.f);
    }
    burst(vec3(g.pos, 0.2f), 36, vec4(1.f, 0.8f, 0.4f, 1), vec4(1.f, 0.3f, 0.1f, 0), 8.f, 0.14f, 0.7f, true, -10.f);
    burst(vec3(g.pos, 0.1f), 18, vec4(0.4f, 0.36f, 0.34f, 0.8f), vec4(0.3f, 0.27f, 0.25f, 0), 4.f, 0.4f, 1.0f, false, -5.f, 1);
    emit(Ev::StarFall, g.pos);
    hitstop = std::max(hitstop, 0.05f);
    shake = std::max(shake, 0.55f);
}

void World::resolve_skill(Actor& h) {
    SkillCtx c = slot_ctx(h.skill);
    if (!c.def) return;
    const SkillDef& sk = *c.def;
    Hero& H = hero;
    vec2 dir = from_angle(h.facing);
    HeroHit hh;
    hh.hit = c.hit;
    hh.ignite = c.ignite;
    hh.shock = c.shock;
    hh.shock_effect = c.shock_effect;
    hh.freeze = c.freeze;
    hh.brk = c.break_mult;
    hh.talisman = H.bar[h.skill];
    float more = 1.f;
    H.rally_hit = false;
    if (H.rally > 0 && (sk.tags & T_ATTACK)) { more = 1.f + 0.4f * (1 + H.stats.sum(S_WARCRY).inc / 100.f); H.rally--; H.rally_hit = true; }
    if ((sk.tags & T_SPELL) && in_glyph(h.pos)) more *= 1.3f;   // a spell cast inside a glyph is empowered
    if ((H.keystones & KS_OVERLOAD) != 0) {
        hh.hit.crit_multi = 1.f;                                   // al-Simak: crits deal no extra damage...
        if (H.overload_t > 0)                                       // ...but charge your elements
            for (int t = DT_FIRE; t <= DT_LIGHTNING; t++) { hh.hit.min[size_t(t)] *= 1.4f; hh.hit.max[size_t(t)] *= 1.4f; }
    }
    for (int t = 0; t < DT_COUNT; t++) { hh.hit.min[size_t(t)] *= more; hh.hit.max[size_t(t)] *= more; }
    const float area = c.area;
    int hits = 0;
    auto hit_all = [&](vec2 at, float r, bool cone, float half) {
        for (size_t i = 1; i < actors.size(); i++) {
            Actor& e = actors[i];
            if (!e.alive()) continue;
            vec2 d = e.pos - at;
            float dist = length(d);
            if (dist > r + e.radius) continue;
            if (cone && dist > 0.3f && std::fabs(wrap_angle(angle_of(d) - h.facing)) > half) continue;
            hit_enemy(e, hh, at, sk.tags & T_SLAM ? 4.f : 2.5f);
            hits++;
        }
    };
    switch (sk.shape) {
        case Shape::Cone: {
            hit_all(h.pos, sk.range * area, true, sk.angle);
            if (hits > 0) {
                H.combo++;
                if (H.combo % 3 == 0) {
                    GroundFx g;
                    g.kind = GroundFx::Crack;
                    g.pos = h.pos + dir * 1.7f;
                    g.radius = 1.3f;
                    g.life = 9;
                    g.seed = rng.next();
                    ground.push_back(g);
                    emit(Ev::SlamImpact, g.pos, 0.6f);
                }
            } else H.combo = 0;
            emit(Ev::Impact, h.pos + dir * 1.5f, float(hits));
            hitstop = hits ? 0.045f : 0.f;
            break;
        }
        case Shape::Circle: {
            vec2 at = h.pos + dir * sk.range;
            hit_all(at, sk.radius * area, false, 0);
            for (int k = -1; k <= 1; k++) {
                GroundFx g;
                g.kind = GroundFx::Crack;
                g.pos = at + rotate(dir, k * 0.55f) * (k == 0 ? 1.4f : 0.9f);
                g.radius = 1.4f;
                g.life = 9;
                g.seed = rng.next();
                ground.push_back(g);
            }
            burst(vec3(at, 0.1f), 20, vec4(0.42f, 0.37f, 0.33f, 0.6f), vec4(0.3f, 0.27f, 0.25f, 0), 5.f, 0.28f, 0.8f, false, -6.f, 1);
            burst(vec3(at, 0.1f), 14, vec4(1.f, 0.7f, 0.3f, 1), vec4(1.f, 0.3f, 0.1f, 0), 6.f, 0.1f, 0.5f, true, -12.f);
            emit(Ev::SlamImpact, at, 1.f);
            hitstop = 0.07f;
            shake = std::max(shake, 0.5f);
            break;
        }
        case Shape::Detonate: {
            int n = 0;
            for (auto& g : ground) {
                if (g.kind != GroundFx::Crack || length(g.pos - h.pos) > sk.range) continue;
                hit_all(g.pos, sk.radius * area, false, 0);
                burst(vec3(g.pos, 0.1f), 22, vec4(1.f, 0.62f, 0.25f, 1), vec4(0.8f, 0.2f, 0.05f, 0), 7.f, 0.16f, 0.7f, true, -10.f);
                burst(vec3(g.pos, 0.1f), 14, vec4(0.6f, 0.52f, 0.45f, 0.9f), vec4(0.4f, 0.35f, 0.3f, 0), 4.f, 0.4f, 0.9f, false, -5.f, 1);
                g.t = g.life;
                n++;
            }
            if (n == 0) {
                hit_all(h.pos + dir * 0.6f, 2.6f * area, false, 0);
                burst(vec3(h.pos + dir * 0.6f, 0.1f), 20, vec4(0.62f, 0.55f, 0.48f, 0.9f), vec4(0.4f, 0.35f, 0.3f, 0), 5.f, 0.35f, 0.8f, false, -6.f, 1);
            }
            emit(Ev::Aftershock, h.pos, float(std::max(1, n)));
            hitstop = 0.08f;
            shake = std::max(shake, 0.4f + 0.12f * n);
            break;
        }
        case Shape::Warcry: {
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                if (!e.alive() || length(e.pos - h.pos) > sk.radius * area + e.radius) continue;
                e.break_meter += 35.f * c.break_mult * (e.rarity >= Rarity::Rare ? 0.6f : 1.f);
                if (e.break_meter >= 100.f) {
                    e.break_meter = 0; e.stun_t = 1.4f; e.broken_t = 3; e.act = Act::Stun;
                    e.anim.play("stagger", 0.08f, true);
                    emit(Ev::Break, e.pos);
                }
            }
            H.rally = 3 + int(H.stats.sum(S_WARCRY).flat);
            GroundFx g;
            g.kind = GroundFx::Ring;
            g.pos = h.pos;
            g.radius = sk.radius * area;
            g.life = 0.6f;
            ground.push_back(g);
            emit(Ev::Warcry, h.pos);
            shake = std::max(shake, 0.3f);
            break;
        }
        case Shape::Projectile: {
            int n = std::max(1, c.projectiles);
            float spread = n > 1 ? radians(9.f) : 0.f;
            for (int k = 0; k < n; k++) {
                Projectile p;
                vec2 pd = rotate(dir, (k - (n - 1) * 0.5f) * spread);
                p.pos = h.pos + pd * 0.8f;
                p.vel = pd * c.proj_speed;
                p.z = 1.3f;
                p.radius = sk.radius;
                p.life = sk.range / std::max(1.f, c.proj_speed);
                p.team = TEAM_HERO;
                p.color = sk.base_type == DT_COLD ? vec3{0.5f, 0.8f, 1.f} : sk.base_type == DT_LIGHTNING ? vec3{0.7f, 0.8f, 1.f} : vec3{1.f, 0.55f, 0.2f};
                p.hh = hh;
                projectiles.push_back(p);
            }
            break;
        }
        case Shape::Chain: {
            // leap to the target in front, then to the nearest enemy not yet struck, up to `chains` times
            std::vector<uint32_t> struck;
            vec2 from = h.pos + vec2{0, 0} + dir * 0.6f;
            Actor* cur = nullptr;
            float bd = 1e9f;
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                vec2 d = e.pos - h.pos;
                float dist = length(d);
                if (!e.alive() || dist > sk.range + e.radius || std::fabs(wrap_angle(angle_of(d) - h.facing)) > radians(40)) continue;
                if (dist < bd) { bd = dist; cur = &e; }
            }
            vec2 end = h.pos + dir * sk.range * 0.6f;
            for (int jump = 0; jump <= c.chains; jump++) {
                GroundFx b;
                b.kind = GroundFx::Bolt;
                b.pos = from;
                b.pos2 = cur ? cur->pos : end;
                b.life = 0.22f;
                b.seed = rng.next();
                ground.push_back(b);
                if (!cur) break;
                struck.push_back(cur->id);
                vec2 at = cur->pos;
                hit_enemy(*cur, hh, from, 1.f);
                emit(Ev::LightningHit, at);
                from = at;
                Actor* next = nullptr;
                float nd = 1e9f;
                for (size_t i = 1; i < actors.size(); i++) {
                    Actor& e = actors[i];
                    if (!e.alive() || std::find(struck.begin(), struck.end(), e.id) != struck.end()) continue;
                    float dist = length(e.pos - at);
                    if (dist < sk.radius * area && dist < nd) { nd = dist; next = &e; }
                }
                cur = next;
                if (!cur) break;
            }
            break;
        }
        case Shape::Glyph: {
            GroundFx g;
            g.kind = GroundFx::Glyph;
            g.pos = level.resolve(h.target, 0.2f);
            g.radius = sk.radius * area;
            g.life = sk.duration;
            g.pulse = 0.f;
            g.seed = rng.next();
            g.hh = hh;
            ground.push_back(g);
            emit(Ev::Glyph, g.pos, 1.f);
            break;
        }
        case Shape::Meteor: {
            GroundFx g;
            g.kind = GroundFx::Meteor;
            g.pos = level.resolve(h.target, 0.2f);
            g.radius = sk.radius * area;
            g.life = 0.55f;
            g.seed = rng.next();
            g.hh = hh;
            ground.push_back(g);
            break;
        }
        default: break;
    }
}

void World::ailments_step(Actor& m, float dt) {
    if (m.ignite_t > 0) {
        m.ignite_t -= dt;
        m.life -= m.ignite_dps * dt;
        if (fx_rng.chance(0.25f))
            burst(vec3(m.pos, 0.8f * m.scale), 1, vec4(1.f, 0.55f, 0.15f, 0.9f), vec4(0.8f, 0.2f, 0.05f, 0), 1.2f, 0.14f, 0.5f, true, 2.f);
        if (m.life <= 0 && m.alive()) kill(m);
    }
    if (m.chill_t > 0 && (m.chill_t -= dt) <= 0) m.chill = 0;
    if (m.shock_t > 0 && (m.shock_t -= dt) <= 0) m.shock = 0;
    if (m.frozen_t > 0) m.frozen_t -= dt;
    m.freeze_meter = std::max(0.f, m.freeze_meter - 8.f * dt);
}

void World::kill(Actor& e) {
    e.act = Act::Dead;
    e.life = 0;
    e.dead_t = 0;
    e.anim.play("death", 0.05f, true);
    const MonsterDef& d = monster_defs()[size_t(e.def)];
    float xp = d.xp * (e.rarity == Rarity::Rare ? 6.f : e.rarity == Rarity::Magic ? 2.f : 1.f);
    if (d.attack == AttackKind::Boss) {
        boss_killed = true;
        emit(Ev::BossDie, e.pos);
    }
    hero.xp += xp;
    hero.kills++;
    hero.flask = std::min(hero.flask_max, hero.flask + 0.25f);
    for (size_t i = 0; i < 4; i++) if (e.mods[i] == MM_VAMPIRIC) {}
    // level up
    for (;;) {
        float need = 90.f * std::pow(float(hero.level), 1.55f);
        if (hero.xp < need || hero.level >= 100) break;
        hero.xp -= need;
        hero.level++;
        recompute_hero();
        actors[0].life = actors[0].life_max;
        actors[0].mana = actors[0].mana_max;
        emit(Ev::LevelUp, actors[0].pos);
        texts.push_back({vec3(actors[0].pos, 2.6f), "LEVEL UP", 0xF2A541, 0, 44});
    }
    emit(Ev::EnemyDie, e.pos, e.scale);
    drop_loot(e);
}

void World::drop_loot(const Actor& e) {
    float rare = 0, magic = 0.05f, chance = 0.07f;
    auto scatter = [&](float r) { return e.pos + vec2{rng.range(-r, r), rng.range(-r, r)}; };
    if (e.rarity == Rarity::Unique) {
        for (int k = 0; k < 4; k++) {
            GroundItem g;
            g.item = random_drop(area_level + 2, k < 2 ? 1.f : 0.4f, 0.6f, rng, k == 0 ? Slot::Weapon : Slot::Count);
            g.pos = level.resolve(e.pos + rotate(vec2{1.4f, 0}, k * 1.57f + 0.4f), 0.3f);
            g.id = next_id++;
            loot.push_back(g);
        }
        for (int k = 0; k < 4; k++) drop_currency(e.pos + rotate(vec2{2.2f, 0}, k * 1.57f), k == 0 ? CUR_PIASTRE : roll_currency(rng), 1);
        drop_gold(e.pos + vec2{0, -1.8f}, 60 + 12 * area_level);
        drop_special(e.pos + vec2{1.6f, -1.2f}, GroundItem::Wafq, rng.irange(0, WQ_COUNT - 1));
        drop_special(e.pos + vec2{-1.6f, -1.2f}, GroundItem::Blank, std::min(20, area_level + 1));
        return;
    }
    // Wafq and Blank Talismans: rare finds, likelier from stronger monsters
    float wq = e.rarity == Rarity::Rare ? 0.3f : e.rarity == Rarity::Magic ? 0.06f : 0.008f;
    if (rng.chance(wq)) drop_special(scatter(0.9f), GroundItem::Wafq, rng.irange(0, WQ_COUNT - 1));
    float bl = e.rarity == Rarity::Rare ? 0.35f : e.rarity == Rarity::Magic ? 0.07f : 0.012f;
    if (rng.chance(bl)) drop_special(scatter(0.9f), GroundItem::Blank, std::clamp(area_level + rng.irange(-1, 1), 1, 20));
    // currency and dinars
    float cur_chance = e.rarity == Rarity::Rare ? 0.9f : e.rarity == Rarity::Magic ? 0.25f : 0.045f;
    if (rng.chance(cur_chance)) drop_currency(scatter(0.8f), roll_currency(rng), 1);
    float gold_chance = e.rarity == Rarity::Normal ? 0.22f : 1.f;
    if (rng.chance(gold_chance)) drop_gold(scatter(0.8f), int(rng.irange(2, 5) * (1 + area_level * 0.5f) * (e.rarity == Rarity::Rare ? 5 : 1)));
    if (e.rarity == Rarity::Rare) { chance = 1.f; rare = 1.f; }
    else if (e.rarity == Rarity::Magic) { chance = 0.35f; rare = 0.15f; magic = 0.6f; }
    if (!rng.chance(chance)) return;
    GroundItem g;
    // early on, a third of drops are weapons: the maul is the build
    Slot only = rng.chance(0.35f) ? Slot::Weapon : Slot::Count;
    g.item = random_drop(area_level + (e.rarity == Rarity::Rare ? 2 : 0), rare, magic, rng, only);
    g.pos = level.resolve(scatter(0.6f), 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

void World::damage_hero(float lo, float hi, int type, vec2 from, float break_amt, uint32_t attacker) {
    Actor& h = actors[0];
    if (!h.alive()) return;
    HitDamage hd;
    hd.min[size_t(type)] = lo;
    hd.max[size_t(type)] = hi;
    Defences def = defences_of(hero.stats);
    HitResult r = roll_hit(hd, def, rng);
    if (attacker) hero.last_attacker = attacker;
    float taken = r.total;
    float soak = std::min(hero.es, taken);                     // Hirz takes the hit first
    hero.es -= soak;
    hero.es_wait = 2.f;
    h.life -= taken - soak;
    h.hit_flash = 0.6f;
    h.knock += normalize(h.pos - from) * 1.5f;
    emit(Ev::HeroHit, h.pos, r.total / std::max(1.f, h.life_max));
    shake = std::max(shake, 0.25f);
    (void)break_amt;
    if (h.life <= 0) {
        h.life = 0;
        h.act = Act::Dead;
        h.dead_t = 0;
        h.anim.play("death", 0.05f, true);
        emit(Ev::HeroDie, h.pos);
    }
}

void World::monster_attack(Actor& m) {
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    Actor& h = actors[0];
    if (!h.alive()) return;
    vec2 fwd = from_angle(m.facing);
    float lo = d.dmg_min * m.dmg_mult * (1 + 0.12f * (area_level - 1)), hi = d.dmg_max * m.dmg_mult * (1 + 0.12f * (area_level - 1));
    switch (d.attack) {
        case AttackKind::Boss: break;  // boss_strike handles her
        case AttackKind::Claw: {
            vec2 dd = h.pos - m.pos;
            float dist = length(dd);
            if (dist <= d.attack_range * m.scale + h.radius + 0.2f && std::fabs(wrap_angle(angle_of(dd) - m.facing)) < radians(75))
                damage_hero(lo, hi, d.dmg_type, m.pos, 10, m.id);
            break;
        }
        case AttackKind::Slam: {
            vec2 c = m.pos + fwd * 1.3f * m.scale;
            if (length(h.pos - c) <= 1.7f * m.scale + h.radius) damage_hero(lo, hi, d.dmg_type, c, 30, m.id);
            burst(vec3(c, 0.1f), 18, vec4(0.5f, 0.45f, 0.42f, 0.9f), vec4(0.3f, 0.28f, 0.26f, 0), 4.f, 0.35f, 0.8f, false, -5.f, 1);
            emit(Ev::SlamImpact, c, 0.8f);
            shake = std::max(shake, 0.35f);
            break;
        }
        case AttackKind::Spit: {
            Projectile p;
            vec2 target = h.pos + h.vel * 0.35f;
            vec2 dir = normalize(target - m.pos);
            p.pos = m.pos + dir * 0.6f;
            p.vel = dir * 10.f;
            p.dmg_min = lo;
            p.dmg_max = hi;
            p.dmg_type = d.dmg_type;
            p.owner = m.id;
            projectiles.push_back(p);
            emit(Ev::Spit, m.pos);
            break;
        }
    }
    for (int i = 0; i < 4; i++)
        if (m.mods[i] == MM_VAMPIRIC) m.life = std::min(m.life_max, m.life + m.life_max * 0.04f);
}

void World::monster_step(Actor& m, float dt) {
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    Actor& h = actors[0];
    m.broken_t = std::max(0.f, m.broken_t - dt);
    m.knock = m.knock * std::exp(-10.f * dt);
    if (m.act == Act::Dead) {
        m.dead_t += dt;
        if (m.dead_t > 0.8f && m.dead_t - dt <= 0.8f)
            burst(vec3(m.pos, 0.6f), 30, vec4(0.55f, 0.5f, 0.52f, 0.85f), vec4(0.35f, 0.32f, 0.34f, 0), 1.6f, 0.3f, 1.4f, false, 1.5f, 1);
        anim_step(m, dt);
        return;
    }
    ailments_step(m, dt);
    if (!m.alive()) return;
    if (m.frozen_t > 0) {  // frozen solid: no thought, no motion, only knockback
        m.vel = {0, 0};
        m.pos = level.resolve(m.pos + m.knock * dt, m.radius);
        return;
    }
    const float slow = 1.f - m.chill;  // chilled: everything they do runs slower
    dt *= slow;
    if (d.attack == AttackKind::Boss) { boss_step(m, dt); return; }
    vec2 to = h.pos - m.pos;
    float dist = length(to);
    vec2 dir = dist > 1e-4f ? to / dist : vec2{0, 1};
    vec2 want{0, 0};
    m.attack_cd -= dt * m.speed_mult;
    m.act_t += dt;
    switch (m.act) {
        case Act::Stun:
            m.stun_t -= dt;
            if (m.stun_t <= 0) { m.act = Act::Idle; }
            break;
        case Act::Hit:
            if (m.anim.done()) m.act = Act::Idle;
            break;
        case Act::Skill: {
            const char* ev = d.attack == AttackKind::Spit ? "fire" : "hit";
            if (m.act_t < 0.3f) m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 6.f));
            if (!m.struck && m.anim.event(ev)) { m.struck = true; monster_attack(m); }
            if (m.anim.done()) {
                m.act = Act::Idle;
                m.attack_cd = d.attack_cd * rng.range(0.8f, 1.25f);
            }
            break;
        }
        default: {
            bool aggro = m.ai_state > 0 || dist < 13.f || m.life < m.life_max;
            if (!aggro || !h.alive()) { m.anim.play("idle", 0.25f); break; }
            m.ai_state = 1;
            float reach = d.attack == AttackKind::Spit ? d.attack_range : d.attack_range * m.scale + h.radius;
            bool in_range = dist <= reach;
            if (d.keep_distance > 0) {
                if (dist < d.keep_distance - 1.5f) want = -dir * m.speed * 0.8f;
                else if (dist > d.keep_distance + 1.f) want = dir * m.speed;
            } else if (!in_range) {
                want = dir * m.speed;
            }
            if (in_range && m.attack_cd <= 0) {
                m.act = Act::Skill;
                m.act_t = 0;
                m.struck = false;
                m.facing = angle_of(to);
                const char* clip = d.attack == AttackKind::Claw ? "claw" : d.attack == AttackKind::Slam ? "slam" : "spit";
                m.anim.play(clip, 0.08f, true, m.speed_mult);
                // telegraph on the ground for everything that can really hurt
                GroundFx g;
                g.kind = GroundFx::Telegraph;
                g.owner = m.id;
                const Clip* c = m.anim.cur;
                float hit_t = c ? c->event_time(d.attack == AttackKind::Spit ? "fire" : "hit", 0.5f) / m.speed_mult : 0.5f;
                g.life = hit_t;
                if (d.attack == AttackKind::Slam) { g.pos = m.pos + from_angle(m.facing) * 1.3f * m.scale; g.radius = 1.7f * m.scale; g.half = kPi; }
                else if (d.attack == AttackKind::Claw) { g.pos = m.pos; g.radius = d.attack_range * m.scale + 0.3f; g.half = radians(75); g.angle = m.facing; }
                if (d.attack != AttackKind::Spit) ground.push_back(g);
            }
            if (length(want) > 0.1f) {
                m.facing = wrap_angle(m.facing + wrap_angle(angle_of(want) - m.facing) * std::min(1.f, dt * 8.f));
                m.anim.play("run", 0.15f, false, clampf(length(want) / 4.3f, 0.6f, 1.4f));
            } else if (m.act == Act::Idle) {
                m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 6.f));
                m.anim.play("idle", 0.25f);
            }
        }
    }
    m.vel = lerp(m.vel, want, std::min(1.f, dt * 10.f));
    m.pos = level.resolve(m.pos + (m.vel + m.knock) * dt, m.radius);
    anim_step(m, dt);
}

// ---- Umm al-Ghula: claw combos up close, leap slams at range; below 55% she summons and wails
void World::boss_strike(Actor& m, const char* ev) {
    Actor& h = actors[0];
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    float k = 1 + 0.12f * (area_level - 1);
    float lo = d.dmg_min * k * m.dmg_mult, hi = d.dmg_max * k * m.dmg_mult;
    if (m.skill == 0) {  // claw combo
        vec2 dd = h.pos - m.pos;
        if (length(dd) <= d.attack_range + h.radius && std::fabs(wrap_angle(angle_of(dd) - m.facing)) < radians(70))
            damage_hero(lo, hi, DT_PHYS, m.pos, 12, m.id);
        (void)ev;
    } else if (m.skill == 1) {  // leap landing
        if (length(h.pos - m.target) <= 2.7f + h.radius) damage_hero(lo * 1.6f, hi * 1.6f, DT_PHYS, m.target, 25, m.id);
        burst(vec3(m.target, 0.1f), 30, vec4(0.45f, 0.4f, 0.36f, 0.8f), vec4(0.3f, 0.27f, 0.25f, 0), 6.f, 0.35f, 1.0f, false, -6.f, 1);
        emit(Ev::SlamImpact, m.target, 1.2f);
        emit(Ev::BossLeap, m.target);
        shake = std::max(shake, 0.7f);
    } else if (m.skill == 2) {  // wail
        if (length(h.pos - m.pos) <= 7.5f) damage_hero(h.life_max * 0.28f, h.life_max * 0.34f, DT_CHAOS, m.pos, 40, m.id);
        GroundFx g;
        g.kind = GroundFx::Ring;
        g.pos = m.pos;
        g.radius = 7.5f;
        g.life = 0.7f;
        ground.push_back(g);
        emit(Ev::BossWail, m.pos, 2.f);
        shake = std::max(shake, 0.6f);
    } else if (m.skill == 3) {  // summon from the graves
        int g = find_monster("ghoul");
        emit(Ev::Summon, m.pos);
        for (int i = 0; i < 5; i++) {
            vec2 p = level.resolve(m.pos + rotate(vec2{3.2f, 0}, i * kTau / 5 + 0.3f), 0.5f);
            Actor& a = spawn_monster(g, p, Rarity::Normal, area_level);
            a.ai_state = 1;
            burst(vec3(p, 0.1f), 16, vec4(0.4f, 0.35f, 0.3f, 0.8f), vec4(0.3f, 0.25f, 0.2f, 0), 3.f, 0.3f, 0.9f, false, -4.f, 1);
        }
    }
}

void World::boss_step(Actor& m, float dt) {
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    Actor& h = actors[0];
    vec2 to = h.pos - m.pos;
    float dist = length(to);
    vec2 dir = dist > 1e-4f ? to / dist : vec2{0, 1};
    float haste = m.phase ? 1.25f : 1.f;
    m.attack_cd -= dt * haste;
    m.cd2 -= dt;
    m.cd3 -= dt;
    m.act_t += dt;
    vec2 want{0, 0};
    auto start = [&](int skill, const char* clip, float speed) {
        m.act = Act::Skill;
        m.act_t = 0;
        m.skill = skill;
        m.struck = false;
        m.facing = angle_of(to);
        m.anim.play(clip, 0.08f, true, speed);
    };
    auto telegraph = [&](vec2 at, float r, float half, float angle, const char* ev) {
        GroundFx g;
        g.kind = GroundFx::Telegraph;
        g.owner = m.id;
        g.pos = at;
        g.radius = r;
        g.half = half;
        g.angle = angle;
        const Clip* c = m.anim.cur;
        g.life = c ? c->event_time(ev, 0.8f) / m.anim.speed : 0.8f;
        ground.push_back(g);
    };
    switch (m.act) {
        case Act::Stun:
            m.stun_t -= dt;
            if (m.stun_t <= 0) m.act = Act::Idle;
            break;
        case Act::Skill: {
            if (m.skill == 1) {  // airborne: travel to the landing point
                float p = m.anim.progress();
                m.pos = lerp(m.from, m.target, smoothstep(0.3f, 0.66f, p));
            }
            if (!m.struck && m.anim.event(m.skill == 3 ? "summon" : "hit")) { m.struck = true; boss_strike(m, "hit"); }
            if (m.skill == 0 && m.anim.event("hit2")) boss_strike(m, "hit2");
            if (m.anim.done()) {
                m.act = Act::Idle;
                if (m.skill == 2) {  // spent after the wail: a Break window
                    m.act = Act::Stun;
                    m.stun_t = 1.8f;
                    m.broken_t = 3.0f;
                    m.anim.play("stagger", 0.1f, true);
                    texts.push_back({vec3(m.pos, 3.2f), "EXHAUSTED", 0xFF2E88, 0, 34});
                }
                m.attack_cd = 1.4f;
            }
            break;
        }
        default: {
            // she keeps to her court: engaged, she follows a little way; if the hero truly escapes (or falls)
            // she walks home and gathers herself
            float leash = m.ai_state > 0 ? 26.f : 17.f;
            if (length(h.pos - m.home) > leash || !h.alive()) {
                m.ai_state = 0;
                vec2 back = m.home - m.pos;
                if (length(back) > 0.8f) {
                    want = normalize(back) * m.speed;
                    m.facing = wrap_angle(m.facing + wrap_angle(angle_of(back) - m.facing) * std::min(1.f, dt * 6.f));
                    m.anim.play("run", 0.15f, false, 1.f);
                } else {
                    m.anim.play("idle", 0.25f);
                }
                m.life = std::min(m.life_max, m.life + m.life_max * 0.08f * dt);
                if (m.life >= m.life_max) { m.phase = 0; m.cd3 = 1e9f; m.break_meter = 0; }  // fully reset
                break;
            }
            bool aggro = m.ai_state > 0 || dist < 11.f || m.life < m.life_max;
            if (!aggro) { m.anim.play("idle", 0.25f); break; }
            m.ai_state = 1;
            if (m.phase == 0 && m.life < m.life_max * 0.55f) {
                m.phase = 1;
                m.cd3 = 5.f;
                start(3, "summon", 1.f);
                texts.push_back({vec3(m.pos, 3.4f), "RISE, MY CHILDREN", 0xFF2E88, 0, 38});
                break;
            }
            if (m.phase == 1 && m.cd3 <= 0) {
                start(2, "wail", 1.f);
                telegraph(m.pos, 7.5f, kPi, 0, "hit");
                m.cd3 = 11.f;
                break;
            }
            if (dist > 5.5f && m.cd2 <= 0) {
                start(1, "leap", haste);
                m.from = m.pos;
                vec2 aim = h.pos + h.vel * 0.3f;
                if (length(aim - m.home) > 9.f) aim = m.home + normalize(aim - m.home) * 9.f;
                m.target = level.resolve(aim, m.radius);
                telegraph(m.target, 2.7f, kPi, 0, "hit");
                m.cd2 = m.phase ? 5.f : 6.5f;
                break;
            }
            if (dist <= d.attack_range + h.radius && m.attack_cd <= 0) {
                start(0, "combo", haste);
                telegraph(m.pos, d.attack_range + 0.4f, radians(70), m.facing, "hit");
                break;
            }
            want = dir * m.speed * haste;
            m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 6.f));
            m.anim.play("run", 0.15f, false, 1.f);
        }
    }
    if (m.act != Act::Skill || m.skill != 1) {
        m.vel = lerp(m.vel, want, std::min(1.f, dt * 8.f));
        m.pos = level.resolve(m.pos + (m.vel + m.knock * 0.3f) * dt, m.radius);
    }
    anim_step(m, dt);
}

void World::separate() {
    for (size_t i = 0; i < actors.size(); i++) {
        Actor& a = actors[i];
        if (!a.alive()) continue;
        for (size_t j = i + 1; j < actors.size(); j++) {
            Actor& b = actors[j];
            if (!b.alive()) continue;
            vec2 d = b.pos - a.pos;
            float r = a.radius + b.radius;
            float l2 = dot(d, d);
            if (l2 >= r * r || l2 < 1e-8f) continue;
            float l = std::sqrt(l2);
            vec2 push = d / l * (r - l);
            float wa = i == 0 ? 0.15f : 0.5f, wb = 0.5f;
            a.pos -= push * wa;
            b.pos += push * wb;
        }
    }
    // townsfolk stand their ground
    Actor& h = actors[0];
    for (const Npc& n : npcs) {
        vec2 d = h.pos - n.pos;
        float r = h.radius + 0.35f * n.scale, len = length(d);
        if (len < r && len > 1e-4f) h.pos = level.resolve(n.pos + d / len * r, h.radius);
    }
}

void World::burst(vec3 p, int n, vec4 c0, vec4 c1, float speed, float size, float life, bool additive, float gravity, uint8_t shape) {
    for (int i = 0; i < n && particles.size() < 3000; i++) {
        vec3 dir = normalize(vec3{fx_rng.range(-1, 1), fx_rng.range(-1, 1), fx_rng.range(0.1f, 1.2f)});
        Particle q;
        q.pos = p;
        q.vel = dir * speed * fx_rng.range(0.4f, 1.f);
        q.life = q.max_life = life * fx_rng.range(0.6f, 1.2f);
        q.size0 = size * fx_rng.range(0.7f, 1.3f);
        q.size1 = shape == 1 ? q.size0 * 1.8f : q.size0 * 0.3f;
        q.gravity = gravity;
        q.drag = shape == 1 ? 2.5f : 1.f;
        q.c0 = c0;
        q.c1 = c1;
        q.shape = shape;
        q.additive = additive;
        particles.push_back(q);
    }
}

void World::fx_step(float dt) {
    for (auto& p : particles) {
        p.vel.z += p.gravity * dt;
        p.vel = p.vel * std::exp(-p.drag * dt);
        p.pos += p.vel * dt;
        if (p.pos.z < 0.02f) { p.pos.z = 0.02f; p.vel.z *= -0.3f; p.vel = p.vel * 0.7f; }
        p.life -= dt;
    }
    particles.erase(std::remove_if(particles.begin(), particles.end(), [](const Particle& p) { return p.life <= 0; }), particles.end());
    for (auto& t : texts) { t.t += dt; t.pos.z += dt * 1.2f; }
    texts.erase(std::remove_if(texts.begin(), texts.end(), [](const FloatText& t) { return t.t > 1.1f; }), texts.end());
    shake = std::max(0.f, shake - dt * 1.8f);
}

}  // namespace q
