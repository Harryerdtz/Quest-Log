# QuestLog test suite

No dependencies — everything runs with the built-in Node test runner and Chrome DevTools Protocol.

```bash
npm test          # fast unit tests (dungeon, raid, shop, storage, quests)
npm run test:e2e  # real browser flow on an iPhone-sized viewport
npm run test:all  # both
```

## Unit tests (`tests/unit`)

| File | Coverage |
| --- | --- |
| `dungeon.test.mjs` | exponential upgrade costs, elite floors, element weaknesses, sprites, crit/dodge/block, daily elite bonus |
| `raid.test.mjs` | boss HP/rewards, quest gold, idle-loot pacing/cap/collection |
| `shop.test.mjs` | avatar purchase/equip, boosters, rewards, insufficient gold |
| `storage.test.mjs` | LocalStorage roundtrip and corrupt-save handling |
| `quest.test.mjs` | XP curve, level-ups, streak handling, daily reset |

## Browser E2E (`tests/e2e.mjs`)

The script starts its own static server and a headless Chrome instance, then drives the real UI:

- four main tabs, no shop modal, no native selects
- avatar purchase + equip and two-column mobile shop
- quest creation/completion, XP and boss damage
- elemental elite sprite/crown, daily elite bonus (only once per day)
- optional dungeon run reset (with confirmation) that keeps gold and deepest floor
- LocalStorage persistence across reloads
- mobile overflow, sticky navigation, touch-action and iOS zoom guard
- zero JS exceptions and console errors

Chrome is auto-detected for common macOS, Linux and Windows paths. Set `CHROME_PATH` if it lives elsewhere:

```bash
CHROME_PATH="/path/to/chrome" npm run test:e2e
```

The E2E run exits with code `1` when a check fails and `2` when no Chrome/Chromium is available.
