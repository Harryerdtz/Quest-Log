// app.js — main controller
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import * as audio from "./audio.js";
import * as QM from "./quest-manager.js";
import * as EXT from "./logic-extended.js";

const DEFAULT_STATE = {
  quests: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,
  lastDailyReset: null,
  settings: {},
};

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  boss: "Boss",
};

const EMPTY_MESSAGES = {
  daily: "Keine Daily Quests. Starte klein.",
  active: "Keine aktiven Quests. Zeit für ein Abenteuer!",
};

let state = loadState() || { ...DEFAULT_STATE };
let levelUpTimer = null;
let levelUpHideTimer = null;

function persist() {
  saveState(state);
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}

function createQuestElement(quest) {
  const li = document.createElement("li");
  const title = escapeHTML(quest.title);
  const difficulty = DIFFICULTY_LABELS[quest.difficulty] || quest.difficulty;

  li.className = "quest-item" + (quest.done ? " is-done" : "");
  li.dataset.id = quest.id;
  li.dataset.difficulty = quest.difficulty;
  li.innerHTML = `
    <button class="quest-check" type="button" data-action="toggle" role="checkbox"
      aria-checked="${quest.done}" aria-label="${quest.done ? "Quest wieder öffnen" : "Quest abschließen"}: ${title}">
      <span class="quest-check__box" aria-hidden="true"></span>
    </button>
    <span class="quest-content">
      <span class="quest-title">${title}</span>
      <span class="quest-meta">
        <span class="quest-tag quest-tag--${quest.difficulty}">${difficulty}</span>
        <span class="quest-xp">+${QM.xpValue(quest.difficulty)} XP</span>
      </span>
    </span>
    <button class="quest-delete" type="button" data-action="delete" aria-label="Quest löschen: ${title}">
      <span aria-hidden="true">✕</span>
    </button>
  `;

  return li;
}

function render() {
  const xpNeeded = QM.xpForLevel(state.level);
  const xpPercent = Math.min(100, Math.max(0, (state.xp / xpNeeded) * 100));

  const levelEl = document.querySelector('[data-stat="level"]');
  if (levelEl) levelEl.textContent = `LV ${state.level}`;

  const streakEl = document.querySelector('[data-stat="streak"]');
  if (streakEl) streakEl.textContent = String(state.streak);

  const xpEl = document.querySelector('[data-stat="xp"]');
  if (xpEl) xpEl.textContent = `${state.xp} / ${xpNeeded} XP`;

  const xpFill = document.querySelector('[data-stat="xp-fill"]');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;

  const xpBar = document.getElementById("xp-bar");
  if (xpBar) {
    xpBar.setAttribute("aria-valuenow", String(state.xp));
    xpBar.setAttribute("aria-valuemax", String(xpNeeded));
    xpBar.setAttribute("aria-valuetext", `${state.xp} von ${xpNeeded} XP`);
  }

  const buckets = { daily: [], active: [] };
  state.quests.forEach((quest) => {
    const bucket = buckets[quest.category] || buckets.active;
    bucket.push(quest);
  });

  Object.entries(buckets).forEach(([category, quests]) => {
    const list = document.getElementById(`${category}-list`);
    const count = document.querySelector(`[data-count="${category}"]`);
    if (count) count.textContent = String(quests.length);
    if (!list) return;

    list.innerHTML = "";
    if (!quests.length) {
      const empty = document.createElement("li");
      empty.className = "quest-empty";
      empty.textContent = EMPTY_MESSAGES[category];
      list.appendChild(empty);
      return;
    }

    quests.forEach((quest) => list.appendChild(createQuestElement(quest)));
  });
}

function animateQuest(questId, className) {
  const item = document.querySelector(`.quest-item[data-id="${questId}"]`);
  if (!item) return;
  item.classList.add(className);
  setTimeout(() => item.classList.remove(className), className === "is-new" ? 400 : 700);
}

