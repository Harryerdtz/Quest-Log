// dungeon.js — dungeon crawler, equipment stats, elements and difficulty balancing
import { classStatDelta, classMaxMana } from "./classes.js";

const icon = (content) =>
  `<svg class="shop-icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${content}</svg>`;

export const UPGRADES = [
  {
    id: "weapon",
    name: "Klinge",
    desc: "+3 Angriff pro Stufe. Kernschaden gegen jede Etage.",
    baseCost: 60,
    stat: "ANG",
    icon: icon(`
      <rect x="11" y="1" width="3" height="2" fill="#cfd6e6"/>
      <rect x="9" y="3" width="3" height="3" fill="#cfd6e6"/>
      <rect x="7" y="5" width="3" height="3" fill="#8b90a6"/>
      <rect x="5" y="7" width="3" height="3" fill="#ffcd38"/>
      <rect x="3" y="9" width="3" height="3" fill="#7a4a1f"/>
      <rect x="4" y="12" width="3" height="2" fill="#ffcd38"/>
    `),
  },
  {
    id: "armor",
    name: "Rüstung",
    desc: "+2 Verteidigung, +4 HP und +1% Blockchance pro Stufe.",
    baseCost: 75,
    stat: "DEF",
    icon: icon(`
      <rect x="5" y="3" width="6" height="2" fill="#cfd6e6"/>
      <rect x="3" y="5" width="10" height="6" fill="#8b90a6"/>
      <rect x="5" y="7" width="6" height="4" fill="#ffcd38"/>
      <rect x="7" y="8" width="2" height="2" fill="#4eef91"/>
      <rect x="4" y="11" width="8" height="2" fill="#6c7488"/>
    `),
  },
  {
    id: "strength",
    name: "Stärke",
    desc: "+2 Angriff und +1,5% Kritchance pro Stufe.",
    baseCost: 50,
    stat: "KRI",
    icon: icon(`
      <rect x="6" y="2" width="4" height="5" fill="#f4c99a"/>
      <rect x="5" y="7" width="6" height="3" fill="#e94560"/>
      <rect x="4" y="8" width="2" height="3" fill="#f4c99a"/>
      <rect x="10" y="8" width="2" height="3" fill="#f4c99a"/>
      <rect x="6" y="10" width="4" height="2" fill="#b32443"/>
    `),
  },
  {
    id: "vitality",
    name: "Vitalität",
    desc: "+10 max. HP pro Stufe. Überlebt tiefere Etagen.",
    baseCost: 55,
    stat: "HP",
    icon: icon(`
      <rect x="4" y="3" width="2" height="2" fill="#e94560"/>
      <rect x="10" y="3" width="2" height="2" fill="#e94560"/>
      <rect x="3" y="5" width="10" height="3" fill="#e94560"/>
      <rect x="4" y="8" width="8" height="2" fill="#e94560"/>
      <rect x="6" y="10" width="4" height="2" fill="#e94560"/>
      <rect x="7" y="12" width="2" height="2" fill="#e94560"/>
      <rect x="6" y="5" width="2" height="2" fill="#ff9fae"/>
    `),
  },
  {
    id: "wand",
    name: "Runenstab",
    desc: "+2 Angriff, +2% Krit und +5% Elementarschaden pro Stufe.",
    baseCost: 80,
    stat: "MAG",
    icon: icon(`
      <rect x="7" y="1" width="2" height="2" fill="#a78bfa"/>
      <rect x="6" y="3" width="4" height="1" fill="#a78bfa"/>
      <rect x="7" y="4" width="2" height="7" fill="#7a4a1f"/>
      <rect x="8" y="5" width="1" height="5" fill="#a96a2c"/>
      <rect x="6" y="11" width="4" height="2" fill="#ffcd38"/>
    `),
  },
  {
    id: "amulet",
    name: "Amulett",
    desc: "+6 max. HP und +5% Goldfund pro Stufe.",
    baseCost: 90,
    stat: "GLD",
    icon: icon(`
      <rect x="6" y="1" width="1" height="2" fill="#cfd6e6"/>
      <rect x="9" y="1" width="1" height="2" fill="#cfd6e6"/>
      <rect x="5" y="3" width="6" height="1" fill="#cfd6e6"/>
      <rect x="6" y="4" width="4" height="3" fill="#4eef91"/>
      <rect x="7" y="5" width="2" height="1" fill="#83ffba"/>
      <rect x="7" y="7" width="2" height="3" fill="#ffcd38"/>
      <rect x="6" y="10" width="4" height="1" fill="#b8860b"/>
    `),
  },
  {
    id: "shield",
    name: "Turmschild",
    desc: "+2 Verteidigung und +2% Blockchance pro Stufe.",
    baseCost: 85,
    stat: "DEF",
    icon: icon(`
      <rect x="4" y="2" width="8" height="2" fill="#cfd6e6"/>
      <rect x="3" y="4" width="10" height="5" fill="#8b90a6"/>
      <rect x="4" y="9" width="8" height="2" fill="#6c7488"/>
      <rect x="6" y="11" width="4" height="2" fill="#6c7488"/>
      <rect x="7" y="4" width="2" height="5" fill="#ffcd38"/>
      <rect x="5" y="5" width="2" height="2" fill="#ffcd38"/>
      <rect x="9" y="5" width="2" height="2" fill="#ffcd38"/>
    `),
  },
  {
    id: "ring",
    name: "Siegelring",
    desc: "+1 Angriff, +1% Krit und +1% Blockchance pro Stufe.",
    baseCost: 95,
    stat: "KRI",
    icon: icon(`
      <rect x="5" y="4" width="6" height="2" fill="#ffcd38"/>
      <rect x="4" y="6" width="2" height="4" fill="#b8860b"/>
      <rect x="10" y="6" width="2" height="4" fill="#b8860b"/>
      <rect x="6" y="10" width="4" height="2" fill="#b8860b"/>
      <rect x="7" y="1" width="2" height="2" fill="#e94560"/>
      <rect x="6" y="2" width="4" height="2" fill="#e94560"/>
      <rect x="7" y="3" width="2" height="1" fill="#ff9fae"/>
    `),
  },
];

