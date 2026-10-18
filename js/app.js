// app.js — main controller
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import * as audio from "./audio.js";
import * as QM from "./quest-manager.js";
import * as RAID from "./raid.js";
import * as DUNGEON from "./dungeon.js";
import { SHOP_ITEMS, AVATARS, COIN_SVG, buyItem, equipAvatar } from "./shop.js";

const DEFAULT_STATE = {
  quests: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,
  lastDailyReset: null,
  settings: { sound: true },
  gold: 250,
  owned: ["avatar_hero"],
  equippedAvatar: "avatar_hero",
  boosterXp: 0,
  boosterGold: 0,
  boss: null,
  lastLootAt: null,
  upgrades: { weapon: 0, armor: 0, strength: 0, vitality: 0 },
  dungeon: null,
};

const DIFFICULTIES = ["easy", "medium", "hard", "boss"];
const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard", boss: "Boss" };
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
  clean.level = Number.isFinite(source.level) ? Math.max(1, Math.floor(source.level)) : 1;
  clean.xp = Number.isFinite(source.xp) ? Math.max(0, Math.floor(source.xp)) : 0;
  clean.streak = Number.isFinite(source.streak) ? Math.max(0, Math.floor(source.streak)) : 0;
  clean.settings = {
    ...DEFAULT_STATE.settings,
    ...(source.settings && typeof source.settings === "object" ? source.settings : {}),
  };
  clean.settings.sound = source.settings?.sound !== false;

  clean.upgrades = {};
  DUNGEON.UPGRADES.forEach((upgrade) => {
    const level = Number.isFinite(source.upgrades?.[upgrade.id]) ? Math.floor(source.upgrades[upgrade.id]) : 0;
    clean.upgrades[upgrade.id] = Math.max(0, level);
  });

  const stats = DUNGEON.heroStats(clean.upgrades);
  const floor = Number.isFinite(source.dungeon?.floor) ? Math.max(1, Math.floor(source.dungeon.floor)) : 1;
  const enemy = DUNGEON.createEnemy(floor);
  clean.dungeon = {
    floor,
    hp: Number.isFinite(source.dungeon?.hp)
      ? Math.max(1, Math.min(stats.maxHp, Math.floor(source.dungeon.hp)))
      : stats.maxHp,
    enemyHp: Number.isFinite(source.dungeon?.enemyHp)
      ? Math.max(1, Math.min(enemy.hp, Math.floor(source.dungeon.enemyHp)))
      : enemy.hp,
  };

  const bossLevel = Number.isFinite(source.boss?.level) ? Math.max(1, Math.floor(source.boss.level)) : 1;
  const bossTemplate = RAID.createBoss(bossLevel);
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
let shopCloseTimer = null;
let shopLastFocus = null;
let activeShopTab = "equipment";
let categoryControl = null;
let difficultyControl = null;
let lootTicker = null;
let resetArmed = false;
let resetTimer = null;

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
  if (window.scrollY > 0) window.scrollTo(0, 0);
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
    if (state.streak >= 3) bits.push("Streak ×1.2");
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
      const goldGain = Math.round(RAID.goldForQuest(quest.difficulty) * (hasGoldBooster ? 1.5 : 1));
      if (hasGoldBooster) state.boosterGold = Math.max(0, state.boosterGold - 1);
      state.gold += goldGain;

      const raid = RAID.damageBoss(state.boss, result.xpGain);
      if (raid.defeated) state.gold += raid.goldReward;

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

function updateLoot(now = Date.now()) {
  const pending = RAID.lootPending(state, now);
  const full = pending >= RAID.LOOT_CAP;
  $$('[data-loot="pending"]').forEach((el) => {
    el.textContent = String(pending);
  });

  const button = $("#loot-collect");
  if (button) button.disabled = pending <= 0;
  const label = $('[data-loot="button"]');
  if (label) label.textContent = pending > 0 ? `Loot einsammeln (+${pending})` : "Loot sammelt sich …";
  const timer = $('[data-loot="timer"]');
  if (timer) {
    timer.textContent = full ? "Kiste voll — jetzt einsammeln!" : `Nächster Loot in ${RAID.lootNextIn(state, now)}s`;
  }
  const panel = $("#loot-panel");
  if (panel) panel.classList.toggle("is-ready", pending > 0);
}

