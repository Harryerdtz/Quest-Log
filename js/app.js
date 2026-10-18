// app.js — main controller
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import * as audio from "./audio.js";
import * as QM from "./quest-manager.js";
import * as RAID from "./raid.js";
import * as DUNGEON from "./dungeon.js";
import * as MAP from "./map.js";
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
const SHOP_CATEGORIES = ["equipment", "booster", "cosmetic", "reward"];
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

  const stats = DUNGEON.heroStats(clean.upgrades, avatarBuff(clean.equippedAvatar));
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
  const dungeonHero = $("#dungeon-hero-sprite");
  if (dungeonHero && dungeonHero.dataset.avatar !== avatar.id) {
    dungeonHero.innerHTML = avatar.sprite;
    dungeonHero.dataset.avatar = avatar.id;
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
  return DUNGEON.heroStats(state.upgrades, avatarBuff(state.equippedAvatar));
}

function currentEnemy() {
  const dungeon = state.dungeon;
  return DUNGEON.createRoomEnemy(
    dungeon.floor,
    dungeon.types[dungeon.pos] || "monster",
    state.settings.difficulty
  );
}

function isCombatActive() {
  const dungeon = state.dungeon;
  return MAP.isCombatRoom(dungeon.types[dungeon.pos]) && !dungeon.cleared[dungeon.pos];
}

