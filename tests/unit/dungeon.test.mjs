import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../../js/dungeon.js";

test("upgrade costs grow exponentially in both modes", () => {
  const weapon = D.UPGRADES.find((entry) => entry.id === "weapon");
  assert.equal(D.upgradeCost(weapon, 0), 60);
  assert.equal(D.upgradeCost(weapon, 1), 93);
  assert.equal(D.upgradeCost(weapon, 2), 144);
  assert.equal(D.upgradeCost(weapon, 3), 223);
  assert.equal(D.upgradeCost(weapon, 1, "heroic"), 163);
  assert.equal(D.upgradeCost(weapon, 2, "heroic"), 252);
  assert.ok(D.upgradeCost(weapon, 4) > D.upgradeCost(weapon, 3) * 1.5);
});

test("hero stats expose combat, magic and loot values", () => {
  assert.deepEqual(D.heroStats(), {
    attack: 10,
    defense: 0,
    maxHp: 50,
    crit: 0.05,
    block: 0.03,
    dodge: 0.02,
    goldFind: 1,
    elementPower: 0,
    spellPower: 0,
    luck: 0,
    healing: 0,
    range: 1,
    maxMana: 0,
  });
  const stats = D.heroStats({ weapon: 2, armor: 1, strength: 3, vitality: 2 });
  assert.equal(stats.attack, 10 + 6 + 6);
  assert.equal(stats.defense, 2);
  assert.equal(stats.maxHp, 50 + 20 + 4);
  assert.ok(stats.crit > 0.05 && stats.block > 0.03);
});

test("hero classes and gear shift the base stats", () => {
  const warrior = D.heroStats({}, {}, { cls: "warrior" });
  assert.equal(warrior.maxHp, 70);
  assert.equal(warrior.attack, 12);
  assert.ok(warrior.block >= 0.08);

  const mage = D.heroStats({}, {}, { cls: "mage" });
  assert.equal(mage.maxMana, 24);
  assert.equal(mage.range, 5);

  const rogue = D.heroStats({}, {}, { cls: "rogue" });
  assert.ok(rogue.crit > 0.15 && rogue.dodge > 0.11);

  const geared = D.heroStats(
    {},
    {},
    { cls: "warrior", gear: { attack: 7, defense: 3, maxHp: 20, crit: 0.1, luck: 0.2, spellPower: 0.5, mana: 6 } }
  );
  assert.equal(geared.attack, 19);
  assert.equal(geared.defense, 7);
  assert.equal(geared.maxHp, 90);
  assert.equal(geared.luck, 0.2);
  assert.equal(geared.spellPower, 0.5);
  assert.equal(geared.maxMana, 6);
});

test("every fifth floor's guardian is an elite with a big HP jump", () => {
  const f4 = D.createRoomEnemy(4, "boss");
  const f5 = D.createRoomEnemy(5, "boss");
  assert.equal(f4.elite, false);
  assert.equal(f5.elite, true);
  assert.match(f5.name, /\(Elite\)$/);
  assert.ok(f5.hp > f4.hp * 2);
  assert.ok(D.createEnemy(6).hp > D.createEnemy(4).hp);
  assert.ok(D.createEnemy(10).hp > D.createEnemy(6).hp);
});

test("bosses progress from the dragon to lich, golem, demon and hydra", () => {
  assert.equal(D.createRoomEnemy(1, "boss").bossId, "procrastination_dragon");
  assert.equal(D.createRoomEnemy(9, "boss").name, "Der Prokrastinations-Drache");
  assert.equal(D.createRoomEnemy(10, "boss").bossId, "chaos_lich");
  assert.equal(D.createRoomEnemy(14, "boss").name, "Chaos-Lich");
  assert.equal(D.createRoomEnemy(15, "boss").bossId, "perfectionism_golem");
  assert.equal(D.createRoomEnemy(20, "boss").bossId, "deadline_demon");
  assert.equal(D.createRoomEnemy(25, "boss").bossId, "inbox_hydra");
  assert.equal(D.bossForFloor(3).id, "procrastination_dragon");
  assert.equal(D.nextBossAfter(9).id, "chaos_lich");
  assert.equal(D.nextBossAfter(99), null);
  D.BOSS_POOL.forEach((boss) => {
    assert.ok(boss.special.name);
    assert.ok(boss.special.chance > 0 && boss.special.chance < 1);
    assert.match(D.bossSprite(boss.id), /<svg/);
    assert.doesNotMatch(D.bossSprite(boss.id), /enemy-crown/);
    assert.match(D.bossSprite(boss.id, true), /enemy-crown/);
    assert.ok(D.createRoomEnemy(boss.from, "boss").special);
  });
  const eliteGuardian = D.createRoomEnemy(5, "boss");
  assert.equal(eliteGuardian.elite, true);
  assert.match(eliteGuardian.sprite, /enemy-crown/);
});

test("normal and elite monster pools cover the new floor roster", () => {
  const early = new Set();
  const elite = new Set();
  for (let floor = 1; floor <= 12; floor += 1) {
    for (let variant = 0; variant < 6; variant += 1) {
      const normal = D.createEnemy(floor, "normal", { variant });
      const tough = D.createEnemy(floor, "normal", { variant, elite: true });
      early.add(normal.name);
      elite.add(tough.name);
      assert.match(normal.name, /^[A-Za-zÄÖÜäöüß-]+$/, `${normal.name} is a real monster name`);
      assert.match(tough.name, /^Elite: [A-Za-zÄÖÜäöüß-]+$/, `${tough.name} is a real elite name`);
    }
  }
  ["Ablenkungs-Wicht", "Fokus-Skelett", "Schatten-Ratte"].forEach((name) => {
    assert.ok(early.has(name), `${name} appears in normal rooms`);
  });
  assert.ok(early.size >= 20, `normal roster stays broad — ${early.size} names`);
  assert.ok(elite.size >= 12, `elite roster stays broad — ${elite.size} names`);
});

test("same floor rooms roll different monsters via the variant offset", () => {
  const variants = [0, 1, 2, 3].map((variant) => D.createEnemy(6, "normal", { variant }).name);
  assert.equal(new Set(variants).size, variants.length);
  assert.equal(D.createEnemy(6, "normal").name, variants[0]);
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

test("daily elite bonus scales with difficulty", () => {
  assert.equal(D.eliteDailyBonus("normal"), 150);
  assert.equal(D.eliteDailyBonus("heroic"), 225);
});