function renderDungeon() {
  const stats = DUNGEON.heroStats(state.upgrades);
  const floor = state.dungeon.floor;
  const enemy = DUNGEON.createEnemy(floor);
  const enemyHp = Math.max(0, Math.min(enemy.hp, state.dungeon.enemyHp));
  const heroHp = Math.max(0, Math.min(stats.maxHp, state.dungeon.hp));

  $$('[data-dungeon="floor"]').forEach((el) => {
    el.textContent = String(floor);
  });
  $$('[data-dungeon="enemy-name"]').forEach((el) => {
    el.textContent = enemy.name;
  });
  $$('[data-dungeon="enemy-attack"]').forEach((el) => {
    el.textContent = String(enemy.attack);
  });
  $$('[data-dungeon="reward"]').forEach((el) => {
    el.textContent = String(enemy.reward);
  });
  $$('[data-dungeon="attack"]').forEach((el) => {
    el.textContent = String(stats.attack);
  });
  $$('[data-dungeon="defense"]').forEach((el) => {
    el.textContent = String(stats.defense);
  });

  const heroFill = $('[data-dungeon="hero-hp-fill"]');
  if (heroFill) heroFill.style.width = `${Math.max(0, Math.min(100, (heroHp / stats.maxHp) * 100))}%`;
  const enemyFill = $('[data-dungeon="enemy-hp-fill"]');
  if (enemyFill) enemyFill.style.width = `${Math.max(0, Math.min(100, (enemyHp / enemy.hp) * 100))}%`;

  $$('[data-dungeon="hero-hp"]').forEach((el) => {
    el.textContent = String(heroHp);
  });
  $$('[data-dungeon="hero-maxhp"]').forEach((el) => {
    el.textContent = String(stats.maxHp);
  });
  $$('[data-dungeon="enemy-hp"]').forEach((el) => {
    el.textContent = String(enemyHp);
  });
  $$('[data-dungeon="enemy-maxhp"]').forEach((el) => {
    el.textContent = String(enemy.hp);
  });

  const heroBar = heroFill?.closest(".mini-hp");
  if (heroBar) {
    heroBar.setAttribute("aria-valuenow", String(heroHp));
    heroBar.setAttribute("aria-valuemax", String(stats.maxHp));
  }
  const enemyBar = enemyFill?.closest(".mini-hp");
  if (enemyBar) {
    enemyBar.setAttribute("aria-valuenow", String(enemyHp));
    enemyBar.setAttribute("aria-valuemax", String(enemy.hp));
  }

  const panel = $("#dungeon-panel");
  if (panel) panel.classList.toggle("is-boss", enemy.boss);

  const status = $('[data-dungeon="status"]');
  if (status) {
    status.textContent = enemy.boss
      ? `Boss-Etage! ${enemy.name} wartet mit ${enemy.hp} HP.`
      : `Etage ${floor}: ${enemy.name} blockiert den Weg.`;
  }
}

function renderSettings() {
  const completed = state.quests.filter((quest) => quest.done).length;
  const values = {
    completed,
    floor: state.dungeon.floor,
    gold: state.gold,
    level: state.level,
  };
  Object.entries(values).forEach(([key, value]) => {
    $$(`[data-settings="${key}"]`).forEach((el) => {
      el.textContent = String(value);
    });
  });
}

/* -------------------------------------------------------------------------
   Shop
   ------------------------------------------------------------------------- */

function upgradeCard(upgrade) {
  const level = state.upgrades[upgrade.id] || 0;
  const cost = DUNGEON.upgradeCost(upgrade, level);
  return `
    <article class="shop-card shop-card--upgrade" style="--card-accent:#4eef91">
      <div class="shop-card__preview">${upgrade.icon}</div>
      <div class="shop-card__topline">
        <span class="shop-card__type">Equipment</span>
        <span class="shop-card__level">Stufe ${level}</span>
      </div>
      <h3 class="shop-card__name">${upgrade.name}</h3>
      <p class="shop-card__desc">${upgrade.desc}</p>
      <div class="shop-card__meta">
        <span class="shop-card__price">${COIN_SVG}<span>${cost}</span></span>
        <button class="btn btn--sm btn--equip" type="button" data-upgrade-id="${upgrade.id}">Upgrade</button>
      </div>
    </article>
  `;
}

