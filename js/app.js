// app.js — main controller
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import * as audio from "./audio.js";
import * as QM from "./quest-manager.js";
import * as RAID from "./raid.js";
import { SHOP_ITEMS, AVATARS, COIN_SVG, buyItem, equipAvatar } from "./shop.js";

const DEFAULT_STATE = {
  quests: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,
  lastDailyReset: null,
  settings: {},
  gold: 250,
  owned: ["avatar_hero"],
  equippedAvatar: "avatar_hero",
  boosterXp: 0,
  boosterGold: 0,
  boss: null,
  lastLootAt: null,
};

const DIFFICULTIES = ["easy", "medium", "hard", "boss"];
const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard", boss: "Boss" };
const DIFFICULTY_FROM_INDEX = (value) => DIFFICULTIES[Number(value)] || "medium";
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
let activeShopTab = "avatar";
let autoMode = true;
let categoryControl = null;
let lootTicker = null;

/* -------------------------------------------------------------------------
   Utilities
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

/* -------------------------------------------------------------------------
   Quest rendering
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

/* -------------------------------------------------------------------------
   HUD rendering
   ------------------------------------------------------------------------- */

function updateGold() {
  $$("[data-gold]").forEach((el) => {
    el.textContent = String(state.gold);
  });
}

function updateAvatar() {
  const frame = $("#avatar-frame");
  const avatar = AVATARS[state.equippedAvatar] || AVATARS.avatar_hero;
  if (!frame) return;
  if (frame.dataset.avatar !== avatar.id) {
    frame.innerHTML = avatar.sprite;
    frame.dataset.avatar = avatar.id;
  }
}

function updateBoosters() {
  const row = $("#booster-row");
  if (!row) return;
  const chips = [];
  if (state.boosterXp > 0) {
    chips.push(`<span class="booster-chip">XP-Booster ×1.5 · ${state.boosterXp} Ladungen</span>`);
  }
  if (state.boosterGold > 0) {
    chips.push(`<span class="booster-chip booster-chip--gold">Gold-Booster ×1.5 · ${state.boosterGold} Ladungen</span>`);
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
  if (label) {
    label.textContent = pending > 0 ? `Loot einsammeln (+${pending})` : "Loot sammelt sich …";
  }
  const timer = $('[data-loot="timer"]');
  if (timer) {
    timer.textContent = full
      ? "Kiste voll — jetzt einsammeln!"
      : `Nächster Loot in ${RAID.lootNextIn(state, now)}s`;
  }
  const panel = $("#loot-panel");
  if (panel) panel.classList.toggle("is-ready", pending > 0);
}

function previewXP(difficulty) {
  let xp = QM.xpValue(difficulty);
  if (state.streak >= 3) xp = Math.round(xp * 1.2);
  if (state.boosterXp > 0) xp = Math.round(xp * 1.5);
  return xp;
}

function currentDifficulty() {
  return DIFFICULTY_FROM_INDEX($("#quest-difficulty")?.value);
}

function estimateDifficulty(title) {
  const text = title.trim();
  if (!text) return 1;
  let index = text.length < 20 ? 0 : text.length < 45 ? 1 : text.length < 75 ? 2 : 3;
  if (/boss/i.test(text)) index = 3;
  else if (HARD_WORDS.test(text)) index = Math.min(3, index + 1);
  return index;
}

function setAutoMode(enabled) {
  autoMode = enabled;
  const button = $("#auto-difficulty");
  if (!button) return;
  button.classList.toggle("is-active", enabled);
  button.setAttribute("aria-pressed", String(enabled));
}

function syncDifficulty() {
  const slider = $("#quest-difficulty");
  if (!slider) return;
  const difficulty = currentDifficulty();
  const xp = previewXP(difficulty);

  const preview = $("#xp-preview");
  if (preview) {
    preview.textContent = `+${xp} XP`;
    preview.classList.toggle("is-boss", difficulty === "boss");
  }

  const control = $("#difficulty-control");
  if (control) control.dataset.difficulty = difficulty;

  const fill = $("#difficulty-fill");
  if (fill) fill.style.width = `${(Number(slider.value) / 3) * 100}%`;

  $$(".difficulty-tick").forEach((tick) => {
    const active = tick.dataset.difficulty === difficulty;
    tick.classList.toggle("is-active", active);
    tick.setAttribute("aria-pressed", String(active));
  });

  slider.setAttribute("aria-valuetext", `${DIFFICULTY_LABELS[difficulty]}, ${xp} XP`);

  const hint = $("#difficulty-hint");
  if (hint) {
    const bits = [autoMode ? "AUTO schätzt aus dem Titel." : "Manuell gewählt."];
    if (state.streak >= 3) bits.push("Streak ×1.2");
    if (state.boosterXp > 0) bits.push(`XP-Booster ×1.5 (${state.boosterXp})`);
    hint.textContent = bits.join(" ");
  }
}

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
  syncDifficulty();

  if ($("#shop-modal") && !$("#shop-modal").hidden) renderShop();
}

