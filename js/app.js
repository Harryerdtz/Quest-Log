// app.js — main controller
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import * as audio from "./audio.js";
import * as QM from "./quest-manager.js";
import * as RAID from "./raid.js";
import * as DUNGEON from "./dungeon.js";
import * as MAP from "./map.js";
import * as ITEMS from "./items.js";
import * as INVENTORY from "./inventory.js";
import * as CLASSES from "./classes.js";
import * as BATTLE from "./battle.js";
import {
  SHOP_ITEMS,
  RUNE_ITEMS,
  AVATARS,
  COIN_SVG,
  avatarBuff,
  buyItem,
  buyRune,
  equipAvatar,
  equipRune,
  itemPrice,
} from "./shop.js";

const DEFAULT_STATE = {
  quests: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,
  lastDailyReset: null,
  settings: { sound: true, haptics: true, difficulty: "normal" },
  gold: 250,
  owned: ["avatar_hero"],
  equippedAvatar: "avatar_hero",
  boosterXp: 0,
  boosterGold: 0,
  boosterLoot: 0,
  boosterBoss: 0,
  boosterLuck: 0,
  boosterMana: 0,
  heroClass: null,
  mana: 0,
  inventory: null,
  battle: null,
  itemsFound: 0,
  epicFound: 0,
  legendaryFound: 0,
  boss: null,
  lastLootAt: null,
  upgrades: { weapon: 0, armor: 0, strength: 0, vitality: 0, wand: 0, amulet: 0, shield: 0, ring: 0 },
  dungeon: null,
  deepestFloor: 1,
  lastEliteBonusDate: null,
  runes: [],
  rune: null,
  totalLoot: 0,
  monstersSlain: 0,
  bestStreak: 0,
  goldEarned: 0,
};

const DIFFICULTIES = ["easy", "medium", "hard", "boss"];
const DIFFICULTY_LABELS = { easy: "Leicht", medium: "Mittel", hard: "Schwer", boss: "Boss" };
const SHOP_CATEGORIES = ["equipment", "booster", "cosmetic", "scroll", "reward"];
const HARD_WORDS = /projekt|prüfung|klausur|steuer|umzug|bewerbung|arbeit/i;

const EMPTY_MESSAGES = {
  daily: "Keine Daily Quests. Starte klein.",
  active: "Keine aktiven Quests. Zeit für ein Abenteuer!",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function normalizeState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const clean = { ...DEFAULT_STATE, ...source };

  clean.quests = Array.isArray(source.quests)
    ? source.quests.filter((quest) => quest && typeof quest.id === "string")
    : [];
  clean.owned = Array.isArray(source.owned)
    ? [...new Set(source.owned.filter((id) => typeof id === "string"))]
    : [];
  if (!clean.owned.includes("avatar_hero")) clean.owned.unshift("avatar_hero");
  clean.equippedAvatar = AVATARS[source.equippedAvatar] ? source.equippedAvatar : "avatar_hero";
  clean.gold = Number.isFinite(source.gold) ? Math.max(0, Math.floor(source.gold)) : 250;
  clean.boosterXp = Number.isFinite(source.boosterXp) ? Math.max(0, Math.floor(source.boosterXp)) : 0;
  clean.boosterGold = Number.isFinite(source.boosterGold) ? Math.max(0, Math.floor(source.boosterGold)) : 0;
  clean.boosterLoot = Number.isFinite(source.boosterLoot) ? Math.max(0, Math.floor(source.boosterLoot)) : 0;
  clean.boosterBoss = Number.isFinite(source.boosterBoss) ? Math.max(0, Math.floor(source.boosterBoss)) : 0;
  clean.boosterLuck = Number.isFinite(source.boosterLuck) ? Math.max(0, Math.floor(source.boosterLuck)) : 0;
  clean.boosterMana = Number.isFinite(source.boosterMana) ? Math.max(0, Math.floor(source.boosterMana)) : 0;
  clean.itemsFound = Number.isFinite(source.itemsFound) ? Math.max(0, Math.floor(source.itemsFound)) : 0;
  clean.epicFound = Number.isFinite(source.epicFound) ? Math.max(0, Math.floor(source.epicFound)) : 0;
  clean.legendaryFound = Number.isFinite(source.legendaryFound) ? Math.max(0, Math.floor(source.legendaryFound)) : 0;
  clean.level = Number.isFinite(source.level) ? Math.max(1, Math.floor(source.level)) : 1;
  clean.xp = Number.isFinite(source.xp) ? Math.max(0, Math.floor(source.xp)) : 0;
  clean.streak = Number.isFinite(source.streak) ? Math.max(0, Math.floor(source.streak)) : 0;
  clean.settings = {
    ...DEFAULT_STATE.settings,
    ...(source.settings && typeof source.settings === "object" ? source.settings : {}),
  };
  clean.settings.sound = source.settings?.sound !== false;
  clean.settings.haptics = source.settings?.haptics !== false;
  clean.settings.difficulty = source.settings?.difficulty === "heroic" ? "heroic" : "normal";

  clean.runes = Array.isArray(source.runes)
    ? [...new Set(source.runes.filter((id) => DUNGEON.ELEMENTS[id]))]
    : [];
  clean.rune = clean.runes.includes(source.rune) ? source.rune : clean.runes[0] || null;
  clean.heroClass = CLASSES.getClass(source.heroClass) ? source.heroClass : null;
  clean.inventory = INVENTORY.normalizeInventory(source.inventory);
  clean.battle = null;
  clean.totalLoot = Number.isFinite(source.totalLoot) ? Math.max(0, Math.floor(source.totalLoot)) : 0;
  clean.monstersSlain = Number.isFinite(source.monstersSlain) ? Math.max(0, Math.floor(source.monstersSlain)) : 0;
  clean.bestStreak = Number.isFinite(source.bestStreak) ? Math.max(0, Math.floor(source.bestStreak)) : 0;
  clean.goldEarned = Number.isFinite(source.goldEarned) ? Math.max(0, Math.floor(source.goldEarned)) : 0;

  const mode = clean.settings.difficulty;

  clean.upgrades = {};
  DUNGEON.UPGRADES.forEach((upgrade) => {
    const level = Number.isFinite(source.upgrades?.[upgrade.id]) ? Math.floor(source.upgrades[upgrade.id]) : 0;
    clean.upgrades[upgrade.id] = Math.max(0, level);
  });

  const stats = DUNGEON.heroStats(clean.upgrades, avatarBuff(clean.equippedAvatar), {
    cls: clean.heroClass,
    gear: INVENTORY.gearBuffs(clean.inventory),
  });
  clean.mana = Number.isFinite(source.mana) ? Math.max(0, Math.min(stats.maxMana, Math.floor(source.mana))) : stats.maxMana;
  const floor = Number.isFinite(source.dungeon?.floor) ? Math.max(1, Math.floor(source.dungeon.floor)) : 1;
  clean.deepestFloor = Math.max(
    floor,
    Number.isFinite(source.deepestFloor) ? Math.floor(source.deepestFloor) : 1
  );
  clean.lastEliteBonusDate =
    typeof source.lastEliteBonusDate === "string" ? source.lastEliteBonusDate : null;
  clean.dungeon = MAP.normalizeDungeon(source.dungeon, floor);
  clean.dungeon.hp = Number.isFinite(source.dungeon?.hp)
    ? Math.max(1, Math.min(stats.maxHp, Math.floor(source.dungeon.hp)))
    : stats.maxHp;

  const bossLevel = Number.isFinite(source.boss?.level) ? Math.max(1, Math.floor(source.boss.level)) : 1;
  const bossTemplate = RAID.createBoss(bossLevel, mode);
  clean.boss = {
    ...bossTemplate,
    hp: Number.isFinite(source.boss?.hp)
      ? Math.max(1, Math.min(bossTemplate.maxHp, Math.floor(source.boss.hp)))
      : bossTemplate.maxHp,
  };

  clean.lastLootAt = Number.isFinite(source.lastLootAt)
    ? Math.min(Date.now(), source.lastLootAt)
    : Date.now() - RAID.LOOT_INTERVAL;

  delete clean.leveledUp;
  return clean;
}

let state = normalizeState(loadState());
let levelUpTimer = null;
let levelUpHideTimer = null;
let activeShopTab = "equipment";
let categoryControl = null;
let difficultyControl = null;
let lootTicker = null;
let resetArmed = false;
let resetTimer = null;
let dungeonResetArmed = false;
let dungeonResetTimer = null;
let classPreview = null;
let inspectorItemId = null;

/* -------------------------------------------------------------------------
   Utilities + navigation
   ------------------------------------------------------------------------- */

function persist() {
  saveState(state);
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}

function toast(message, tone = "gold") {
  const stack = $("#toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  stack.appendChild(el);
  while (stack.children.length > 3) stack.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 200);
  }, 2800);
}

function haptic(duration = 8) {
  if (state.settings.haptics === false) return;
  if (typeof navigator.vibrate === "function") navigator.vibrate(duration);
}

function pulseWallet() {
  const wallet = $("#btn-shop");
  if (!wallet) return;
  wallet.classList.remove("is-gaining");
  void wallet.offsetWidth;
  wallet.classList.add("is-gaining");
  setTimeout(() => wallet.classList.remove("is-gaining"), 600);
}

function setTab(tab) {
  const panels = $$("[data-tab-panel]");
  const target = panels.some((panel) => panel.dataset.tabPanel === tab) ? tab : "quests";
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== target;
  });
  $$(".tab-nav__btn[data-tab]").forEach((button) => {
    const active = button.dataset.tab === target;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.body.dataset.tab = target;
  if (target === "shop") renderShop();
  if (target === "inventory") renderInventory();
  if (window.scrollY > 0) window.scrollTo(0, 0);
  haptic(6);
}

/* -------------------------------------------------------------------------
   Custom dropdowns
   ------------------------------------------------------------------------- */

function initDropdown(root, onChange = null) {
  if (!root) return { select: () => {} };
  const trigger = $(".dropdown__trigger", root);
  const menu = $(".dropdown__menu", root);
  const hidden = $('input[type="hidden"]', root);
  const valueEl = $("[data-dropdown-value]", root);
  const iconEl = $("[data-dropdown-icon]", root);
  const options = $$(".dropdown__option", menu);
  let open = false;

  function setOpen(next) {
    open = next;
    trigger.setAttribute("aria-expanded", String(next));
    menu.hidden = !next;
    if (next) {
      const selected = options.find((option) => option.getAttribute("aria-selected") === "true") || options[0];
      selected.focus();
    }
  }

  function select(value, { focusTrigger = false } = {}) {
    const option = options.find((entry) => entry.dataset.value === value) || options[0];
    if (!option) return;
    hidden.value = option.dataset.value;
    valueEl.textContent = option.dataset.label || option.textContent.trim();
    iconEl.textContent = option.dataset.icon || "◆";
    options.forEach((entry) => {
      const selected = entry === option;
      entry.classList.toggle("is-selected", selected);
      entry.setAttribute("aria-selected", String(selected));
    });
    setOpen(false);
    if (onChange) onChange(option.dataset.value);
    if (focusTrigger) trigger.focus();
  }

  trigger.addEventListener("click", () => setOpen(!open));
  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  });

  options.forEach((option) => {
    option.addEventListener("click", () => select(option.dataset.value, { focusTrigger: true }));
    option.addEventListener("keydown", (event) => {
      const index = options.indexOf(option);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        options[(index + delta + options.length) % options.length].focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(option.dataset.value, { focusTrigger: true });
      } else if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (open && !root.contains(event.target)) setOpen(false);
  });

  return { select };
}

/* -------------------------------------------------------------------------
   XP / auto difficulty
   ------------------------------------------------------------------------- */

function previewXP(difficulty) {
  let xp = QM.xpValue(difficulty);
  if (state.streak >= 3) xp = Math.round(xp * 1.2);
  if (state.boosterXp > 0) xp = Math.round(xp * 1.5);
  return xp;
}

function estimateDifficulty(title) {
  const text = title.trim();
  if (!text) return "medium";
  let index = text.length < 20 ? 0 : text.length < 45 ? 1 : text.length < 75 ? 2 : 3;
  if (/boss/i.test(text)) index = 3;
  else if (HARD_WORDS.test(text)) index = Math.min(3, index + 1);
  return DIFFICULTIES[index];
}

function resolveDifficulty() {
  const selected = $("#quest-difficulty")?.value || "auto";
  if (selected === "auto") return estimateDifficulty($("#quest-title")?.value || "");
  return DIFFICULTIES.includes(selected) ? selected : "medium";
}

