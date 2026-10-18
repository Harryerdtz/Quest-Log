// raid.js — boss raid, quest gold and idle loot
export const LOOT_INTERVAL = 20000;
export const LOOT_CAP = 60;

const BOSS_NAMES = [
  "Der Prokrastinations-Drache",
  "Der Papierkram-Golem",
  "Die Inbox-Hydra",
  "Der Deadline-Dämon",
  "Der Montags-Moloch",
];

const QUEST_GOLD = { easy: 5, medium: 10, hard: 20, boss: 40 };

export function bossMaxHp(level) {
  return 80 + level * 40;
}

export function createBoss(level = 1) {
  const safeLevel = Math.max(1, Math.floor(level));
  const maxHp = bossMaxHp(safeLevel);
  return {
    level: safeLevel,
    name: BOSS_NAMES[(safeLevel - 1) % BOSS_NAMES.length],
    hp: maxHp,
    maxHp,
  };
}

export function goldForQuest(difficulty) {
  return QUEST_GOLD[difficulty] || QUEST_GOLD.easy;
}

export function damageBoss(boss, amount) {
  const damage = Math.max(1, Math.round(amount));
  boss.hp = Math.max(0, boss.hp - damage);

  if (boss.hp > 0) return { defeated: false, damage };

  const defeatedLevel = boss.level;
  const defeatedName = boss.name;
  const defeatedMaxHp = boss.maxHp;
  const goldReward = 80 + defeatedLevel * 20;
  const next = createBoss(defeatedLevel + 1);

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

export function lootPending(state, now = Date.now()) {
  const last = Number.isFinite(state.lastLootAt) ? state.lastLootAt : now;
  const elapsed = Math.max(0, now - last);
  return Math.min(LOOT_CAP, Math.floor(elapsed / LOOT_INTERVAL));
}

export function lootNextIn(state, now = Date.now()) {
  const last = Number.isFinite(state.lastLootAt) ? state.lastLootAt : now;
  const elapsed = Math.max(0, now - last);
  if (lootPending(state, now) >= LOOT_CAP) return 0;
  return Math.max(1, Math.ceil((LOOT_INTERVAL - (elapsed % LOOT_INTERVAL)) / 1000));
}

export function collectLoot(state, now = Date.now()) {
  const pending = lootPending(state, now);
  if (pending <= 0) return { ok: false, gold: 0 };
  state.gold += pending;
  state.lastLootAt = now;
  return { ok: true, gold: pending };
}