function renderDungeon() {
  const mode = state.settings.difficulty;
  const stats = heroStats();
  const dungeon = state.dungeon;
  const floor = dungeon.floor;
  const roomType = dungeon.types[dungeon.pos] || "start";
  const room = MAP.ROOM_TYPES[roomType] || MAP.ROOM_TYPES.start;
  const cleared = Boolean(dungeon.cleared[dungeon.pos]);
  const combat = MAP.isCombatRoom(roomType) && !cleared;
  const enemy = combat ? currentEnemy() : null;
  const enemyHp = enemy
    ? Math.max(0, Math.min(enemy.hp, Number.isFinite(dungeon.enemyHp) && dungeon.enemyHp > 0 ? dungeon.enemyHp : enemy.hp))
    : 0;
  const heroHp = Math.max(0, Math.min(stats.maxHp, dungeon.hp));
  const heroElement = state.rune ? DUNGEON.ELEMENTS[state.rune] : null;
  const runeLabel = heroElement ? heroElement.name : "Keine Rune";

  const mapEl = $("#dungeon-map");
  if (mapEl) {
    mapEl.style.setProperty("--map-size", String(dungeon.size));
    mapEl.innerHTML = dungeon.types
      .map((type, index) => {
        const meta = MAP.ROOM_TYPES[type] || MAP.ROOM_TYPES.monster;
        const visited = dungeon.visited[index];
        const visible = MAP.isVisible(dungeon, index);
        const current = index === dungeon.pos;
        const done = dungeon.cleared[index];
        const glyph = current ? "★" : visited ? meta.icon : visible ? "?" : "·";
        const label = current
          ? `Aktueller Raum: ${meta.name}`
          : visited
            ? `${meta.name}${done ? " (erledigt)" : ""}`
            : visible
              ? "Unbekannter Raum"
              : "Unbekannt";
        const classes = [
          "map-cell",
          current ? "is-current" : "",
          visited ? "is-visited" : "",
          visible ? "is-seen" : "is-fog",
          done ? "is-cleared" : "",
          type === "boss" && visited ? "is-boss" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button class="${classes}" type="button" data-map-index="${index}" aria-label="${label}"${
          current ? ' aria-current="true"' : ""
        }>${glyph}</button>`;
      })
      .join("");
  }

  const roomCard = $("#room-card");
  if (roomCard) roomCard.dataset.roomType = roomType;
  $$('[data-room="icon"]').forEach((el) => {
    el.textContent = room.icon;
  });
  $$('[data-room="name"]').forEach((el) => {
    el.textContent = combat
      ? enemy.name
      : cleared && MAP.isCombatRoom(roomType)
        ? `${room.name} · gesäubert`
        : room.name;
  });
  $$('[data-room="desc"]').forEach((el) => {
    if (combat) {
      el.textContent = `${enemy.name} blockiert den Ausgang. Wähle eine Rune und greife an.`;
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

  const runeButtons = $$(".rune-btn");
  runeButtons.forEach((button) => {
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
    button.title = unlocked ? DUNGEON.ELEMENT_EFFECTS[id] : "Gesperrt — im Basar kaufen oder am Altar finden";
  });

  MAP.availableMoves(dungeon).forEach(({ direction }) => {
    const button = $(`[data-move="${direction}"]`);
    if (!button) return;
    button.disabled = combat || !MAP.canMove(dungeon, direction);
  });
  const attackButton = $("#dungeon-attack");
  if (attackButton) attackButton.disabled = !combat;

  const arena = $("#dungeon-arena");
  if (arena) arena.hidden = !combat;

  if (combat && enemy) {
    const spriteWrap = $("#dungeon-enemy-sprite");
    const spriteKey = `${floor}-${roomType}-${enemy.element}-${enemy.elite}`;
    if (spriteWrap && spriteWrap.dataset.spriteKey !== spriteKey) {
      spriteWrap.innerHTML = DUNGEON.enemySprite(enemy.element, enemy.elite);
      spriteWrap.dataset.element = enemy.element;
      spriteWrap.dataset.elite = String(enemy.elite);
      spriteWrap.dataset.spriteKey = spriteKey;
    }
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
      el.textContent = String(enemyHp);
    });
    $$('[data-dungeon="enemy-maxhp"]').forEach((el) => {
      el.textContent = String(enemy.hp);
    });
    const enemyFill = $('[data-dungeon="enemy-hp-fill"]');
    if (enemyFill) {
      enemyFill.style.width = `${enemy.hp > 0 ? (enemyHp / enemy.hp) * 100 : 0}%`;
      const bar = enemyFill.closest(".mini-hp");
      if (bar) {
        bar.setAttribute("aria-valuenow", String(enemyHp));
        bar.setAttribute("aria-valuemax", String(enemy.hp));
      }
    }
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
  $$('[data-dungeon="hero-element"]').forEach((el) => {
    el.textContent = runeLabel;
  });
  const heroDot = $('[data-dungeon="hero-element-dot"]');
  if (heroDot) heroDot.style.setProperty("--element", heroElement ? heroElement.color : "#5c6278");
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
    el.textContent = String(combat && enemy ? enemy.reward : 0);
  });
  $$('[data-dungeon="runes-owned"]').forEach((el) => {
    el.textContent = `${state.runes.length}/4 Runen`;
  });

  const panel = $("#dungeon-panel");
  if (panel) panel.classList.toggle("is-boss", combat && Boolean(enemy?.boss));

  const status = $('[data-dungeon="status"]');
  if (status) {
    if (combat) {
      status.textContent = `Kampf gegen ${enemy.name} · Etage ${floor} · ${mode === "heroic" ? "Heroic" : "Casual"}`;
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
  };
  const stock = item.type === "booster" ? stockMap[item.resource] ?? 0 : null;
  const preview = item.sprite || item.icon || COIN_SVG;
  const typeLabel = { cosmetic: "Skin", booster: "Elixier", reward: "Belohnung" }[item.type] || item.type;
  const priceValue = itemPrice(item, state.settings.difficulty);

  let action;
  if (item.type === "cosmetic" && equipped) {
    action = `<button class="btn btn--sm" type="button" data-item-id="${item.id}" disabled>Ausrüsten</button>`;
  } else if (item.type === "cosmetic" && owned) {
    action = `<button class="btn btn--sm btn--equip" type="button" data-shop-action="equip" data-item-id="${item.id}">Ausrüsten</button>`;
  } else if (item.type === "cosmetic") {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Kaufen</button>`;
  } else if (item.type === "booster") {
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
    meta.innerHTML = `<span class="stock-chip">Ausgerüstet: ${avatar.name}</span><span class="stock-chip stock-chip--gold">${state.owned.length} Avatare im Besitz</span>`;
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

    const result = buyItem(state, item, state.settings.difficulty);
    if (!result.ok) {
      audio.playError();
      toast(result.reason === "gold" ? "Nicht genug Gold. Erledige mehr Quests!" : "Kauf nicht möglich.", "magenta");
      return;
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
  state.dungeon.enemyHp = 0;
  state.dungeon.burn = 0;
  state.dungeon.frozen = false;
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
    const enemy = currentEnemy();
    dungeon.enemyHp = enemy.hp;
    dungeon.burn = 0;
    dungeon.frozen = false;
    audio.playHit();
    toast(type === "boss" ? "Boss-Raum betreten!" : "Monster-Raum betreten!", "magenta");
  } else if (type === "merchant") {
    audio.playCoin();
    toast("Händler-Raum: Tränke und Runen im Angebot.", "gold");
  }
}

function moveDungeon(direction) {
  if (isCombatActive()) {
    toast("Kampf läuft — greife zuerst an!", "magenta");
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
  if (!isCombatActive()) return;

  const result = DUNGEON.attackDungeon(
    state,
    state.settings.difficulty,
    avatarBuff(state.equippedAvatar)
  );
  if (result.type === "idle") return;

  state.monstersSlain += result.slain || 0;
  if (result.gold > 0) {
    const bonus = lootBonus(result.gold);
    result.lootBonus = bonus;
    state.goldEarned += result.gold + bonus;
  }

  const today = new Date().toDateString();
  if (result.type === "elite" && state.lastEliteBonusDate !== today) {
    result.dailyBonus = DUNGEON.eliteDailyBonus(state.settings.difficulty);
    state.gold += result.dailyBonus;
    state.goldEarned += result.dailyBonus;
    state.lastEliteBonusDate = today;
  }

  let advanced = false;
  if (result.boss) {
    const nextFloor = state.dungeon.floor + 1;
    state.deepestFloor = Math.max(state.deepestFloor, nextFloor);
    const next = MAP.createFloor(nextFloor);
    next.hp = result.heroHp;
    state.dungeon = next;
    advanced = true;
  }

  persist();
  renderDungeon();
  updateGold();
  renderSettings();
  pulseWallet();
  renderShop();
  flashDungeon(result);
  audio.playHit();
  haptic(result.crit ? [10, 30, 12] : 8);

  const log = $('[data-dungeon="log"]');
  if (log) {
    const text = describeCombat(result);
    log.textContent = advanced
      ? `${text} · Etage ${state.dungeon.floor} betreten!`
      : text;
  }

  const reward = result.gold + (result.lootBonus || 0) + (result.dailyBonus || 0);
  if (advanced) {
    audio.playCoin();
    audio.playLevelUp();
    toast(
      `${result.type === "elite" ? "Etagenboss" : "Raumwächter"} besiegt! +${reward} Gold · Etage ${state.dungeon.floor}`,
      result.type === "elite" ? "magenta" : "green"
    );
  } else if (result.type === "monster") {
    audio.playCoin();
    toast(`Monster besiegt! +${reward} Gold`, "green");
  } else if (result.type === "down") {
    toast(`Besiegt — zurück zum Eingang. Etage ${state.dungeon.floor} bleibt.`, "magenta");
  }
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
      ? "Heroic aktiv: 1,75× auf alle Basar-Preise, härtere Gegner, mehr Beute."
      : "Casual aktiv: günstigere Preise und schnellere Quests.",
    next === "heroic" ? "magenta" : "green"
  );
}

function disarmReset() {
  resetArmed = false;
  clearTimeout(resetTimer);
  const button = $("#btn-reset");
  if (!button) return;
  button.textContent = "Reset";
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
        toast("Rune gesperrt — im Basar kaufen oder am Altar finden.", "magenta");
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
