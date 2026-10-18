import test from "node:test";
import assert from "node:assert/strict";
import * as B from "../../js/battle.js";
import * as I from "../../js/items.js";

const calm = () => 0.99;

function makeBattle(overrides = {}) {
  return B.createBattle({
    floor: 1,
    roomType: "monster",
    mode: "normal",
    heroClass: "warrior",
    stats: { attack: 10, defense: 0, maxHp: 70, crit: 0.05, dodge: 0.02, block: 0.03, maxMana: 0, luck: 0 },
    hp: 70,
    mana: 0,
    rng: calm,
    ...overrides,
  });
}

test("battle starts on a grid with both fighters apart", () => {
  const battle = makeBattle();
  assert.equal(battle.status, "ongoing");
  assert.equal(battle.w, B.GRID_W);
  assert.equal(battle.h, B.GRID_H);
  assert.ok(B.battleDistance(battle) > 1);
  assert.equal(battle.hero.x, 0);
  assert.equal(battle.enemy.hp, battle.enemy.maxHp);
  assert.ok(battle.obstacles.length > 0);
});

test("movement respects grid bounds and obstacles", () => {
  const battle = makeBattle();
  assert.equal(B.canMove(battle, -1, 0), false);
  assert.equal(B.canMove(battle, 0, -1), true);
  assert.equal(B.canMove(battle, 2, -1), false);
  assert.equal(B.canStep(battle, 3, 2), false, "obstacle tiles are not walkable");
  assert.equal(B.canMove(battle, 1, 0), true);
  const before = B.battleDistance(battle);
  const result = B.moveHero(battle, 1, 0);
  assert.equal(result.ok, true);
  assert.equal(battle.hero.x, 1);
  assert.ok(B.battleDistance(battle) < before);
});

test("melee needs adjacency while ranged classes attack on distance", () => {
  const warrior = makeBattle();
  assert.equal(B.canAttack(warrior, false), false);
  const blocked = B.heroAttack(warrior, { ranged: false, stats: { attack: 999 } });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "melee-range");

  const mage = makeBattle({ heroClass: "mage" });
  assert.equal(mage.range, 5);
  assert.equal(B.canAttack(mage, true), true);
  const shot = B.heroAttack(mage, { ranged: true, stats: { attack: 999, crit: 0 } });
  assert.equal(shot.ok, true);
  assert.equal(shot.damage, 999);
  assert.equal(mage.status, "won");
});

test("killing the enemy ends the battle", () => {
  const battle = makeBattle();
  battle.enemy.hp = 5;
  battle.hero.x = battle.enemy.x - 1;
  battle.hero.y = battle.enemy.y;
  const result = B.heroAttack(battle, { stats: { attack: 50, crit: 0 } });
  assert.equal(result.defeated, true);
  assert.equal(battle.status, "won");
});

test("the enemy turn advances the round and damages the hero", () => {
  const battle = makeBattle({ heroClass: "mage" });
  const round = battle.round;
  const hp = battle.hp;
  B.heroAttack(battle, { ranged: true, stats: { attack: 1, crit: 0 } });
  assert.ok(battle.round > round);
  assert.ok(battle.hp <= hp);
});

test("class skills cost mana, respect melee range and stun", () => {
  const warrior = makeBattle();
  battleFar: {
    const far = B.useSkill(warrior, { stats: { attack: 10 } });
    assert.equal(far.ok, false);
    assert.equal(far.reason, "melee-range");
  }
  warrior.hero.x = warrior.enemy.x - 1;
  warrior.hero.y = warrior.enemy.y;
  const bash = B.useSkill(warrior, { stats: { attack: 10 } });
  assert.equal(bash.ok, true);
  assert.equal(bash.skill, "shield_bash");
  assert.equal(warrior.enemyStunned, true);

  const mage = makeBattle({ heroClass: "mage", mana: 24 });
  const bolt = B.useSkill(mage, { stats: { attack: 100 } });
  assert.equal(bolt.ok, true);
  assert.equal(bolt.skill, "arcane_bolt");
  assert.ok(mage.mana < 24);
  assert.equal(mage.status, "won");
});