export const ELEMENT_EFFECTS = {
  fire: "Feuer: Brand — 2 Runden Schaden über Zeit",
  frost: "Frost: verlangsamt — 35% Chance, den Konter einzufrieren",
  storm: "Sturm: +15% Kritchance auf Blitzeinschläge",
  shadow: "Schatten: 25% Lebensraub pro Treffer",
};

export const ELEMENTS = {
  fire: { id: "fire", name: "Feuer", color: "#ff8a3d", weak: "frost", icon: "▲" },
  frost: { id: "frost", name: "Frost", color: "#7fd4ff", weak: "storm", icon: "❄" },
  storm: { id: "storm", name: "Sturm", color: "#ffcd38", weak: "shadow", icon: "⚡" },
  shadow: { id: "shadow", name: "Schatten", color: "#a78bfa", weak: "fire", icon: "☠" },
};

export const RUNES = Object.values(ELEMENTS).map((element) => ({
  ...element,
  label: element.name.toUpperCase(),
}));

const ENEMY_NAMES = {
  fire: ["Glut-Goblin", "Ofen-Imp", "Lava-Schreiber", "Brand-Fledermaus"],
  frost: ["Frost-Slime", "Eis-Wicht", "Schnee-Golem", "Gletscher-Ratte"],
  storm: ["Sturm-Fledermaus", "Blitz-Wicht", "Donner-Golem", "Spannungs-Geist"],
  shadow: ["Schatten-Gespenst", "Fluch-Katze", "Nacht-Golem", "Dunkel-Slime"],
};

const ELITE_NAMES = {
  fire: ["Glut-Titan", "Ofen-Koloss", "Lava-Leviathan"],
  frost: ["Eis-Titan", "Frost-Koloss", "Gletscher-Leviathan"],
  storm: ["Sturm-Titan", "Blitz-Koloss", "Donner-Leviathan"],
  shadow: ["Schatten-Titan", "Fluch-Koloss", "Nacht-Leviathan"],
};

const ELEMENT_ORDER = ["fire", "frost", "storm", "shadow"];

const SVG_OPEN =
  '<svg class="enemy-sprite" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">';

const ELITE_CROWN = `<g class="enemy-crown">
  <rect x="5" y="0" width="1" height="2" fill="#ffcd38"/>
  <rect x="7" y="0" width="2" height="2" fill="#ffcd38"/>
  <rect x="10" y="0" width="1" height="2" fill="#ffcd38"/>
  <rect x="5" y="2" width="6" height="1" fill="#ffcd38"/>
  <rect x="7" y="2" width="2" height="1" fill="#e94560"/>
</g>`;

