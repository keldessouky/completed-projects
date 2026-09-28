// Slice 7: the Mercenary (swords, a crossbow on the back and the weapon swap, bleeding, piercing bolts, grenades), its
// sky and two ascendancies, Act III's road and its resistance penalty, and the Excavations (their charges, their
// chamber, and relics that never drop at random).
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "core/pack.hpp"
#include "game/areas.hpp"
#include "game/classes.hpp"
#include "game/menu.hpp"
#include "game/save.hpp"
#include "game/zone.hpp"
#include <cstdio>

using namespace q;

TEST(the_mercenary_swaps_to_the_crossbow_on_its_back_when_a_skill_needs_it) {
    CHECK(load_generated_tree());
    const ClassDef& c = class_def("mercenary");
    CHECK(std::string(c.id) == "mercenary" && c.playable && c.weapon2);
    World w;
    w.reset_hero("mercenary");
    CHECK(w.hero.weapon().b().wkind == WK_SWORD && w.hero.equip[EQ_WEAPON2].b().wkind == WK_CROSSBOW);
    CHECK(w.hero.talismans.size() == 4);
    SkillCtx cut = w.slot_ctx(0), bolt = w.slot_ctx(3);
    CHECK(cut.def && std::string(cut.def->id) == "crescent_cut" && cut.usable);
    CHECK(bolt.def && std::string(bolt.def->id) == "quarrel" && !bolt.usable && bolt.needs_weapon);
    // rated with the crossbow it would swap to, Quarrel has damage of its own
    CHECK(hero_skill_ctx(w.hero, *w.hero.slot_talisman(3)).usable && hero_skill_ctx(w.hero, *w.hero.slot_talisman(3)).hit.dps() > 0);
    // the weapon on the back gives nothing until it is in hand
    Rng r(3);
    w.hero.equip[EQ_WEAPON2] = make_item(find_base("light_crossbow"), Rarity::Normal, 1, r);
    w.hero.equip[EQ_WEAPON2].affixes.push_back({uint16_t(find_affix("bleed_chance")), 0, 10, 0});
    w.recompute_hero();
    CHECK(w.hero.stats.sum(S_BLEED).flat == 0);
    // Quarrel pressed: the crossbow comes into hand, the sword goes on the back, and the shot is loosed
    w.actors[0].mana = w.actors[0].mana_max;
    w.start_skill(3, {0, 1});
    CHECK(w.hero.weapon().b().wkind == WK_CROSSBOW && w.hero.equip[EQ_WEAPON2].b().wkind == WK_SWORD);
    CHECK(w.actors[0].act == Act::Skill && w.hero.stats.sum(S_BLEED).flat == 10);
    // and Crescent Cut takes the sword back
    w.actors[0].act = Act::Idle;
    w.start_skill(0, {0, 1});
    CHECK(w.hero.weapon().b().wkind == WK_SWORD);
    // a crossbow found goes on the back, not in the sword's place
    Item xb = make_item(find_base("arbalest"), Rarity::Normal, 12, r);
    CHECK(equip_slot_for(xb, w.hero.equip) == EQ_WEAPON2);
}

TEST(bleeding_ticks_away_and_riposte_opens_the_wound) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("mercenary");
    w.area_level = 10;
    w.spawn_monster(find_monster("timthal"), {0, 1.6f}, Rarity::Normal, 10);
    size_t mi = w.actors.size() - 1;
    w.actors[mi].life = w.actors[mi].life_max = 1e4f;   // small enough for float steps of a quarter point to add up
    w.actors[mi].armour = 0;
    HeroHit hh;
    hh.hit.min[DT_PHYS] = hh.hit.max[DT_PHYS] = 100;
    hh.bleed = 1.f;
    hh.talisman = 0;
    w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    Actor& m = w.actors[mi];
    CHECK(m.bleed_t > 4.9f && std::fabs(m.bleed_dps - 100 * 0.7f / 5.f) < 0.5f);
    float before = m.life;
    for (int k = 0; k < 60; k++) w.ailments_step(m, 1.f / 60.f);
    CHECK(std::fabs((before - m.life) - m.bleed_dps) < 1.f);   // a second of bleeding
    // Riposte's second thrust bursts what the bleed had left
    w.actors[0].facing = kPi / 2;
    w.actors[0].skill = 1;
    w.actors[0].struck2 = true;
    const float left = m.bleed_dps * m.bleed_t;
    before = m.life;
    w.resolve_skill(w.actors[0]);
    CHECK(m.bleed_t <= 0 && before - m.life > left);
}

