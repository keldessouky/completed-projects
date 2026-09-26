"""The roster: every sprite the ROM carries, and the name the game knows it by.

The drawings live in three modules — `cast` for the people, `bestiary` for what
they meet, `props` for the furniture — all built on `forge_tools`, all lit by the
same key light. `tools/forge.py` turns this list into src/gen/art.c.
"""
import bestiary
import cast
import items
import props
import textures
import overworld

def _boss(name):
    """A boss from boss_ref.py, which boss_paint.py writes."""
    from boss_ref import BOSSES
    from import_ref import ALPHABET
    from forge_tools import Sprite
    pal, rows = BOSSES[name]
    s = Sprite(len(rows[0]), len(rows))
    idx = {ALPHABET[i]: s.ink(c) for i, c in enumerate(pal)}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * s.w + x] = idx[ch]
    return s.emit()


ROSTER = [
    # the party and the two people who talk to them, at three sizes, each
    # painted at its own size rather than scaled (see cast.py). The order
    # within each size is crawler order and the three groups are contiguous:
    # render.c finds a crawler's other sizes by offset.
    ('carl', cast.carl),
    ('donut', cast.donut),
    ('mordecai', cast.mordecai),
    ('bopca', cast.bopca),
    ('carl_s', cast.carl_s),
    ('donut_s', cast.donut_s),
    ('mordecai_s', cast.mordecai_s),
    ('bopca_s', cast.bopca_s),
    ('carl_l', cast.carl_l),
    ('donut_l', cast.donut_l),
    ('mordecai_l', cast.mordecai_l),
    ('bopca_l', cast.bopca_l),

    # the bestiary (72x72)
    ('rat', bestiary.sewer_rat),
    ('goblin', bestiary.goblin_trapper),
    ('rotsticker', bestiary.rot_sticker),
    ('troglodyte', bestiary.troglodyte),
    ('kobold', bestiary.kobold_sapper),
    ('sludge', bestiary.sludge_mound),
    ('sofa', bestiary.screaming_sofa),
    ('hound', bestiary.bramble_hound),
    ('bailiff', bestiary.bone_bailiff),
    ('beetle', bestiary.doom_beetle),
    ('mimic', bestiary.neon_mimic),
    ('bouncer', bestiary.club_bouncer),
    ('vulture', bestiary.vulture_fan),

    #  The block: what the dungeon made out of somebody's building and
    #  somebody's high street. Each one is a silhouette nothing else in the
    #  roster has -- a tall cabinet, a squat tub with its lid flung back, a
    #  cylinder, a bare pole, a box with something swinging off it.
    ('snackmachine', bestiary.snack_machine),
    ('wheeliebin', bestiary.wheelie_bin),
    ('boiler', bestiary.rusted_boiler),
    ('meter', bestiary.parking_meter),
    ('payphone', bestiary.payphone),

    #  Book one's own floors, which are tunnels and mob neighbourhoods rather
    #  than streets. A long-necked quadruped and a thing with no feet at all.
    ('llama', bestiary.bad_llama),
    ('mindhorror', bestiary.mind_horror),
    ('grub', bestiary.brindle_grub),

    #  The bosses of book one's floors, sculpted and lit in boss_paint.py
    #  and each painted at the height the battle screen shows it, so it is
    #  drawn one to one. See boss_ref.py for the pixels.
    ('boss_hoarder', lambda: _boss('hoarder')),
    ('boss_juicer', lambda: _boss('juicer')),
    ('boss_warchief', lambda: _boss('warchief')),
    ('boss_swine', lambda: _boss('swine')),
    ('boss_krakaren', lambda: _boss('krakaren')),
    ('boss_ralph', lambda: _boss('ralph')),
    ('boss_heather', lambda: _boss('heather')),
    ('boss_clammy', lambda: _boss('clammy')),
    ('boss_grimaldi', lambda: _boss('grimaldi')),
    ('boss_rage', lambda: _boss('rage')),

    #  Carl in chapter one, before the dungeon took his shoes off him.
    ('carl_crocs_s', cast.carl_crocs_s),

    # the furniture (40x40)
    ('box_bronze', lambda: props.loot_box(0)),
    ('box_silver', lambda: props.loot_box(1)),
    ('box_gold', lambda: props.loot_box(2)),
    ('box_legendary', lambda: props.loot_box(3)),
    #  The same four with the lid off, and the four lids, so the opening has a
    #  second state to cut to instead of shaking a shut box at the player.
    ('box_open_bronze', lambda: props.loot_box_open(0)),
    ('box_open_silver', lambda: props.loot_box_open(1)),
    ('box_open_gold', lambda: props.loot_box_open(2)),
    ('box_open_legendary', lambda: props.loot_box_open(3)),
    ('lid_bronze', lambda: props.loot_lid(0)),
    ('lid_silver', lambda: props.loot_lid(1)),
    ('lid_gold', lambda: props.loot_lid(2)),
    ('lid_legendary', lambda: props.loot_lid(3)),
    ('stairs', props.stairs_down),
    ('shop', props.shop_stall),
    ('shrine', props.shrine),
    ('door', props.door),
]

# The corridor surfaces. Not sprites -- src/render/view3d.c samples these
# directly and tiles them, so index 0 is a real colour here, not transparency.
#  What the boxes pay out, one per entry in item_defs and in that order, so
#  the renderer can go from an item id straight to a sprite. An RPG that names
#  a reward and shows nothing is asking you to take its word for it.
ROSTER += items.ROSTER

ROSTER += textures.ROSTER

# The party as the overworld sees them: 16x24, three facings, mirrored for the
# fourth. Small enough that silhouette is the whole design.
ROSTER += overworld.ROSTER
