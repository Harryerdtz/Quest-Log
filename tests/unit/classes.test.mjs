import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../../js/classes.js";

test("all five requested classes exist with a skill", () => {
  assert.deepEqual(C.CLASS_ORDER, ["warrior", "mage", "rogue", "huntress", "cleric"]);
  C.classList().forEach((cls) => {
    assert.ok(cls.name);
    assert.match(cls.sprite, /<svg/);
    assert.ok(cls.tagline);
    assert.ok(cls.desc.length > 30);
    assert.ok(cls.buffs.length >= 3);
    assert.ok(cls.passive);
    assert.ok(cls.skill && cls.skill.name && cls.skill.desc);
    assert.ok(cls.maxHp > 0);
  });
  assert.equal(C.getClass("missing"), null);
});

test("warrior tanks, mage casts, rogue crits, cleric heals", () => {
  const warrior = C.getClass("warrior");
  const mage = C.getClass("mage");
  const rogue = C.getClass("rogue");
  const cleric = C.getClass("cleric");

  assert.equal(warrior.maxHp, 70);
  assert.ok(warrior.block > 0.05);
  assert.equal(warrior.range, 1);
  assert.equal(warrior.skill.id, "shield_bash");

  assert.ok(mage.manaRegen >= 4);
  assert.ok(mage.range >= 4);
  assert.equal(mage.skill.id, "arcane_bolt");

  assert.ok(rogue.crit > 0.15);
  assert.ok(rogue.dodge > 0.1);
  assert.equal(rogue.skill.id, "shadowstep");

  assert.match(cleric.passive, /Daily-Quest/);
  assert.equal(cleric.skill.id, "blessing");
  assert.ok(C.classMaxMana("cleric") > 0);
});

test("class stat deltas are relative to the neutral hero", () => {
  assert.deepEqual(C.classStatDelta(null), {});
  const warrior = C.classStatDelta("warrior");
  assert.equal(warrior.maxHp, 20);
  assert.equal(warrior.attack, 2);
  assert.equal(warrior.defense, 4);
  const rogue = C.classStatDelta("rogue");
  assert.ok(rogue.crit > 0.1);
  assert.ok(rogue.dodge >= 0.09);
  assert.equal(C.classRange("mage"), 5);
  assert.equal(C.classRange(null), 1);
  assert.equal(C.skillFor("nobody"), null);
});