function shopCard(item) {
  const owned = item.type === "cosmetic" && state.owned.includes(item.id);
  const equipped = item.type === "cosmetic" && state.equippedAvatar === item.id;
  const stock = item.type === "booster" ? (item.resource === "xp" ? state.boosterXp : state.boosterGold) : null;
  const preview = item.sprite || item.icon || COIN_SVG;
  const typeLabel = { cosmetic: "Kosmetik", booster: "Booster", reward: "Reward" }[item.type] || item.type;

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
    : `<span class="shop-card__price">${COIN_SVG}<span>${item.price}</span></span>`;
  const stockLine = stock === null ? "" : `<span class="shop-card__stock">Im Inventar: ${stock}</span>`;

  return `
    <article class="shop-card${equipped ? " is-equipped" : ""}" style="--card-accent:${item.accent}">
      <div class="shop-card__preview">${preview}</div>
      <div class="shop-card__topline">
        <span class="shop-card__type">${typeLabel}</span>
        ${stockLine}
      </div>
      <h3 class="shop-card__name">${item.name}</h3>
      <p class="shop-card__desc">${item.desc}</p>
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
    const stats = DUNGEON.heroStats(state.upgrades);
    meta.innerHTML = `
      <span class="stock-chip">ANG ${stats.attack}</span>
      <span class="stock-chip">DEF ${stats.defense}</span>
      <span class="stock-chip">HP ${stats.maxHp}</span>
      <span class="stock-chip stock-chip--gold">Etage ${state.dungeon.floor}</span>
    `;
  } else if (activeShopTab === "booster") {
    const chips = [];
    if (state.boosterXp > 0) chips.push(`<span class="stock-chip">XP-Booster ×1.5 · ${state.boosterXp}</span>`);
    if (state.boosterGold > 0) chips.push(`<span class="stock-chip stock-chip--gold">Gold-Booster ×1.5 · ${state.boosterGold}</span>`);
    meta.innerHTML = chips.length ? chips.join("") : '<span class="stock-chip">Keine Booster aktiv</span>';
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
    grid.innerHTML = DUNGEON.UPGRADES.map(upgradeCard).join("");
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

function openShop(category = null) {
  const modal = $("#shop-modal");
  if (!modal) return;
  clearTimeout(shopCloseTimer);
  if (!modal.hidden && modal.classList.contains("is-open")) return;
  if (category && SHOP_CATEGORIES.includes(category)) activeShopTab = category;
  shopLastFocus = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  renderShop();
  requestAnimationFrame(() => {
    modal.classList.add("is-open");
    $("#shop-close")?.focus();
  });
}

function closeShop() {
  const modal = $("#shop-modal");
  if (!modal || modal.hidden) return;
  modal.classList.remove("is-open");
  document.body.classList.remove("is-modal-open");
  shopCloseTimer = setTimeout(() => {
    modal.hidden = true;
  }, 180);
  if (shopLastFocus && typeof shopLastFocus.focus === "function") shopLastFocus.focus();
}

function purchaseUpgrade(upgrade) {
  if (!upgrade) return;
  const level = state.upgrades[upgrade.id] || 0;
  const cost = DUNGEON.upgradeCost(upgrade, level);
  if (state.gold < cost) {
    audio.playError();
    toast(`Nicht genug Gold. Benötigt: ${cost}.`, "magenta");
    return;
  }

  const before = DUNGEON.heroStats(state.upgrades);
  state.gold -= cost;
  state.upgrades[upgrade.id] = level + 1;
  const after = DUNGEON.heroStats(state.upgrades);
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
  $$("[data-open-shop]").forEach((button) => {
    button.addEventListener("click", () => openShop(button.dataset.shopCategory || null));
  });
  $("#btn-shop")?.addEventListener("click", () => openShop());
  $$("[data-shop-close]").forEach((el) => el.addEventListener("click", closeShop));
  $("#shop-close")?.addEventListener("click", closeShop);

  $$(".shop-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeShopTab = tab.dataset.shopTab;
      renderShop();
    });
  });

  $("#shop-grid")?.addEventListener("click", (event) => {
    const upgradeButton = event.target.closest("[data-upgrade-id]");
    if (upgradeButton) {
      const upgrade = DUNGEON.UPGRADES.find((entry) => entry.id === upgradeButton.dataset.upgradeId);
      purchaseUpgrade(upgrade);
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
      persist();
      updateAvatar();
      renderShop();
      document.querySelector(`#shop-grid [data-item-id="${item.id}"]:not([disabled])`)?.focus();
      audio.playCoin();
      toast(result.message, "green");
      return;
    }

    const result = buyItem(state, item);
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
    renderShop();
    document.querySelector(`#shop-grid [data-item-id="${item.id}"]:not([disabled])`)?.focus();
    pulseWallet();
    audio.playCoin();
    toast(result.message, item.type === "reward" ? "gold" : "green");
  });

  const modal = $("#shop-modal");
  modal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeShop();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = $$(
      'button:not([disabled]), [href], input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])',
      modal
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
  if (float) float.textContent = `-${result.damage}`;
  panel.classList.remove("is-attacking");
  void panel.offsetWidth;
  panel.classList.add("is-attacking");
  setTimeout(() => panel.classList.remove("is-attacking"), 500);

  const status = $('[data-dungeon="status"]');
  if (status) {
    if (result.type === "floor") {
      status.textContent = `Etage geschafft! +${result.gold} Gold · Weiter zu Etage ${state.dungeon.floor}.`;
    } else if (result.type === "down") {
      status.textContent = `Besiegt! Zurück zu Etage ${state.dungeon.floor} — HP aufgefüllt.`;
    } else {
      status.textContent = `Treffer für ${result.damage}. Konter: -${result.counter} HP.`;
    }
  }
}