function syncDifficulty() {
  const selected = $("#quest-difficulty")?.value || "auto";
  const auto = selected === "auto";
  const resolved = resolveDifficulty();
  const xp = previewXP(resolved);
  const trigger = $("#difficulty-trigger");
  if (trigger) trigger.dataset.difficulty = resolved;

  const badge = $("[data-xp-badge]");
  if (badge) badge.textContent = `+${xp} XP`;

  $$(".dropdown__option[data-difficulty]").forEach((option) => {
    const difficulty = option.dataset.value === "auto" ? resolved : option.dataset.value;
    const xpEl = $("[data-option-xp]", option);
    if (xpEl) xpEl.textContent = `+${previewXP(difficulty)} XP`;
  });

  const hint = $("#difficulty-hint");
  if (hint) {
    const bits = [auto ? `AUTO: ${DIFFICULTY_LABELS[resolved]} erkannt` : `Manuell: ${DIFFICULTY_LABELS[resolved]}`];
    if (state.streak >= 3) bits.push("Serie ×1.2");
    if (state.boosterXp > 0) bits.push(`XP-Booster ×1.5 (${state.boosterXp})`);
    hint.textContent = bits.join(" · ");
  }
}

/* -------------------------------------------------------------------------
   Quest rendering + actions
   ------------------------------------------------------------------------- */

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
        <span class="quest-gold">+${RAID.goldForQuest(quest.difficulty)} G</span>
      </span>
    </span>
    <button class="quest-delete" type="button" data-action="delete" aria-label="Quest löschen: ${title}">
      <span aria-hidden="true">✕</span>
    </button>
  `;

  return li;
}

function renderQuests() {
  const buckets = { daily: [], active: [] };
  state.quests.forEach((quest) => {
    (buckets[quest.category] || buckets.active).push(quest);
  });

  Object.entries(buckets).forEach(([category, quests]) => {
    const list = document.getElementById(`${category}-list`);
    const count = document.querySelector(`[data-count="${category}"]`);
    if (count) count.textContent = String(quests.length);

    const done = quests.filter((quest) => quest.done).length;
    const percent = quests.length ? Math.round((done / quests.length) * 100) : 0;
    const progressCount = document.querySelector(`[data-progress-count="${category}"]`);
    if (progressCount) progressCount.textContent = `${done} / ${quests.length}`;
    const progressFill = document.querySelector(`[data-progress-fill="${category}"]`);
    if (progressFill) progressFill.style.width = `${percent}%`;
    const progressBar = document.querySelector(`[data-progress-bar="${category}"]`);
    if (progressBar) progressBar.setAttribute("aria-valuenow", String(percent));
    const progress = document.querySelector(`[data-progress="${category}"]`);
    if (progress) progress.classList.toggle("is-complete", quests.length > 0 && percent === 100);

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
  const bar = $("#xp-bar");
  if (!bar) return;
  bar.classList.remove("is-gaining");
  void bar.offsetWidth;
  bar.classList.add("is-gaining");
  setTimeout(() => bar.classList.remove("is-gaining"), 900);
}

function addQuest(event) {
  event.preventDefault();
  const titleInput = $("#quest-title");
  const title = titleInput.value.trim();
  if (!title) return;

  const quest = QM.createQuest({
    title,
    category: $("#quest-category").value,
    difficulty: resolveDifficulty(),
  });

  state.quests.push(quest);
  persist();
  render();
  animateQuest(quest.id, "is-new");

  $("#quest-form").reset();
  categoryControl?.select("daily");
  difficultyControl?.select("auto");
  syncDifficulty();
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
      const hasXpBooster = state.boosterXp > 0;
      const result = QM.applyCompletion(state, quest, hasXpBooster ? 1.5 : 1);
      if (hasXpBooster) state.boosterXp = Math.max(0, state.boosterXp - 1);

      const hasGoldBooster = state.boosterGold > 0;
      const goldGain = Math.round(
        RAID.goldForQuest(quest.difficulty, state.settings.difficulty) * (hasGoldBooster ? 1.5 : 1)
      );
      if (hasGoldBooster) state.boosterGold = Math.max(0, state.boosterGold - 1);
      state.gold += goldGain;
      state.goldEarned += goldGain;

      const raid = RAID.damageBoss(state.boss, result.xpGain);
      if (raid.defeated) {
        state.gold += raid.goldReward;
        state.goldEarned += raid.goldReward;
      }

      quest.done = true;
      if (quest.category === "daily" && state.heroClass === "cleric") {
        const stats = heroStats();
        const heal = Math.round(stats.maxHp * (0.12 + Math.max(0, stats.healing || 0) * 0.5));
        state.dungeon.hp = Math.min(stats.maxHp, Math.max(1, state.dungeon.hp) + heal);
        if (state.battle) state.battle.hp = Math.min(stats.maxHp, state.battle.hp + heal);
        toast(`Segen des Klerikers: +${heal} HP`, "green");
      }
      persist();
      render();
      pulseWallet();
      flashXPBar();
      audio.playComplete();
      animateQuest(quest.id, "is-completing");

      if (raid.defeated) showBossDefeat(raid);
      else playBossHit(raid.damage);

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

/* -------------------------------------------------------------------------
   HUD
   ------------------------------------------------------------------------- */

function updateGold() {
  $$("[data-gold]").forEach((el) => {
    el.textContent = String(state.gold);
  });
}

function updateAvatar() {
  const avatar = AVATARS[state.equippedAvatar] || AVATARS.avatar_hero;
  const frame = $("#avatar-frame");
  if (frame && frame.dataset.avatar !== avatar.id) {
    frame.innerHTML = avatar.sprite;
    frame.dataset.avatar = avatar.id;
  }
}

function updateBoosters() {
  const row = $("#booster-row");
  if (!row) return;
  const chips = [];
  if (state.boosterXp > 0) {
    chips.push(`<span class="booster-chip">XP ×1.5 · ${state.boosterXp}</span>`);
  }
  if (state.boosterGold > 0) {
    chips.push(`<span class="booster-chip booster-chip--gold">Gold ×1.5 · ${state.boosterGold}</span>`);
  }
  if (state.boosterLoot > 0) {
    chips.push(`<span class="booster-chip">Loot ×1.5 · ${state.boosterLoot}</span>`);
  }
  if (state.boosterBoss > 0) {
    chips.push(`<span class="booster-chip booster-chip--boss">Boss ×1.5 · ${state.boosterBoss}</span>`);
  }
  if (state.boosterLuck > 0) {
    chips.push(`<span class="booster-chip booster-chip--luck">Loot-Glück +1 · ${state.boosterLuck}</span>`);
  }
  if (state.boosterMana > 0) {
    chips.push(`<span class="booster-chip">Mana-Trank · ${state.boosterMana}</span>`);
  }
  row.innerHTML = chips.join("");
  row.hidden = chips.length === 0;
}

function setBossHpDisplay(hp, maxHp) {
  const percent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const fill = $('[data-boss="hp-fill"]');
  if (fill) fill.style.width = `${percent}%`;
  $$('[data-boss="hp"]').forEach((el) => {
    el.textContent = String(hp);
  });
  $$('[data-boss="maxhp"]').forEach((el) => {
    el.textContent = String(maxHp);
  });
  const bar = $("#boss-hp");
  if (bar) {
    bar.setAttribute("aria-valuenow", String(hp));
    bar.setAttribute("aria-valuemax", String(maxHp));
    bar.setAttribute("aria-valuetext", `${hp} von ${maxHp} HP`);
  }
}

function renderBoss() {
  const boss = state.boss;
  $$('[data-boss="name"]').forEach((el) => {
    el.textContent = boss.name;
  });
  $$('[data-boss="level"]').forEach((el) => {
    el.textContent = String(boss.level);
  });
  setBossHpDisplay(boss.hp, boss.maxHp);
  const panel = $("#boss-panel");
  if (panel) panel.classList.toggle("is-critical", boss.hp / boss.maxHp <= 0.3);
}

function syncEliteDaily() {
  const mode = state.settings.difficulty;
  const claimed = state.lastEliteBonusDate === new Date().toDateString();
  $$('[data-dungeon="elite-daily"]').forEach((el) => {
    el.textContent = claimed
      ? "Tagesbonus heute kassiert"
      : `Tagesbonus: +${DUNGEON.eliteDailyBonus(mode)} G`;
    el.classList.toggle("is-claimed", claimed);
  });
}

function updateLoot(now = Date.now()) {
  const mode = state.settings.difficulty;
  const pending = RAID.lootPending(state, now, mode);
  const full = pending >= RAID.lootCap(mode);
  $$('[data-loot="pending"]').forEach((el) => {
    el.textContent = String(pending);
  });

  const button = $("#loot-collect");
  if (button) button.disabled = pending <= 0;
  const label = $('[data-loot="button"]');
  if (label) label.textContent = pending > 0 ? `Loot einsammeln (+${pending})` : "Loot sammelt sich …";
  const timer = $('[data-loot="timer"]');
  if (timer) {
    timer.textContent = full
      ? "Kiste voll — jetzt einsammeln!"
      : `Nächster Loot in ${RAID.lootNextIn(state, now, mode)}s`;
  }
  const panel = $("#loot-panel");
  if (panel) panel.classList.toggle("is-ready", pending > 0);
  syncEliteDaily();
}

function heroStats() {
  return DUNGEON.heroStats(state.upgrades, avatarBuff(state.equippedAvatar), {
    cls: state.heroClass,
    gear: INVENTORY.gearBuffs(state.inventory),
  });
}

function ensureBattle() {
  if (!state.heroClass) return null;
  const dungeon = state.dungeon;
  const roomType = dungeon.types[dungeon.pos] || "monster";
  if (!MAP.isCombatRoom(roomType) || dungeon.cleared[dungeon.pos]) {
    state.battle = null;
    return null;
  }
  const stats = heroStats();
  const heroClass = state.heroClass || "warrior";
  const needsNew =
    !state.battle ||
    state.battle.status !== "ongoing" ||
    state.battle.floor !== dungeon.floor ||
    state.battle.roomType !== roomType;

  if (needsNew) {
    state.battle = BATTLE.createBattle({
      floor: dungeon.floor,
      roomType,
      mode: state.settings.difficulty,
      heroClass,
      stats,
      hp: Math.max(1, Math.min(stats.maxHp, dungeon.hp)),
      mana: Math.max(0, Math.min(stats.maxMana, state.mana)),
      rune: state.rune,
    });
  }

  const battle = state.battle;
  battle.maxHp = stats.maxHp;
  battle.maxMana = stats.maxMana;
  battle.range = CLASSES.classRange(heroClass);
  battle.heroDefense = stats.defense;
  battle.heroDodge = stats.dodge;
  battle.heroBlock = stats.block;
  return battle;
}

function isCombatActive() {
  const dungeon = state.dungeon;
  return MAP.isCombatRoom(dungeon.types[dungeon.pos] || "monster") && !dungeon.cleared[dungeon.pos];
}

function currentEnemy() {
  const battle = isCombatActive() ? ensureBattle() : null;
  return battle ? battle.enemy : null;
}

function setBattleLog(events) {
  const log = $('[data-dungeon="log"]');
  if (!log) return;
  const text = Array.isArray(events) ? events.filter(Boolean).join(" · ") : String(events || "");
  if (text) log.textContent = text;
}

function classStatChips(cls) {
  return [
    ["HP", cls.maxHp],
    ["ANG", cls.attack],
    ["DEF", cls.defense],
    ["KRI", `${Math.round(cls.crit * 100)}%`],
    ["AUS", `${Math.round(cls.dodge * 100)}%`],
    ["BLK", `${Math.round(cls.block * 100)}%`],
  ]
    .map(([label, value]) => `<span class="hero-detail__stat"><b>${value}</b>${label}</span>`)
    .join("");
}

function renderClassSelect() {
  const grid = $("#class-grid");
  if (!grid) return;
  if (!classPreview) classPreview = state.heroClass || CLASSES.CLASS_ORDER[0];
  grid.innerHTML = CLASSES.classList()
    .map(
      (cls) => `
      <button class="class-card${cls.id === classPreview ? " is-selected" : ""}" type="button" role="radio"
        aria-checked="${cls.id === classPreview}" aria-pressed="${cls.id === classPreview}" data-class-id="${cls.id}">
        <span class="class-card__portrait" aria-hidden="true">${cls.sprite}</span>
        <span class="class-card__name">${cls.name}</span>
      </button>`
    )
    .join("");

  const detail = $("#class-detail");
  const cls = CLASSES.getClass(classPreview);
  if (!detail || !cls) return;
  detail.innerHTML = `
    <div class="hero-detail__head">
      <span class="hero-detail__portrait" aria-hidden="true">${cls.sprite}</span>
      <div class="hero-detail__headings">
        <h4 class="hero-detail__name">${cls.name}</h4>
        <p class="hero-detail__tagline">${cls.tagline}</p>
      </div>
    </div>
    <p class="hero-detail__desc">${cls.desc}</p>
    <ul class="hero-detail__buffs">
      ${cls.buffs.map((buff) => `<li>${buff}</li>`).join("")}
    </ul>
    <div class="hero-detail__skill">
      <span class="hero-detail__skill-name">${cls.skill.name}</span>
      <span class="hero-detail__skill-desc">${cls.skill.desc}${cls.skill.cost ? ` · ${cls.skill.cost} MP` : ""}</span>
    </div>
    <div class="hero-detail__stats">${classStatChips(cls)}</div>
    <button class="btn btn--primary hero-detail__start" type="button" data-class-start="${cls.id}">
      Mit ${cls.name} starten
    </button>
  `;
}

function battleTokenStyle(x, y) {
  return `grid-column:${x + 1};grid-row:${y + 1};`;
}

function renderBattleLog(battle) {
  const log = $("#battle-log");
  if (!log) return;
  const lines = battle?.log?.length ? battle.log : ["Kein Kampf — erkunde die Etage."];
  log.innerHTML = lines
    .map(
      (line, index) =>
        `<p class="battle-log__line${index === lines.length - 1 ? " is-latest" : ""}"><span class="battle-log__prompt">&gt;</span> ${line}</p>`
    )
    .join("");
  log.scrollTop = log.scrollHeight;
}

function renderBattleGrid(battle) {
  const grid = $("#battle-grid");
  if (!grid || !battle) return;
  const tiles = [];
  for (let y = 0; y < battle.h; y += 1) {
    for (let x = 0; x < battle.w; x += 1) {
      const obstacle = BATTLE.isObstacle(battle, x, y);
      const walkable = BATTLE.canStep(battle, x, y);
      tiles.push(
        `<span class="battle-tile${obstacle ? " is-wall" : ""}${walkable ? " is-walkable" : ""}" data-battle-cell="${x},${y}" style="${battleTokenStyle(x, y)}"></span>`
      );
    }
  }
  const heroSprite = AVATARS[state.equippedAvatar]?.sprite || AVATARS.avatar_hero.sprite;
  tiles.push(
    `<span class="battle-token battle-token--hero" data-token="hero" style="${battleTokenStyle(battle.hero.x, battle.hero.y)}" aria-label="Held">${heroSprite}</span>`
  );
  if (battle.enemy.hp > 0) {
    tiles.push(
      `<span class="battle-token battle-token--enemy" id="dungeon-enemy-sprite" data-token="enemy" data-element="${battle.enemy.element}" data-elite="${battle.enemy.elite}" style="${battleTokenStyle(battle.enemy.x, battle.enemy.y)}" aria-label="${battle.enemy.name}">${battle.enemy.sprite}</span>`
    );
  }
  grid.innerHTML = tiles.join("");
  grid.style.setProperty("--grid-w", String(battle.w));
  grid.style.setProperty("--grid-h", String(battle.h));
}

function renderQuickBar() {
  const bar = $("#quick-bar");
  if (!bar) return;
  bar.innerHTML = Array.from({ length: INVENTORY.QUICK_SLOT_COUNT }, (_, index) => {
    const item = INVENTORY.quickItem(state.inventory, index);
    const label = item ? item.name : "leer";
    return `<button class="quick-slot${item ? " is-filled" : ""}" type="button" data-quick-index="${index}" aria-label="Schnellslot ${index + 1}: ${label}"${item ? "" : " disabled"} title="${label}">
      <span class="quick-slot__key">${index + 1}</span>
      <span class="quick-slot__name">${item ? item.name.split(" ")[0] : "—"}</span>
    </button>`;
  }).join("");
}

function renderDungeon() {
  renderClassSelect();
  const mode = state.settings.difficulty;
  const stats = heroStats();
  const dungeon = state.dungeon;
  const floor = dungeon.floor;
  const roomType = dungeon.types[dungeon.pos] || "start";
  const room = MAP.ROOM_TYPES[roomType] || MAP.ROOM_TYPES.start;
  const cleared = Boolean(dungeon.cleared[dungeon.pos]);
  const cls = CLASSES.getClass(state.heroClass);
  const combat = isCombatActive();

  const select = $("#class-select");
  if (select) select.hidden = Boolean(cls);
  const badge = $("#class-badge");
  if (badge) badge.hidden = !cls;
  const body = $("#dungeon-body");
  if (body) body.hidden = !cls;
  if (cls) {
    $$('[data-class="icon"]').forEach((el) => {
      el.innerHTML = cls.sprite;
    });
    $$('[data-class="name"]').forEach((el) => {
      el.textContent = cls.name;
    });
    $$('[data-class="passive"]').forEach((el) => {
      el.textContent = cls.passive;
    });
  }

  const mapEl = $("#dungeon-map");
  if (mapEl) {
    const tileMap = MAP.buildTileMap(dungeon);
    const heroTile = MAP.roomTile(dungeon);
    const heroSprite = CLASSES.classSprite(state.heroClass) || "";
    mapEl.style.setProperty("--map-dim", String(tileMap.dim));
    const tiles = tileMap.tiles.map((tile) => {
      const style = `grid-column:${tile.x + 1};grid-row:${tile.y + 1};`;
      if (tile.kind === "wall") {
        return `<span class="tile tile--wall${tile.seen ? " is-seen" : ""}" style="${style}" aria-hidden="true"></span>`;
      }
      if (tile.kind === "corridor") {
        const stateClass = tile.lit ? "is-lit" : tile.seen ? "is-seen" : "is-fog";
        return `<span class="tile tile--corridor ${stateClass}" style="${style}" aria-hidden="true"></span>`;
      }
      const meta = MAP.ROOM_TYPES[tile.roomType] || MAP.ROOM_TYPES.monster;
      const current = tile.index === dungeon.pos;
      const clearedRoom = dungeon.cleared[tile.index];
      const known = tile.seen;
      const label = current
        ? `Aktueller Raum: ${meta.name}`
        : known
          ? `${meta.name}${clearedRoom ? " (erledigt)" : ""}`
          : "Unbekannter Raum";
      const classes = [
        "tile",
        "tile--room",
        "map-cell",
        current ? "is-current" : "",
        known ? "is-visited" : "is-fog",
        clearedRoom ? "is-cleared" : "",
        tile.roomType === "boss" && known ? "is-boss" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="${classes}" type="button" data-map-index="${tile.index}" aria-label="${label}"${
        current ? ' aria-current="true"' : ""
      } style="${style}">
        <span class="tile__prop" aria-hidden="true">${known ? MAP.ROOM_SPRITES[tile.roomType] || "" : ""}</span>
        <span class="tile__fog" aria-hidden="true">${known ? "" : "?"}</span>
      </button>`;
    });
    tiles.push(
      `<span class="map-hero" style="grid-column:${heroTile.x + 1};grid-row:${heroTile.y + 1};" aria-label="Held auf der Karte">${heroSprite}</span>`
    );
    mapEl.innerHTML = tiles.join("");
  }

  const roomCard = $("#room-card");
  if (roomCard) roomCard.dataset.roomType = roomType;
  $$('[data-room="icon"]').forEach((el) => {
    el.textContent = room.icon;
  });
  $$('[data-room="name"]').forEach((el) => {
    el.textContent = combat
      ? currentEnemy()?.name || room.name
      : cleared && MAP.isCombatRoom(roomType)
        ? `${room.name} · gesäubert`
        : room.name;
  });
  $$('[data-room="desc"]').forEach((el) => {
    if (combat) {
      el.textContent = "Kampf läuft — bewege dich auf dem Feld, nutze Fernkampf oder Fertigkeiten.";
    } else if (cleared && roomType === "treasure") {
      el.textContent = "Die Truhe ist leer. Der Weg ist frei.";
    } else if (cleared && roomType === "trap") {
      el.textContent = "Die Falle ist entschärft. Weiter geht's.";
    } else if (cleared && roomType === "altar") {
      el.textContent = "Die Magie des Altars ist verklungen.";
    } else {
      el.textContent = room.desc;
    }
  });

  const actions = $("#room-actions");
  if (actions) {
    if (roomType === "merchant" && !cleared) {
      const factor = mode === "heroic" ? 1.75 : 1;
      const healCost = Math.round(30 * factor);
      const runeCost = Math.round(160 * factor);
      const locked = DUNGEON.RUNES.filter((rune) => !state.runes.includes(rune.id));
      const canHeal = state.dungeon.hp < stats.maxHp;
      actions.innerHTML = `
        <button class="btn btn--sm btn--ghost" type="button" data-room-action="heal" ${
          state.gold < healCost || !canHeal ? "disabled" : ""
        }>Heiltrank (${healCost} G)</button>
        <button class="btn btn--sm btn--ghost" type="button" data-room-action="rune" ${
          state.gold < runeCost || !locked.length ? "disabled" : ""
        }>Rune (${runeCost} G)</button>
      `;
    } else if (roomType === "altar" && cleared) {
      actions.innerHTML = `<span class="room-note">Altar erschöpft</span>`;
    } else if (MAP.isCombatRoom(roomType) && cleared) {
      actions.innerHTML = `<span class="room-note">Raum gesäubert</span>`;
    } else {
      actions.innerHTML = "";
    }
  }

  $$(".rune-btn").forEach((button) => {
    const id = button.dataset.rune;
    const unlocked = state.runes.includes(id);
    const active = state.rune === id;
    button.disabled = !unlocked;
    button.classList.toggle("is-locked", !unlocked);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      unlocked ? `Rune ${DUNGEON.ELEMENTS[id].name}${active ? " aktiv" : " wählen"}` : `Rune ${DUNGEON.ELEMENTS[id].name} gesperrt`
    );
    button.title = unlocked ? DUNGEON.ELEMENT_EFFECTS[id] : "Gesperrt — im Shop kaufen oder am Altar finden";
  });

  const battle = combat ? ensureBattle() : null;
  const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  Object.entries(dirs).forEach(([direction, [dx, dy]]) => {
    const button = $(`[data-move="${direction}"]`);
    if (!button) return;
    if (battle) {
      button.disabled = !BATTLE.canMove(battle, dx, dy);
    } else {
      button.disabled = !MAP.canMove(dungeon, direction);
    }
  });

  const attackButton = $("#dungeon-attack");
  if (attackButton) {
    attackButton.disabled = !battle || battle.status !== "ongoing";
    if (battle) {
      const melee = BATTLE.canAttack(battle, false);
      const ranged = BATTLE.canAttack(battle, true);
      attackButton.textContent = melee ? "Angriff (Nahkampf)" : ranged ? "Angriff (Fernkampf)" : "Angriff";
      attackButton.title = melee
        ? "Nahkampf auf dem angrenzenden Feld"
        : ranged
          ? "Distanzangriff mit deiner Klasse"
          : "Zu weit weg — bewege dich näher heran";
    } else {
      attackButton.textContent = "Angriff";
    }
  }

  const skillButton = $("#dungeon-skill");
  if (skillButton) {
    const skill = CLASSES.skillFor(state.heroClass || "warrior");
    const cooldown = battle ? battle.cooldowns[skill?.id] || 0 : 0;
    const affordable = battle ? battle.mana >= (skill?.cost || 0) : false;
    skillButton.disabled = !battle || cooldown > 0 || !affordable;
    skillButton.textContent = skill ? `${skill.name}${skill.cost ? ` (${skill.cost} MP)` : ""}` : "Fertigkeit";
    skillButton.title = skill ? skill.desc : "";
  }

  const fleeButton = $("#dungeon-flee");
  if (fleeButton) fleeButton.disabled = !battle;

  const arena = $("#dungeon-arena");
  if (arena) arena.hidden = !battle;

  if (battle) {
    renderBattleGrid(battle);
    renderBattleLog(battle);
    renderQuickBar();
    const enemy = battle.enemy;
    $$('[data-dungeon="enemy-name"]').forEach((el) => {
      el.textContent = enemy.name;
    });
    $$('[data-dungeon="enemy-attack"]').forEach((el) => {
      el.textContent = String(enemy.attack);
    });
    $$('[data-dungeon="enemy-dodge"]').forEach((el) => {
      el.textContent = `${Math.round(enemy.dodge * 100)}%`;
    });
    $$('[data-dungeon="enemy-element"]').forEach((el) => {
      el.textContent = DUNGEON.ELEMENTS[enemy.element].name;
    });
    $$('[data-dungeon="enemy-weakness"]').forEach((el) => {
      el.textContent = DUNGEON.ELEMENTS[enemy.weakness].name;
      el.style.color = DUNGEON.ELEMENTS[enemy.weakness].color;
    });
    const enemyDot = $('[data-dungeon="enemy-element-dot"]');
    if (enemyDot) enemyDot.style.setProperty("--element", DUNGEON.ELEMENTS[enemy.element].color);
    $$('[data-dungeon="enemy-hp"]').forEach((el) => {
      el.textContent = String(Math.max(0, enemy.hp));
    });
    $$('[data-dungeon="enemy-maxhp"]').forEach((el) => {
      el.textContent = String(enemy.maxHp);
    });
    const enemyFill = $('[data-dungeon="enemy-hp-fill"]');
    if (enemyFill) {
      enemyFill.style.width = `${enemy.maxHp > 0 ? (Math.max(0, enemy.hp) / enemy.maxHp) * 100 : 0}%`;
      const bar = enemyFill.closest(".mini-hp");
      if (bar) {
        bar.setAttribute("aria-valuenow", String(Math.max(0, enemy.hp)));
        bar.setAttribute("aria-valuemax", String(enemy.maxHp));
      }
    }
    $$('[data-dungeon="distance"]').forEach((el) => {
      el.textContent = String(BATTLE.battleDistance(battle));
    });
    $$('[data-dungeon="round"]').forEach((el) => {
      el.textContent = String(battle.round);
    });
    $$('[data-dungeon="turn"]').forEach((el) => {
      el.textContent = battle.status === "ongoing" ? "Dein Zug" : "Kampf beendet";
    });
    $$('[data-dungeon="mana"]').forEach((el) => {
      el.textContent = String(Math.max(0, Math.floor(battle.mana)));
    });
    $$('[data-dungeon="mana-max"]').forEach((el) => {
      el.textContent = String(battle.maxMana);
    });
    const log = $('[data-dungeon="log"]');
    if (log && battle.log.length) log.textContent = battle.log[battle.log.length - 1];
  }

  $$('[data-dungeon="floor"]').forEach((el) => {
    el.textContent = String(floor);
  });
  $$('[data-dungeon="map-size"]').forEach((el) => {
    el.textContent = `${dungeon.size}×${dungeon.size}`;
  });
  $$('[data-dungeon="attack"]').forEach((el) => {
    el.textContent = String(stats.attack);
  });
  $$('[data-dungeon="defense"]').forEach((el) => {
    el.textContent = String(stats.defense);
  });
  $$('[data-dungeon="crit"]').forEach((el) => {
    el.textContent = `${Math.round(stats.crit * 100)}%`;
  });
  $$('[data-dungeon="dodge"]').forEach((el) => {
    el.textContent = `${Math.round(stats.dodge * 100)}%`;
  });
  $$('[data-dungeon="hero-class-icon"]').forEach((el) => {
    el.innerHTML = cls ? cls.sprite : "";
  });
  $$('[data-dungeon="hero-name"]').forEach((el) => {
    el.textContent = cls ? cls.name : "Held";
  });
  const heroElement = state.rune ? DUNGEON.ELEMENTS[state.rune] : null;
  $$('[data-dungeon="hero-element"]').forEach((el) => {
    el.textContent = heroElement ? heroElement.name : "Keine Rune";
  });
  const heroDot = $('[data-dungeon="hero-element-dot"]');
  if (heroDot) heroDot.style.setProperty("--element", heroElement ? heroElement.color : "#5c6278");

  const heroHp = Math.max(0, Math.min(stats.maxHp, battle ? battle.hp : dungeon.hp));
  $$('[data-dungeon="hero-hp"]').forEach((el) => {
    el.textContent = String(heroHp);
  });
  $$('[data-dungeon="hero-maxhp"]').forEach((el) => {
    el.textContent = String(stats.maxHp);
  });
  const heroFill = $('[data-dungeon="hero-hp-fill"]');
  if (heroFill) {
    heroFill.style.width = `${stats.maxHp > 0 ? (heroHp / stats.maxHp) * 100 : 0}%`;
    const bar = heroFill.closest(".mini-hp");
    if (bar) {
      bar.setAttribute("aria-valuenow", String(heroHp));
      bar.setAttribute("aria-valuemax", String(stats.maxHp));
    }
  }
  $$('[data-dungeon="reward"]').forEach((el) => {
    el.textContent = String(battle ? battle.enemy.reward : 0);
  });
  $$('[data-dungeon="runes-owned"]').forEach((el) => {
    el.textContent = `${state.runes.length}/4 Runen`;
  });
  $$('[data-dungeon="items-found"]').forEach((el) => {
    el.textContent = String(state.itemsFound);
  });

  const panel = $("#dungeon-panel");
  if (panel) panel.classList.toggle("is-boss", Boolean(battle && battle.enemy.boss));

  const status = $('[data-dungeon="status"]');
  if (status) {
    if (!cls) {
      status.textContent = "Wähle zuerst deine Klasse — jede kämpft mit eigenen Fertigkeiten.";
    } else if (battle) {
      status.textContent = `Kampf gegen ${battle.enemy.name} · Distanz ${BATTLE.battleDistance(battle)} · Runde ${battle.round}`;
    } else if (roomType === "merchant") {
      status.textContent = "Händler-Raum: Kaufe Heilung oder schalte eine Rune frei.";
    } else if (cleared) {
      status.textContent = `${room.name} erledigt. Bewege dich weiter.`;
    } else {
      status.textContent = `Etage ${floor}: ${room.desc}`;
    }
  }

  syncEliteDaily();
}