const ENEMY_SPRITES = {
  fire: `
    <rect x="6" y="2" width="1" height="2" fill="#ff8a3d"/>
    <rect x="9" y="2" width="1" height="2" fill="#ff8a3d"/>
    <rect x="5" y="3" width="6" height="2" fill="#e94560"/>
    <rect x="4" y="5" width="8" height="4" fill="#e94560"/>
    <rect x="5" y="5" width="2" height="2" fill="#101218"/>
    <rect x="9" y="5" width="2" height="2" fill="#101218"/>
    <rect x="5" y="8" width="6" height="2" fill="#b32443"/>
    <rect x="3" y="8" width="2" height="2" fill="#ff8a3d"/>
    <rect x="11" y="8" width="2" height="2" fill="#ff8a3d"/>
    <rect x="5" y="10" width="2" height="3" fill="#b32443"/>
    <rect x="9" y="10" width="2" height="3" fill="#b32443"/>
    <rect x="13" y="9" width="2" height="1" fill="#ff8a3d"/>
    <rect x="14" y="10" width="1" height="2" fill="#ff8a3d"/>
  `,
  frost: `
    <rect x="7" y="1" width="2" height="1" fill="#eafcff"/>
    <rect x="5" y="2" width="6" height="2" fill="#7fd4ff"/>
    <rect x="4" y="4" width="8" height="3" fill="#7fd4ff"/>
    <rect x="2" y="4" width="2" height="2" fill="#c9f2ff"/>
    <rect x="12" y="4" width="2" height="2" fill="#c9f2ff"/>
    <rect x="5" y="5" width="2" height="2" fill="#101218"/>
    <rect x="9" y="5" width="2" height="2" fill="#101218"/>
    <rect x="6" y="8" width="4" height="1" fill="#101218"/>
    <rect x="4" y="8" width="8" height="2" fill="#4ea9d8"/>
    <rect x="6" y="10" width="4" height="2" fill="#7fd4ff"/>
    <rect x="7" y="12" width="2" height="2" fill="#c9f2ff"/>
    <rect x="3" y="2" width="1" height="1" fill="#eafcff"/>
    <rect x="12" y="9" width="1" height="1" fill="#eafcff"/>
  `,
  storm: `
    <rect x="4" y="2" width="2" height="2" fill="#ffcd38"/>
    <rect x="10" y="2" width="2" height="2" fill="#ffcd38"/>
    <rect x="6" y="3" width="4" height="2" fill="#ffcd38"/>
    <rect x="1" y="5" width="4" height="2" fill="#b8860b"/>
    <rect x="11" y="5" width="4" height="2" fill="#b8860b"/>
    <rect x="2" y="7" width="3" height="2" fill="#ffcd38"/>
    <rect x="11" y="7" width="3" height="2" fill="#ffcd38"/>
    <rect x="4" y="6" width="8" height="5" fill="#ffcd38"/>
    <rect x="5" y="7" width="2" height="2" fill="#101218"/>
    <rect x="9" y="7" width="2" height="2" fill="#101218"/>
    <rect x="6" y="10" width="1" height="2" fill="#fff3c4"/>
    <rect x="9" y="10" width="1" height="2" fill="#fff3c4"/>
  `,
  shadow: `
    <rect x="5" y="3" width="6" height="2" fill="#6b4bb8"/>
    <rect x="3" y="5" width="10" height="5" fill="#a78bfa"/>
    <rect x="4" y="10" width="8" height="2" fill="#6b4bb8"/>
    <rect x="2" y="6" width="1" height="3" fill="#6b4bb8"/>
    <rect x="13" y="6" width="1" height="3" fill="#6b4bb8"/>
    <rect x="5" y="6" width="2" height="2" fill="#101218"/>
    <rect x="9" y="6" width="2" height="2" fill="#101218"/>
    <rect x="6" y="9" width="4" height="1" fill="#101218"/>
    <rect x="7" y="10" width="1" height="1" fill="#e94560"/>
    <rect x="9" y="10" width="1" height="1" fill="#e94560"/>
  `,
};

export function enemySprite(element, elite = false) {
  const key = ELEMENTS[element] ? element : "fire";
  return `${SVG_OPEN}${ENEMY_SPRITES[key]}${elite ? ELITE_CROWN : ""}</svg>`;
}

export function eliteDailyBonus(mode = "normal") {
  return isHeroic(mode) ? 225 : 150;
}

export function isHeroic(mode) {
  return mode === "heroic";
}

export function upgradeCost(upgrade, level, mode = "normal") {
  // Exponential base curve, with a flat +75% price tag in Heroic.
  const exponent = Math.max(0, Math.floor(level));
  const base = upgrade.baseCost * Math.pow(1.55, exponent);
  return Math.round(base * (isHeroic(mode) ? 1.75 : 1));
}

