// classes.js — hero classes, pixel sprites, passives and battle skills
const px = (content) =>
  `<svg class="class-sprite" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${content}</svg>`;

const BODY = (robe, trim, skin = "#f4c99a") => `
  <rect x="6" y="4" width="4" height="1" fill="${skin}"/>
  <rect x="5" y="5" width="6" height="3" fill="${skin}"/>
  <rect x="6" y="8" width="4" height="1" fill="${skin}"/>
  <rect x="6" y="6" width="1" height="1" fill="#101218"/>
  <rect x="9" y="6" width="1" height="1" fill="#101218"/>
  <rect x="4" y="9" width="8" height="5" fill="${robe}"/>
  <rect x="4" y="10" width="8" height="1" fill="${trim}"/>
  <rect x="7" y="11" width="2" height="3" fill="${trim}"/>
  <rect x="3" y="9" width="1" height="4" fill="${robe}"/>
  <rect x="12" y="9" width="1" height="4" fill="${robe}"/>
  <rect x="4" y="14" width="2" height="1" fill="#101218"/>
  <rect x="10" y="14" width="2" height="1" fill="#101218"/>
`;

const CLASS_SPRITES = {
  warrior: px(`
    ${BODY("#b32443", "#ffcd38")}
    <rect x="3" y="2" width="10" height="2" fill="#cfd6e6"/>
    <rect x="4" y="1" width="8" height="1" fill="#cfd6e6"/>
    <rect x="3" y="4" width="1" height="3" fill="#8b90a6"/>
    <rect x="12" y="4" width="1" height="3" fill="#8b90a6"/>
    <rect x="2" y="9" width="2" height="3" fill="#ffcd38"/>
    <rect x="12" y="9" width="2" height="3" fill="#ffcd38"/>
    <rect x="13" y="3" width="1" height="6" fill="#dfe3f0"/>
    <rect x="12" y="8" width="3" height="1" fill="#ffcd38"/>
  `),
  mage: px(`
    ${BODY("#5b3fa8", "#a78bfa")}
    <rect x="6" y="0" width="4" height="1" fill="#7b5cff"/>
    <rect x="4" y="1" width="8" height="1" fill="#7b5cff"/>
    <rect x="3" y="2" width="10" height="2" fill="#7b5cff"/>
    <rect x="4" y="4" width="8" height="1" fill="#ffcd38"/>
    <rect x="14" y="6" width="1" height="8" fill="#7a4a1f"/>
    <rect x="13" y="4" width="3" height="2" fill="#7fd4ff"/>
    <rect x="14" y="3" width="1" height="1" fill="#eafcff"/>
  `),
  rogue: px(`
    ${BODY("#22303f", "#4eef91")}
    <rect x="4" y="1" width="8" height="2" fill="#33405a"/>
    <rect x="3" y="3" width="10" height="2" fill="#33405a"/>
    <rect x="4" y="5" width="1" height="2" fill="#4eef91"/>
    <rect x="11" y="5" width="1" height="2" fill="#4eef91"/>
    <rect x="1" y="10" width="1" height="3" fill="#dfe3f0"/>
    <rect x="0" y="12" width="2" height="1" fill="#8b90a6"/>
    <rect x="14" y="10" width="1" height="3" fill="#dfe3f0"/>
    <rect x="14" y="12" width="2" height="1" fill="#8b90a6"/>
  `),
  huntress: px(`
    ${BODY("#2f4a2c", "#7fd4ff")}
    <rect x="4" y="1" width="8" height="2" fill="#3f6b3a"/>
    <rect x="3" y="3" width="10" height="2" fill="#3f6b3a"/>
    <rect x="5" y="2" width="6" height="1" fill="#7fd4ff"/>
    <rect x="14" y="4" width="1" height="9" fill="#b8860b"/>
    <rect x="13" y="4" width="1" height="2" fill="#e9e7f0"/>
    <rect x="13" y="11" width="1" height="2" fill="#e9e7f0"/>
    <rect x="13" y="6" width="2" height="5" fill="#e9e7f0" opacity="0.25"/>
  `),
  cleric: px(`
    ${BODY("#e9e2c8", "#ffcd38")}
    <rect x="4" y="1" width="8" height="2" fill="#ffe37a"/>
    <rect x="3" y="3" width="10" height="2" fill="#ffe37a"/>
    <rect x="7" y="0" width="2" height="1" fill="#ffcd38"/>
    <rect x="7" y="11" width="2" height="2" fill="#4eef91"/>
    <rect x="6" y="12" width="4" height="1" fill="#4eef91"/>
    <rect x="2" y="10" width="1" height="3" fill="#ffcd38"/>
    <rect x="13" y="10" width="1" height="3" fill="#ffcd38"/>
  `),
};