function flashXPBar() {
  const bar = document.getElementById("xp-bar");
  if (!bar) return;
  bar.classList.remove("is-gaining");
  // Restart the animation even if two quests are completed in quick succession.
  void bar.offsetWidth;
  bar.classList.add("is-gaining");
  setTimeout(() => bar.classList.remove("is-gaining"), 900);
}

function showLevelUp(level) {
  const banner = document.getElementById("levelup-banner");
  if (!banner) return;

  clearTimeout(levelUpTimer);
  clearTimeout(levelUpHideTimer);

  banner.hidden = false;
  const levelEl = banner.querySelector("[data-levelup-level]");
  if (levelEl) levelEl.textContent = String(level);
  banner.classList.remove("is-visible");
  void banner.offsetWidth;
  banner.classList.add("is-visible");

  levelUpTimer = setTimeout(() => {
    banner.classList.remove("is-visible");
    levelUpHideTimer = setTimeout(() => {
      banner.hidden = true;
    }, 260);
  }, 2600);

  const card = document.querySelector(".player-card");
  if (card) {
    card.classList.remove("is-leveling");
    void card.offsetWidth;
    card.classList.add("is-leveling");
    setTimeout(() => card.classList.remove("is-leveling"), 1900);
  }
}

function addQuest(event) {
  event.preventDefault();
  const titleInput = document.getElementById("quest-title");
  const categoryInput = document.getElementById("quest-category");
  const difficultyInput = document.getElementById("quest-difficulty");
  const title = titleInput.value.trim();
  if (!title) return;

  const quest = QM.createQuest({
    title,
    category: categoryInput.value,
    difficulty: difficultyInput.value,
  });

  state.quests.push(quest);
  persist();
  render();
  animateQuest(quest.id, "is-new");

  document.getElementById("quest-form").reset();
  titleInput.focus();
}

function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = button.closest("li");
  const id = item?.dataset.id;
  const action = button.dataset.action;
  const quest = state.quests.find((entry) => entry.id === id);
  if (!quest) return;

  if (action === "toggle") {
    if (!quest.done) {
      state.leveledUp = false;
      const result = QM.applyCompletion(state, quest);
      // booster
      let xpGain = result.xpGain;
      if (EXT.isBoosterActive(state)) xpGain = Math.round(xpGain * 2);
      state.xp += (xpGain - result.xpGain);
      EXT.damageBoss(state, xpGain);
      quest.done = true;
      persist();
      render();
      audio.playComplete();
      animateQuest(quest.id, "is-completing");
      flashXPBar();
      if (result.leveledUp) {
        audio.playLevelUp();
        showLevelUp(state.level);
      }
    } else {
      quest.done = false;
      persist();
      render();
    }
  } else if (action === "delete") {
    state.quests = state.quests.filter((entry) => entry.id !== id);
    persist();
    render();
    audio.playDelete();
  }
}

function setup() {
  QM.updateStreak(state);
  QM.resetDailyQuests(state);
  const idleGold = EXT.claimIdleGold(state);
  if (idleGold > 0) console.log("Idle gold claimed:", idleGold);
  EXT.initBoss(state);
  persist();

  const form = document.getElementById("quest-form");
  const dailyList = document.getElementById("daily-list");
  const activeList = document.getElementById("active-list");
  const titleInput = document.getElementById("quest-title");
  const diffSelect = document.getElementById("quest-difficulty");

  titleInput.addEventListener("input", () => {
    const est = EXT.estimateDifficulty(titleInput.value);
    diffSelect.value = est.difficulty;
  });

  form.addEventListener("submit", addQuest);
  dailyList.addEventListener("click", handleListClick);
  activeList.addEventListener("click", handleListClick);

  document.getElementById("btn-export").addEventListener("click", () => exportJSON(state));
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = await importJSON(file);
      state = { ...DEFAULT_STATE, ...imported, quests: Array.isArray(imported.quests) ? imported.quests : [] };
      persist();
      render();
    } catch (error) {
      audio.playError();
      alert("Import fehlgeschlagen");
    } finally {
      event.target.value = "";
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  render();
}

setup();
