import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../../js/dungeon.js";

function withRandom(values, fn) {
  const original = Math.random;
  let index = 0;
  Math.random = () => values[Math.min(index++, values.length - 1)];
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function makeState(overrides = {}) {
  return {
    gold: 0,
    upgrades: { weapon: 0, armor: 0, strength: 0, vitality: 0 },
    rune: "frost",
    deepestFloor: 1,
    dungeon: { floor: 1, hp: 50, enemyHp: 1 },
    ...overrides,
  };
}

test("upgrade costs grow exponentially in both modes", () => {
  const weapon = D.UPGRADES.find((entry) => entry.id === "weapon");
  assert.equal(D.upgradeCost(weapon, 0), 60);
  assert.equal(D.upgradeCost(weapon, 1), 93);
  assert.equal(D.upgradeCost(weapon, 2), 144);
  assert.equal(D.upgradeCost(weapon, 3), 223);
  assert.equal(D.upgradeCost(weapon, 1, "heroic"), 105);
  assert.equal(D.upgradeCost(weapon, 2, "heroic"), 184);
  assert.ok(D.upgradeCost(weapon, 4) > D.upgradeCost(weapon, 3) * 1.5);
});

test("hero stats scale with upgrades and expose crit/block", () => {
  assert.deepEqual(D.heroStats(), {
    attack: 10,
    defense: 0,
    maxHp: 50,
    crit: 0.05,
    block: 0.03,
  });
  const stats = D.heroStats({ weapon: 2, armor: 1, strength: 3, vitality: 2 });
  assert.equal(stats.attack, 10 + 6 + 6);
  assert.equal(stats.defense, 2);
  assert.equal(stats.maxHp, 50 + 20 + 4);
  assert.ok(stats.crit > 0.05 && stats.block > 0.03);
});

test("every fifth floor is an elemental elite with a big HP jump", () => {
  const f4 = D.createEnemy(4);
  const f5 = D.createEnemy(5);
  assert.equal(f4.elite, false);
  assert.equal(f5.elite, true);
  assert.match(f5.name, /^Elite:/);
  assert.ok(f5.hp > f4.hp * 2);
  assert.ok(D.createEnemy(6).hp > f4.hp);
  assert.ok(D.createEnemy(10).hp > D.createEnemy(6).hp);
});

test("elements cycle and weaknesses resolve correctly", () => {
  assert.equal(D.createEnemy(1).element, "fire");
  assert.equal(D.createEnemy(2).element, "frost");
  assert.equal(D.createEnemy(3).element, "storm");
  assert.equal(D.createEnemy(4).element, "shadow");
  assert.equal(D.createEnemy(5).element, "fire");
  assert.equal(D.createEnemy(1).weakness, "frost");
  assert.equal(D.elementMultiplier("frost", D.createEnemy(1)), 1.5);
  assert.equal(D.elementMultiplier("fire", D.createEnemy(1)), 0.7);
  assert.equal(D.elementMultiplier("storm", D.createEnemy(1)), 1);
});

test("elemental sprites are distinct and only elites wear the crown", () => {
  const sprites = ["fire", "frost", "storm", "shadow"].map((element) => D.enemySprite(element));
  assert.equal(new Set(sprites).size, 4);
  sprites.forEach((sprite) => assert.match(sprite, /<svg/));
  assert.doesNotMatch(sprites[0], /enemy-crown/);
  assert.match(D.enemySprite("fire", true), /enemy-crown/);
  assert.match(D.enemySprite("unknown"), /#ff8a3d/);
});

test("heroic enemies are tougher and reward more", () => {
  const normal = D.createEnemy(8, "normal");
  const heroic = D.createEnemy(8, "heroic");
  assert.ok(heroic.hp > normal.hp * 1.5);
  assert.ok(heroic.attack > normal.attack * 1.3);
  assert.ok(heroic.reward > normal.reward);
  assert.ok(heroic.dodge > normal.dodge);
});

test("attackDungeon kills, rewards gold and advances the floor", () => {
  const state = makeState();
  const result = withRandom([0.5], () => D.attackDungeon(state, "normal"));
  assert.equal(result.type, "floor");
  assert.equal(result.damage, 15); // 10 attack × 1.5 elemental weakness
  assert.equal(state.dungeon.floor, 2);
  assert.equal(state.deepestFloor, 2);
  assert.ok(state.gold > 0);
  assert.equal(result.slain, 1);
});

test("attackDungeon applies block and counter damage", () => {
  const state = makeState({ dungeon: { floor: 1, hp: 50, enemyHp: 999 } });
  const result = withRandom([0.9, 0.9, 0, 0.9], () => D.attackDungeon(state, "normal"));
  assert.equal(result.type, "hit");
  assert.equal(result.blocked, true);
  assert.ok(result.counter >= 1);
  assert.ok(state.dungeon.hp < 50);
});

test("attackDungeon handles dodges and defeat", () => {
  const dodged = makeState({ dungeon: { floor: 1, hp: 50, enemyHp: 999 } });
  const dodgeResult = withRandom([0.9, 0], () => D.attackDungeon(dodged, "normal"));
  assert.equal(dodgeResult.dodged, true);
  assert.equal(dodgeResult.damage, 0);

  const defeated = makeState({ dungeon: { floor: 3, hp: 1, enemyHp: 999 } });
  const downResult = withRandom([0.5], () => D.attackDungeon(defeated, "normal"));
  assert.equal(downResult.type, "down");
  assert.equal(defeated.dungeon.floor, 2);
  assert.equal(defeated.dungeon.hp, 50);
});

test("daily elite bonus scales with difficulty", () => {
  assert.equal(D.eliteDailyBonus("normal"), 150);
  assert.equal(D.eliteDailyBonus("heroic"), 225);
});
