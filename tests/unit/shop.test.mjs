import test from "node:test";
import assert from "node:assert/strict";
import { AVATARS, SHOP_ITEMS, buyItem, equipAvatar, getShopItem, itemPrice } from "../../js/shop.js";
import { UPGRADES, upgradeCost } from "../../js/dungeon.js";

function makeState() {
  return {
    gold: 2500,
    owned: ["avatar_hero"],
    equippedAvatar: "avatar_hero",
    boosterXp: 0,
    boosterGold: 0,
  };
}

test("catalog contains avatars, boosters and repeatable rewards", () => {
  assert.equal(Object.keys(AVATARS).length, 4);
  assert.ok(SHOP_ITEMS.some((item) => item.type === "booster"));
  assert.ok(SHOP_ITEMS.some((item) => item.type === "reward"));
  assert.equal(getShopItem("missing"), null);
  assert.ok(getShopItem("avatar_mage"));
  assert.equal(UPGRADES.length, 8, "equipment line is expanded to eight pieces");
  assert.equal(SHOP_ITEMS.filter((item) => item.type === "booster").length, 4);
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
