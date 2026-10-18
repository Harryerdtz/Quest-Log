// shop.js — pixel avatar sprites, shop catalog and transactions
import { RUNES, ELEMENT_EFFECTS, isHeroic } from "./dungeon.js";

const svg = (content, className = "avatar-sprite") =>
  `<svg class="${className}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${content}</svg>`;

export const COIN_SVG = `<svg class="coin-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
  <rect x="2" y="0" width="4" height="1" fill="#ffcd38"/>
  <rect x="1" y="1" width="6" height="6" fill="#ffcd38"/>
  <rect x="2" y="7" width="4" height="1" fill="#ffcd38"/>
  <rect x="2" y="1" width="4" height="1" fill="#ffe37a"/>
  <rect x="1" y="2" width="1" height="4" fill="#ffe37a"/>
  <rect x="6" y="2" width="1" height="4" fill="#b8860b"/>
  <rect x="3" y="2" width="2" height="1" fill="#b8860b"/>
  <rect x="3" y="3" width="1" height="3" fill="#b8860b"/>
  <rect x="4" y="5" width="1" height="1" fill="#b8860b"/>
  <rect x="2" y="6" width="4" height="1" fill="#b8860b"/>
</svg>`;

export const AVATARS = {
  avatar_hero: {
    id: "avatar_hero",
    name: "Der Held",
    desc: "Standard-Recke mit goldenem Helm. Solide Basis für jeden Run.",
    price: 0,
    accent: "#ffcd38",
    buff: { goldFind: 0.05 },
    buffText: "+5% Goldfund",
    sprite: svg(`
      <rect x="2" y="10" width="2" height="5" fill="#e94560"/>
      <rect x="12" y="10" width="2" height="5" fill="#e94560"/>
      <rect x="5" y="1" width="6" height="1" fill="#ffcd38"/>
      <rect x="4" y="2" width="8" height="1" fill="#ffcd38"/>
      <rect x="3" y="3" width="10" height="2" fill="#ffcd38"/>
      <rect x="3" y="5" width="1" height="3" fill="#b8860b"/>
      <rect x="12" y="5" width="1" height="3" fill="#b8860b"/>
      <rect x="4" y="5" width="8" height="5" fill="#f4c99a"/>
      <rect x="4" y="5" width="8" height="1" fill="#c99a6b"/>
      <rect x="5" y="7" width="2" height="1" fill="#101218"/>
      <rect x="9" y="7" width="2" height="1" fill="#101218"/>
      <rect x="7" y="9" width="2" height="1" fill="#a86b48"/>
      <rect x="6" y="10" width="4" height="1" fill="#f4c99a"/>
      <rect x="2" y="11" width="2" height="2" fill="#ffcd38"/>
      <rect x="12" y="11" width="2" height="2" fill="#ffcd38"/>
      <rect x="3" y="11" width="10" height="4" fill="#e94560"/>
      <rect x="4" y="13" width="8" height="1" fill="#ffcd38"/>
      <rect x="7" y="12" width="2" height="1" fill="#4eef91"/>
    `),
  },
  avatar_mage: {
    id: "avatar_mage",
    name: "Pixel-Magier",
    desc: "Bündelt rohe Magie in präzise Elementar-Treffer.",
    price: 650,
    accent: "#a78bfa",
    buff: { elementPower: 0.15, crit: 0.05 },
    buffText: "+15% Elementarschaden · +5% Krit",
    sprite: svg(`
      <rect x="6" y="0" width="4" height="1" fill="#7b5cff"/>
      <rect x="5" y="1" width="6" height="1" fill="#7b5cff"/>
      <rect x="4" y="2" width="8" height="1" fill="#7b5cff"/>
      <rect x="2" y="3" width="12" height="2" fill="#7b5cff"/>
      <rect x="4" y="4" width="8" height="1" fill="#ffcd38"/>
      <rect x="4" y="5" width="8" height="5" fill="#f4c99a"/>
      <rect x="4" y="5" width="8" height="1" fill="#c99a6b"/>
      <rect x="5" y="7" width="2" height="1" fill="#4eef91"/>
      <rect x="9" y="7" width="2" height="1" fill="#4eef91"/>
      <rect x="7" y="9" width="2" height="1" fill="#a86b48"/>
      <rect x="4" y="9" width="1" height="2" fill="#dfe3f0"/>
      <rect x="11" y="9" width="1" height="2" fill="#dfe3f0"/>
      <rect x="6" y="10" width="4" height="1" fill="#dfe3f0"/>
      <rect x="2" y="12" width="1" height="2" fill="#f4c99a"/>
      <rect x="13" y="12" width="1" height="2" fill="#f4c99a"/>
      <rect x="3" y="11" width="10" height="4" fill="#7b5cff"/>
      <rect x="4" y="13" width="8" height="1" fill="#ffcd38"/>
      <rect x="7" y="12" width="2" height="1" fill="#4eef91"/>
    `),
  },
  avatar_rogue: {
    id: "avatar_rogue",
    name: "Neon-Schurke",
    desc: "Erledigt Quests lautlos — und trifft, bevor der Gegner blinzelt.",
    price: 1200,
    accent: "#4eef91",
    buff: { crit: 0.15, dodge: 0.1 },
    buffText: "+15% Krit · +10% Ausweichen",
    sprite: svg(`
      <rect x="4" y="1" width="8" height="1" fill="#33405a"/>
      <rect x="3" y="2" width="10" height="3" fill="#33405a"/>
      <rect x="4" y="5" width="8" height="4" fill="#f4c99a"/>
      <rect x="4" y="5" width="8" height="1" fill="#c99a6b"/>
      <rect x="5" y="6" width="2" height="1" fill="#e94560"/>
      <rect x="9" y="6" width="2" height="1" fill="#e94560"/>
      <rect x="7" y="8" width="2" height="1" fill="#a86b48"/>
      <rect x="3" y="9" width="10" height="2" fill="#4eef91"/>
      <rect x="12" y="10" width="2" height="3" fill="#4eef91"/>
      <rect x="2" y="11" width="2" height="2" fill="#cfd6e6"/>
      <rect x="3" y="11" width="10" height="4" fill="#2a2f3d"/>
      <rect x="5" y="12" width="2" height="2" fill="#e94560"/>
      <rect x="9" y="12" width="2" height="2" fill="#e94560"/>
      <rect x="4" y="13" width="8" height="1" fill="#8b90a6"/>
    `),
  },
  avatar_knight: {
    id: "avatar_knight",
    name: "Gold-Ritter",
    desc: "Eine Rüstung aus reinem XP. Steht wie eine Burgmauer.",
    price: 1500,
    accent: "#e94560",
    buff: { maxHp: 30, defense: 5 },
    buffText: "+30 max. HP · +5 Verteidigung",
    sprite: svg(`
      <rect x="7" y="0" width="2" height="2" fill="#4eef91"/>
      <rect x="7" y="2" width="2" height="1" fill="#4eef91"/>
      <rect x="4" y="2" width="8" height="1" fill="#cfd6e6"/>
      <rect x="3" y="3" width="10" height="2" fill="#cfd6e6"/>
      <rect x="3" y="5" width="1" height="3" fill="#8b90a6"/>
      <rect x="12" y="5" width="1" height="3" fill="#8b90a6"/>
      <rect x="4" y="5" width="8" height="1" fill="#8b90a6"/>
      <rect x="4" y="6" width="8" height="3" fill="#6c7488"/>
      <rect x="5" y="7" width="2" height="1" fill="#4eef91"/>
      <rect x="9" y="7" width="2" height="1" fill="#4eef91"/>
      <rect x="2" y="10" width="2" height="2" fill="#cfd6e6"/>
      <rect x="12" y="10" width="2" height="2" fill="#cfd6e6"/>
      <rect x="3" y="10" width="10" height="5" fill="#ffcd38"/>
      <rect x="4" y="11" width="8" height="3" fill="#e94560"/>
      <rect x="7" y="11" width="2" height="2" fill="#ffcd38"/>
    `),
  },
};

