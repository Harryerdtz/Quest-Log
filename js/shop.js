// shop.js — pixel avatar sprites, shop catalog and transactions
import { RUNES, ELEMENT_EFFECTS, isHeroic } from "./dungeon.js";
import { CONSUMABLES, ITEM_ICONS, SCROLL_ICONS, POTION_ICONS } from "./items.js";

const svg = (content, className = "avatar-sprite") =>
  `<svg class="${className}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${content}</svg>`;

// Shared 16x16 hero silhouette so every class skin stays in the same pixel grid.
const classSprite = ({ robe, trim, eye, metal }) =>
  svg(`
    <rect x="6" y="0" width="4" height="1" fill="${trim}"/>
    <rect x="4" y="1" width="8" height="1" fill="${trim}"/>
    <rect x="3" y="2" width="10" height="2" fill="${trim}"/>
    <rect x="3" y="4" width="1" height="3" fill="${metal}"/>
    <rect x="12" y="4" width="1" height="3" fill="${metal}"/>
    <rect x="4" y="4" width="8" height="1" fill="#c99a6b"/>
    <rect x="4" y="5" width="8" height="4" fill="#f4c99a"/>
    <rect x="5" y="6" width="2" height="2" fill="${eye}"/>
    <rect x="9" y="6" width="2" height="2" fill="${eye}"/>
    <rect x="7" y="8" width="2" height="1" fill="#a86b48"/>
    <rect x="2" y="9" width="2" height="4" fill="${metal}"/>
    <rect x="12" y="9" width="2" height="4" fill="${metal}"/>
    <rect x="3" y="9" width="10" height="6" fill="${robe}"/>
    <rect x="4" y="10" width="8" height="1" fill="${trim}"/>
    <rect x="7" y="11" width="2" height="3" fill="${trim}"/>
    <rect x="5" y="14" width="2" height="1" fill="${robe}"/>
    <rect x="9" y="14" width="2" height="1" fill="${robe}"/>
  `);

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
  avatar_warden: {
    id: "avatar_warden",
    name: "Eiserner Wächter",
    desc: "Krieger-Skin: Schwere Platten und ein Turmschild, das jede Etage übersteht.",
    price: 2200,
    accent: "#7fd4ff",
    buff: { maxHp: 45, defense: 7, block: 0.05 },
    buffText: "+45 max. HP · +7 Verteidigung · +5% Blocken",
    sprite: classSprite({ robe: "#4a5568", trim: "#cfd6e6", eye: "#7fd4ff", metal: "#8b90a6" }),
  },
  avatar_archon: {
    id: "avatar_archon",
    name: "Arkaner Archon",
    desc: "Magier-Skin: Ein Gewand aus Sternenstaub bündelt jede Rune doppelt.",
    price: 2600,
    accent: "#a78bfa",
    buff: { elementPower: 0.25, crit: 0.08, mana: 8 },
    buffText: "+25% Elementarschaden · +8% Krit · +8 Mana",
    sprite: classSprite({ robe: "#5b3fa8", trim: "#a78bfa", eye: "#ffcd38", metal: "#cfd6e6" }),
  },
  avatar_nightblade: {
    id: "avatar_nightblade",
    name: "Nachtschatten",
    desc: "Schurken-Skin: Schlägt aus dem Schatten zu und sammelt Beute im Vorbeigehen.",
    price: 2400,
    accent: "#4eef91",
    buff: { crit: 0.18, dodge: 0.14, luck: 0.1 },
    buffText: "+18% Krit · +14% Ausweichen · +10% Loot-Glück",
    sprite: classSprite({ robe: "#22303f", trim: "#4eef91", eye: "#e94560", metal: "#8b90a6" }),
  },
  avatar_lightbringer: {
    id: "avatar_lightbringer",
    name: "Lichtbringer",
    desc: "Kleriker-Skin: Göttlicher Segen heilt tiefe Wunden und stärkt die Rüstung.",
    price: 2500,
    accent: "#ffe37a",
    buff: { maxHp: 25, healing: 0.3, defense: 4 },
    buffText: "+25 max. HP · +30% Heilung · +4 Verteidigung",
    sprite: classSprite({ robe: "#e9e2c8", trim: "#ffcd38", eye: "#4eef91", metal: "#b8860b" }),
  },
  avatar_paladin: {
    id: "avatar_paladin",
    name: "Silber-Paladin",
    desc: "Kleriker-Skin in schwerer Platte: Segen heilt und schützt zugleich.",
    price: 3000,
    accent: "#dfe3f0",
    buff: { maxHp: 35, defense: 6, healing: 0.2 },
    buffText: "+35 max. HP · +6 Verteidigung · +20% Heilung",
    sprite: classSprite({ robe: "#cfd6e6", trim: "#ffcd38", eye: "#4eef91", metal: "#8b90a6" }),
  },
  avatar_warlock: {
    id: "avatar_warlock",
    name: "Blut-Warlock",
    desc: "Magier-Skin: Tauscht Lebenskraft gegen rohe Elementargewalt.",
    price: 2800,
    accent: "#e94560",
    buff: { elementPower: 0.35, crit: 0.1 },
    buffText: "+35% Elementarschaden · +10% Krit",
    sprite: classSprite({ robe: "#3a1f4f", trim: "#e94560", eye: "#ffcd38", metal: "#a78bfa" }),
  },
  avatar_ranger: {
    id: "avatar_ranger",
    name: "Waldläuferin",
    desc: "Jägerin-Skin: Leise Sohlen, schnelle Pfeile, sichere Beute.",
    price: 2300,
    accent: "#7fd4ff",
    buff: { crit: 0.1, dodge: 0.16, luck: 0.08 },
    buffText: "+10% Krit · +16% Ausweichen · +8% Loot-Glück",
    sprite: classSprite({ robe: "#2f4a2c", trim: "#7fd4ff", eye: "#4eef91", metal: "#b8860b" }),
  },
  avatar_oracle: {
    id: "avatar_oracle",
    name: "Orakel",
    desc: "Kleriker-Skin: Sieht den nächsten Treffer voraus und segnet ihn.",
    price: 2750,
    accent: "#eafcff",
    buff: { healing: 0.4, block: 0.08, mana: 12 },
    buffText: "+40% Heilung · +8% Blocken · +12 Mana",
    sprite: classSprite({ robe: "#e9e2c8", trim: "#7fd4ff", eye: "#a78bfa", metal: "#cfd6e6" }),
  },
  avatar_shadowblade: {
    id: "avatar_shadowblade",
    name: "Schattenklinge",
    desc: "Schurken-Skin: Verschwindet zwischen zwei Kacheln und schlägt aus dem Nichts.",
    price: 2900,
    accent: "#a78bfa",
    buff: { crit: 0.22, dodge: 0.12 },
    buffText: "+22% Krit · +12% Ausweichen",
    sprite: classSprite({ robe: "#101218", trim: "#a78bfa", eye: "#e94560", metal: "#6c7488" }),
  },
  avatar_tinkerer: {
    id: "avatar_tinkerer",
    name: "Tüftler",
    desc: "Krieger-Skin: Schraubt an Rüstung und Loot, bis alles passt.",
    price: 1900,
    accent: "#4eef91",
    buff: { defense: 4, luck: 0.12, goldFind: 0.2 },
    buffText: "+4 Verteidigung · +12% Loot-Glück · +20% Goldfund",
    sprite: classSprite({ robe: "#8a5a2b", trim: "#4eef91", eye: "#ffcd38", metal: "#cfd6e6" }),
  },
  avatar_druid: {
    id: "avatar_druid",
    name: "Druide",
    desc: "Natur-Skin: Wurzeln heilen, Ranken blocken, Bienen stechen.",
    price: 2400,
    accent: "#ffe37a",
    buff: { maxHp: 25, healing: 0.25, block: 0.06 },
    buffText: "+25 max. HP · +25% Heilung · +6% Blocken",
    sprite: classSprite({ robe: "#2f5d3a", trim: "#ffe37a", eye: "#4eef91", metal: "#7a4a1f" }),
  },
  avatar_voidwalker: {
    id: "avatar_voidwalker",
    name: "Leerengänger",
    desc: "Legendärer Skin: Ein Riss im Pixelraum, der Beute anzieht.",
    price: 3800,
    accent: "#cbb8ff",
    buff: { elementPower: 0.2, crit: 0.12, luck: 0.2, maxHp: 20 },
    buffText: "+20% Elementarschaden · +12% Krit · +20% Loot-Glück",
    sprite: classSprite({ robe: "#1b1730", trim: "#cbb8ff", eye: "#eafcff", metal: "#5b3fa8" }),
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

const keyIcon = svg(`
  <rect x="2" y="6" width="5" height="4" fill="#ffcd38"/>
  <rect x="3" y="7" width="2" height="2" fill="#101216"/>
  <rect x="7" y="7" width="6" height="2" fill="#ffcd38"/>
  <rect x="11" y="9" width="2" height="2" fill="#ffcd38"/>
  <rect x="8" y="9" width="1" height="2" fill="#ffcd38"/>
  <rect x="2" y="6" width="5" height="1" fill="#ffe37a"/>
`, "shop-icon");

const napIcon = svg(`
  <rect x="2" y="9" width="12" height="4" fill="#5b6478"/>
  <rect x="3" y="7" width="10" height="2" fill="#e9e2c8"/>
  <rect x="4" y="5" width="8" height="2" fill="#7fd4ff"/>
  <rect x="6" y="2" width="1" height="2" fill="#eafcff"/>
  <rect x="9" y="1" width="1" height="2" fill="#eafcff"/>
  <rect x="1" y="12" width="3" height="1" fill="#4a5568"/>
`, "shop-icon");

const snackIcon = svg(`
  <rect x="3" y="3" width="10" height="9" fill="#e9a23b"/>
  <rect x="4" y="2" width="8" height="1" fill="#ffcd38"/>
  <rect x="4" y="12" width="8" height="1" fill="#b8860b"/>
  <rect x="6" y="5" width="1" height="1" fill="#7a4a1f"/>
  <rect x="9" y="5" width="1" height="1" fill="#7a4a1f"/>
  <rect x="6" y="8" width="4" height="1" fill="#7a4a1f"/>
`, "shop-icon");

const gemIcon = (color) => svg(`
  <rect x="6" y="1" width="4" height="1" fill="${color}"/>
  <rect x="4" y="2" width="8" height="2" fill="${color}"/>
  <rect x="3" y="4" width="10" height="4" fill="${color}"/>
  <rect x="4" y="8" width="8" height="2" fill="${color}"/>
  <rect x="6" y="10" width="4" height="2" fill="${color}"/>
  <rect x="5" y="3" width="2" height="2" fill="#ffffff" opacity="0.45"/>
  <rect x="7" y="12" width="2" height="2" fill="#8b90a6"/>
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
    icon: avatar.sprite,
    buff: avatar.buff,
    buffText: avatar.buffText,
  })),
  {
    id: "booster_xp",
    type: "booster",
    resource: "xp",
    name: "XP-Multiplikator",
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
    name: "Boss-Killer-Elixier",
    desc: "+50% Schaden gegen Raumwächter und Bosse für 5 Treffer.",
    price: 180,
    charges: 5,
    accent: "#e94560",
    icon: bossPotionIcon,
  },
  {
    id: "booster_luck",
    type: "booster",
    resource: "luck",
    name: "Loot-Glücks-Trank",
    desc: "+1 Loot-Glück für die nächsten 10 Drops — mehr Selten, Episch und Legendär.",
    price: 220,
    charges: 10,
    accent: "#a78bfa",
    icon: magnetIcon,
  },
  {
    id: "booster_mana",
    type: "booster",
    resource: "mana",
    name: "Mana-Trank",
    desc: "Füllt im Kampf sofort 60% Mana auf — 10 Ladungen.",
    price: 140,
    charges: 10,
    accent: "#7fd4ff",
    icon: bossPotionIcon,
  },
  {
    id: "booster_xp_mega",
    type: "booster",
    resource: "xp",
    name: "XP-Orbital",
    desc: "+50% XP für die nächsten 25 Quests.",
    price: 320,
    charges: 25,
    accent: "#ffe37a",
    icon: lightningIcon,
  },
  {
    id: "booster_gold_mega",
    type: "booster",
    resource: "gold",
    name: "Gold-Ader",
    desc: "+50% Gold für die nächsten 25 Quests.",
    price: 280,
    charges: 25,
    accent: "#ffcd38",
    icon: COIN_SVG.replace("coin-icon", "shop-icon"),
  },
  {
    id: "booster_heal",
    type: "booster",
    resource: "heal",
    name: "Sanfter Trank",
    desc: "Heilt sofort 50 HP im Verlies — ohne Kampfrunde.",
    price: 90,
    accent: "#e94560",
    icon: POTION_ICONS.potion_greater_heal,
  },
  {
    id: "booster_key",
    type: "booster",
    resource: "key",
    name: "Dietrich-Set",
    desc: "Ein Schlüssel für verschlossene Pforten. Öffnet eine Tür im Verlies.",
    price: 130,
    charges: 1,
    accent: "#ffcd38",
    icon: keyIcon,
  },
  {
    id: "booster_luck_mega",
    type: "booster",
    resource: "luck",
    name: "Glücks-Rune",
    desc: "+1 Loot-Glück für die nächsten 25 Drops.",
    price: 400,
    charges: 25,
    accent: "#cbb8ff",
    icon: magnetIcon,
  },
  {
    id: "booster_boss_mega",
    type: "booster",
    resource: "boss",
    name: "Boss-Jäger-Kombo",
    desc: "+50% Schaden gegen Bosse für 10 Treffer.",
    price: 330,
    charges: 10,
    accent: "#e94560",
    icon: bossPotionIcon,
  },
  ...Object.values(CONSUMABLES)
    .filter((consumable) => consumable.kind === "scroll")
    .map((consumable) => ({
      id: `shop_${consumable.id}`,
      type: "scroll",
      consumableId: consumable.id,
      name: consumable.name,
      desc: `${consumable.desc} Landet im Inventar-Beutel für die Schnellslots.`,
      price: consumable.value,
      accent: consumable.rarity === "epic" ? "#a78bfa" : consumable.rarity === "common" ? "#a7adbd" : "#ffcd38",
      icon: SCROLL_ICONS[consumable.id],
      buffText: consumable.desc,
    })),
  ...[
    { id: "gear_steel_sword", kind: "sword", rarity: "rare", price: 260, name: "Stahlklinge", accent: "#7fd4ff" },
    { id: "gear_rune_axe", kind: "axe", rarity: "epic", price: 520, name: "Runen-Axt", accent: "#a78bfa" },
    { id: "gear_shadow_dagger", kind: "dagger", rarity: "epic", price: 480, name: "Schattenklinge", accent: "#4eef91" },
    { id: "gear_tower_shield", kind: "shield", rarity: "rare", price: 300, name: "Turmschild", accent: "#7fd4ff" },
    { id: "gear_arcane_wand", kind: "wand", rarity: "epic", price: 540, name: "Arkanstab", accent: "#a78bfa" },
    { id: "gear_plate_armor", kind: "armor", rarity: "epic", price: 560, name: "Plattenpanzer", accent: "#cfd6e6" },
    { id: "gear_lucky_ring", kind: "ring", rarity: "rare", price: 340, name: "Glücksring", accent: "#ffcd38" },
    { id: "gear_heart_amulet", kind: "amulet", rarity: "epic", price: 500, name: "Herzamulett", accent: "#e94560" },
    { id: "gear_mace", kind: "mace", rarity: "rare", price: 320, name: "Runenkolben", accent: "#ffcd38" },
    { id: "gear_robe", kind: "robe", rarity: "rare", price: 360, name: "Sternenrobe", accent: "#a78bfa" },
    { id: "gear_guard_shield", kind: "shield", rarity: "epic", price: 480, name: "Wächterschild", accent: "#4eef91" },
    { id: "gear_swift_dagger", kind: "dagger", rarity: "rare", price: 280, name: "Flinker Dolch", accent: "#7fd4ff" },
  ].map((gear) => ({
    id: gear.id,
    type: "gear",
    kind: gear.kind,
    rarity: gear.rarity,
    floor: 5,
    name: gear.name,
    desc: "Direktkauf fürs Inventar: wird als Item in den Beutel gelegt und ist dort ausrüstbar.",
    price: gear.price,
    accent: gear.accent,
    icon: ITEM_ICONS[gear.kind],
    buffText: `Seltenheit: ${gear.rarity}`,
  })),
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
  {
    id: "reward_nap",
    type: "reward",
    name: "Power-Nap",
    desc: "Zwanzig Minuten Schlaf. Danach fühlt sich jede Quest leichter an.",
    price: 120,
    accent: "#7fd4ff",
    icon: napIcon,
  },
  {
    id: "reward_snack",
    type: "reward",
    name: "Lieblings-Snack",
    desc: "Eine Belohnung, die schmeckt — und den nächsten Run versüßt.",
    price: 70,
    accent: "#ffcd38",
    icon: snackIcon,
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
  icon: gemIcon(rune.color),
  buffText: ELEMENT_EFFECTS[rune.id],
}));

export function itemPrice(item, mode = "normal") {
  if (!item) return 0;
  return Math.round(item.price * (isHeroic(mode) ? 1.75 : 1));
}

export function getShopItem(id) {
  return SHOP_ITEMS.find((item) => item.id === id) || RUNE_ITEMS.find((item) => item.id === id) || null;
}

export function buyItem(state, item, mode = "normal", options = {}) {
  if (!item) return { ok: false, reason: "missing" };
  const price = itemPrice(item, mode);
  if (state.gold < price) return { ok: false, reason: "gold" };

  if (item.type === "scroll") {
    const consumable = options.createConsumable
      ? options.createConsumable(item.consumableId)
      : null;
    if (!consumable) return { ok: false, reason: "invalid" };
    state.gold -= price;
    return { ok: true, price, consumable, message: `${item.name} in den Beutel gelegt.` };
  }

  if (item.type === "gear") {
    const gear = options.createItem
      ? options.createItem({ floor: item.floor || 5, kind: item.kind, rarity: item.rarity })
      : null;
    if (!gear) return { ok: false, reason: "invalid" };
    state.gold -= price;
    return { ok: true, price, gear, message: `${gear.name} in den Beutel gelegt.` };
  }

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
    else if (item.resource === "luck") state.boosterLuck = (state.boosterLuck || 0) + item.charges;
    else if (item.resource === "mana") state.boosterMana = (state.boosterMana || 0) + item.charges;
    else if (item.resource === "key") state.keys = (state.keys || 0) + (item.charges || 1);
    else if (item.resource === "heal") {
      const hp = Number.isFinite(state.dungeon?.hp) ? state.dungeon.hp : 1;
      state.dungeon = state.dungeon || {};
      state.dungeon.hp = hp + 50;
    }
    if (item.resource === "key") return { ok: true, price, message: `${item.name}: Schlüssel im Beutel.` };
    return { ok: true, price, message: `${item.name}: +${item.charges || 1} Ladungen aktiviert.` };
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
