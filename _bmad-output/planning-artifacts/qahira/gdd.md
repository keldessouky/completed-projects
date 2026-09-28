---
title: "QAHIRA — Game Design Document"
status: draft v2
created: 2026-09-27
updated: 2026-09-27
companions: [brief.md, architecture.md, slices.md]
---

# QAHIRA — Game Design Document

Contents: 1 Core loop · 2 Controls · 3 Combat · 4 Classes & ascendancies ·
5 The Book of Fixed Stars (passive tree) · 6 Talismans & Wafq (skills) ·
7 Items, crafting, loot · 8 Stats & the damage pipeline · 9 Campaign ·
10 Endgame · 11 Handheld UX · 12 Art & audio direction · 13 Onboarding

---

## 1. Core loop

```
      ┌──────────── kill ────────────┐
      ▼                              │
  explore zone ──► loot ──► filter/pick ──► craft / equip / carve Talismans
      ▲                                              │
      │                                              ▼
  next zone / chart ◄── allocate stars ◄── level up / ascend
```

- **Minute to minute:** move, dodge, set up, pay off, pick up the beam.
- **Session (8–12 min):** one zone or one chart, then back to the rooftop hub.
- **Long term:** plan a build, chase what enables it, climb chart tiers, beat
  the pinnacles, then roll another class.

Every zone and chart is sized so a normal run lasts under 12 minutes.
RetroArch's sleep and save-state support means you can stop at any moment
(§11.6).

---

## 2. Controls (fits the 16-button RetroPad)

libretro exposes a **RetroPad**: two sticks, analog L2/R2, and 16 buttons. The
RP6's rear M1/M2 buttons are remapped at the system level, so they have to
**alias** RetroPad buttons. The recommended setup is **M1 → L3** and **M2 → R3**.
Face buttons are named by position, since the RP6 can swap between Nintendo
and Xbox labels.

| Input | In combat | In menus |
|---|---|---|
| Left stick | Move | Magnetised cursor |
| Right stick | Aim override; free aim for skillshots | Pan / scroll |
| **South** | Skill 1 (default attack); interact outside combat | Select |
| **West / North** | Skill 2 / Skill 3 | Context actions |
| **East** | **Dodge roll**; hold to sprint after the roll | Back |
| **R1** | Skill 4 | Next tab |
| **R2 (analog)** | Skill 5. Charged and channelled skills read trigger depth. | — |
| **L2 (hold)** | Second bar: South/West/North/R1/R2 become Skills 6–10 | Previous tab |
| L1 | Swap weapon set | — |
| **L3 (M1)** | Life flask | — |
| **R3 (M2)** | Mana flask | Full tooltip |
| D-pad ↑ | Portal to the rooftop | Navigate |
| D-pad ← | Pick up nearest highlighted item | Navigate |
| D-pad → | Toggle loot labels | Navigate |
| D-pad ↓ | Overlay map | Navigate |
| Select | Hard target lock (flick right stick to cycle) | Quick stats |
| Start | Menu hub | Close |
| Gyro (if RetroArch exposes it) | Fine aim while a skill is held | — |
| Touch (libretro pointer) | Tap loot, NPCs | Drag, tap (tree, stash, map) |

**Targeting:** a soft auto-target cone of 30° in the facing direction, weighted
by threat and distance. The right stick overrides it. Ground-targeted skills
place their reticle by right-stick deflection.

**Analog triggers:** bow draws, channelled beams and slam wind-ups on R2 scale
with trigger depth. Half-pulling holds the charge.

Everything is rebindable in the game. RetroArch remaps also work.

---

## 3. Combat

### 3.1 Feel
- Every attack has a **wind-up → impact → recovery**. You can cancel into a
  dodge after the impact frame. **Hit-stop** is 30–60 ms on heavy hits. Rumble
  and a camera kick on every impact.
