import test from "node:test";
import assert from "node:assert/strict";
import * as I from "../../js/items.js";

function seeded(seed = 11) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

test("rarity tiers are ordered from common to legendary", () => {
  assert.deepEqual(I.RARITY_ORDER, ["common", "rare", "epic", "legendary"]);
  assert.equal(I.RARITIES.common.name, "Gewöhnlich");
  assert.equal(I.RARITIES.rare.color, "#7fd4ff");
  assert.equal(I.RARITIES.epic.name, "Episch");
  assert.equal(I.RARITIES.legendary.color, "#ffcd38");
  assert.ok(I.RARITIES.legendary.power > I.RARITIES.epic.power);
});

test("deeper floors and elites shift chances toward epic and legendary", () => {
  const shallow = I.rarityChanceTable(1);
  const deep = I.rarityChanceTable(12, { elite: true, luck: 1 });
  const epicShallow = shallow.find((entry) => entry.id === "epic").percent;
  const epicDeep = deep.find((entry) => entry.id === "epic").percent;
  const legendaryShallow = shallow.find((entry) => entry.id === "legendary").percent;
  const legendaryDeep = deep.find((entry) => entry.id === "legendary").percent;
  assert.ok(epicDeep > epicShallow);
  assert.ok(legendaryDeep > legendaryShallow);
  assert.ok(deep.reduce((sum, entry) => sum + entry.percent, 0) > 99);
});

test("rolled rarity respects the floor and elite bonus", () => {
  let legendaryOnFloorOne = 0;
  let legendaryOnDeepBoss = 0;
  const rng = seeded(5);
  for (let i = 0; i < 2000; i += 1) {
    if (I.rollRarity(1, { rng }) === "legendary") legendaryOnFloorOne += 1;
    if (I.rollRarity(15, { boss: true, rng }) === "legendary") legendaryOnDeepBoss += 1;
  }
  assert.ok(legendaryOnFloorOne < 30, `${legendaryOnFloorOne} legendary on floor 1`);
  assert.ok(legendaryOnDeepBoss > legendaryOnFloorOne * 3, `${legendaryOnDeepBoss} vs ${legendaryOnFloorOne}`);
});

test("generated equipment scales with floor and rarity", () => {
  const common = I.createItem({ floor: 1, kind: "sword", rarity: "common" });
  const legendary = I.createItem({ floor: 12, kind: "sword", rarity: "legendary" });
  assert.equal(common.slot, "weapon");
  assert.ok(common.stats.attack > 0);
  assert.equal(common.level, 0);
  assert.ok(legendary.stats.attack > common.stats.attack * 3);
  assert.ok(legendary.value > common.value * 3);
  assert.equal(legendary.rarityColor, I.RARITIES.legendary.color);
  assert.ok(I.statLine(common.stats).includes("Angriff"));
});

test("rollDrop always rewards elites and bosses", () => {
  const rng = seeded(21);
  const normal = I.rollDrop({ floor: 1, rng });
  const boss = I.rollDrop({ floor: 10, boss: true, rng });
  const elite = I.rollDrop({ floor: 6, elite: true, rng });
  assert.ok(boss.items.length >= 1);
  assert.ok(elite.items.length >= 1);
  assert.ok(boss.gold > normal.gold);
  assert.ok(I.upgradeCost(boss.items[0]) > 0);
});

test("upgrading raises level, stats and sell value", () => {
  const item = I.createItem({ floor: 3, kind: "armor", rarity: "rare" });
  const before = { ...item.stats };
  const powerBefore = I.itemPower(item);
  const cost = I.upgradeCost(item);
  I.applyUpgrade(item);
  assert.equal(item.level, 1);
  assert.ok(item.stats.defense > before.defense);
  assert.ok(I.itemPower(item) > powerBefore);
  assert.ok(I.upgradeCost(item) > cost);
  assert.equal(I.sellValue(item), Math.round(item.value * 0.5));
});

test("compare text shows candidate against current gear", () => {
  const current = I.createItem({ floor: 1, kind: "sword", rarity: "common" });
  const candidate = I.createItem({ floor: 8, kind: "sword", rarity: "epic" });
  assert.match(I.compareText(candidate, current), /vs\./);
  assert.match(I.compareText(candidate, null), /Slot frei/);
});

test("consumables expose their battle effect and template id", () => {
  const potion = I.createConsumable("potion_heal");
  const scroll = I.createConsumable("scroll_upgrade");
  assert.equal(potion.effect, "heal");
  assert.equal(potion.type, "consumable");
  assert.equal(potion.templateId, "potion_heal");
  assert.equal(scroll.type, "scroll");
  assert.equal(scroll.effect, "upgrade");
  assert.equal(I.createConsumable("missing"), null);
});