function itemCard(item) {
  const meta = ITEMS.RARITIES[item.rarity] || ITEMS.RARITIES.common;
  const line = ITEMS.statLine(item.stats);
  const equippedSlot = item.slot && state.inventory.equipped[item.slot] === item.id;
  const current = item.slot ? INVENTORY.equippedItem(state.inventory, item.slot) : null;
  const compare =
    item.type === "equipment" && !equippedSlot
      ? `<p class="item-card__compare">${ITEMS.compareText(item, current)}</p>`
      : "";
  const upgradeCost = ITEMS.upgradeCost(item);
  const actions = [];
  if (item.type === "equipment") {
    actions.push(
      equippedSlot
        ? `<button class="btn btn--sm" type="button" data-inv-action="unequip" data-inv-id="${item.id}">Ablegen</button>`
        : `<button class="btn btn--sm btn--equip" type="button" data-inv-action="equip" data-inv-id="${item.id}">Ausrüsten</button>`
    );
    actions.push(
      `<button class="btn btn--sm btn--buy" type="button" data-inv-action="upgrade" data-inv-id="${item.id}" ${
        state.gold < upgradeCost ? "disabled" : ""
      }>Upgrade ${upgradeCost} G</button>`
    );
    actions.push(
      `<button class="btn btn--sm btn--ghost" type="button" data-inv-action="scrollupgrade" data-inv-id="${item.id}">Schriftrolle</button>`
    );
  } else {
    const quickIndex = state.inventory.quick.indexOf(item.id);
    actions.push(
      quickIndex >= 0
        ? `<button class="btn btn--sm btn--equip" type="button" data-inv-action="quick-remove" data-inv-id="${item.id}">Aus Slot ${quickIndex + 1}</button>`
        : `<button class="btn btn--sm btn--equip" type="button" data-inv-action="quick" data-inv-id="${item.id}">Schnellslot</button>`
    );
  }
  actions.push(
    `<button class="btn btn--sm btn--danger" type="button" data-inv-action="sell" data-inv-id="${item.id}">Verkaufen (${ITEMS.sellValue(item)} G)</button>`
  );

  return `
    <article class="item-card${equippedSlot ? " is-equipped" : ""}" style="--rarity:${meta.color}">
      <div class="item-card__head">
        <span class="item-card__rarity">${meta.name}</span>
        <span class="item-card__level">${item.type === "equipment" ? `Stufe ${item.level || 0}` : "Verbrauch"}</span>
      </div>
      <h4 class="item-card__name">${item.name}</h4>
      <p class="item-card__stats">${line || item.desc}</p>
      ${compare}
      <div class="item-card__actions">${actions.join("")}</div>
    </article>
  `;
}

