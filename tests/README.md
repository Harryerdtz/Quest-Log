# QuestLog test suite

No dependencies — everything runs with the built-in Node test runner and Chrome DevTools Protocol.

```bash
npm test          # fast unit tests (classes, battle, items, inventory, dungeon, map, shop, raid, storage, quests)
npm run test:e2e  # real browser flow on an iPhone-sized viewport plus a desktop pass
npm run test:all  # both
```

## Unit tests (`tests/unit`)

| File | Coverage |
| --- | --- |
| `classes.test.mjs` | five hero classes with pixel sprites, passives, stat deltas, skills and mana |
| `battle.test.mjs` | turn-based 7×5 grid, movement/obstacles, melee vs ranged, skills, consumables, defeat/flee |
| `items.test.mjs` | rarity tiers and scaling, drop tables, depth/elite luck, upgrades, sell values, comparisons |
| `inventory.test.mjs` | paperdoll equip/swap/unequip, six quick slots, consumable stacking, gold/scroll upgrades, selling, gear buffs, save normalization |
| `dungeon.test.mjs` | upgrade costs, class/gear stat stacking, elite guardians, element weaknesses, sprites, heroic scaling |
| `map.test.mjs` | 3×3–5×5 floor generation, room types, adjacency movement, fog of war, tile map with walls/corridors, room sprites, map repair |
| `shop.test.mjs` | class skins, boosters, scrolls, heroic 1.75× pricing, purchases and equipping |
| `raid.test.mjs` | boss HP/rewards, quest gold, idle-loot pacing/cap/collection |
| `storage.test.mjs` | LocalStorage roundtrip and corrupt-save handling |
| `quest.test.mjs` | XP curve, level-ups, streak handling, daily reset |

## Browser E2E (`tests/e2e.mjs`)

The script starts its own static server and a headless Chrome instance, then drives the real UI:

- five main tabs including **Inventar**, no Basar naming, no native selects
- visual hero select: five square pixel cards, selected-card detail (name, description, buffs, skill), start confirmation, class skill wiring and persistence
- dungeon tile map: 49 tiles with walls, 12 corridors, fogged rooms, room sprites and the hero token
- tactical battle grid: 35 tiles, hero/enemy tokens, DPad grid movement, melee/ranged labels, retro terminal battle log
- inventory grid: 4 compact 44px paperdoll slots, 2×3 hotbar, 28-slot bag (4×7) of small pixel sprites with stack badges, item inspector with comparison, click-to-equip on the paperdoll, drag & drop zones and gold upgrades
- sprite caps: 32px map hero/monster sprites so the tile map stays visible
- elemental elite sprite/crown, daily elite bonus (only once per day)
- run reset (with confirmation) that keeps gold and deepest floor
- avatar purchase + equip, two-column mobile shop, Schriftrollen tab
- LocalStorage persistence across reloads
- mobile overflow, sticky navigation, touch-action, thumb-sized DPad/attack controls and iOS zoom guard
- desktop pass: no overflow, side-by-side map/DPad, non-sticky controls
- zero JS exceptions and console errors

Chrome is auto-detected for common macOS, Linux and Windows paths. Set `CHROME_PATH` if it lives elsewhere:

```bash
CHROME_PATH="/path/to/chrome" npm run test:e2e
```

The E2E run exits with code `1` when a check fails and `2` when no Chrome/Chromium is available.
