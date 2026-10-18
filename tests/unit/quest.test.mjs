import test from "node:test";
import assert from "node:assert/strict";
import * as QM from "../../js/quest-manager.js";

test("createQuest builds a stable quest shape", () => {
  const quest = QM.createQuest({ title: "Lernen", category: "daily", difficulty: "hard" });
  assert.match(quest.id, /^q_/);
  assert.equal(quest.title, "Lernen");
  assert.equal(quest.difficulty, "hard");
  assert.equal(quest.done, false);
  assert.ok(quest.createdAt > 0);
});

test("XP values and level thresholds match the RPG curve", () => {
  assert.equal(QM.xpValue("easy"), 10);
  assert.equal(QM.xpValue("medium"), 25);
  assert.equal(QM.xpValue("hard"), 50);
  assert.equal(QM.xpValue("boss"), 100);
  assert.equal(QM.xpValue("unknown"), 10);
  assert.equal(QM.xpForLevel(1), 100);
  assert.equal(QM.xpForLevel(4), 400);
});

test("applyCompletion handles streak bonus and level ups", () => {
  const state = { xp: 95, level: 1, streak: 3, leveledUp: false };
  const result = QM.applyCompletion(state, { difficulty: "medium" });
  assert.equal(result.xpGain, 30);
  assert.equal(result.leveledUp, true);
  assert.equal(state.level, 2);
  assert.equal(state.xp, 25);
});

test("applyCompletion applies booster multipliers", () => {
  const state = { xp: 0, level: 1, streak: 0, leveledUp: false };
  const result = QM.applyCompletion(state, { difficulty: "easy" }, 1.5);
  assert.equal(result.xpGain, 15);
  assert.equal(state.xp, 15);
});

test("updateStreak continues yesterday and resets after a gap", () => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const continued = { streak: 2, lastActiveDate: yesterday };
  QM.updateStreak(continued);
  assert.equal(continued.streak, 3);
  assert.equal(continued.lastActiveDate, today);

  const broken = { streak: 8, lastActiveDate: "Mon Jan 01 2001" };
  QM.updateStreak(broken);
  assert.equal(broken.streak, 1);
});

test("resetDailyQuests reopens only daily quests once per day", () => {
  const state = {
    lastDailyReset: null,
    quests: [
      { id: "d1", category: "daily", done: true },
      { id: "a1", category: "active", done: true },
    ],
  };
  QM.resetDailyQuests(state);
  assert.equal(state.quests[0].done, false);
  assert.equal(state.quests[1].done, true);
  assert.equal(state.lastDailyReset, new Date().toDateString());
});
