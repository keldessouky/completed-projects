// Saves: the character file round-trips and refuses what it cannot read.
#include "tests/check.hpp"
#include "game/save.hpp"

using namespace q;

TEST(character_file_round_trips) {
    Hero h;
    Rng rng(3);
    h.level = 7;
    h.xp = 1234.5f;
    h.gold = 321;
    h.kills = 99;
    h.filter = FILTER_STRICT;
    h.currency[CUR_SAFFRON] = 4;
    h.weapon() = make_item(find_base("brass_maul"), Rarity::Rare, 8, rng);
    h.equip[EQ_RING2] = make_item(find_base("brass_ring"), Rarity::Magic, 8, rng);
    h.inv.add(make_item(find_base("work_coat"), Rarity::Rare, 8, rng));
    ByteWriter w;
    write_character(w, h);
    Hero r;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, r));
    CHECK(r.level == 7 && r.gold == 321 && r.kills == 99 && r.filter == FILTER_STRICT && r.currency[CUR_SAFFRON] == 4);
    CHECK_NEAR(r.xp, 1234.5, 1e-3);
    CHECK(r.weapon().seed == h.weapon().seed && r.weapon().affixes.size() == h.weapon().affixes.size());
    CHECK(r.equip[EQ_RING2].seed == h.equip[EQ_RING2].seed && r.equip[EQ_HELMET].empty());
    CHECK(r.inv.items.size() == 1 && r.inv.items[0].item.name == h.inv.items[0].item.name);
    // a truncated or foreign file is refused
    ByteReader bad(w.buf.data(), 6);
    Hero x;
    CHECK(!read_character(bad, x));
}