const BAG_SLOTS = 28;

function bagTile({ item, count }) {
  const rarity = ITEMS.RARITIES[item.rarity] || ITEMS.RARITIES.common;
  const corner = item.type === "equipment" ? (item.level ? `+${item.level}` : "") : count > 1 ? `x${count}` : "";
  return `
    <button class="item-tile${item.id === inspectorItemId ? " is-selected" : ""}" type="button"
      draggable="true" data-inv-id="${item.id}" data-item-type="${item.type}" data-count="${count}"
      style="--rarity:${rarity.color}"
      title="${item.name}${count > 1 ? ` ×${count}` : ""}"
      aria-label="${item.name}${count > 1 ? ` ×${count}` : ""} · ${rarity.name}${item.type === "equipment" ? ` · Stufe ${item.level || 0}` : ""}">
      <span class="item-tile__icon" aria-hidden="true">${ITEMS.itemIcon(item)}</span>
      ${corner ? `<span class="item-tile__corner">${corner}</span>` : ""}
    </button>`;
}

function renderPaperdoll() {
  const doll = $("#paperdoll");
  if (!doll) return;
  doll.innerHTML = INVENTORY.SLOT_ORDER.map((slot) => {
    const meta = INVENTORY.SLOT_META[slot];
    const item = INVENTORY.equippedItem(state.inventory, slot);
    const rarity = item ? ITEMS.RARITIES[item.rarity] || ITEMS.RARITIES.common : null;
    const filled = Boolean(item);
    const selected = filled && item.id === inspectorItemId;
    return `
      <div class="paperdoll-slot${filled ? " is-filled" : ""}${selected ? " is-selected" : ""}"
        data-slot="${slot}" data-drop-slot="${slot}" style="--rarity:${rarity ? rarity.color : "#363c4d"}"
        ${filled ? `data-inv-action="inspect" data-inv-id="${item.id}" role="button" tabindex="0"` : ""}
        title="${meta.label}: ${filled ? `${item.name} · ${ITEMS.statLine(item.stats)}` : "leer"}"
        aria-label="${meta.label}: ${filled ? item.name : "leer"}">
        <span class="paperdoll-slot__icon" aria-hidden="true">${filled ? ITEMS.itemIcon(item) : meta.icon}</span>
        <span class="paperdoll-slot__label">${filled ? item.name : meta.short || meta.label}</span>
        <span class="paperdoll-slot__item">${filled ? `+${item.level || 0}` : "leer"}</span>
        <span class="paperdoll-slot__stats">${filled ? ITEMS.statLine(item.stats) : meta.hint}</span>
      </div>
    `;
  }).join("");
}

function renderQuickSlotsInventory() {
  const wrap = $("#inventory-quick");
  if (!wrap) return;
  wrap.innerHTML = Array.from({ length: INVENTORY.QUICK_SLOT_COUNT }, (_, index) => {
    const item = INVENTORY.quickItem(state.inventory, index);
    const rarity = item ? ITEMS.RARITIES[item.rarity] || ITEMS.RARITIES.common : null;
    const selected = item && item.id === inspectorItemId;
    return `
      <button class="quick-slot-card${item ? " is-filled" : ""}${selected ? " is-selected" : ""}" type="button"
        data-drop-slot="quick:${index}" style="--rarity:${rarity ? rarity.color : "#363c4d"}"
        ${item ? `data-inv-action="inspect" data-inv-id="${item.id}"` : 'aria-disabled="true"'}
        aria-label="Schnellslot ${index + 1}: ${item ? item.name : "leer"}">
        <span class="quick-slot-card__key">${index + 1}</span>
        <span class="quick-slot-card__icon" aria-hidden="true">${item ? ITEMS.itemIcon(item) : INVENTORY.QUICK_ICON}</span>
        <span class="quick-slot-card__name">${item ? item.name.split(" ")[0] : "leer"}</span>
      </button>
    `;
  }).join("");
}

