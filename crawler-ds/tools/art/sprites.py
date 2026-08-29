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

ROSTER = [
    # the party and the two people who talk to them (56x72)
    ('carl', cast.carl),
    ('donut', cast.donut),
    ('mordecai', cast.mordecai),
    ('bopca', cast.bopca),

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

    # the bosses (96x96)
    ('boss_ratking', bestiary.boss_ratking),
    ('boss_foreman', bestiary.boss_foreman),
    ('boss_producer', bestiary.boss_producer),

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