TEST(bolts_pierce_and_never_strike_the_same_enemy_twice) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("mercenary");
    for (int k = 0; k < 3; k++) {
        w.spawn_monster(find_monster("desert_ghoul"), {0, 3.f + 2.f * k}, Rarity::Normal, 20);
        w.actors.back().life = w.actors.back().life_max = 1e6f;
    }
    Projectile p;
    p.pos = {0, 1};
    p.vel = {0, 30};
    p.team = TEAM_HERO;
    p.life = 1.f;
    p.hh.hit.min[DT_PHYS] = p.hh.hit.max[DT_PHYS] = 10;
    p.pierce = 1;
    w.projectiles.push_back(p);
    Input none{};
    for (int k = 0; k < 30; k++) w.step(none, 1.f / 60.f);
    int hit = 0;
    for (size_t i = 1; i < w.actors.size(); i++) hit += w.actors[i].life < w.actors[i].life_max;
    CHECK(hit == 2);   // the first, and one more
}

TEST(the_mercenarys_two_ascendancies_and_its_keystone) {
    CHECK(load_generated_tree());
    auto two = ascendancies_of("mercenary");
    CHECK(two.size() == 2);
    const Ascendancy* duel = ascendancy_of("mercenary", find_ascendancy("duelist"));
    const Ascendancy* demo = ascendancy_of("mercenary", find_ascendancy("demolitionist"));
    CHECK(duel && demo && duel->nodes.size() == 13 && demo->nodes.size() == 13);
    Stats s;
    uint64_t rules = 0;
    asc_apply(*duel, (1u << 11) | (1u << 12), s, rules);   // Footwork, then Crescent Moon
    CHECK((rules & KS_CRESCENT) && s.sum(S_MOVE_SPEED).inc == 5);
    // the rules sit above bit 31 of the old mask
    CHECK(uint64_t(KS_CHAIN_BURST) == (1ull << 31));
    // al-Han'a in the sky: every hit brands
    const PassiveTree& T = tree();
    int brand = -1;
    for (auto& st : T.stars) if (st.keystone == KS_BRAND) brand = st.id;
    CHECK(brand >= 0);
    CHECK(T.class_start("mercenary") >= 0 && T.recommended_for("mercenary") && !T.recommended_for("mercenary")->empty());
    World w;
    w.reset_hero("mercenary");
    w.hero.passives.taken[size_t(brand)] = 1;
    w.recompute_hero();
    CHECK(w.hero.keystones & KS_BRAND);
}

TEST(act_three_crosses_the_western_desert_and_takes_thirty_resistance) {
    const char* road[] = {"farafra", "sand_sea", "siwa", "shali", "oracle"};
    int last = 25;
    for (size_t i = 0; i < 5; i++) {
        int z = find_zone(road[i]);
        CHECK(z >= 0);
        const ZoneDef& d = zone_def(z);
        CHECK(d.act == 3 && d.level > last);
        last = d.level;
        if (i + 1 < 5) CHECK(std::string(d.next) == road[i + 1]);
        if (*d.boss) CHECK(boss_def(find_monster(d.boss)) != nullptr);
    }
    CHECK(std::string(zone_def(find_zone("tomb")).next) == "farafra");   // Act II leads on to it
    const ZoneDef& trial = zone_def(find_zone("bab_futuh"));
    CHECK(trial.trial && trial.toll_slot == EQ_BODY && std::string(zone_def(find_zone("siwa")).side) == "bab_futuh");
    CHECK(quest_asc_points(Q_TRIAL1 | Q_TRIAL2) == 4 && quest_passive_points(Q_DABA | Q_WRAITH) == 2);
    // after Act III every resistance is 30% lower
    CHECK(act_res_penalty(0) == 0 && act_res_penalty(Q_ACT3) == 30);
    Hero h;
    h.base.add(S_FIRE_RES, MK_FLAT, 50);
    h.passives.cls = "warrior";
    compute_hero_stats(h);
    float before = summarize(h).res[DT_FIRE];
    h.quests |= Q_ACT3;
    CHECK(std::fabs(before - summarize(h).res[DT_FIRE] - 30) < 1e-3f);
}