function renderItemInspector() {
  const box = $("#item-inspector");
  if (!box) return;
  const item = inspectorItemId ? INVENTORY.findItem(state.inventory, inspectorItemId) : null;
  if (!item) {
    inspectorItemId = null;
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = itemCard(item);
}

function renderInventory() {
  const panel = $("#inventory-panel");
  if (!panel) return;
  renderPaperdoll();
  renderQuickSlotsInventory();

  const stats = heroStats();
  const summary = INVENTORY.inventorySummary(state.inventory);
  $$('[data-inventory="score"]').forEach((el) => {
    el.textContent = `Ausrüstung ${summary.score}`;
  });

  const bag = $("#inventory-bag");
  const bagItems = INVENTORY.bagItems(state.inventory);
  const stacks = INVENTORY.bagStacks(state.inventory);
  $$('[data-inventory="bag-count"]').forEach((el) => {
    el.textContent = String(bagItems.length);
  });
  if (bag) {
    const tiles = stacks.map(bagTile);
    while (tiles.length < BAG_SLOTS) {
      tiles.push(`<span class="item-tile item-tile--empty" aria-hidden="true"></span>`);
    }
    bag.innerHTML = stacks.length
      ? tiles.join("")
      : `<p class="bag-empty">Leer — besiege Monster im Verlies. Je tiefer die Etage, desto besser die Beute.</p>${tiles.join("")}`;
  }

  const statsEl = $("#inventory-stats");
  if (statsEl) {
    const rows = [
      ["ANG", stats.attack],
      ["DEF", stats.defense],
      ["HP", stats.maxHp],
      ["KRI", `${Math.round(stats.crit * 100)}%`],
      ["AUS", `${Math.round(stats.dodge * 100)}%`],
      ["BLK", `${Math.round(stats.block * 100)}%`],
      ["MAG", `${Math.round(stats.spellPower * 100)}%`],
      ["GLÜCK", `${Math.round((stats.luck || 0) * 100)}%`],
      ["Items", state.itemsFound],
      ["Episch", state.epicFound],
      ["Legendär", state.legendaryFound],
    ];
    statsEl.innerHTML = rows
      .map(([label, value]) => `<span class="inventory-stat"><b>${value}</b>${label}</span>`)
      .join("");
  }

  renderItemInspector();
}

function inventoryAction(action, id) {
  const item = INVENTORY.findItem(state.inventory, id);
  if (!item) return;

  if (action === "inspect") {
    inspectorItemId = item.id;
    renderInventory();
    return;
  }

  if (action === "equip") {
    const previousItem = item.slot ? INVENTORY.equippedItem(state.inventory, item.slot) : null;
    const result = INVENTORY.equipItem(state.inventory, id);
    if (!result.ok) {
      audio.playError();
      toast("Dieses Item passt nicht in den Slot.", "magenta");
      return;
    }
    state.dungeon.hp = Math.min(heroStats().maxHp, Math.max(1, state.dungeon.hp));
    audio.playCoin();
    haptic(8);
    toast(
      result.previous
        ? `${item.name} ausgerüstet · ${ITEMS.compareText(item, previousItem)}`
        : `${item.name} ausgerüstet.`,
      "green"
    );
  } else if (action === "unequip") {
    const result = INVENTORY.unequipItem(state.inventory, item.slot);
    if (!result.ok) return;
    audio.playDelete();
    toast(`${item.name} abgelegt.`, "gold");
  } else if (action === "upgrade") {
    const cost = ITEMS.upgradeCost(item);
    if (state.gold < cost) {
      audio.playError();
      toast("Nicht genug Gold für das Upgrade.", "magenta");
      return;
    }
    const result = INVENTORY.upgradeItem(state.inventory, id, { gold: state.gold });
    if (!result.ok) {
      audio.playError();
      return;
    }
    state.gold -= result.cost;
    updateGold();
    audio.playLevelUp();
    haptic([10, 25]);
    toast(`${item.name} auf Stufe ${result.level} · −${result.cost} Gold`, "green");
  } else if (action === "scrollupgrade") {
    const scroll = state.inventory.items.find((entry) => entry.effect === "upgrade");
    if (!scroll) {
      audio.playError();
      toast("Keine Schriftrolle der Veredelung im Beutel — im Shop kaufen.", "magenta");
      return;
    }
    const result = INVENTORY.upgradeItem(state.inventory, id, { useScroll: true });
    if (!result.ok) {
      audio.playError();
      return;
    }
    INVENTORY.consumeItemById(state.inventory, scroll.id);
    audio.playLevelUp();
    toast(`${item.name} mit Schriftrolle auf Stufe ${result.level} veredelt.`, "green");
  } else if (action === "sell") {
    const result = INVENTORY.sellItem(state.inventory, id);
    inspectorItemId = null;
    if (!result.ok) {
      audio.playError();
      toast("Ausgerüstete Items zuerst ablegen.", "magenta");
      return;
    }
    state.gold += result.gold;
    state.goldEarned += result.gold;
    updateGold();
    audio.playCoin();
    toast(`${result.item.name} verkauft: +${result.gold} Gold`, "gold");
  } else if (action === "quick") {
    const free = state.inventory.quick.findIndex((entry) => !entry);
    if (free < 0) {
      audio.playError();
      toast("Alle Schnellslots belegt.", "magenta");
      return;
    }
    const result = INVENTORY.assignQuickSlot(state.inventory, id, free);
    if (!result.ok) {
      audio.playError();
      toast("Nur Tränke und Schriftrollen passen in die Schnellslots.", "magenta");
      return;
    }
    audio.playCoin();
    toast(`${item.name} in Schnellslot ${free + 1} gelegt.`, "green");
  } else if (action === "quick-remove") {
    const index = state.inventory.quick.indexOf(id);
    if (index >= 0) state.inventory.quick[index] = null;
    toast(`${item.name} aus dem Schnellslot genommen.`, "gold");
  }

  persist();
  render();
}

function renderSettings() {
  const completed = state.quests.filter((quest) => quest.done).length;
  const values = {
    completed,
    floor: state.deepestFloor,
    gold: state.gold,
    level: state.level,
    loot: state.totalLoot,
    monsters: state.monstersSlain,
    bestStreak: state.bestStreak,
    bossLevel: state.boss.level,
    runes: state.runes.length,
    items: state.itemsFound,
    epic: state.epicFound,
    legendary: state.legendaryFound,
    heroClass: CLASSES.getClass(state.heroClass)?.name || "—",
  };
  Object.entries(values).forEach(([key, value]) => {
    $$(`[data-settings="${key}"]`).forEach((el) => {
      el.textContent = String(value);
    });
  });

  $$(".mode-btn").forEach((button) => {
    const active = button.dataset.mode === state.settings.difficulty;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

/* -------------------------------------------------------------------------
   Shop
   ------------------------------------------------------------------------- */

function upgradeCard(upgrade) {
  const level = state.upgrades[upgrade.id] || 0;
  const mode = state.settings.difficulty;
  const cost = DUNGEON.upgradeCost(upgrade, level, mode);
  const growth = mode === "heroic" ? "1,75×" : "1,55×";
  return `
    <article class="shop-card shop-card--upgrade" style="--card-accent:#4eef91">
      <div class="shop-card__preview">${upgrade.icon}</div>
      <div class="shop-card__topline">
        <span class="shop-card__type">Ausrüstung</span>
        <span class="shop-card__level">Stufe ${level}</span>
      </div>
      <h3 class="shop-card__name">${upgrade.name}</h3>
      <p class="shop-card__desc">${upgrade.desc}</p>
      <span class="shop-card__growth">Stufe ${level + 1} · Preis ×${growth}</span>
      <div class="shop-card__meta">
        <span class="shop-card__price">${COIN_SVG}<span>${cost}</span></span>
        <button class="btn btn--sm btn--equip" type="button" data-upgrade-id="${upgrade.id}" aria-label="${upgrade.name} auf Stufe ${level + 1} bringen für ${cost} Gold">Upgrade</button>
      </div>
    </article>
  `;
}

function runeCard(item) {
  const unlocked = state.runes.includes(item.rune);
  const active = state.rune === item.rune;
  const cost = itemPrice(item, state.settings.difficulty);
  let action;
  if (active) {
    action = `<button class="btn btn--sm" type="button" disabled>Aktiv</button>`;
  } else if (unlocked) {
    action = `<button class="btn btn--sm btn--equip" type="button" data-equip-rune="${item.rune}">Aktivieren</button>`;
  } else {
    action = `<button class="btn btn--sm btn--buy" type="button" data-unlock-rune="${item.rune}">Freischalten</button>`;
  }
  const price = unlocked
    ? '<span class="shop-card__price is-owned">Freigeschaltet</span>'
    : `<span class="shop-card__price">${COIN_SVG}<span>${cost}</span></span>`;

  return `
    <article class="shop-card shop-card--rune${active ? " is-equipped" : ""}" style="--card-accent:${item.accent}">
      <div class="shop-card__preview">${item.icon}</div>
      <div class="shop-card__topline">
        <span class="shop-card__type">Rune</span>
        <span class="shop-card__stock">${unlocked ? "Freigeschaltet" : "Gesperrt"}</span>
      </div>
      <h3 class="shop-card__name">${item.name}</h3>
      <p class="shop-card__desc">${item.desc}</p>
      <span class="shop-card__growth">${item.buffText}</span>
      <div class="shop-card__meta">
        ${price}
        ${action}
      </div>
    </article>
  `;
}

function shopCard(item) {
  const owned = item.type === "cosmetic" && state.owned.includes(item.id);
  const equipped = item.type === "cosmetic" && state.equippedAvatar === item.id;
  const stockMap = {
    xp: state.boosterXp,
    gold: state.boosterGold,
    loot: state.boosterLoot,
    boss: state.boosterBoss,
    luck: state.boosterLuck,
    mana: state.boosterMana,
  };
  const scrollCount = state.inventory.items.filter(
    (entry) => entry.templateId === item.consumableId
  ).length;
  const stock = item.type === "booster" ? stockMap[item.resource] ?? 0 : item.type === "scroll" ? scrollCount : null;
  const preview = item.sprite || item.icon || COIN_SVG;
  const typeLabel = { cosmetic: "Skin", booster: "Elixier", scroll: "Schriftrolle", reward: "Belohnung" }[item.type] || item.type;
  const priceValue = itemPrice(item, state.settings.difficulty);

  let action;
  if (item.type === "cosmetic" && equipped) {
    action = `<button class="btn btn--sm" type="button" data-item-id="${item.id}" disabled>Ausrüsten</button>`;
  } else if (item.type === "cosmetic" && owned) {
    action = `<button class="btn btn--sm btn--equip" type="button" data-shop-action="equip" data-item-id="${item.id}">Ausrüsten</button>`;
  } else if (item.type === "cosmetic") {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Kaufen</button>`;
  } else if (item.type === "booster" || item.type === "scroll") {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Kaufen</button>`;
  } else {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Einlösen</button>`;
  }

  const price = owned
    ? '<span class="shop-card__price is-owned">Im Besitz</span>'
    : `<span class="shop-card__price">${COIN_SVG}<span>${priceValue}</span></span>`;
  const stockLine = stock === null ? "" : `<span class="shop-card__stock">Im Inventar: ${stock}</span>`;
  const buffLine = item.buffText ? `<span class="shop-card__buff">${item.buffText}</span>` : "";

  return `
    <article class="shop-card${equipped ? " is-equipped" : ""}" style="--card-accent:${item.accent}">
      <div class="shop-card__preview">${preview}</div>
      <div class="shop-card__topline">
        <span class="shop-card__type">${typeLabel}</span>
        ${stockLine}
      </div>
      <h3 class="shop-card__name">${item.name}</h3>
      <p class="shop-card__desc">${item.desc}</p>
      ${buffLine}
      <div class="shop-card__meta">
        ${price}
        ${action}
      </div>
    </article>
  `;
}

function renderShopMeta() {
  const meta = $("#shop-meta");
  if (!meta) return;
  if (activeShopTab === "equipment") {
    const stats = heroStats();
    meta.innerHTML = `
      <span class="stock-chip stock-chip--gold">${state.settings.difficulty === "heroic" ? "HEROIC ×1,75" : "CASUAL"}</span>
      <span class="stock-chip">ANG ${stats.attack}</span>
      <span class="stock-chip">DEF ${stats.defense}</span>
      <span class="stock-chip">HP ${stats.maxHp}</span>
      <span class="stock-chip">KRI ${Math.round(stats.crit * 100)}%</span>
      <span class="stock-chip">AUS ${Math.round(stats.dodge * 100)}%</span>
      <span class="stock-chip">${state.runes.length}/4 Runen</span>
    `;
  } else if (activeShopTab === "booster") {
    const chips = [];
    if (state.boosterXp > 0) chips.push(`<span class="stock-chip">XP-Elexier ×1.5 · ${state.boosterXp}</span>`);
    if (state.boosterGold > 0) chips.push(`<span class="stock-chip stock-chip--gold">Gold-Elexier ×1.5 · ${state.boosterGold}</span>`);
    if (state.boosterLoot > 0) chips.push(`<span class="stock-chip">Loot-Magnet ×1.5 · ${state.boosterLoot}</span>`);
    if (state.boosterBoss > 0) chips.push(`<span class="stock-chip">Boss-Trank ×1.5 · ${state.boosterBoss}</span>`);
    meta.innerHTML = chips.length ? chips.join("") : '<span class="stock-chip">Keine Elixiere aktiv</span>';
  } else if (activeShopTab === "cosmetic") {
    const avatar = AVATARS[state.equippedAvatar] || AVATARS.avatar_hero;
    meta.innerHTML = `<span class="stock-chip">Ausgerüstet: ${avatar.name}</span><span class="stock-chip stock-chip--gold">${state.owned.length} Skins im Besitz</span>`;
  } else if (activeShopTab === "scroll") {
    const scrolls = state.inventory.items.filter((entry) => entry.type === "scroll").length;
    meta.innerHTML = `<span class="stock-chip stock-chip--gold">Schriftrollen im Beutel: ${scrolls}</span><span class="stock-chip">Veredelung hebt gelootete Ausrüstung</span>`;
  } else {
    meta.innerHTML = '<span class="stock-chip stock-chip--gold">Belohnungen sind wiederholbar</span>';
  }
}

function renderShop() {
  const grid = $("#shop-grid");
  if (!grid) return;

  if (activeShopTab === "equipment") {
    grid.innerHTML = [...DUNGEON.UPGRADES.map(upgradeCard), ...RUNE_ITEMS.map(runeCard)].join("");
  } else {
    const items = SHOP_ITEMS.filter((item) => item.type === activeShopTab);
    grid.innerHTML = items.map(shopCard).join("");
  }

  $$(".shop-tab").forEach((tab) => {
    const active = tab.dataset.shopTab === activeShopTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  });

  renderShopMeta();
}

function setShopCategory(category) {
  if (category && SHOP_CATEGORIES.includes(category)) activeShopTab = category;
  renderShop();
}

function purchaseUpgrade(upgrade) {
  if (!upgrade) return;
  const mode = state.settings.difficulty;
  const level = state.upgrades[upgrade.id] || 0;
  const cost = DUNGEON.upgradeCost(upgrade, level, mode);
  if (state.gold < cost) {
    audio.playError();
    toast(`Nicht genug Gold. Benötigt: ${cost}.`, "magenta");
    return;
  }

  const before = heroStats();
  state.gold -= cost;
  state.upgrades[upgrade.id] = level + 1;
  const after = heroStats();
  state.dungeon.hp = Math.min(after.maxHp, state.dungeon.hp + Math.max(0, after.maxHp - before.maxHp));

  persist();
  updateGold();
  renderDungeon();
  renderSettings();
  renderShop();
  pulseWallet();
  audio.playCoin();
  toast(`${upgrade.name} Stufe ${level + 1} · -${cost} Gold`, "green");
  document.querySelector(`#shop-grid [data-upgrade-id="${upgrade.id}"]`)?.focus();
}

function initShop() {
  $$(".shop-tab").forEach((tab) => {
    tab.addEventListener("click", () => setShopCategory(tab.dataset.shopTab));
  });

  $$("[data-shop-category]").forEach((button) => {
    button.addEventListener("click", () => setShopCategory(button.dataset.shopCategory));
  });

  $("#btn-shop")?.addEventListener("click", () => setTab("shop"));
  $("#btn-avatar")?.addEventListener("click", () => {
    activeShopTab = "cosmetic";
    setTab("shop");
  });

  $("#shop-grid")?.addEventListener("click", (event) => {
    const upgradeButton = event.target.closest("[data-upgrade-id]");
    if (upgradeButton) {
      const upgrade = DUNGEON.UPGRADES.find((entry) => entry.id === upgradeButton.dataset.upgradeId);
      purchaseUpgrade(upgrade);
      return;
    }

    const unlockRuneButton = event.target.closest("[data-unlock-rune]");
    if (unlockRuneButton) {
      const rune = RUNE_ITEMS.find((entry) => entry.rune === unlockRuneButton.dataset.unlockRune);
      const result = buyRune(state, rune, state.settings.difficulty);
      if (!result.ok) {
        audio.playError();
        toast(result.reason === "gold" ? "Nicht genug Gold für diese Rune." : "Rune nicht verfügbar.", "magenta");
        return;
      }
      persist();
      updateGold();
      renderDungeon();
      renderShop();
      pulseWallet();
      audio.playLevelUp();
      toast(result.message, "green");
      return;
    }

    const equipRuneButton = event.target.closest("[data-equip-rune]");
    if (equipRuneButton) {
      const rune = RUNE_ITEMS.find((entry) => entry.rune === equipRuneButton.dataset.equipRune);
      const result = equipRune(state, rune);
      if (!result.ok) {
        audio.playError();
        return;
      }
      persist();
      renderDungeon();
      renderShop();
      audio.playCoin();
      toast(result.message, "green");
      return;
    }

    const button = event.target.closest("[data-shop-action]");
    if (!button) return;
    const item = SHOP_ITEMS.find((entry) => entry.id === button.dataset.itemId);
    if (!item) return;

    if (button.dataset.shopAction === "equip") {
      const result = equipAvatar(state, item);
      if (!result.ok) {
        audio.playError();
        return;
      }
      const stats = heroStats();
      state.dungeon.hp = Math.min(stats.maxHp, Math.max(1, state.dungeon.hp));
      persist();
      updateAvatar();
      renderDungeon();
      renderSettings();
      renderShop();
      document.querySelector(`#shop-grid [data-item-id="${item.id}"]:not([disabled])`)?.focus();
      audio.playCoin();
      toast(result.message, "green");
      return;
    }

    const result = buyItem(state, item, state.settings.difficulty, {
      createConsumable: (id) => ITEMS.createConsumable(id),
    });
    if (!result.ok) {
      audio.playError();
      toast(result.reason === "gold" ? "Nicht genug Gold. Erledige mehr Quests!" : "Kauf nicht möglich.", "magenta");
      return;
    }
    if (result.consumable) {
      INVENTORY.addItem(state.inventory, result.consumable);
      state.itemsFound += 1;
    }
    if (item.id === "booster_mana") {
      for (let i = 0; i < 3; i += 1) {
        INVENTORY.addItem(state.inventory, ITEMS.createConsumable("potion_mana"));
      }
      state.itemsFound += 3;
    }

    persist();
    updateGold();
    updateAvatar();
    updateBoosters();
    syncDifficulty();
    renderSettings();
    renderDungeon();
    renderShop();
    document.querySelector(`#shop-grid [data-item-id="${item.id}"]:not([disabled])`)?.focus();
    pulseWallet();
    audio.playCoin();
    toast(result.message, item.type === "reward" ? "gold" : "green");
  });
}

/* -------------------------------------------------------------------------
   Boss feedback / level up
   ------------------------------------------------------------------------- */

function playBossHit(damage, defeated = false) {
  const panel = $("#boss-panel");
  if (!panel) return;
  const float = $('[data-boss="damage"]', panel);
  if (float) float.textContent = `-${damage} HP`;
  panel.classList.remove("is-hit");
  void panel.offsetWidth;
  panel.classList.add("is-hit");
  setTimeout(() => panel.classList.remove("is-hit"), 850);
  if (defeated) {
    panel.classList.add("is-defeated");
    setTimeout(() => panel.classList.remove("is-defeated"), 1500);
  }
}

function showBossDefeat(result) {
  const panel = $("#boss-panel");
  if (!panel) return;
  $$('[data-boss="name"]').forEach((el) => {
    el.textContent = result.defeatedName;
  });
  $$('[data-boss="level"]').forEach((el) => {
    el.textContent = String(result.defeatedLevel);
  });
  setBossHpDisplay(0, result.defeatedMaxHp);
  panel.classList.remove("is-critical");
  playBossHit(result.damage, true);
  pulseWallet();
  toast(`Boss besiegt! +${result.goldReward} Gold · Nächster Raid: LV ${result.nextLevel}`, "magenta");
  setTimeout(() => {
    panel.classList.remove("is-defeated");
    renderBoss();
  }, 1450);
}

function showLevelUp(level) {
  const banner = $("#levelup-banner");
  if (!banner) return;

  clearTimeout(levelUpTimer);
  clearTimeout(levelUpHideTimer);
  banner.hidden = false;
  const levelEl = $("[data-levelup-level]", banner);
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
}

/* -------------------------------------------------------------------------
   Dungeon actions
   ------------------------------------------------------------------------- */

function flashDungeon(result) {
  const panel = $("#dungeon-panel");
  if (!panel) return;
  const float = $('[data-dungeon="damage"]', panel);
  if (float) {
    float.textContent = result.dodged ? "MISS" : result.damage > 0 ? `-${result.damage}` : "0";
  }
  panel.classList.remove("is-attacking", "is-crit");
  void panel.offsetWidth;
  panel.classList.add("is-attacking");
  if (result.crit) panel.classList.add("is-crit");
  setTimeout(() => panel.classList.remove("is-attacking", "is-crit"), 520);
}

function describeCombat(result) {
  const bits = [];
  if (result.burnDamage) bits.push(`Brand −${result.burnDamage}`);
  if (result.dodged) bits.push("Gegner weicht aus!");
  else bits.push(`${result.crit ? "KRITISCH! " : ""}${result.damage} Schaden`);
  if (result.multiplier > 1) bits.push("Elementar-Schwäche ×1,5");
  if (result.multiplier < 1) bits.push("Elementar-Widerstand ×0,7");
  if (result.type === "hit") {
    if (result.blocked) bits.push("Block! halber Konter");
    if (result.enemyCrit) bits.push("Gegner-Krit");
    bits.push(`Konter −${result.counter} HP`);
  }
  if (Array.isArray(result.effects) && result.effects.length) bits.push(result.effects.join(" · "));
  if (result.type === "down") bits.push("Niedergeschlagen — zurück zum Eingang");
  return bits.join(" · ");
}

function lootBonus(base) {
  if (!(base > 0) || state.boosterLoot <= 0) return 0;
  const bonus = Math.round(base * 0.5);
  state.gold += bonus;
  state.boosterLoot = Math.max(0, state.boosterLoot - 1);
  return bonus;
}

function respawnDungeon() {
  const stats = heroStats();
  state.dungeon.hp = stats.maxHp;
  state.dungeon.pos = 0;
  state.dungeon.visited[0] = true;
  state.battle = null;
}

function enterRoom() {
  const dungeon = state.dungeon;
  const type = dungeon.types[dungeon.pos];
  if (dungeon.cleared[dungeon.pos]) return;
  const stats = heroStats();
  const floor = dungeon.floor;
  const factor = state.settings.difficulty === "heroic" ? 1.6 : 1;

  if (type === "treasure") {
    const gold = Math.round((20 + floor * 8) * factor * stats.goldFind);
    state.gold += gold;
    const bonus = lootBonus(gold);
    state.goldEarned += gold + bonus;
    dungeon.cleared[dungeon.pos] = true;
    audio.playCoin();
    toast(`Schatzkammer geplündert: +${gold + bonus} Gold`, "gold");
  } else if (type === "trap") {
    const damage = Math.round(stats.maxHp * 0.12 + floor * 2);
    dungeon.hp = Math.max(0, dungeon.hp - damage);
    dungeon.cleared[dungeon.pos] = true;
    audio.playHit();
    haptic([8, 30, 8]);
    toast(`Falle! −${damage} HP`, "magenta");
    if (dungeon.hp <= 0) {
      respawnDungeon();
      toast("Falle erwischt — zurück zum Eingang, HP aufgefüllt.", "magenta");
    }
  } else if (type === "altar") {
    const locked = DUNGEON.RUNES.filter((rune) => !state.runes.includes(rune.id));
    dungeon.cleared[dungeon.pos] = true;
    if (locked.length) {
      const rune = locked[Math.floor(Math.random() * locked.length)];
      state.runes.push(rune.id);
      if (!state.rune) state.rune = rune.id;
      audio.playLevelUp();
      toast(`Magie-Altar: Rune ${rune.name} freigeschaltet!`, "green");
    } else {
      const gold = 40 + floor * 5;
      state.gold += gold;
      state.goldEarned += gold;
      dungeon.hp = stats.maxHp;
      audio.playCoin();
      toast(`Alle Runen bekannt — Altar schenkt ${gold} Gold und volle HP.`, "gold");
    }
  } else if (type === "monster" || type === "boss") {
    state.battle = null;
    audio.playHit();
    toast(type === "boss" ? "Boss-Raum betreten — Kampf beginnt!" : "Monster-Raum betreten!", "magenta");
  } else if (type === "merchant") {
    audio.playCoin();
    toast("Händler-Raum: Tränke und Runen im Angebot.", "gold");
  }
}

function afterBattleTurn(events = []) {
  const battle = state.battle;
  if (!battle) return;
  if (battle.status === "won") {
    handleBattleVictory(events);
    return;
  }
  if (battle.status === "lost") {
    handleBattleDefeat(events);
    return;
  }
  state.dungeon.hp = Math.max(1, battle.hp);
  state.mana = Math.max(0, Math.floor(battle.mana));
  persist();
  setBattleLog(events);
  renderDungeon();
  renderSettings();
}

function lootTone(rarity) {
  return rarity === "legendary" ? "gold" : rarity === "epic" ? "magenta" : rarity === "rare" ? "green" : "gold";
}

function handleBattleVictory(events = []) {
  const battle = state.battle;
  const enemy = battle.enemy;
  const dungeon = state.dungeon;
  const stats = heroStats();

  dungeon.cleared[dungeon.pos] = true;
  dungeon.hp = Math.min(stats.maxHp, Math.max(1, battle.hp));
  state.monstersSlain += 1;
  state.mana = Math.min(stats.maxMana, Math.floor(battle.mana));

  let luck = stats.luck || 0;
  if (state.boosterLuck > 0) {
    luck += 1;
    state.boosterLuck = Math.max(0, state.boosterLuck - 1);
  }
  const drop = ITEMS.rollDrop({
    floor: dungeon.floor,
    elite: enemy.elite,
    boss: enemy.boss,
    luck,
  });
  let gold = enemy.reward + drop.gold;
  const today = new Date().toDateString();
  if (enemy.elite && state.lastEliteBonusDate !== today) {
    const dailyBonus = DUNGEON.eliteDailyBonus(state.settings.difficulty);
    gold += dailyBonus;
    state.lastEliteBonusDate = today;
  }
  state.gold += gold;
  state.goldEarned += gold;

  drop.items.forEach((item) => {
    INVENTORY.addItem(state.inventory, item);
    state.itemsFound += 1;
    if (item.rarity === "epic") state.epicFound += 1;
    if (item.rarity === "legendary") state.legendaryFound += 1;
  });

  const advanced = enemy.boss;
  if (advanced) {
    const next = MAP.createFloor(dungeon.floor + 1);
    next.hp = dungeon.hp;
    state.dungeon = next;
    state.deepestFloor = Math.max(state.deepestFloor, next.floor);
  }
  state.battle = null;

  persist();
  render();
  updateGold();
  pulseWallet();
  audio.playCoin();
  if (advanced) audio.playLevelUp();
  flashDungeon({ damage: 0, crit: false, dodged: false });

  const log = $('[data-dungeon="log"]');
  if (log) {
    const parts = [...events, `+${gold} Gold`];
    log.textContent = `${parts.join(" · ")}${advanced ? ` · Etage ${state.dungeon.floor} betreten!` : ""}`;
  }
  toast(
    advanced
      ? `${enemy.elite ? "Etagenboss" : "Raumwächter"} besiegt! +${gold} Gold · Etage ${state.dungeon.floor}`
      : `${enemy.name} besiegt! +${gold} Gold`,
    enemy.boss ? "magenta" : "green"
  );
  drop.items.slice(0, 2).forEach((item) => {
    toast(`Beute: ${item.name} · ${rarityName(item.rarity)}`, lootTone(item.rarity));
  });
  if (drop.items.length > 2) toast(`+${drop.items.length - 2} weitere Beutestücke im Inventar`, "gold");
}

function rarityName(rarity) {
  return ITEMS.RARITIES[rarity]?.name || "Gewöhnlich";
}

function handleBattleDefeat(events = []) {
  const stats = heroStats();
  state.dungeon.hp = stats.maxHp;
  state.dungeon.pos = 0;
  state.dungeon.visited[0] = true;
  state.battle = null;
  state.mana = stats.maxMana;
  persist();
  render();
  setBattleLog([...events, "Zurück zum Eingang — HP aufgefüllt."]);
  audio.playError();
  toast("Besiegt! Zurück zum Eingang, HP aufgefüllt.", "magenta");
}

function moveDungeon(direction) {
  if (!state.heroClass) {
    toast("Wähle zuerst deine Klasse.", "magenta");
    return;
  }
  const deltas = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  if (isCombatActive()) {
    const battle = ensureBattle();
    const [dx, dy] = deltas[direction] || [0, 0];
    if (!battle || !BATTLE.canMove(battle, dx, dy)) {
      toast("Feld blockiert — wähle eine andere Richtung.", "magenta");
      return;
    }
    const result = BATTLE.moveHero(battle, dx, dy);
    if (!result.ok) return;
    haptic(6);
    afterBattleTurn(result.events);
    return;
  }

  const moved = MAP.move(state.dungeon, direction);
  if (!moved.ok) return;
  haptic(6);
  enterRoom();
  persist();
  renderDungeon();
  renderSettings();
}

function moveToRoom(index) {
  if (isCombatActive()) return;
  if (!MAP.moveTo(state.dungeon, index)) return;
  haptic(6);
  enterRoom();
  persist();
  renderDungeon();
  renderSettings();
}

function useRoomAction(action) {
  const stats = heroStats();
  const factor = state.settings.difficulty === "heroic" ? 1.75 : 1;
  if (action === "heal") {
    const cost = Math.round(30 * factor);
    if (state.gold < cost) {
      audio.playError();
      toast("Nicht genug Gold für den Heiltrank.", "magenta");
      return;
    }
    if (state.dungeon.hp >= stats.maxHp) {
      toast("Du bist bereits bei vollen HP.", "green");
      return;
    }
    state.gold -= cost;
    state.dungeon.hp = Math.min(stats.maxHp, state.dungeon.hp + 40);
    audio.playCoin();
    toast(`Heiltrank getrunken: +40 HP · −${cost} Gold`, "green");
  } else if (action === "rune") {
    const cost = Math.round(160 * factor);
    const locked = DUNGEON.RUNES.filter((rune) => !state.runes.includes(rune.id));
    if (!locked.length) {
      toast("Der Händler hat keine unbekannten Runen mehr.", "gold");
      return;
    }
    if (state.gold < cost) {
      audio.playError();
      toast("Nicht genug Gold für eine Rune.", "magenta");
      return;
    }
    const rune = locked[Math.floor(Math.random() * locked.length)];
    state.gold -= cost;
    state.runes.push(rune.id);
    if (!state.rune) state.rune = rune.id;
    audio.playLevelUp();
    toast(`Rune ${rune.name} gekauft · −${cost} Gold`, "green");
  }
  persist();
  updateGold();
  renderDungeon();
  renderSettings();
  renderShop();
}

function dungeonAttack() {
  const battle = ensureBattle();
  if (!battle || battle.status !== "ongoing") return;
  const stats = heroStats();
  const melee = BATTLE.canAttack(battle, false);
  const ranged = !melee && BATTLE.canAttack(battle, true);
  if (!melee && !ranged) {
    audio.playError();
    toast("Zu weit weg — bewege dich näher heran oder nutze Fernkampf.", "magenta");
    return;
  }
  const result = BATTLE.heroAttack(battle, { ranged, stats, rune: state.rune });
  if (!result.ok) return;
  flashDungeon({ damage: result.damage, crit: result.crit, dodged: result.dodged });
  haptic(result.crit ? [10, 30, 12] : 8);
  afterBattleTurn(result.events);
}

function useClassSkill() {
  const battle = ensureBattle();
  if (!battle || battle.status !== "ongoing") return;
  const result = BATTLE.useSkill(battle, { stats: heroStats(), rune: state.rune });
  if (!result.ok) {
    audio.playError();
    const reasons = {
      cooldown: "Fertigkeit lädt noch.",
      mana: "Nicht genug Mana.",
      "melee-range": "Für den Schildstoß musst du angrenzen.",
      "spell-range": "Ziel außer Reichweite.",
    };
    toast(reasons[result.reason] || "Fertigkeit nicht verfügbar.", "magenta");
    return;
  }
  flashDungeon({ damage: 0, crit: true, dodged: false });
  audio.playLevelUp();
  haptic([10, 25]);
  afterBattleTurn(result.events);
}

function useQuickSlot(index) {
  const battle = ensureBattle();
  if (!battle) return;
  const item = INVENTORY.quickItem(state.inventory, index);
  if (!item) return;
  if (item.effect === "upgrade") {
    toast("Veredelungs-Schriftrollen wirken im Inventar.", "gold");
    return;
  }
  const result = BATTLE.useConsumable(battle, item, { stats: heroStats() });
  if (!result.ok) {
    toast("Dieses Item wirkt nicht im Kampf.", "magenta");
    return;
  }
  INVENTORY.consumeQuickSlot(state.inventory, index);
  audio.playCoin();
  haptic(8);
  afterBattleTurn(result.events);
  renderInventory();
}

function fleeDungeonBattle() {
  const battle = ensureBattle();
  if (!battle) return;
  BATTLE.fleeBattle(battle);
  state.battle = null;
  state.dungeon.pos = 0;
  state.dungeon.visited[0] = true;
  persist();
  renderDungeon();
  renderSettings();
  audio.playDelete();
  toast("Du ziehst dich zum Eingang zurück. Der Raum bleibt ungesäubert.", "gold");
}

function chooseHeroClass(classId) {
  const cls = CLASSES.getClass(classId);
  if (!cls) return;
  state.heroClass = classId;
  classPreview = classId;
  state.battle = null;
  state.dungeon = MAP.createFloor(1);
  const stats = heroStats();
  state.dungeon.hp = stats.maxHp;
  state.mana = stats.maxMana;
  persist();
  render();
  updateGold();
  audio.playLevelUp();
  haptic([12, 40, 12]);
  toast(`${cls.name} gewählt — ${cls.passive}`, "green");
}

function disarmDungeonReset() {
  dungeonResetArmed = false;
  clearTimeout(dungeonResetTimer);
  const button = $("#dungeon-reset");
  if (!button) return;
  button.textContent = "Run aufgeben";
  button.classList.remove("is-armed");
}

function resetDungeonRun() {
  const button = $("#dungeon-reset");
  if (!dungeonResetArmed) {
    dungeonResetArmed = true;
    if (button) {
      button.textContent = "Sicher? Etage 1";
      button.classList.add("is-armed");
    }
    dungeonResetTimer = setTimeout(disarmDungeonReset, 3000);
    return;
  }

  clearTimeout(dungeonResetTimer);
  dungeonResetArmed = false;
  const stats = heroStats();
  state.dungeon = MAP.createFloor(1);
  state.dungeon.hp = stats.maxHp;
  state.battle = null;
  state.mana = stats.maxMana;
  persist();
  renderDungeon();
  renderSettings();
  updateGold();
  audio.playDelete();
  haptic(10);
  toast(`Neuer Run auf Etage 1. Tiefste Etage bleibt ${state.deepestFloor}.`, "gold");
  disarmDungeonReset();
}

/* -------------------------------------------------------------------------
   Idle loot + settings
   ------------------------------------------------------------------------- */

function collectLoot() {
  const result = RAID.collectLoot(state, Date.now(), state.settings.difficulty);
  if (!result.ok) return;
  state.totalLoot += result.gold;
  state.goldEarned += result.gold;
  persist();
  updateGold();
  updateLoot();
  renderSettings();
  pulseWallet();
  audio.playCoin();
  toast(`+${result.gold} Gold aus der Idle-Kiste`, "gold");

  const panel = $("#loot-panel");
  if (panel) {
    panel.classList.add("is-opening");
    setTimeout(() => panel.classList.remove("is-opening"), 900);
  }
}

function syncSoundUI() {
  const enabled = state.settings.sound !== false;
  audio.setMuted(!enabled);
  const button = $("#btn-sound");
  if (!button) return;
  button.classList.toggle("is-on", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  const label = $("[data-sound-label]", button);
  if (label) label.textContent = enabled ? "AN" : "AUS";
}

function syncHapticsUI() {
  const enabled = state.settings.haptics !== false;
  const button = $("#btn-haptics");
  if (!button) return;
  button.classList.toggle("is-on", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  const label = $("[data-haptics-label]", button);
  if (label) label.textContent = enabled ? "AN" : "AUS";
}

function setDifficultyMode(mode) {
  const next = mode === "heroic" ? "heroic" : "normal";
  if (state.settings.difficulty === next) return;

  state.settings.difficulty = next;
  state.boss = RAID.createBoss(state.boss.level, next);
  state.battle = null;
  state.dungeon.enemyHp = 0;
  state.dungeon.burn = 0;
  state.dungeon.frozen = false;
  const stats = heroStats();
  state.dungeon.hp = Math.min(stats.maxHp, Math.max(1, state.dungeon.hp));

  persist();
  render();
  updateLoot();
  audio.playLevelUp();
  haptic([12, 40, 12]);
  toast(
    next === "heroic"
      ? "Heroic aktiv: 1,75× auf alle Shop-Preise, härtere Gegner, mehr Beute."
      : "Casual aktiv: günstigere Preise und schnellere Quests.",
    next === "heroic" ? "magenta" : "green"
  );
}

function disarmReset() {
  resetArmed = false;
  clearTimeout(resetTimer);
  const button = $("#btn-reset");
  if (!button) return;
  button.textContent = "Löschen";
  button.classList.remove("is-armed");
}

function resetProgress() {
  if (!resetArmed) {
    resetArmed = true;
    const button = $("#btn-reset");
    if (button) {
      button.textContent = "Sicher?";
      button.classList.add("is-armed");
    }
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }

  clearTimeout(resetTimer);
  resetArmed = false;
  disarmDungeonReset();
  state = normalizeState(null);
  persist();
  syncSoundUI();
  syncHapticsUI();
  setTab("quests");
  render();
  updateLoot();
  disarmReset();
  disarmDungeonReset();
  toast("Fortschritt zurückgesetzt.", "gold");
}

function initSettings() {
  $("#btn-sound")?.addEventListener("click", () => {
    const next = state.settings.sound === false;
    state.settings.sound = next;
    persist();
    syncSoundUI();
    if (next) audio.playCoin();
    toast(`Sound ${next ? "an" : "aus"}.`, "green");
  });

  $("#btn-haptics")?.addEventListener("click", () => {
    const next = state.settings.haptics === false;
    state.settings.haptics = next;
    persist();
    syncHapticsUI();
    if (next) haptic(12);
    toast(`Haptik ${next ? "an" : "aus"}.`, "green");
  });

  $$(".mode-btn").forEach((button) => {
    button.addEventListener("click", () => setDifficultyMode(button.dataset.mode));
  });

  $("#btn-reset")?.addEventListener("click", resetProgress);

  $("#btn-export").addEventListener("click", () => exportJSON(state));
  $("#btn-import").addEventListener("click", () => {
    $("#import-file").click();
  });

  $("#import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = await importJSON(file);
      state = normalizeState(imported);
      persist();
      syncSoundUI();
      syncHapticsUI();
      render();
      updateLoot();
      toast("Save-Daten importiert.", "green");
    } catch (error) {
      audio.playError();
      toast("Import fehlgeschlagen.", "magenta");
    } finally {
      event.target.value = "";
    }
  });
}

/* -------------------------------------------------------------------------
   Render
   ------------------------------------------------------------------------- */

function render() {
  const xpNeeded = QM.xpForLevel(state.level);
  const xpPercent = Math.min(100, Math.max(0, (state.xp / xpNeeded) * 100));

  const levelEl = $('[data-stat="level"]');
  if (levelEl) levelEl.textContent = `LV ${state.level}`;
  const streakEl = $('[data-stat="streak"]');
  if (streakEl) streakEl.textContent = String(state.streak);
  const xpEl = $('[data-stat="xp"]');
  if (xpEl) xpEl.textContent = `${state.xp} / ${xpNeeded} XP`;
  const xpFill = $('[data-stat="xp-fill"]');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;

  const xpBar = $("#xp-bar");
  if (xpBar) {
    xpBar.setAttribute("aria-valuenow", String(state.xp));
    xpBar.setAttribute("aria-valuemax", String(xpNeeded));
    xpBar.setAttribute("aria-valuetext", `${state.xp} von ${xpNeeded} XP`);
  }

  renderQuests();
  updateGold();
  updateAvatar();
  updateBoosters();
  renderBoss();
  updateLoot();
  renderDungeon();
  renderSettings();
  syncDifficulty();

  renderShop();
  renderInventory();
}

/* -------------------------------------------------------------------------
   Setup
   ------------------------------------------------------------------------- */

function setup() {
  QM.updateStreak(state);
  QM.resetDailyQuests(state);
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  persist();

  categoryControl = initDropdown($('[data-dropdown="category"]'));
  difficultyControl = initDropdown($('[data-dropdown="difficulty"]'), syncDifficulty);
  initShop();
  initSettings();

  $$("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  $$(".rune-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.rune;
      if (!state.runes.includes(id)) {
        toast("Rune gesperrt — im Shop kaufen oder am Altar finden.", "magenta");
        audio.playError();
        return;
      }
      if (state.rune === id) return;
      state.rune = id;
      persist();
      renderDungeon();
      audio.playHit();
      haptic(8);
    });
  });

  $$("[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveDungeon(button.dataset.move));
  });

  $("#dungeon-map")?.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-map-index]");
    if (cell) moveToRoom(Number(cell.dataset.mapIndex));
  });

  $("#room-actions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-room-action]");
    if (button) useRoomAction(button.dataset.roomAction);
  });

  document.addEventListener("keydown", (event) => {
    if (document.body.dataset.tab !== "dungeon") return;
    if (event.target.closest("input, textarea, select")) return;
    const keys = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const direction = keys[event.key];
    if (!direction) return;
    event.preventDefault();
    moveDungeon(direction);
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("button");
      if (!button || button.disabled) return;
      button.classList.add("is-pressed");
      haptic(5);
    },
    { passive: true }
  );
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    document.addEventListener(
      type,
      (event) => {
        event.target.closest?.("button")?.classList.remove("is-pressed");
      },
      { passive: true }
    );
  });

  $("#quest-form").addEventListener("submit", addQuest);
  $("#daily-list").addEventListener("click", handleListClick);
  $("#active-list").addEventListener("click", handleListClick);
  $("#loot-collect").addEventListener("click", collectLoot);
  $("#dungeon-attack").addEventListener("click", dungeonAttack);
  $("#dungeon-skill")?.addEventListener("click", useClassSkill);
  $("#dungeon-flee")?.addEventListener("click", fleeDungeonBattle);
  $("#class-grid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-class-id]");
    if (!card || card.dataset.classId === classPreview) return;
    classPreview = card.dataset.classId;
    renderClassSelect();
    audio.playHit();
    haptic(6);
  });
  $("#class-detail")?.addEventListener("click", (event) => {
    const start = event.target.closest("[data-class-start]");
    if (start) chooseHeroClass(start.dataset.classStart);
  });
  $("#class-change")?.addEventListener("click", () => {
    classPreview = state.heroClass || classPreview;
    state.heroClass = null;
    state.battle = null;
    persist();
    render();
    toast("Wähle eine neue Klasse für den nächsten Run.", "gold");
  });
  $("#quick-bar")?.addEventListener("click", (event) => {
    const slot = event.target.closest("[data-quick-index]");
    if (slot) useQuickSlot(Number(slot.dataset.quickIndex));
  });
  $("#battle-grid")?.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-battle-cell]");
    if (!cell || !isCombatActive()) return;
    const [x, y] = cell.dataset.battleCell.split(",").map(Number);
    const battle = ensureBattle();
    if (!battle) return;
    const dx = x - battle.hero.x;
    const dy = y - battle.hero.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const result = BATTLE.moveHero(battle, dx, dy);
    if (!result.ok) return;
    haptic(6);
    afterBattleTurn(result.events);
  });
  const inventoryPanel = $("#inventory-panel");
  inventoryPanel?.addEventListener("click", (event) => {
    const tile = event.target.closest(".item-tile[data-inv-id]");
    if (tile) {
      inspectorItemId = tile.dataset.invId;
      renderInventory();
      audio.playHit();
      haptic(5);
      return;
    }

    const slotEl = event.target.closest(".paperdoll-slot");
    if (slotEl) {
      const selected = inspectorItemId ? INVENTORY.findItem(state.inventory, inspectorItemId) : null;
      const slot = slotEl.dataset.slot;
      const canEquipSelected =
        selected &&
        selected.type === "equipment" &&
        selected.slot === slot &&
        state.inventory.equipped[slot] !== selected.id;
      if (canEquipSelected) {
        inventoryAction("equip", selected.id);
        return;
      }
      if (slotEl.dataset.invId) inventoryAction("inspect", slotEl.dataset.invId);
      return;
    }

    const button = event.target.closest("[data-inv-action]");
    if (button) inventoryAction(button.dataset.invAction, button.dataset.invId);
  });

  inventoryPanel?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const slot = event.target.closest(".paperdoll-slot[data-inv-id]");
    if (!slot) return;
    event.preventDefault();
    inventoryAction("inspect", slot.dataset.invId);
  });

  inventoryPanel?.addEventListener("dragstart", (event) => {
    const tile = event.target.closest(".item-tile[data-inv-id]");
    if (!tile) return;
    try {
      event.dataTransfer.setData("text/plain", tile.dataset.invId);
      event.dataTransfer.effectAllowed = "move";
    } catch {
      // older browsers without dataTransfer
    }
    tile.classList.add("is-dragging");
    inventoryPanel.classList.add("is-dragging-item");
  });

  inventoryPanel?.addEventListener("dragend", (event) => {
    event.target.closest?.(".item-tile")?.classList.remove("is-dragging");
    inventoryPanel.classList.remove("is-dragging-item");
    inventoryPanel.querySelectorAll(".is-drop-target").forEach((el) => el.classList.remove("is-drop-target"));
  });

  inventoryPanel?.addEventListener("dragover", (event) => {
    const zone = event.target.closest("[data-drop-slot]");
    if (!zone) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    inventoryPanel.querySelectorAll(".is-drop-target").forEach((el) => {
      if (el !== zone) el.classList.remove("is-drop-target");
    });
    zone.classList.add("is-drop-target");
  });

  inventoryPanel?.addEventListener("drop", (event) => {
    const zone = event.target.closest("[data-drop-slot]");
    if (!zone) return;
    event.preventDefault();
    let id = "";
    try {
      id = event.dataTransfer.getData("text/plain");
    } catch {
      id = "";
    }
    inventoryPanel.classList.remove("is-dragging-item");
    inventoryPanel.querySelectorAll(".is-drop-target").forEach((el) => el.classList.remove("is-drop-target"));
    const item = INVENTORY.findItem(state.inventory, id);
    if (!item) return;
    const target = zone.dataset.dropSlot;

    if (target === "bag") {
      if (item.slot && state.inventory.equipped[item.slot] === item.id) inventoryAction("unequip", item.id);
      return;
    }

    if (target.startsWith("quick:")) {
      const index = Number(target.split(":")[1]);
      const result = INVENTORY.assignQuickSlot(state.inventory, id, index);
      if (!result.ok) {
        audio.playError();
        toast("Nur Tränke und Schriftrollen passen in die Schnelltaschen.", "magenta");
        return;
      }
      inspectorItemId = item.id;
      audio.playCoin();
      haptic(8);
      persist();
      render();
      return;
    }

    if (item.slot !== target) {
      audio.playError();
      toast(`${item.name} passt nicht in den Slot „${INVENTORY.SLOT_META[target]?.label || target}“.`, "magenta");
      return;
    }
    inspectorItemId = item.id;
    inventoryAction("equip", item.id);
  });
  $("#dungeon-reset")?.addEventListener("click", resetDungeonRun);
  $("#quest-title").addEventListener("input", syncDifficulty);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateLoot();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  syncSoundUI();
  syncHapticsUI();
  setTab("quests");
  render();
  syncDifficulty();
  updateLoot();
  lootTicker = setInterval(updateLoot, 5000);
  window.addEventListener("beforeunload", () => clearInterval(lootTicker));
}

setup();
