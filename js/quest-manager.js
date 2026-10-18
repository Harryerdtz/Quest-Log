// quest-manager.js — Quest logic, XP, leveling, streaks
const XP_VALUES = { easy: 10, medium: 25, hard: 50, boss: 100 };

export function xpValue(difficulty) {
  return XP_VALUES[difficulty] || 10;
}

export function createQuest({ title, category, difficulty }) {
  return {
    id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    title,
    category, // 'daily' | 'active'
    difficulty, // 'easy' | 'medium' | 'hard'
    done: false,
    createdAt: Date.now(),
  };
}

export function xpForLevel(level) {
  // XP needed to reach next level from current: level * 100
  return level * 100;
}

export function applyCompletion(state, quest) {
  let xpGain = xpValue(quest.difficulty);
  // streak multiplier: +20% if streak >= 3
  if (state.streak >= 3) xpGain = Math.round(xpGain * 1.2);
  state.xp += xpGain;
  // level up loop
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    state.leveledUp = true;
  }
  return { xpGain, leveledUp: !!state.leveledUp };
}

export function updateStreak(state) {
  const today = new Date().toDateString();
  if (state.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (state.lastActiveDate === yesterday) {
    state.streak = (state.streak || 0) + 1;
  } else {
    state.streak = 1;
  }
  state.lastActiveDate = today;
}

export function resetDailyQuests(state) {
  const today = new Date().toDateString();
  if (state.lastDailyReset !== today) {
    state.quests = state.quests.map((q) =>
      q.category === "daily" ? { ...q, done: false } : q
    );
    state.lastDailyReset = today;
  }
}