export function heroStats(upgrades = {}, buff = {}, options = {}) {
  const weapon = Math.max(0, upgrades.weapon || 0);
  const armor = Math.max(0, upgrades.armor || 0);
  const strength = Math.max(0, upgrades.strength || 0);
  const vitality = Math.max(0, upgrades.vitality || 0);
  const wand = Math.max(0, upgrades.wand || 0);
  const amulet = Math.max(0, upgrades.amulet || 0);
  const shield = Math.max(0, upgrades.shield || 0);
  const ring = Math.max(0, upgrades.ring || 0);
  const skin = buff && typeof buff === "object" ? buff : {};
  const gear = options.gear && typeof options.gear === "object" ? options.gear : {};
  const cls = options.cls || null;
  const delta = classStatDelta(cls);
  const num = (value) => (Number.isFinite(value) ? value : 0);
  const spellPower = wand * 0.05 + num(skin.elementPower) + num(gear.spellPower);

  return {
    attack: 10 + weapon * 3 + strength * 2 + wand * 2 + ring + num(delta.attack) + num(gear.attack),
    defense: armor * 2 + shield * 2 + num(skin.defense) + num(delta.defense) + num(gear.defense),
    maxHp: 50 + vitality * 10 + armor * 4 + amulet * 6 + num(skin.maxHp) + num(delta.maxHp) + num(gear.maxHp),
    crit: Math.min(0.8, 0.05 + strength * 0.015 + wand * 0.02 + ring * 0.01 + num(skin.crit) + num(delta.crit) + num(gear.crit)),
    block: Math.min(0.75, 0.03 + armor * 0.01 + shield * 0.02 + ring * 0.01 + num(skin.block) + num(delta.block) + num(gear.block)),
    dodge: Math.min(0.6, 0.02 + num(skin.dodge) + num(delta.dodge) + num(gear.dodge)),
    goldFind: 1 + amulet * 0.05 + num(skin.goldFind) + num(gear.goldFind),
    elementPower: spellPower,
    spellPower,
    luck: num(gear.luck) + num(skin.luck),
    healing: num(gear.healing) + num(skin.healing),
    range: num(delta.range) || 1,
    maxMana: classMaxMana(cls) + num(gear.mana) + num(skin.mana),
  };
}

export function enemyElement(floor) {
  return ELEMENT_ORDER[(Math.max(1, Math.floor(floor)) - 1) % ELEMENT_ORDER.length];
}

export function elementMultiplier(rune, enemy) {
  if (!rune || !enemy?.weakness) return 1;
  if (rune === enemy.weakness) return 1.5;
  if (rune === enemy.element) return 0.7;
  return 1;
}

export function createEnemy(floor, mode = "normal", options = {}) {
  const safeFloor = Math.max(1, Math.floor(floor));
  const heroic = isHeroic(mode);
  const elite = Boolean(options.elite);
  const element = enemyElement(safeFloor);
  const names = ENEMY_NAMES[element];
  const type = names[(safeFloor - 1) % names.length];
  const elitePool = ELITE_NAMES[element];
  const eliteName = elitePool[Math.floor(safeFloor / 5 - 1) % elitePool.length];
  const weakness = ELEMENTS[element].weak;
  const growth = Math.pow(1.12, Math.max(0, safeFloor - 4));
  const hpBase = (20 + safeFloor * 8) * growth * (elite ? 2.2 : 1);
  const attackBase = (3 + safeFloor * 1.8) * Math.pow(1.06, Math.max(0, safeFloor - 4)) + (elite ? 2 : 0);
  const hp = Math.round(hpBase * (heroic ? 1.55 : 1));
  const attack = Math.round(attackBase * (heroic ? 1.35 : 1));
  const reward = Math.round((8 + safeFloor * 4) * (elite ? 2.4 : 1) * (heroic ? 1.6 : 1));

  return {
    floor: safeFloor,
    elite,
    boss: elite,
    name: elite ? `Elite: ${eliteName}` : type,
    hp,
    maxHp: hp,
    attack,
    reward,
    element,
    weakness,
    sprite: enemySprite(element, elite),
    dodge: Math.min(0.2, 0.04 + safeFloor * 0.008 + (heroic ? 0.04 : 0)),
    crit: Math.min(0.25, 0.03 + safeFloor * 0.006),
  };
}

export function createRoomEnemy(floor, roomType, mode = "normal") {
  const base = createEnemy(floor, mode);
  if (roomType !== "boss") {
    return { ...base, bossRoom: false };
  }

  const safeFloor = Math.max(1, Math.floor(floor));
  const elite = safeFloor % 5 === 0;
  const elitePool = ELITE_NAMES[base.element];
  const eliteName = elitePool[Math.floor(safeFloor / 5 - 1) % elitePool.length];
  const hp = Math.round(base.hp * (elite ? 2.6 : 1.55));
  const attack = Math.round(base.attack * (elite ? 1.25 : 1.1));
  const reward = Math.round(base.reward * (elite ? 2.3 : 1.5));

  return {
    ...base,
    boss: true,
    bossRoom: true,
    elite,
    name: elite ? `Etagenboss: ${eliteName}` : `Raumwächter: ${base.name}`,
    hp,
    maxHp: hp,
    attack,
    reward,
    sprite: enemySprite(base.element, true),
  };
}
