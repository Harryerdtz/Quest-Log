import test from "node:test";
import assert from "node:assert/strict";
import { AVATARS, SHOP_ITEMS, buyItem, equipAvatar, getShopItem, itemPrice } from "../../js/shop.js";
import { UPGRADES, upgradeCost } from "../../js/dungeon.js";
import { createConsumable, createItem } from "../../js/items.js";

function makeState() {
  return {
    gold: 2500,
    owned: ["avatar_hero"],
    equippedAvatar: "avatar_hero",
    boosterXp: 0,
    boosterGold: 0,
  };
}

test("catalog is doubled in every shop category", () => {
  assert.equal(Object.keys(AVATARS).length, 16, "base roster plus eight extra skins");
  assert.equal(SHOP_ITEMS.filter((item) => item.type === "booster").length, 12);
  assert.equal(SHOP_ITEMS.filter((item) => item.type === "scroll").length, 6);
  assert.equal(SHOP_ITEMS.filter((item) => item.type === "reward").length, 4);
  assert.equal(SHOP_ITEMS.filter((item) => item.type === "gear").length, 12);
  assert.equal(getShopItem("missing"), null);
  assert.ok(getShopItem("avatar_mage"));
  assert.equal(UPGRADES.length, 8, "equipment upgrades stay at eight tracks");
  assert.ok(SHOP_ITEMS.some((item) => item.resource === "luck"));
  assert.ok(SHOP_ITEMS.some((item) => item.resource === "mana"));
  assert.ok(SHOP_ITEMS.some((item) => item.resource === "key"));
  assert.ok(SHOP_ITEMS.some((item) => item.resource === "heal"));
  SHOP_ITEMS.forEach((item) => {
    assert.ok(item.icon, `${item.id} has a pixel icon`);
    assert.doesNotMatch(String(item.icon), /[\u{1F300}-\u{1FAFF}]/u);
  });
});

test("all six scrolls carry their own parchment sprite", () => {
  const scrolls = SHOP_ITEMS.filter((item) => item.type === "scroll");
  assert.equal(scrolls.length, 6);
  scrolls.forEach((scroll) => assert.match(scroll.icon, /<svg/));
  const icons = new Set(scrolls.map((scroll) => scroll.icon));
  assert.equal(icons.size, scrolls.length, "every scroll uses a distinct sprite");
});

test("gear purchases create equippable inventory items", () => {
  const state = makeState();
  const gear = getShopItem("gear_rune_axe");
  const result = buyItem(state, gear, "normal", {
    createItem: (options) => createItem(options),
  });
  assert.equal(result.ok, true);
  assert.equal(result.gear.kind, "axe");
  assert.equal(result.gear.rarity, "epic");
  assert.equal(state.gold, 2500 - gear.price);
  assert.equal(buyItem(makeState(), gear).reason, "invalid");

  const key = getShopItem("booster_key");
  const keyState = makeState();
  buyItem(keyState, key);
  assert.equal(keyState.keys, 1);
});

test("scrolls land in the inventory bag instead of instantly applying", () => {
  const state = makeState();
  const scroll = getShopItem("shop_scroll_upgrade");
  const result = buyItem(state, scroll, "normal", { createConsumable });
  assert.equal(result.ok, true);
  assert.equal(result.consumable.name, "Schriftrolle der Veredelung");
  assert.equal(result.consumable.effect, "upgrade");
  assert.equal(state.gold, 2500 - scroll.price);
  assert.equal(buyItem(makeState(), scroll).ok, false);
});

test("skins carry real stat buffs and get more expensive with power", () => {
  const skins = Object.values(AVATARS);
  skins.forEach((skin) => {
    assert.ok(skin.buff && Object.keys(skin.buff).length > 0, `${skin.id} has a buff`);
    assert.ok(skin.buffText, `${skin.id} advertises its buff`);
  });
  assert.ok(AVATARS.avatar_mage.price > AVATARS.avatar_hero.price);
  assert.ok(AVATARS.avatar_rogue.price > AVATARS.avatar_mage.price);
  assert.ok(AVATARS.avatar_knight.price > AVATARS.avatar_rogue.price);
  assert.equal(AVATARS.avatar_rogue.buff.crit, 0.15);
  assert.equal(AVATARS.avatar_knight.buff.maxHp, 30);
  assert.equal(AVATARS.avatar_warden.buff.defense, 7);
  assert.equal(AVATARS.avatar_archon.buff.elementPower, 0.25);
  assert.equal(AVATARS.avatar_nightblade.buff.dodge, 0.14);
  assert.equal(AVATARS.avatar_lightbringer.buff.healing, 0.3);
  assert.ok(AVATARS.avatar_archon.price > AVATARS.avatar_knight.price);
});

test("heroic difficulty raises every shop price and upgrade by 1.75x", () => {
  const mage = getShopItem("avatar_mage");
  const booster = getShopItem("booster_xp");
  assert.equal(itemPrice(mage, "heroic"), Math.round(mage.price * 1.75));
  assert.equal(itemPrice(booster, "heroic"), Math.round(booster.price * 1.75));
  const weapon = UPGRADES.find((entry) => entry.id === "weapon");
  assert.equal(upgradeCost(weapon, 0, "heroic"), Math.round(weapon.baseCost * 1.75));
  assert.equal(upgradeCost(weapon, 0, "normal"), weapon.baseCost);
});

test("cosmetic purchase deducts gold and adds ownership once", () => {
  const state = makeState();
  const mage = getShopItem("avatar_mage");
  const result = buyItem(state, mage);
  assert.equal(result.ok, true);
  assert.equal(state.gold, 1850);
  assert.ok(state.owned.includes("avatar_mage"));

  const duplicate = buyItem(state, mage);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "owned");
  assert.equal(state.gold, 1850);
});

test("purchases fail without enough gold", () => {
  const state = makeState();
  state.gold = 10;
  const result = buyItem(state, getShopItem("avatar_knight"));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "gold");
  assert.equal(state.gold, 10);
  assert.equal(state.owned.length, 1);
});

test("boosters stack charges", () => {
  const state = makeState();
  state.gold = 400;
  buyItem(state, getShopItem("booster_xp"));
  buyItem(state, getShopItem("booster_xp"));
  assert.equal(state.boosterXp, 20);
  assert.equal(state.gold, 100);

  state.gold = 500;
  buyItem(state, getShopItem("booster_gold"));
  assert.equal(state.boosterGold, 10);
  assert.equal(state.gold, 380);
});

test("rewards can be redeemed repeatedly", () => {
  const state = makeState();
  const coffee = getShopItem("reward_coffee");
  assert.equal(buyItem(state, coffee).ok, true);
  assert.equal(buyItem(state, coffee).ok, true);
  assert.equal(state.gold, 2500 - 80);
});

test("avatars can only be equipped after purchase", () => {
  const state = makeState();
  const mage = getShopItem("avatar_mage");
  assert.equal(equipAvatar(state, mage).ok, false);
  buyItem(state, mage);
  const result = equipAvatar(state, mage);
  assert.equal(result.ok, true);
  assert.equal(state.equippedAvatar, "avatar_mage");
  assert.equal(equipAvatar(state, getShopItem("reward_coffee")).ok, false);
});