- Most skills slow movement to 50–70% while in use.
- **Dodge roll:** 0.45 s, 3.5 m, no i-frames by default. Evasion notables add
  brief phasing.

### 3.2 Setup and payoff
| State | Applied by | Consumed by |
|---|---|---|
| **Cracked ground** | Slams, heavy strikes | Aftershock skills detonate it |
| **Frozen / Chilled** | Cold buildup | Shatter |
| **Shocked** | Lightning | Extra chains |
| **Marked** | Ranger marks, curses | Payoffs hit a weak point (guaranteed crit) |
| **Broken** | Stun / Break buildup | Heavy hits: a ×3 window |
| **Glyphs** | Some spells leave a glyph on the ground | The next spell cast inside it is empowered |
| **Hexed** | Chaos curses | Detonate: the hex bursts |

### 3.3 Buildups, ailments, charges
- **Buildup meters** (as in PoE2) for Freeze, **Break** (heavy stun) and
  **Dread** (chaos; the target flees). They show under the boss bar.
- **Ailments:** Ignite, Chill, Freeze, Shock, Bleed, Poison, Wither.
- **Charges:** **Endurance** (damage reduction and resistances), **Frenzy**
  (speed), **Power** (crit).

### 3.4 Enemies (folklore, not religion)
- Rarity is normal, magic, rare or unique. Rare mods show as **icons**.
- **Families:** ghouls (ghūl and ghūla) of the City of the Dead · quṭrub
  (graveyard ghouls that behave like werewolves) · ifrīt (fire) · mārid (water
  and sea) · siʿlāh (shapeshifters) · nasnās (half-bodied hoppers) · El Naddāha
  (the Nile's calling siren) · Umm al-Ṣubyān · ʿAisha Qandisha (Maghreb) ·
  sand-wraiths of the Great Sand Sea · Apep's coils (ancient Egyptian).
- **Modern twist:** the jinn possess the city itself. Microbuses, neon signs,
  satellite dishes and tangles of electrical cable become enemies and hazards.
- **Allies:** Cairo's **street cats can see the jinn**. A cat follows you, hisses
  at invisible enemies, and leads you to secrets. It is cosmetic and helpful,
  and it can never be hurt.
- **Bosses:** gold and magenta telegraphs, 2–3 phases, Break windows, and arenas
  that fit the camera.

### 3.5 Flasks and Nazars
- **2 flasks** (Life and Mana) on the rear buttons. Flask bases include the
  Clay Qulla, the Brass Thermos and the Copper Ibrik.
- **3 Nazar slots:** evil-eye charms that trigger automatically on a
  condition (on freeze, at low life, when a boss appears), like PoE2's charms.

---

## 4. Classes and ascendancies

The classes work exactly like PoE's. Each one is a plain combat archetype at a
point on the attribute wheel. **The world and the look are different, not the
class fantasy.** Nobody is written as a cultural archetype. Each class is a
person in today's Cairo who picked up a weapon when the sun went out (§12.3).

Attributes: **Strength**, **Dexterity**, **Intelligence**. Every class has
two body types on one shared rig.

| Class | Attr | Weapons | Plays like | Ascendancies (★ = launch) |
|---|---|---|---|---|
| **Warrior** | Str | Maces, axes, two-handers, shields | Slams, warcries, armour, stun | ★ **Ironclad** (armour, Endurance charges, stun immunity) · ★ **Ravager** (rage, leech, speed at low life) · Warcaller (warcries, totems) |
| **Ranger** | Dex | Bows, spears | Projectiles, evasion, flask uptime | ★ **Marksman** (projectile crits, marks) · ★ **Outrider** (speed, poison, flask and charm uptime) · Beastmaster (companion) |
| **Sorcerer** | Int | Staves, wands | Elemental spells, energy shield, minions | ★ **Stormbinder** (elemental ailments, spell crits) · ★ **Gravecaller** (minions) · Hexer (curses, chaos) |
| **Mercenary** | Str/Dex | Swords, crossbows, grenades | Weapon swapping, combos, bleed | ★ **Duelist** (single-target melee, riposte, bleed) · ★ **Demolitionist** (grenades, crossbow ammo, area) · Vanguard (block, banners) |
| **Shadow** | Dex/Int | Daggers, claws, quarterstaves | Crits, poison, traps, chaos | ★ **Nightblade** (crits, poison) · ★ **Mystic** (quarterstaff, lightning and cold charges) · Trapwright (traps, mines) |
| **Templar** | Int/Str | Maces, sceptres, staves | Elemental melee, auras, totems | ★ **Zealot** (fire, consecrated ground) · ★ **Warden** (block, auras, recovery) · Totemist (totems) |
| **Wanderer** | Centre | Any | Unlocked after the campaign | **Fragments:** one notable from each of three other ascendancies |

Any class can use any weapon or skill. The class sets your **start in the
sky** and which ascendancies you can take. Each ascendancy has ~14 nodes and
you allocate **8 points**. Each one ships with a **Recommended Path** (§13).

---

## 5. The Book of Fixed Stars: the passive tree

### 5.1 Concept
In 964, ʿAbd al-Raḥmān al-Ṣūfī published the *Book of Fixed Stars* in
Isfahan. Most star names in English today are Arabic because of books like it:
Aldebaran, Algol, Altair, Betelgeuse, Deneb, Rigel, Vega. The passive tree is
**that sky**. Nodes are stars, notables are named stars, and each cluster is a
constellation drawn in al-Sufi's illustrated style. On the AMOLED it is gold
pinpoints on pure black, and it should be the most beautiful screen in the game.

### 5.2 Shape
```
                    Int · Sorcerer
          Templar ◆                ◆ Shadow
                     ╲   ╭───╮   ╱
        Str ───────── (  ◉ Pole ) ───────── Dex
                     ╱   ╰───╯   ╲
          Warrior ◆                ◆ Ranger
                    Mercenary (Str/Dex, at 6 o'clock)
        ── outer rim: the 28 Lunar Mansions (keystones) ──
```

The layout is concentric:
1. **The Pole** (centre): the Wanderer's start, with spokes to all six classes.
2. **Inner ring:** six class starts, 60° apart. Pure attributes and hybrids
   alternate.
3. **The Ecliptic:** a ring road of attribute stars and the **5 Great Sockets**
   for the Wandering Stars (§5.5).
4. **Constellation band:** about 48 constellations, each with 3–5 notables, a
   Mastery and minor stars.
5. **The Manāzil** (outer rim): the **28 lunar mansions** of Arabic astronomy,
   **one keystone each**, named for the real mansions (al-Sharaṭān, al-Thurayyā,
   al-Dabarān, al-Hanʿa and so on).

### 5.3 Node types (~850)
| Type | Count | Example |
|---|---|---|
| Minor star | ~560 | +10 max Life · 8% increased Fire Damage |
| Attribute star | (inside minors) | Choose Strength, Dexterity or Intelligence on allocate |
| Notable (a named star) | ~190 | **Altair, the Flyer:** 25% increased projectile speed; projectiles pierce 1 more |
| Mastery | ~48 | Choose 1 of 4–6 effects once a notable in the constellation is taken |
| Keystone (lunar mansion) | 28 | **al-Ghūl's Head** (Algol, the Demon Star): your curses cannot expire; you can apply only one · **al-Dabarān, the Follower:** you deal 40% more damage to the last enemy that hit you, and 20% less to all others · **al-Thurayyā** (the Pleiades): seven skills share one cooldown pool |
| Star socket | 21 | Holds a Star-Stone (jewel). The 5 Great Sockets hold Wandering Stars. |

### 5.4 Points and respec
- **123 points:** 99 from levels plus 24 from quests. **8 ascendancy points.**
- Respec is free until level 20. After that each point costs one **Rosewater
  Vial** plus dinars. Three saved loadouts.

### 5.5 Wandering Stars (the long chase)
The five classical planets by their Arabic names. Each one fits a Great Socket
and **rewrites every node in its orbit**. Each drops as a seeded "transit"
variant.

| Star | Effect on nodes in radius |
|---|---|
| **al-Mirrīkh, al-Qāhir** (Mars, Cairo's namesake) | Life nodes become Fire damage + Life leech |
| **al-Zuhara** (Venus) | Each notable in radius adds +1 to all charge maximums (capped) |
| **ʿUṭārid** (Mercury) | Minor stars become attributes; attributes grant spell damage |
| **al-Mushtarī** (Jupiter) | Notables gain one extra stat (command, minions, auras) |
| **Zuḥal** (Saturn) | Nodes in radius can be allocated without a connection, at double cost |

### 5.6 Using the sky on the RP6 (built in Slice 3)
- The **magnetised cursor** snaps to the nearest star in the push direction. The
  **D-pad walks along edges**. L1/R1 jump between planned notables. L2/R2 zoom
  through three detail levels.
- **South on a star:** preview the cheapest path and its cost, then commit.
  Changes are staged: **Start applies, East cancels.**
- **North: search** by stat keyword chips. Matches glow.
- **Planner:** ghost nodes you plan now. On level-up, one press allocates the
  next planned node.
- **Touch:** drag and tap.
- **Stat delta** on every preview (±DPS, ±EHP, resists).
- **Build codes:** exported as a short string and an on-screen **QR code**, and
  imported the same way.

### 5.7 Tree health rules (the CI validator)
- Everything is reachable from every start.
- Each class reaches ≥ 2 keystones in ≤ 25 points and every keystone in ≤ 60.
- No constellation holds more than ~40% of any one stat.
- Each notable's power stays inside its tier band.

---

## 6. Skills: Talismans and Wafq

A skill is a **Talisman** (from the Arabic *ṭilasm*). Supports are **Wafq**:
magic squares carved into the talisman, each one drawn as its real number
square. This is the PoE2 model: no gear sockets, no colour or link RNG.

- **Blank Talismans** drop with a level (1–20). Carving one lets you **choose
  any Talisman you've unlocked** at or below that level.
- A Talisman starts with **2 Wafq slots**. A **Brass Stylus** adds slots, up to
  **5**. **Each Wafq can be used in only one Talisman at a time.**
- Attribute requirements feed back into the tree. Levels 1–20 plus gear bonuses.
- **Nafas** (breath) is reserved by persistent skills: auras, bound jinn,
  banners.
- **Tags:** Attack, Spell, Melee, Projectile, Area, Slam, Strike, Channel,
  Duration, Minion, Totem, Trap, Curse, Inscription, Warcry, Aura, Rhythm, plus
  elements.
- Two weapon sets, and each Talisman is bound to a set.

**Example: the Warrior's early kit (Slice 1)**
| Talisman | Role |
|---|---|
| Crushing Blow | Basic strike. The third hit in a string cracks the ground. |
| Earthshatter | Slam. Cracks the ground in a cone. |
| Rallying Shout | Warcry. Your next 3 hits gain Break buildup. |
| Aftershock | Payoff. Every crack in range erupts. |

Catalogue target: ~60 Talismans, ~80 Wafq, ~20 Nafas skills.

---

## 7. Items, crafting and loot

### 7.1 Slots
Two weapon sets, helmet, body, gloves, boots, belt, amulet, 2 rings, 3 Nazars,
2 flasks.

### 7.2 Affixes
Normal, magic (1+1), rare (3+3), unique. Item level gates tiers. The expanded
tooltip shows tier and range. Corruption is available. Quality goes to 20%.

### 7.3 Currency: things from a Cairo street, made magic
| Currency | Does |
|---|---|
| **Blue Bead** (kharaza zarqa) | Normal → magic |
| **Pinch of Salt** | Add a mod to a magic item |
| **Coffee Grounds** | Reroll a magic item |
| **Saffron Thread** | Normal → rare |
| **Gilded Piastre** | Magic → rare, adding one mod |
| **Khamsa** | Add a random mod to a rare |
| **Bakhoor Ash** | Remove one mod, add one |
| **Broken Tea Glass** | Remove a random mod |
| **Drop of Attar** | Reroll numeric values |
| **Ifrit's Ember** | Corrupt |
| **Brass Stylus** | +1 Wafq slot |
| **Rosewater Vial** | Refund one passive point |
| **Spice Blends** (e.g., *Baharat of Embers*) | Upgrade with a **guaranteed** mod type |
| **Coffee-Cup Omens** | Read the cup to bend your next craft: *the Bird in the Cup* (next Khamsa adds a suffix), *the Closed Door* (next Glass cannot remove a crafted mod), and so on |
| **Dinars** | Vendors, respecs, the workbench |

### 7.4 Fair solo play
- **The Coppersmith's Bench** in Khan el-Khalili: deterministic crafts from
  recipes you find. One bench mod per item.
- **Poster Scraps:** torn pieces of hand-painted posters for invented
  golden-age Egyptian films. Complete a poster to get the specific unique it
  shows.
- **Spice Blends** and **Omens** turn crafting from gambling into planning.
- **Upgrade hints:** ±DPS and ±EHP on every drop, and a ★ on strict upgrades.

### 7.5 Built-in loot filter
Presets from Story to Uber, switchable mid-map. A rule editor built from
condition and action chips. Auto-pickup for dinars and currency. Beams are
lantern-light pillars.

### 7.6 Stash
Tabs, auto-deposit by affinity, keyword-chip search, and bulk sell or salvage by
filter.

---

## 8. Stats and the damage pipeline

One modifier engine. A modifier is `(stat, kind: flat|inc|more|override|flag,
value, tags, conditions, source)`.

**The hit pipeline:**
1. Base damage
2. Flat added
3. Conversion (physical → lightning → cold → fire → chaos), then gained-as-extra
4. Increased (one additive sum)
5. More (each one multiplies)
6. Crit
7. Mitigation: armour `DR = A/(A+10·D)`, capped at 90% · resistances capped at
   75%, with penetration · block · entropy-based evasion
8. Ailments and buildups

**Defences:** Life, **Hirz** (the energy shield analog), armour, evasion, block,
resistances, leech, regen, Break resistance. Resistance penalty: −30% after
Act III, −60% after Act VI.

Every number on the sheet has a **"Why?" breakdown**.

---

## 9. Campaign: along the path of the eclipse

### 9.1 Structure
The **rooftop hub** sits in Islamic Cairo, a rooftop ahwa (café) looking out
over domes and minarets in endless dusk, with the black ring in the south. From
there each act follows the Moon's shadow.

| Act | Region | Levels | Zones (examples) | Boss |
|---|---|---|---|---|
| **I** | **Cairo in Twilight** | 1–14 | Downtown (Wust el-Balad), the Metro under Tahrir, Khan el-Khalili, al-Muizz Street, the City of the Dead, Mokattam cliffs | **Umm al-Ghūla**, mother of the ghouls, in the City of the Dead · an ifrīt bound in **Bab Zuweila** (**Trial I**) |
| **II** | **The Nile to Luxor**: the eye of totality | 14–26 | A felucca river run, Upper Egypt villages, Karnak's hypostyle hall under a black sun, the Valley of the Kings | **El Naddāha** · first glimpse of **Apep's coils** around the sun |
| **III** | **The Western Desert** | 26–36 | The White Desert, Siwa, the Great Sand Sea | The **Sand-Wraith of Siwa** · **Trial II** (Bab al-Futuh) · −30% res |
| **IV** | **The Maghreb Coast** | 36–46 | Ghadames old town, Chott el-Djerid salt flats, the Tunis medina | **The Ghūla of the Salt** |
| **V** | **The Atlas and the Strait** | 46–56 | Fes tanneries, blue Chefchaouen, Jemaa el-Fnaa at night, Tangier on the Strait | **ʿAisha Qandisha** · **Trial III** (Bab al-Nasr) |
| **VI** | **Across the Red Sea** | 56–66 | Al-Balad's coral houses in Jeddah, Shibam's mudbrick towers in Hadramawt, the Empty Quarter, **Iram of the Pillars** (the legendary lost city) | **Apep**, in the sky above Luxor, at the heart of totality · −60% res |

About 36 zones and 18 bosses. Zones are generated from hand-authored tiles and
grammars (architecture.md §7).

### 9.2 Ascendancy trials: every gate takes a toll
Cairo's three surviving Fatimid gates (**Bab Zuweila, Bab al-Futuh, Bab
al-Nasr**) hold trial dungeons. The gatekeeper collects a **toll**: you enter
with one gear slot sealed (amulet, then body armour, then rings), and the item is
returned afterwards. The fourth trial, **the Gate of Iram**, is in the endgame,
and **you choose** what to give up. A braver toll gets a better reward. Each
trial grants 2 points, for 8 in total.

### 9.3 The ending choice
At the heart of the eclipse you can **seal the Veil** or **leave the door
open**. Sealing it brings back the sun and sends the jinn back to being unseen;
you lose your Eclipse-Eye but gain +2 passive points. Leaving it open keeps the
night and a harder, richer endgame world where jinn offer bargains. The choice
is per character and shown on character select.

---

## 10. Endgame: the Map of al-Idrisi

In 1154 al-Idrisi drew the world for King Roger of Sicily, with **south at the
top**. The endgame is that map, brought to life. Its regions are drawn in the
map's own style, and the eclipse band is a dark line across it.

- **Charts** (map items, tiers 1–16) are run on map **sites**. Completing one
  reveals its neighbours. Chart mods add risk and reward, and Omens can be
  pressed into charts.
- **The Astrolabe** (atlas tree): ~120 nodes used to specialise in mechanics.
- **Launch mechanics:**
  1. **Haboob:** a sandstorm wall rolls across the map. Visibility drops, sand
     jinn come with it, and the longer you stay in the storm the more you earn.
  2. **Mārid Rifts:** tears full of hordes. Collect splinters to summon a Rift
     Lord.
  3. **Excavations:** place charges along a line to uncover buried chambers and
     their guardians. Barter the relics with an old antiquities dealer.
  4. **Zar Nights:** keep a drum circle going. Kills fill the rhythm, and the
     rhythm pays out.
- **Pinnacles:** **the Mārid King** · **Umm al-Ṣubyān** · **Falak**, the great
  serpent beneath the world from Arab cosmology, which is Apep's true form. Uber
  versions of all three.
- **Seasons** (later): offline content cycles, each with a new mechanic and an
  optional fresh-start stash.

---

## 11. Handheld UX

- **Camera:** perspective, 30° FOV, 55° pitch, about a 14 m radius visible. It
  pulls back up to 15% when crowded.
- **Text:** body ≥ 36 px, secondary ≥ 32 px, headers ≥ 48 px, UI always drawn at
  native 1080p. Tooltips have a compact view (name, key stats, ±DPS/EHP) and an
  expanded view (R3).
- **HUD:** life orb bottom-left, mana orb bottom-right, the skill bar between
  them with **glyphs matching the physical buttons**. Holding L2 slides in bar
  two. Boss bar top-centre, optional minimap top-right.
- **AMOLED care:** true-black UI. The static HUD dims to 40% after 4 s out of
  combat and drifts ±2 px every few minutes. No pure-white static elements.
- **Menu hub:** L1/R1 tabs for Character, Stars, Talismans, Inventory, Map,
  Journal and Settings. A 12×5 inventory with variable item sizes, a
  magnetised cursor and one-button sort.
- **11.6 Suspend anywhere:** the game implements libretro `serialize` for the
  **full world state**, so RetroArch save states and auto-save-state-on-close
  work mid-fight. The game also autosaves at every zone transition to the
  RetroArch save directory.
- **Performance modes** (in-game and as core options):
  | Mode | FPS | 3D scale | Note |
  |---|---|---|---|
  | Battery | 40 | 0.67 | 40 divides evenly into 120 Hz |
  | **Balanced** (default) | 60 | 0.75 | ≥ 3 h target |
  | Showcase | 120 | 0.75 | Plugged in or short sessions |
- **Accessibility:** rebinding, text size +1/+2, colourblind loot palettes, a
  shake slider, hold/toggle options, **English and Arabic UI** (Arabic with full
  right-to-left layout is a later slice; the text engine shapes Arabic from day
  one).

---

## 12. Art and audio direction

### 12.1 "Neon and arabesque under a black sun"
| Token | Hex | Use |
|---|---|---|
| Night | `#07060A` | Void, UI (true black) |
| Dusk violet | `#2B1E44` | Cairo's twilight sky, fog |
| Lantern amber | `#F2A541` | Fawanees, fire, the player's light |
| Faience turquoise | `#1FA3A0` | Magic, mana, zellige, rare items |
| Neon magenta | `#FF2E88` | Shop signs, enemy telegraphs |
| Brass gold | `#D4A84B` | UI rules, uniques, the star map |
| Sandstone | `#C9A27A` | Architecture |
| Bone | `#EDE3D1` | Body text (never pure white) |

**Signature image:** the black sun with its burning corona, low over the
southern skyline of domes, satellite dishes and laundry lines. It's the logo,
the title screen and a constant presence in the sky.

**Visual languages we draw from (all generated in-house):**
1. **Islamic geometric pattern:** girih and zellige star patterns, generated
   algorithmically. Used on floors, tiles, UI frames, and mashrabiya screens
   whose **patterned light is projected** onto the ground by light cookies.
2. **Arabic calligraphy and signage:** square Kufic for UI headers; Naskh and
   Ruqʿa for hand-painted shop signs and graffiti. All secular text (§5 of the
   brief). Set in OFL fonts, shaped with HarfBuzz.
3. **Egyptian hand-painted cinema posters:** the style for key art, loading
   screens, act cards and Poster Scraps. Rendered from 3D scenes through a
   painterly post-process: posterised gradients, brush-stroke normals, a
   hand-lettered title.
4. **Khayamiya** (Cairo tentmakers' appliqué): bold, flat, symmetric colour
   panels for menus and the rooftop hub's canopy.
5. **Neon and lantern:** Arabic neon shop signs, Ramadan-style fawanees and
   string lights. These are the **clustered dynamic lights**, which the Adreno
   740 can afford and the AMOLED shows at full effect.

- **Silhouettes:** a warm amber rim on the player, a magenta rim on enemies.
- **Deaths:** jinn **scatter into embers and smoke**. Ghouls crumble to grave
  dust. No ragdolls.
- **The star map:** gold points and al-Sufi-style figure drawings (generated
  line art) on black.

### 12.2 Audio
All of it is synthesised by our own tools:
- Plucked strings (oud, qanun) by physical modelling
- Breathy ney
- Darbuka, riq and tabl
- Mahraganat-style electro for the Downtown zones

Music is written in **maqamat with real quarter tones** (Rast, Bayati, Hijaz,
Saba, Kurd); each act has its own maqam. The rooftop hub plays a slow taqsim.
Rumble patterns are designed as part of the sound pass.

---

## 13. Onboarding
- **Recommended Paths** per ascendancy: ghost nodes, suggested Talismans and
  gear priorities.
- **"Why?"** on every stat.
- A **codex** entry the first time you meet each mechanic.
- **Staged unlocks:** Wafq slots, the bench, Omens and the outer mansions arrive
  over Acts I–III.