function dungeonAttack() {
  const result = DUNGEON.attackDungeon(state);
  persist();
  renderDungeon();
  updateGold();
  renderSettings();
  pulseWallet();
  renderShop();
  flashDungeon(result);
  audio.playHit();

  if (result.type === "floor") {
    audio.playCoin();
    toast(`Etage geschafft! +${result.gold} Gold`, "green");
  } else if (result.type === "down") {
    toast(`Besiegt! Zurück zu Etage ${state.dungeon.floor}.`, "magenta");
  }
}

/* -------------------------------------------------------------------------
   Idle loot + settings
   ------------------------------------------------------------------------- */

function collectLoot() {
  const result = RAID.collectLoot(state);
  if (!result.ok) return;
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
  state = normalizeState(null);
  persist();
  syncSoundUI();
  setTab("quests");
  render();
  updateLoot();
  disarmReset();
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

  if ($("#shop-modal") && !$("#shop-modal").hidden) renderShop();
}

/* -------------------------------------------------------------------------
   Setup
   ------------------------------------------------------------------------- */

function setup() {
  QM.updateStreak(state);
  QM.resetDailyQuests(state);
  persist();

  categoryControl = initDropdown($('[data-dropdown="category"]'));
  difficultyControl = initDropdown($('[data-dropdown="difficulty"]'), syncDifficulty);
  initShop();
  initSettings();

  $$(".tab-nav__btn[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  $("#quest-form").addEventListener("submit", addQuest);
  $("#daily-list").addEventListener("click", handleListClick);
  $("#active-list").addEventListener("click", handleListClick);
  $("#loot-collect").addEventListener("click", collectLoot);
  $("#dungeon-attack").addEventListener("click", dungeonAttack);
  $("#quest-title").addEventListener("input", syncDifficulty);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateLoot();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  syncSoundUI();
  setTab("quests");
  render();
  syncDifficulty();
  updateLoot();
  lootTicker = setInterval(updateLoot, 5000);
  window.addEventListener("beforeunload", () => clearInterval(lootTicker));
}

setup();
