// app.js — main controller
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import * as audio from "./audio.js";
import * as QM from "./quest-manager.js";

const DEFAULT_STATE = {
  quests: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,
  lastDailyReset: null,
  settings: {},
};

let state = loadState() || { ...DEFAULT_STATE };

function persist() { saveState(state); }

function render() {
  const levelEl = document.querySelector('[data-stat="level"]');
  const xpEl = document.querySelector('[data-stat="xp"]');
  const streakEl = document.querySelector('[data-stat="streak"]');
  if (levelEl) levelEl.textContent = `Lv ${state.level}`;
  if (xpEl) xpEl.textContent = `XP: ${state.xp} / ${QM.xpForLevel(state.level)}`;
  if (streakEl) streakEl.textContent = `Streak: ${state.streak}`;

  const daily = document.getElementById("daily-list");
  const active = document.getElementById("active-list");
  if (daily) daily.innerHTML = "";
  if (active) active.innerHTML = "";

  state.quests.forEach((q) => {
    const li = document.createElement("li");
    li.className = "quest-item" + (q.done ? " done" : "");
    li.dataset.id = q.id;
    li.dataset.difficulty = q.difficulty;
    li.innerHTML = `
      <span class="quest-title">${q.title}</span>
      <span class="quest-meta">${q.difficulty}</span>
      <button data-action="toggle">✓</button>
      <button data-action="delete">✕</button>
    `;
    (q.category === "daily" ? daily : active).appendChild(li);
  });
}

function addQuest(e) {
  e.preventDefault();
  const title = document.getElementById("quest-title").value.trim();
  const category = document.getElementById("quest-category").value;
  const difficulty = document.getElementById("quest-difficulty").value;
  if (!title) return;
  state.quests.push(QM.createQuest({ title, category, difficulty }));
  document.getElementById("quest-form").reset();
  persist();
  render();
}

function handleListClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const li = btn.closest("li");
  const id = li.dataset.id;
  const action = btn.dataset.action;
  const quest = state.quests.find((q) => q.id === id);
  if (!quest) return;

  if (action === "toggle") {
    if (!quest.done) {
      quest.done = true;
      state.leveledUp = false;
      const res = QM.applyCompletion(state, quest);
      persist();
      render();
      audio.playComplete();
      if (res.leveledUp) audio.playLevelUp();
    } else {
      quest.done = false;
      persist();
      render();
    }
  } else if (action === "delete") {
    state.quests = state.quests.filter((q) => q.id !== id);
    persist();
    render();
    audio.playDelete();
  }
}

function setup() {
  QM.updateStreak(state);
  QM.resetDailyQuests(state);
  persist();

  document.getElementById("quest-form").addEventListener("submit", addQuest);
  document.getElementById("daily-list").addEventListener("click", handleListClick);
  document.getElementById("active-list").addEventListener("click", handleListClick);

  document.getElementById("btn-export").addEventListener("click", () => exportJSON(state));
  document.getElementById("btn-import").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await importJSON(file);
      state = { ...DEFAULT_STATE, ...imported };
      persist();
      render();
    } catch (err) {
      audio.playError();
      alert("Import fehlgeschlagen");
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  render();
}

setup();