const lightningIcon = svg(`
  <rect x="8" y="0" width="4" height="2" fill="#ffcd38"/>
  <rect x="6" y="2" width="4" height="2" fill="#ffcd38"/>
  <rect x="4" y="4" width="6" height="2" fill="#ffe37a"/>
  <rect x="7" y="6" width="5" height="2" fill="#ffe37a"/>
  <rect x="8" y="8" width="3" height="2" fill="#ffcd38"/>
  <rect x="6" y="10" width="3" height="2" fill="#ffcd38"/>
  <rect x="4" y="12" width="3" height="2" fill="#ffcd38"/>
  <rect x="3" y="14" width="2" height="2" fill="#ffcd38"/>
`, "shop-icon");

const coffeeIcon = svg(`
  <rect x="4" y="1" width="2" height="2" fill="#dfe3f0"/>
  <rect x="8" y="0" width="2" height="2" fill="#dfe3f0"/>
  <rect x="11" y="1" width="2" height="2" fill="#dfe3f0"/>
  <rect x="2" y="4" width="10" height="2" fill="#e94560"/>
  <rect x="2" y="6" width="11" height="6" fill="#ffcd38"/>
  <rect x="13" y="7" width="2" height="3" fill="#ffcd38"/>
  <rect x="4" y="8" width="7" height="2" fill="#7a4a1f"/>
  <rect x="3" y="12" width="10" height="1" fill="#b8860b"/>
  <rect x="1" y="13" width="14" height="1" fill="#b8860b"/>
`, "shop-icon");

