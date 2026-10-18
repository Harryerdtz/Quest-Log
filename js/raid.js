// raid.js — boss raid, quest gold and idle loot with difficulty modes
export const LOOT_INTERVAL = 40000;
export const LOOT_CAP = 45;
const HEROIC_INTERVAL = 60000;
const HEROIC_CAP = 30;

const BOSS_NAMES = [
  "Der Prokrastinations-Drache",
  "Der Papierkram-Golem",
  "Die Inbox-Hydra",
  "Der Deadline-Dämon",
  "Der Montags-Moloch",
];

const QUEST_GOLD = { easy: 5, medium: 10, hard: 20, boss: 40 };

export function isHeroic(mode) {
  return mode === "heroic";
}

export function bossMaxHp(level, mode = "normal") {
  // More hits per boss than before, extra tough on Heroic.
  return Math.round((100 + level * 55) * (isHeroic(mode) ? 1.4 : 1));
}

export function createBoss(level = 1, mode = "normal") {
  const safeLevel = Math.max(1, Math.floor(level));
  const maxHp = bossMaxHp(safeLevel, mode);
  return {
    level: safeLevel,
    name: BOSS_NAMES[(safeLevel - 1) % BOSS_NAMES.length],
    hp: maxHp,
    maxHp,
    mode: isHeroic(mode) ? "heroic" : "normal",
  };
}

export function goldForQuest(difficulty, mode = "normal") {
  const base = QUEST_GOLD[difficulty] || QUEST_GOLD.easy;
  return Math.round(base * (isHeroic(mode) ? 1 : 1.25));
}

export function bossGold(level, mode = "normal") {
  return Math.round((60 + level * 18) * (isHeroic(mode) ? 1.5 : 1));
}

export function damageBoss(boss, amount) {
  const damage = Math.max(1, Math.round(amount));
  boss.hp = Math.max(0, boss.hp - damage);

  if (boss.hp > 0) return { defeated: false, damage };

  const defeatedLevel = boss.level;
  const defeatedName = boss.name;
  const defeatedMaxHp = boss.maxHp;
  const mode = boss.mode || "normal";
  const goldReward = bossGold(defeatedLevel, mode);
  const next = createBoss(defeatedLevel + 1, mode);

  Object.assign(boss, next);

  return {
    defeated: true,
    damage,
    defeatedLevel,
    defeatedName,
    defeatedMaxHp,
    goldReward,
    nextLevel: next.level,
    nextName: next.name,
  };
}

export function lootInterval(mode = "normal") {
  return isHeroic(mode) ? HEROIC_INTERVAL : LOOT_INTERVAL;
}

export function lootCap(mode = "normal") {
  return isHeroic(mode) ? HEROIC_CAP : LOOT_CAP;
}

export function lootPending(state, now = Date.now(), mode = "normal") {
  const last = Number.isFinite(state.lastLootAt) ? state.lastLootAt : now;
  const elapsed = Math.max(0, now - last);
  return Math.min(lootCap(mode), Math.floor(elapsed / lootInterval(mode)));
}

export function lootNextIn(state, now = Date.now(), mode = "normal") {
  const last = Number.isFinite(state.lastLootAt) ? state.lastLootAt : now;
  const elapsed = Math.max(0, now - last);
  if (lootPending(state, now, mode) >= lootCap(mode)) return 0;
  return Math.max(1, Math.ceil((lootInterval(mode) - (elapsed % lootInterval(mode))) / 1000));
}

export function collectLoot(state, now = Date.now(), mode = "normal") {
  const pending = lootPending(state, now, mode);
  if (pending <= 0) return { ok: false, gold: 0 };
  state.gold += pending;
  state.lastLootAt = now;
  return { ok: true, gold: pending };
}