test("consumables heal, restore mana and camouflage", () => {
  const battle = makeBattle({ heroClass: "mage", hp: 10, mana: 0 });
  const potion = I.createConsumable("potion_heal");
  const healed = B.useConsumable(battle, potion, { stats: {} });
  assert.equal(healed.ok, true);
  assert.ok(battle.hp > 10);

  const manaPotion = I.createConsumable("potion_mana");
  battle.maxMana = 20;
  B.useConsumable(battle, manaPotion, { stats: {} });
  assert.ok(battle.mana > 0);

  const stealth = I.createConsumable("potion_invisible");
  const cloaked = B.useConsumable(battle, stealth, { stats: {} });
  assert.match(cloaked.events.join(" "), /getarnt/);
});

test("defeat and fleeing close the battle", () => {
  const loss = makeBattle({ hp: 1 });
  loss.enemy.hp = 999;
  loss.hero.x = loss.enemy.x - 1;
  loss.hero.y = loss.enemy.y;
  B.heroAttack(loss, { ranged: false, stats: { attack: 1, crit: 0 } });
  assert.equal(loss.status, "lost");
  assert.equal(loss.hp, 0);

  const flee = makeBattle();
  assert.equal(B.fleeBattle(flee).ok, true);
  assert.equal(flee.status, "fled");
  assert.equal(B.fleeBattle(flee).ok, false);
});

test("battle snapshots expose distance, hp and logs", () => {
  const battle = makeBattle();
  const snapshot = B.battleSnapshot(battle);
  assert.equal(snapshot.floor, 1);
  assert.equal(snapshot.maxHp, 70);
  assert.ok(snapshot.distance > 0);
  assert.ok(Array.isArray(snapshot.log));
  assert.equal(B.battleSnapshot(null), null);
});

test("boss specials trigger with their signature effect", () => {
  const sequence = () => {
    let calls = 0;
    return () => (calls++ === 0 ? 0 : 0.5);
  };

  const dragon = makeBattle({ floor: 1, roomType: "boss", rng: sequence() });
  dragon.hp = 5000;
  dragon.maxHp = 5000;
  dragon.hero.x = dragon.enemy.x - 2;
  dragon.hero.y = dragon.enemy.y;
  const dragonHp = dragon.hp;
  const dragonEvents = B.enemyTurn(dragon);
  assert.match(dragonEvents.join(" | "), /Aufschieber-Atem/);
  assert.ok(dragon.hp < dragonHp);

  const lich = makeBattle({ floor: 10, roomType: "boss", rng: sequence() });
  lich.hp = 5000;
  lich.maxHp = 5000;
  lich.hero.x = lich.enemy.x - 2;
  lich.hero.y = lich.enemy.y;
  lich.enemy.hp = lich.enemy.maxHp - 20;
  const lichHp = lich.enemy.hp;
  B.enemyTurn(lich);
  assert.ok(lich.enemy.hp > lichHp, "the lich heals from soul drain");

  const golem = makeBattle({ floor: 15, roomType: "boss", rng: sequence() });
  golem.hp = 5000;
  golem.maxHp = 5000;
  golem.hero.x = golem.enemy.x - 1;
  golem.hero.y = golem.enemy.y;
  golem.heroDefense = 9;
  B.enemyTurn(golem);
  assert.equal(golem.heroDefense, 6, "armor crush removes 3 defense");

  const demon = makeBattle({ floor: 20, roomType: "boss", heroClass: "mage", rng: sequence() });
  demon.hp = 5000;
  demon.maxHp = 5000;
  demon.hero.x = demon.enemy.x - 2;
  demon.hero.y = demon.enemy.y;
  demon.mana = 20;
  B.enemyTurn(demon);
  assert.equal(demon.mana, 14, "deadline pressure burns 6 mana");

  const hydra = makeBattle({ floor: 25, roomType: "boss", rng: sequence() });
  hydra.hp = 5000;
  hydra.maxHp = 5000;
  hydra.hero.x = hydra.enemy.x - 2;
  hydra.hero.y = hydra.enemy.y;
  const hydraHp = hydra.hp;
  const hydraEvents = B.enemyTurn(hydra);
  assert.match(hydraEvents.join(" | "), /Zweiter Treffer/);
  assert.ok(hydra.hp < hydraHp);
});
