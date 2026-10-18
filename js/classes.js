// classes.js — hero classes, passives and battle skills
export const HERO_CLASSES = {
  warrior: {
    id: "warrior",
    name: "Krieger",
    icon: "🗡️",
    tagline: "Höhere HP · Schild-Passiv",
    desc: "Robuster Frontkämpfer. Hält Schläge aus und stößt Gegner mit dem Schild zurück.",
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
    icon: "🔮",
    tagline: "Zauberstäbe · Manaregeneration",
    desc: "Bündelt Magie über Distanz. Regeneriert Mana und entfesselt arkane Blitze.",
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
    icon: "🏹",
    tagline: "Krit · Ausweichen · Tarnung",
    desc: "Schneller Jäger. Trifft kritisch, weicht aus und verschwindet im Schatten.",
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
    skill: {
      id: "shadowstep",
      name: "Schattenschritt",
      cost: 3,
      cooldown: 3,
      desc: "Springt neben den Gegner und landet einen garantierten Volltreffer.",
    },
  },
  cleric: {
    id: "cleric",
    name: "Kleriker",
    icon: "🛡️",
    tagline: "Segen · Heilung bei Daily-Quests",
    desc: "Geweihter Streiter. Segnet Wunden und heilt bei jeder erledigten Daily-Quest.",
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
    skill: {
      id: "blessing",
      name: "Segnung",
      cost: 5,
      cooldown: 2,
      desc: "Heilt 35% deiner max. HP im Kampf.",
    },
  },
};

export const CLASS_ORDER = ["warrior", "mage", "rogue", "cleric"];

export function getClass(id) {
  return HERO_CLASSES[id] || null;
}

export function classList() {
  return CLASS_ORDER.map((id) => HERO_CLASSES[id]);
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
