import test from "node:test";
import assert from "node:assert/strict";
import * as INV from "../../js/inventory.js";
import * as I from "../../js/items.js";

function makeItem(kind, rarity = "common", floor = 3) {
  return I.createItem({ floor, kind, rarity });
}

test("inventory starts with empty equipment and quick slots", () => {
  const inv = INV.createInventory();
  assert.deepEqual(Object.keys(inv.equipped).sort(), ["armor", "offhand", "trinket", "weapon"]);
  assert.equal(inv.quick.length, INV.QUICK_SLOT_COUNT);
  assert.equal(inv.items.length, 0);
});

test("equipping moves items into paperdoll slots and swaps the old one", () => {
  const inv = INV.createInventory();
  const sword = makeItem("sword");
  const axe = makeItem("axe", "rare");
  INV.addItem(inv, sword);
  INV.addItem(inv, axe);

  const first = INV.equipItem(inv, sword.id);
  assert.equal(first.ok, true);
  assert.equal(INV.equippedItem(inv, "weapon").id, sword.id);

  const second = INV.equipItem(inv, axe.id);
  assert.equal(second.ok, true);
  assert.equal(INV.equippedItem(inv, "weapon").id, axe.id);
  assert.equal(second.previous.name, sword.name);

  const bag = INV.bagItems(inv);
  assert.equal(bag.length, 1);
  assert.equal(bag[0].id, sword.id);
  assert.equal(Object.values(inv.equipped).filter(Boolean).length, 1);
});

test("unequipping puts gear back into the bag", () => {
  const inv = INV.createInventory();
  const shield = makeItem("shield");
  INV.addItem(inv, shield);
  INV.equipItem(inv, shield.id);
  assert.equal(INV.bagItems(inv).length, 0);
  const result = INV.unequipItem(inv, "offhand");
  assert.equal(result.ok, true);
  assert.equal(INV.bagItems(inv).length, 1);
});

test("selling pays gold and refuses equipped gear", () => {
  const inv = INV.createInventory();
  const ring = makeItem("ring", "epic", 6);
  INV.addItem(inv, ring);
  INV.equipItem(inv, ring.id);
  assert.equal(INV.sellItem(inv, ring.id).reason, "equipped");

  const sword = makeItem("sword");
  INV.addItem(inv, sword);
  const result = INV.sellItem(inv, sword.id);
  assert.equal(result.ok, true);
  assert.equal(result.gold, I.sellValue(sword));
  assert.equal(INV.findItem(inv, sword.id), null);
});

test("upgrading consumes gold or a scripting scroll", () => {
  const inv = INV.createInventory();
  const sword = makeItem("sword");
  INV.addItem(inv, sword);

  const poor = INV.upgradeItem(inv, sword.id, { gold: 0 });
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, "gold");
  assert.equal(poor.cost, I.upgradeCost(sword));

  const rich = INV.upgradeItem(inv, sword.id, { gold: 10000 });
  assert.equal(rich.ok, true);
  assert.equal(sword.level, 1);
  assert.equal(rich.cost, poor.cost);

  const leveled = sword.level;
  const scroll = INV.upgradeItem(inv, sword.id, { useScroll: true });
  assert.equal(scroll.ok, true);
  assert.equal(scroll.cost, 0);
  assert.equal(sword.level, leveled + 1);
});

test("quick slots only accept consumables and consume on use", () => {
  const inv = INV.createInventory();
  const potion = I.createConsumable("potion_heal");
  const sword = makeItem("sword");
  INV.addItem(inv, potion);
  INV.addItem(inv, sword);

  assert.equal(INV.assignQuickSlot(inv, sword.id, 0).reason, "invalid");
  const assigned = INV.assignQuickSlot(inv, potion.id, 2);
  assert.equal(assigned.ok, true);
  assert.equal(INV.quickItem(inv, 2).id, potion.id);
  assert.equal(INV.bagItems(inv).some((item) => item.id === potion.id), false);

  const consumed = INV.consumeQuickSlot(inv, 2);
  assert.equal(consumed.id, potion.id);
  assert.equal(INV.quickItem(inv, 2), null);
  assert.equal(INV.findItem(inv, potion.id), null);
});

test("identical consumables stack while equipment keeps its own slot", () => {
  const inv = INV.createInventory();
  const potions = [
    I.createConsumable("potion_heal"),
    I.createConsumable("potion_heal"),
    I.createConsumable("potion_heal"),
  ];
  const mana = I.createConsumable("potion_mana");
  const sword = makeItem("sword");
  const axe = makeItem("axe");
  [...potions, mana, sword, axe].forEach((item) => INV.addItem(inv, item));

  const stacks = INV.bagStacks(inv);
  assert.equal(stacks.length, 4);
  const healStack = stacks.find((stack) => stack.item.templateId === "potion_heal");
  assert.equal(healStack.count, 3);
  assert.deepEqual(healStack.ids, potions.map((item) => item.id));
  assert.equal(stacks.filter((stack) => stack.count === 1).length, 3);

  INV.assignQuickSlot(inv, potions[0].id, 0);
  const afterQuick = INV.bagStacks(inv).find((stack) => stack.item.templateId === "potion_heal");
  assert.equal(afterQuick.count, 2);
});

test("gear buffs aggregate every equipped slot", () => {
  const inv = INV.createInventory();
  const sword = makeItem("sword", "legendary", 10);
  const armor = makeItem("armor", "epic", 10);
  const ring = makeItem("ring", "rare", 10);
  const wand = makeItem("wand", "epic", 10);
  [sword, armor, ring, wand].forEach((item) => INV.addItem(inv, item));
  INV.equipItem(inv, sword.id);
  INV.equipItem(inv, armor.id);
  INV.equipItem(inv, ring.id);
  INV.equipItem(inv, wand.id);

  const buffs = INV.gearBuffs(inv);
  assert.ok(buffs.attack >= sword.stats.attack + wand.stats.attack);
  assert.ok(buffs.defense >= armor.stats.defense);
  assert.ok(buffs.crit >= ring.stats.crit);
  assert.ok(INV.gearScore(inv) > 0);
  const summary = INV.inventorySummary(inv);
  assert.equal(summary.equipped, 4);
  assert.ok(summary.best && summary.best.type === "equipment");
});

test("normalizing a save keeps items, equipment and quick slots", () => {
  const inv = INV.createInventory();
  const sword = makeItem("sword");
  const potion = I.createConsumable("potion_mana");
  INV.addItem(inv, sword);
  INV.addItem(inv, potion);
  INV.equipItem(inv, sword.id);
  INV.assignQuickSlot(inv, potion.id, 1);

  const restored = INV.normalizeInventory(JSON.parse(JSON.stringify(inv)));
  assert.equal(INV.equippedItem(restored, "weapon").id, sword.id);
  assert.equal(INV.quickItem(restored, 1).id, potion.id);
  assert.equal(restored.items.length, 2);
  assert.equal(INV.normalizeInventory(null).items.length, 0);
});