const playIcon = svg(`
  <rect x="2" y="2" width="12" height="12" fill="#e94560"/>
  <rect x="4" y="4" width="8" height="8" fill="#101216"/>
  <rect x="7" y="5" width="2" height="6" fill="#4eef91"/>
  <rect x="9" y="6" width="2" height="4" fill="#4eef91"/>
  <rect x="11" y="7" width="1" height="2" fill="#4eef91"/>
`, "shop-icon");

const magnetIcon = svg(`
  <rect x="4" y="1" width="8" height="2" fill="#cfd6e6"/>
  <rect x="3" y="3" width="2" height="6" fill="#e94560"/>
  <rect x="11" y="3" width="2" height="6" fill="#e94560"/>
  <rect x="3" y="9" width="2" height="3" fill="#cfd6e6"/>
  <rect x="11" y="9" width="2" height="3" fill="#cfd6e6"/>
  <rect x="5" y="11" width="2" height="2" fill="#ffcd38"/>
  <rect x="9" y="11" width="2" height="2" fill="#ffcd38"/>
`, "shop-icon");

const bossPotionIcon = svg(`
  <rect x="5" y="1" width="6" height="2" fill="#cfd6e6"/>
  <rect x="6" y="3" width="4" height="2" fill="#8b90a6"/>
  <rect x="4" y="5" width="8" height="3" fill="#e94560"/>
  <rect x="3" y="8" width="10" height="4" fill="#e94560"/>
  <rect x="5" y="9" width="2" height="2" fill="#ff9fae"/>
  <rect x="9" y="10" width="2" height="1" fill="#ffcd38"/>
`, "shop-icon");

export const SHOP_ITEMS = [
  ...Object.values(AVATARS).map((avatar) => ({
    id: avatar.id,
    type: "cosmetic",
    name: avatar.name,
    desc: avatar.desc,
    price: avatar.price,
    accent: avatar.accent,
    sprite: avatar.sprite,
    buff: avatar.buff,
    buffText: avatar.buffText,
  })),
  {
    id: "booster_xp",
    type: "booster",
    resource: "xp",
    name: "XP-Elexier",
    desc: "+50% XP für die nächsten 10 abgeschlossenen Quests.",
    price: 150,
    charges: 10,
    accent: "#ffcd38",
    icon: lightningIcon,
  },
  {
    id: "booster_gold",
    type: "booster",
    resource: "gold",
    name: "Gold-Elexier",
    desc: "+50% Gold für die nächsten 10 abgeschlossenen Quests.",
    price: 120,
    charges: 10,
    accent: "#4eef91",
    icon: COIN_SVG.replace("coin-icon", "shop-icon"),
  },
  {
    id: "booster_loot",
    type: "booster",
    resource: "loot",
    name: "Loot-Magnet",
    desc: "+50% Gold aus Dungeon-Räumen für 10 Belohnungen.",
    price: 160,
    charges: 10,
    accent: "#7fd4ff",
    icon: magnetIcon,
  },
  {
    id: "booster_boss",
    type: "booster",
    resource: "boss",
    name: "Boss-Trank",
    desc: "+50% Schaden gegen Raumwächter und Bosse für 5 Treffer.",
    price: 180,
    charges: 5,
    accent: "#e94560",
    icon: bossPotionIcon,
  },
  {
    id: "reward_coffee",
    type: "reward",
    name: "Kaffee-Pause",
    desc: "Zehn Minuten Pause ohne schlechtes Gewissen. Verdient!",
    price: 40,
    accent: "#e94560",
    icon: coffeeIcon,
  },
  {
    id: "reward_episode",
    type: "reward",
    name: "Serien-Folge",
    desc: "Eine Folge deiner Lieblingsserie freischalten und genießen.",
    price: 90,
    accent: "#a78bfa",
    icon: playIcon,
  },
];

