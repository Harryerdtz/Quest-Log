import test from "node:test";
import assert from "node:assert/strict";
import { AVATARS, SHOP_ITEMS, buyItem, equipAvatar, getShopItem } from "../../js/shop.js";

function makeState() {
  return {
    gold: 250,
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
});

test("cosmetic purchase deducts gold and adds ownership once", () => {
  const state = makeState();
  const mage = getShopItem("avatar_mage");
  const result = buyItem(state, mage);
  assert.equal(result.ok, true);
  assert.equal(state.gold, 130);
  assert.ok(state.owned.includes("avatar_mage"));

  const duplicate = buyItem(state, mage);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "owned");
  assert.equal(state.gold, 130);
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
  assert.equal(state.gold, 250 - 80);
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
