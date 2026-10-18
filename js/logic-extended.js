// logic-extended.js — Auto-difficulty, Boss, Idle Gold, Shop, Inventory, Custom Dropdowns

// ---------- 1. Auto-Difficulty Heuristic ----------
const KEYWORDS = {
  hard: ["projekt", "prüfungsphase", "voraussetzungsreich", "bugfix", "deadline", "präsentation", "exam"],
  medium: ["lernen", "kochen", "training", "recherche", "1 stunde", "30 min"],
  easy: ["einkaufen", "aufräumen", "lesen", "trinken", "spazieren"],
};

export function estimateDifficulty(title) {
  const t = (title || "").toLowerCase();
  let score = 0;
  // word length
  const words = t.split(/\s+/).filter(Boolean);
  const avgLen = words.reduce((a, w) => a + w.length, 0) / Math.max(1, words.length);
  if (avgLen > 8) score += 2;
  // time mentions
  const timeMatch = t.match(/(\d+)\s*(min|stunde|hour|h)/);
  if (timeMatch) {
    const n = parseInt(timeMatch[1], 10);
    if (n >= 60) score += 3;
    else if (n >= 30) score += 2;
    else score += 1;
  }
  for (const k of KEYWORDS.hard) if (t.includes(k)) score += 3;
  for (const k of KEYWORDS.medium) if (t.includes(k)) score += 2;
  for (const k of KEYWORDS.easy) if (t.includes(k)) score -= 1;

  if (score >= 6) return { difficulty: "hard", xp: 50 };
  if (score >= 3) return { difficulty: "medium", xp: 25 };
  return { difficulty: "easy", xp: 10 };
}

// ---------- 2. Boss System ----------
export function initBoss(state) {
  if (!state.boss) {
    state.boss = { name: "Weekly Boss", hp: 500, maxHp: 500, period: "weekly" };
  }
  return state.boss;
}

export function damageBoss(state, xpGained) {
  const boss = initBoss(state);
  boss.hp = Math.max(0, boss.hp - xpGained);
  if (boss.hp === 0) {
    state.gold = (state.gold || 0) + 100;
    boss.hp = boss.maxHp;
    state.bossDefeated = (state.bossDefeated || 0) + 1;
  }
  return boss;
}

// ---------- 3. Idle Gold ----------
export function claimIdleGold(state) {
  const now = Date.now();
  const last = state.lastIdleClaim || now;
  const hours = Math.floor((now - last) / 3600000);
  if (hours <= 0) return 0;
  const rate = 5 + (state.level || 1) * 2 + (state.streak || 0);
  const gold = hours * rate;
  state.gold = (state.gold || 0) + gold;
  state.lastIdleClaim = now;
  return gold;
}

// ---------- 4. Shop & Inventory ----------
const SHOP_ITEMS = [
  { id: "skin_neon", name: "Neon Frame", type: "cosmetic", price: 50 },
  { id: "booster_2x", name: "2x XP (24h)", type: "booster", price: 100, effect: "2x", duration: 86400000 },
  { id: "reward_pizza", name: "1x Pizza (Real Life)", type: "reward", price: 200 },
];

export function getShopItems() { return SHOP_ITEMS; }

export function buyItem(state, itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: "not_found" };
  if ((state.gold || 0) < item.price) return { ok: false, reason: "no_gold" };
  state.gold -= item.price;
  state.inventory = state.inventory || [];
  state.inventory.push({ ...item, purchasedAt: Date.now() });
  if (item.type === "booster") {
    state.activeBooster = { id: item.id, until: Date.now() + item.duration };
  }
  return { ok: true, item };
}

export function isBoosterActive(state) {
  return !!(state.activeBooster && state.activeBooster.until > Date.now());
}

// ---------- 5. Custom Dropdown / Modal Controller ----------
export class DropdownController {
  constructor(root) {
    this.root = root;
    this.open = false;
    this.value = null;
    this.options = [];
    this.listeners = [];
    root.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-option]");
      if (opt) {
        this.value = opt.dataset.option;
        this.close();
        this.listeners.forEach((cb) => cb(this.value));
        return;
      }
      if (e.target.closest("[data-toggle]")) this.toggle();
    });
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) this.close();
    });
  }
  setOptions(opts) { this.options = opts; this.render(); }
  toggle() { this.open = !this.open; this.root.classList.toggle("open", this.open); }
  close() { this.open = false; this.root.classList.remove("open"); }
  onChange(cb) { this.listeners.push(cb); }
  render() {
    const list = this.root.querySelector("[data-list]");
    if (list) list.innerHTML = this.options.map((o) => `<li data-option="${o.value}">${o.label}</li>`).join("");
  }
}

export class ModalController {
  constructor(root) {
    this.root = root;
    root.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]") || e.target === root) this.close();
    });
  }
  open() { this.root.classList.add("open"); this.root.setAttribute("aria-hidden", "false"); }
  close() { this.root.classList.remove("open"); this.root.setAttribute("aria-hidden", "true"); }
}
