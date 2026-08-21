"""The roster: every sprite the ROM carries, and the name the game knows it by.

The drawings live in three modules — `cast` for the people, `bestiary` for what
they meet, `props` for the furniture — all built on `forge_tools`, all lit by the
same key light. `tools/forge.py` turns this list into src/gen/art.c.
"""
import bestiary
import cast
import props

ROSTER = [
    # the party and the two people who talk to them (56x72)
    ('carl', cast.carl),
    ('donut', cast.donut),
    ('mordecai', cast.mordecai),
    ('bopca', cast.bopca),

    # the bestiary (72x72)
    ('rat', bestiary.sewer_rat),
    ('goblin', bestiary.goblin_trapper),
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
    ('stairs', props.stairs_down),
    ('shop', props.shop_stall),
    ('shrine', props.shrine),
    ('door', props.door),
]
