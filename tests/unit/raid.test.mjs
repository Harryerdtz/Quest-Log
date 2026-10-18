import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../../js/raid.js";

test("boss HP and rewards scale per mode", () => {
  assert.equal(R.bossMaxHp(1), 155);
  assert.equal(R.bossMaxHp(1, "heroic"), 217);
  assert.equal(R.bossGold(1), 78);
  assert.equal(R.bossGold(1, "heroic"), 117);

  const boss = R.createBoss(3, "heroic");
  assert.equal(boss.level, 3);
  assert.equal(boss.maxHp, R.bossMaxHp(3, "heroic"));
  assert.equal(boss.mode, "heroic");
  assert.equal(boss.hp, boss.maxHp);
});

test("quest gold rewards casual play more than heroic", () => {
  assert.equal(R.goldForQuest("easy"), 6);
  assert.equal(R.goldForQuest("medium"), 13);
  assert.equal(R.goldForQuest("hard"), 25);
  assert.equal(R.goldForQuest("boss"), 50);
  assert.equal(R.goldForQuest("medium", "heroic"), 10);
});

test("damageBoss transitions to the next raid", () => {
  const boss = R.createBoss(1);
  const first = R.damageBoss(boss, 100);
  assert.equal(first.defeated, false);
  assert.equal(boss.hp, 55);

  const second = R.damageBoss(boss, 60);
  assert.equal(second.defeated, true);
  assert.equal(second.defeatedLevel, 1);
  assert.equal(second.goldReward, 78);
  assert.equal(boss.level, 2);
  assert.equal(boss.hp, R.bossMaxHp(2));
});

test("idle loot ticks slower in heroic mode", () => {
  assert.equal(R.lootInterval("normal"), 40000);
  assert.equal(R.lootInterval("heroic"), 60000);
  assert.equal(R.lootCap("normal"), 45);
  assert.equal(R.lootCap("heroic"), 30);

  const now = 1_000_000;
  const state = { lastLootAt: now - 85000 };
  assert.equal(R.lootPending(state, now, "normal"), 2);
  assert.equal(R.lootPending(state, now, "heroic"), 1);
  assert.equal(R.lootNextIn(state, now, "normal"), 35);
  assert.equal(R.lootNextIn(state, now, "heroic"), 35);
});

test("collectLoot adds pending gold and resets the timer", () => {
  const now = 2_000_000;
  const state = { lastLootAt: now - 90_000, gold: 10 };
  const result = R.collectLoot(state, now, "normal");
  assert.equal(result.ok, true);
  assert.equal(result.gold, 2);
  assert.equal(state.gold, 12);
  assert.equal(state.lastLootAt, now);
  assert.equal(R.collectLoot(state, now, "normal").ok, false);
});

test("loot is capped", () => {
  const now = 5_000_000;
  const state = { lastLootAt: now - 10 * 60 * 60 * 1000 };
  assert.equal(R.lootPending(state, now, "normal"), 45);
  assert.equal(R.lootPending(state, now, "heroic"), 30);
  assert.equal(R.lootNextIn(state, now, "normal"), 0);
});