export const RUNE_ITEMS = RUNES.map((rune, index) => ({
  id: `rune_${rune.id}`,
  type: "rune",
  rune: rune.id,
  name: `Rune: ${rune.name}`,
  desc: ELEMENT_EFFECTS[rune.id],
  price: [120, 140, 160, 180][index],
  accent: rune.color,
  icon: COIN_SVG.replace("coin-icon", "shop-icon"),
  buffText: ELEMENT_EFFECTS[rune.id],
}));

export function itemPrice(item, mode = "normal") {
  if (!item) return 0;
  return Math.round(item.price * (isHeroic(mode) ? 1.75 : 1));
}

export function getShopItem(id) {
  return SHOP_ITEMS.find((item) => item.id === id) || RUNE_ITEMS.find((item) => item.id === id) || null;
}

export function buyItem(state, item, mode = "normal") {
  if (!item) return { ok: false, reason: "missing" };
  const price = itemPrice(item, mode);
  if (state.gold < price) return { ok: false, reason: "gold" };

  if (item.type === "cosmetic") {
    if (state.owned.includes(item.id)) return { ok: false, reason: "owned" };
    state.gold -= price;
    state.owned.push(item.id);
    return { ok: true, price, message: `${item.name} gekauft. Jetzt ausrüsten!` };
  }

  if (item.type === "booster") {
    state.gold -= price;
    if (item.resource === "xp") state.boosterXp = (state.boosterXp || 0) + item.charges;
    else if (item.resource === "gold") state.boosterGold = (state.boosterGold || 0) + item.charges;
    else if (item.resource === "loot") state.boosterLoot = (state.boosterLoot || 0) + item.charges;
    else if (item.resource === "boss") state.boosterBoss = (state.boosterBoss || 0) + item.charges;
    return { ok: true, price, message: `${item.name}: +${item.charges} Ladungen aktiviert.` };
  }

  state.gold -= price;
  return { ok: true, price, message: `Belohnung eingelöst: ${item.name}.` };
}

export function buyRune(state, item, mode = "normal") {
  if (!item || item.type !== "rune") return { ok: false, reason: "invalid" };
  if (state.runes.includes(item.rune)) return { ok: false, reason: "owned" };
  const price = itemPrice(item, mode);
  if (state.gold < price) return { ok: false, reason: "gold" };
  state.gold -= price;
  state.runes.push(item.rune);
  if (!state.rune) state.rune = item.rune;
  return { ok: true, price, message: `${item.name} freigeschaltet.` };
}

export function equipRune(state, item) {
  if (!item || item.type !== "rune") return { ok: false, reason: "invalid" };
  if (!state.runes.includes(item.rune)) return { ok: false, reason: "locked" };
  state.rune = item.rune;
  return { ok: true, message: `${item.name} aktiviert.` };
}

export function avatarBuff(avatarId) {
  return AVATARS[avatarId]?.buff || {};
}

export function equipAvatar(state, item) {
  if (!item || item.type !== "cosmetic") return { ok: false, reason: "invalid" };
  if (!state.owned.includes(item.id)) return { ok: false, reason: "not-owned" };
  state.equippedAvatar = item.id;
  return { ok: true, message: `${item.name} ausgerüstet.` };
}