/* -------------------------------------------------------------------------
   Custom category dropdown
   ------------------------------------------------------------------------- */

function initCategoryDropdown() {
  const root = $("[data-dropdown]");
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
    valueEl.textContent = $(".dropdown__option-text", option).textContent.trim();
    iconEl.textContent = option.dataset.icon || "◆";
    options.forEach((entry) => {
      const selected = entry === option;
      entry.classList.toggle("is-selected", selected);
      entry.setAttribute("aria-selected", String(selected));
    });
    setOpen(false);
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
   Difficulty controls
   ------------------------------------------------------------------------- */

function initDifficultyControls() {
  const slider = $("#quest-difficulty");
  const titleInput = $("#quest-title");
  if (!slider) return;

  slider.addEventListener("input", () => {
    setAutoMode(false);
    syncDifficulty();
  });

  $$(".difficulty-tick").forEach((tick) => {
    tick.addEventListener("click", () => {
      slider.value = tick.dataset.value;
      setAutoMode(false);
      syncDifficulty();
    });
  });

  $("#auto-difficulty")?.addEventListener("click", () => {
    const next = !autoMode;
    setAutoMode(next);
    if (next) slider.value = String(estimateDifficulty(titleInput.value));
    syncDifficulty();
  });

  titleInput?.addEventListener("input", () => {
    if (autoMode) slider.value = String(estimateDifficulty(titleInput.value));
    syncDifficulty();
  });
}

/* -------------------------------------------------------------------------
   Shop
   ------------------------------------------------------------------------- */

function shopCard(item) {
  const owned = item.type === "avatar" && state.owned.includes(item.id);
  const equipped = item.type === "avatar" && state.equippedAvatar === item.id;
  const stock = item.type === "booster"
    ? (item.resource === "xp" ? state.boosterXp : state.boosterGold)
    : null;
  const preview = item.sprite || item.icon || COIN_SVG;
  const typeLabel = { avatar: "Avatar", booster: "Booster", reward: "Reward" }[item.type] || item.type;

  let action;
  if (item.type === "avatar" && equipped) {
    action = `<button class="btn btn--sm" type="button" data-item-id="${item.id}" disabled>Ausrüsten</button>`;
  } else if (item.type === "avatar" && owned) {
    action = `<button class="btn btn--sm btn--equip" type="button" data-shop-action="equip" data-item-id="${item.id}">Ausrüsten</button>`;
  } else if (item.type === "avatar") {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Kaufen</button>`;
  } else if (item.type === "booster") {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Kaufen</button>`;
  } else {
    action = `<button class="btn btn--sm btn--buy" type="button" data-shop-action="buy" data-item-id="${item.id}">Einlösen</button>`;
  }

  const price = owned
    ? '<span class="shop-card__price is-owned">Im Besitz</span>'
    : `<span class="shop-card__price">${COIN_SVG}<span>${item.price}</span></span>`;

  const stockLine = stock === null
    ? ""
    : `<span class="shop-card__stock">Im Inventar: ${stock}</span>`;

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

function renderBoosterStock() {
  const el = $("#booster-stock");
  if (!el) return;
  const chips = [];
  if (state.boosterXp > 0) chips.push(`<span class="stock-chip">XP-Booster ×1.5 · ${state.boosterXp} Ladungen</span>`);
  if (state.boosterGold > 0) chips.push(`<span class="stock-chip stock-chip--gold">Gold-Booster ×1.5 · ${state.boosterGold} Ladungen</span>`);
  el.innerHTML = chips.join("");
  el.hidden = chips.length === 0;
}

function renderShop() {
  const grid = $("#shop-grid");
  if (!grid) return;
  const items = SHOP_ITEMS.filter((item) => item.type === activeShopTab);
  grid.innerHTML = items.map(shopCard).join("");

  $$(".shop-tab").forEach((tab) => {
    const active = tab.dataset.shopTab === activeShopTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  });

  renderBoosterStock();
}

function openShop() {
  const modal = $("#shop-modal");
  if (!modal) return;
  clearTimeout(shopCloseTimer);
  if (!modal.hidden && modal.classList.contains("is-open")) return;
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

function initShop() {
  $("#btn-shop")?.addEventListener("click", openShop);
  $$("[data-shop-close]").forEach((el) => el.addEventListener("click", closeShop));
  $("#shop-close")?.addEventListener("click", closeShop);

  $$(".shop-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeShopTab = tab.dataset.shopTab;
      renderShop();
    });
  });

  $("#shop-grid")?.addEventListener("click", (event) => {
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
   Quest actions
   ------------------------------------------------------------------------- */

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

  const card = $(".player-card");
  if (card) {
    card.classList.remove("is-leveling");
    void card.offsetWidth;
    card.classList.add("is-leveling");
    setTimeout(() => card.classList.remove("is-leveling"), 1900);
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
  panel.classList.add("is-defeated");
  pulseWallet();
  toast(`Boss besiegt! +${result.goldReward} Gold · Nächster Raid: LV ${result.nextLevel}`, "magenta");
  setTimeout(() => {
    panel.classList.remove("is-defeated");
    renderBoss();
  }, 1450);
}

function addQuest(event) {
  event.preventDefault();
  const titleInput = $("#quest-title");
  const title = titleInput.value.trim();
  if (!title) return;

  const quest = QM.createQuest({
    title,
    category: $("#quest-category").value,
    difficulty: currentDifficulty(),
  });

  state.quests.push(quest);
  persist();
  render();
  animateQuest(quest.id, "is-new");

  $("#quest-form").reset();
  categoryControl?.select("daily");
  setAutoMode(true);
  $("#quest-difficulty").value = "1";
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
   Idle loot
   ------------------------------------------------------------------------- */

function collectLoot() {
  const result = RAID.collectLoot(state);
  if (!result.ok) return;
  persist();
  updateGold();
  updateLoot();
  pulseWallet();
  audio.playCoin();
  toast(`+${result.gold} Gold aus der Idle-Kiste`, "gold");

  const panel = $("#loot-panel");
  if (panel) {
    panel.classList.add("is-opening");
    setTimeout(() => panel.classList.remove("is-opening"), 900);
  }
}

/* -------------------------------------------------------------------------
   Setup
   ------------------------------------------------------------------------- */

function setup() {
  QM.updateStreak(state);
  QM.resetDailyQuests(state);
  persist();

  categoryControl = initCategoryDropdown();
  initDifficultyControls();
  initShop();

  $("#quest-form").addEventListener("submit", addQuest);
  $("#daily-list").addEventListener("click", handleListClick);
  $("#active-list").addEventListener("click", handleListClick);
  $("#loot-collect").addEventListener("click", collectLoot);

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
      render();
    } catch (error) {
      audio.playError();
      toast("Import fehlgeschlagen.", "magenta");
    } finally {
      event.target.value = "";
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateLoot();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  render();
  updateLoot();
  lootTicker = setInterval(updateLoot, 5000);
  window.addEventListener("beforeunload", () => clearInterval(lootTicker));
}

setup();