export const HERO_CLASSES = {
  warrior: {
    id: "warrior",
    name: "Krieger",
    sprite: CLASS_SPRITES.warrior,
    tagline: "Höhere HP · Schild-Passiv",
    desc: "Robuster Frontkämpfer mit schwerer Klinge. Hält Schläge aus und stößt Gegner mit dem Schild zurück.",
    maxHp: 70,
    attack: 12,
    defense: 4,
    crit: 0.05,
    dodge: 0.02,
    block: 0.08,
    range: 1,
    mana: 0,
    manaRegen: 0,
    passive: "Schild-Passiv: +8% Blockchance und +4 Verteidigung.",
    buffs: ["+20 max. HP", "+4 Verteidigung", "+8% Blocken"],
    skill: {
      id: "shield_bash",
      name: "Schildstoß",
      cost: 0,
      cooldown: 2,
      desc: "1,5× Schaden im Nahkampf und der Gegner verliert eine Runde.",
    },
  },
  mage: {
    id: "mage",
    name: "Magier",
    sprite: CLASS_SPRITES.mage,
    tagline: "Zauberstäbe · Manaregeneration",
    desc: "Bündelt Magie über Distanz. Regeneriert Mana und entfesselt arkane Blitze über das ganze Kampffeld.",
    maxHp: 52,
    attack: 9,
    defense: 1,
    crit: 0.06,
    dodge: 0.03,
    block: 0.02,
    range: 5,
    mana: 24,
    manaRegen: 4,
    passive: "Manaregeneration: +4 Mana pro Runde.",
    buffs: ["+24 Mana", "+4 Mana pro Runde", "Reichweite 5"],
    skill: {
      id: "arcane_bolt",
      name: "Arkaner Blitz",
      cost: 6,
      cooldown: 0,
      desc: "Fernkampf-Blitz mit 1,8× Schaden über bis zu 5 Felder.",
    },
  },
  rogue: {
    id: "rogue",
    name: "Schurke",
    sprite: CLASS_SPRITES.rogue,
    tagline: "Krit · Ausweichen · Tarnung",
    desc: "Schneller Schattenläufer. Trifft kritisch, weicht aus und verschwindet mit Tränken aus dem Sichtfeld.",
    maxHp: 54,
    attack: 11,
    defense: 2,
    crit: 0.16,
    dodge: 0.12,
    block: 0.02,
    range: 3,
    mana: 10,
    manaRegen: 1,
    passive: "Meucheln: +11% Kritchance und +10% Ausweichen.",
    buffs: ["+16% Krit", "+12% Ausweichen", "Tarnung durch Tränke"],
    skill: {
      id: "shadowstep",
      name: "Schattenschritt",
      cost: 3,
      cooldown: 3,
      desc: "Springt neben den Gegner und landet einen garantierten Volltreffer.",
    },
  },
  huntress: {
    id: "huntress",
    name: "Jägerin",
    sprite: CLASS_SPRITES.huntress,
    tagline: "Bogen · Präzision · Doppelschuss",
    desc: "Meisterin des Bogens. Eröffnet Kämpfe aus sicherer Entfernung und trifft mit zwei Pfeilen pro Runde.",
    maxHp: 56,
    attack: 11,
    defense: 2,
    crit: 0.12,
    dodge: 0.08,
    block: 0.03,
    range: 5,
    mana: 8,
    manaRegen: 1,
    passive: "Präzision: +12% Krit und Reichweite 5 mit dem Bogen.",
    buffs: ["Reichweite 5", "+12% Krit", "+8% Ausweichen"],
    skill: {
      id: "double_shot",
      name: "Doppelschuss",
      cost: 2,
      cooldown: 2,
      desc: "Zwei Pfeile mit je 1,2× Schaden auf Distanz.",
    },
  },
  cleric: {
    id: "cleric",
    name: "Kleriker",
    sprite: CLASS_SPRITES.cleric,
    tagline: "Segen · Heilung bei Daily-Quests",
    desc: "Geweihter Streiter. Segnet Wunden im Kampf und heilt bei jeder erledigten Daily-Quest.",
    maxHp: 62,
    attack: 10,
    defense: 3,
    crit: 0.05,
    dodge: 0.02,
    block: 0.05,
    range: 2,
    mana: 16,
    manaRegen: 2,
    passive: "Segen: Heilung bei jeder erledigten Daily-Quest.",
    buffs: ["+16 Mana", "+3 Verteidigung", "Heilung bei Daily-Quests"],
    skill: {
      id: "blessing",
      name: "Segnung",
      cost: 5,
      cooldown: 2,
      desc: "Heilt 35% deiner max. HP im Kampf.",
    },
  },
};

export const CLASS_ORDER = ["warrior", "mage", "rogue", "huntress", "cleric"];

export function getClass(id) {
  return HERO_CLASSES[id] || null;
}

export function classList() {
  return CLASS_ORDER.map((id) => HERO_CLASSES[id]);
}

export function classSprite(id) {
  return CLASS_SPRITES[id] || CLASS_SPRITES.warrior;
}

export function classStatDelta(id) {
  const cls = getClass(id);
  if (!cls) return {};
  return {
    attack: cls.attack - 10,
    maxHp: cls.maxHp - 50,
    defense: cls.defense,
    crit: cls.crit - 0.05,
    dodge: cls.dodge - 0.02,
    block: cls.block - 0.03,
    range: cls.range,
  };
}

export function classRange(id) {
  return getClass(id)?.range || 1;
}

export function skillFor(id) {
  return getClass(id)?.skill || null;
}

export function classMaxMana(id) {
  return getClass(id)?.mana || 0;
}