TEST(a_character_file_v7_keeps_the_weapon_swap_and_waypoints_past_32) {
    CHECK(load_generated_tree());
    Hero h;
    h.passives.cls = "mercenary";
    Rng r(9);
    h.equip[EQ_WEAPON] = make_item(find_base("mamluk_sword"), Rarity::Rare, 20, r);
    h.equip[EQ_WEAPON2] = make_item(find_base("arbalest"), Rarity::Magic, 20, r);
    h.waypoints = (1ull << find_zone("oracle")) | 1ull;
    CHECK(find_zone("oracle") >= 32);
    h.currency[CUR_RELIC] = 7;
    ByteWriter w;
    write_character(w, h);
    Hero b;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, b));
    CHECK(b.equip[EQ_WEAPON2].seed == h.equip[EQ_WEAPON2].seed && b.equip[EQ_WEAPON].seed == h.equip[EQ_WEAPON].seed);
    CHECK(b.waypoints == h.waypoints && b.currency[CUR_RELIC] == 7);
}

TEST(relics_never_drop_at_random_and_amm_ramadan_takes_them) {
    CHECK(currency_def(CUR_RELIC).weight == 0);
    Rng r(4);
    for (int k = 0; k < 2000; k++) CHECK(roll_currency(r, 100) != CUR_RELIC);
    Item u = make_unique(0, 30, r);
    CHECK(Menu::relic_price(u) > Menu::relic_price(make_chart(4, r)));
}

TEST(an_excavation_lays_its_charges_down_a_walkable_line) {
    static int state = -1;
    if (state < 0) state = pack().open_file((std::string(QAHIRA_SOURCE_DIR) + "/build/Qahira.qpk").c_str()) ? 1 : 0;
    if (state != 1) { std::printf("  (skipped: no build/Qahira.qpk)\n"); return; }
    int made = 0;
    for (uint32_t seed = 1; seed <= 12; seed++) {
        const ZoneDef& zd = zone_def(find_zone("site_iskandariya"));
        World w;
        Areas a;
        a.zone.layout = generate_zone(seed * 2654435761u, zd.w, zd.h, zd.branches);
        build_zone_level(a.zone.layout, zd.tileset, w.level);
        w.actors.resize(1);
        if (!a.arm_dig(w)) continue;
        made++;
        const Dig& d = w.dig;
        CHECK(d.armed && !d.fired);
        std::vector<vec2> path;
        for (auto& s : d.spots) CHECK(w.level.find_path(d.stake, s, 0.5f, path));
        int charges = 0, detonators = 0;
        for (auto& it : w.interacts) { charges += it.kind == Interactable::Charge; detonators += it.kind == Interactable::Detonator; }
        CHECK(charges == Dig::kCharges && detonators == 1);
        // fired before every charge is set: nothing happens
        for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Detonator) w.dig_use(int(i));
        CHECK(!w.dig.fired);
        for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Charge) w.dig_use(int(i));
        CHECK(w.dig.all_set());
        for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Detonator) w.dig_use(int(i));
        CHECK(w.dig.fired);
    }
    CHECK(made >= 8);
}
