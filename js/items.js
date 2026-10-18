// items.js — Shattered-Pixel-style loot pool, rarity tiers and drops
export const RARITIES = {
  common: { id: "common", name: "Gewöhnlich", color: "#a7adbd", power: 1, value: 1 },
  rare: { id: "rare", name: "Selten", color: "#7fd4ff", power: 1.35, value: 1.9 },
  epic: { id: "epic", name: "Episch", color: "#a78bfa", power: 1.8, value: 3.4 },
  legendary: { id: "legendary", name: "Legendär", color: "#ffcd38", power: 2.45, value: 6.5 },
};

export const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

export const EQUIPMENT_SLOTS = ["weapon", "offhand", "armor", "trinket"];

const TEMPLATES = {
  sword: {
    slot: "weapon",
    label: "Schwert",
    stats: { attack: 3 },
    names: ["Kurzschwert", "Langschwert", "Bastardschwert", "Runenklinge"],
  },
  axe: {
    slot: "weapon",
    label: "Axt",
    stats: { attack: 4, crit: 0.02 },
    names: ["Streitaxt", "Kriegsbeil", "Zwillingsaxt", "Dämonenaxt"],
  },
  dagger: {
    slot: "weapon",
    label: "Dolch",
    stats: { attack: 2, crit: 0.06 },
    names: ["Stilett", "Sicheldolch", "Schattenklinge", "Giftzahn"],
  },
  shield: {
    slot: "offhand",
    label: "Schild",
    stats: { defense: 2, block: 0.03 },
    names: ["Holzschild", "Turmschild", "Runenschild", "Drachenschild"],
  },
  wand: {
    slot: "offhand",
    label: "Zauberstab",
    stats: { attack: 1, spellPower: 0.12, mana: 4 },
    names: ["Eschenstab", "Kristallstab", "Runenstab", "Erzmagierstab"],
  },
  armor: {
    slot: "armor",
    label: "Rüstung",
    stats: { defense: 1, maxHp: 5, block: 0.01 },
    names: ["Lederwams", "Kettenhemd", "Plattenpanzer", "Dämonenpanzer"],
  },
  ring: {
    slot: "trinket",
    label: "Ring",
    stats: { crit: 0.02, luck: 0.05 },
    names: ["Kupferring", "Rubinring", "Runenring", "Siegel des Glücks"],
  },
  amulet: {
    slot: "trinket",
    label: "Amulett",
    stats: { maxHp: 6, defense: 1 },
    names: ["Knochenamulett", "Mondamulett", "Herzamulett", "Ewiges Amulett"],
  },
};

const WEAPON_KINDS = ["sword", "axe", "dagger"];
const OFFHAND_KINDS = ["shield", "wand"];
const ARMOR_KINDS = ["armor"];
const TRINKET_KINDS = ["ring", "amulet"];

export const CONSUMABLES = {
  potion_heal: {
    id: "potion_heal",
    kind: "potion",
    name: "Heiltrank",
    rarity: "common",
    effect: "heal",
    power: 0.45,
    value: 45,
    desc: "Heilt 45% deiner max. HP.",
  },
  potion_mana: {
    id: "potion_mana",
    kind: "potion",
    name: "Manatrank",
    rarity: "rare",
    effect: "mana",
    power: 0.6,
    value: 55,
    desc: "Füllt 60% deines Manas auf.",
  },
  potion_strength: {
    id: "potion_strength",
    kind: "potion",
    name: "Stärketrank",
    rarity: "epic",
    effect: "buff",
    stat: "attack",
    amount: 3,
    value: 90,
    desc: "+3 Angriff für den restlichen Kampf.",
  },
  potion_invisible: {
    id: "potion_invisible",
    kind: "potion",
    name: "Unsichtbarkeitstrank",
    rarity: "epic",
    effect: "invisible",
    value: 110,
    desc: "Der Gegner verliert dich für eine Runde.",
  },
  scroll_upgrade: {
    id: "scroll_upgrade",
    kind: "scroll",
    name: "Schriftrolle der Veredelung",
    rarity: "epic",
    effect: "upgrade",
    value: 300,
    desc: "Veredelt ein Ausrüstungsteil um +1 Stufe — ohne Gold.",
  },
  scroll_blast: {
    id: "scroll_blast",
    kind: "scroll",
    name: "Schriftrolle des Feuerballs",
    rarity: "rare",
    effect: "damage",
    power: 2.2,
    value: 120,
    desc: "Schleudert einen Feuerball mit 2,2× Zauberkraft.",
  },
  scroll_ward: {
    id: "scroll_ward",
    kind: "scroll",
    name: "Schriftrolle des Schutzes",
    rarity: "rare",
    effect: "ward",
    amount: 4,
    value: 130,
    desc: "+4 Verteidigung für den restlichen Kampf.",
  },
};

export const CONSUMABLE_ORDER = [
  "potion_heal",
  "potion_mana",
  "potion_strength",
  "potion_invisible",
  "scroll_blast",
  "scroll_ward",
  "scroll_upgrade",
];

let itemSeq = 0;
function nextId(prefix) {
  itemSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${itemSeq}`;
}

export function rarityMeta(id) {
  return RARITIES[id] || RARITIES.common;
}

export function rollRarity(floor, { elite = false, boss = false, luck = 0, rng = Math.random } = {}) {
  const depth = Math.max(0, Math.floor(floor) - 1);
  const l = Math.max(0, luck);
  const weights = {
    common: Math.max(6, 100 - depth * 3.5 - (elite ? 20 : 0) - (boss ? 30 : 0) - l * 22),
    rare: Math.max(4, 16 + depth * 3 + (elite ? 14 : 0) - (boss ? 0 : 0) + l * 18),
    epic: Math.max(2, 1.5 + depth * 2.1 + (elite ? 9 : 0) + (boss ? 16 : 0) + l * 11),
    legendary: Math.max(1, depth * 0.9 + (elite ? 3.5 : 0) + (boss ? 7 : 0) + l * 8),
  };
  const total = RARITY_ORDER.reduce((sum, id) => sum + weights[id], 0);
  let roll = rng() * total;
  for (const id of RARITY_ORDER) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return "common";
}

function scaledStat(base, floor, rarity) {
  const growth = 1 + Math.max(0, floor - 1) * 0.24;
  return Math.max(1, Math.round(base * growth * rarityMeta(rarity).power));
}

function scaledFloat(base, floor, rarity) {
  const growth = 1 + Math.max(0, floor - 1) * 0.18;
  return Math.round(base * growth * rarityMeta(rarity).power * 1000) / 1000;
}

export function createItem({ floor = 1, kind, rarity = "common", rng = Math.random } = {}) {
  const meta = rarityMeta(rarity);
  const template = TEMPLATES[kind] || TEMPLATES.sword;
  const names = template.names;
  const tier = Math.min(names.length - 1, Math.floor((Math.max(1, floor) - 1) / 3));
  const stats = {};
  Object.entries(template.stats).forEach(([key, value]) => {
    stats[key] = Number.isInteger(value) && key !== "crit" && key !== "block" && key !== "dodge" && key !== "luck" && key !== "spellPower"
      ? scaledStat(value, floor, rarity)
      : scaledFloat(value, floor, rarity);
  });
  return {
    id: nextId(kind),
    type: "equipment",
    kind,
    slot: template.slot,
    label: template.label,
    name: names[Math.min(tier, names.length - 1)],
    rarity,
    rarityColor: meta.color,
    floor: Math.max(1, Math.floor(floor)),
    level: 0,
    stats,
    value: Math.round((18 + floor * 9) * meta.value),
    desc: `${template.label} aus Etage ${Math.max(1, Math.floor(floor))}`,
  };
}

export function createConsumable(id) {
  const template = CONSUMABLES[id];
  if (!template) return null;
  const meta = rarityMeta(template.rarity);
  return {
    ...template,
    type: template.kind === "scroll" ? "scroll" : "consumable",
    id: nextId(id),
    templateId: id,
    rarityColor: meta.color,
    level: 0,
  };
}

export function equipmentKindPool(rng = Math.random) {
  const pools = [WEAPON_KINDS, OFFHAND_KINDS, ARMOR_KINDS, TRINKET_KINDS];
  const pool = pools[Math.floor(rng() * pools.length)] || WEAPON_KINDS;
  return pool[Math.floor(rng() * pool.length)] || "sword";
}

export function rollDrop({ floor = 1, elite = false, boss = false, luck = 0, rng = Math.random } = {}) {
  const depth = Math.max(0, Math.floor(floor) - 1);
  const chance = Math.min(0.95, 0.42 + depth * 0.03 + (elite ? 0.4 : 0) + (boss ? 0.55 : 0) + luck * 0.05);
  const drops = [];
  if (rng() < chance || elite || boss) {
    const rarity = rollRarity(floor, { elite, boss, luck, rng });
    drops.push(createItem({ floor, kind: equipmentKindPool(rng), rarity, rng }));
  }
  if (boss || (elite && rng() < 0.7) || rng() < 0.12 + depth * 0.01) {
    const consumableIds = Object.keys(CONSUMABLES);
    const weighted = [
      ...Array(3).fill("potion_heal"),
      ...Array(2).fill("potion_mana"),
      "potion_strength",
      "potion_invisible",
      "scroll_blast",
      "scroll_ward",
      "scroll_upgrade",
    ];
    const id = weighted[Math.floor(rng() * weighted.length)] || consumableIds[0];
    drops.push(createConsumable(id));
  }
  const gold = Math.round((6 + floor * 5 + (elite ? 20 : 0) + (boss ? 45 : 0)) * (1 + luck * 0.1));
  return { items: drops.filter(Boolean), gold };
}

const STAT_LABELS = {
  attack: "Angriff",
  defense: "Verteidigung",
  maxHp: "max. HP",
  crit: "Krit",
  dodge: "Ausweichen",
  block: "Blocken",
  spellPower: "Zauberkraft",
  luck: "Loot-Glück",
  mana: "Mana",
  healing: "Heilung",
};

export function statLine(stats = {}) {
  return Object.entries(stats)
    .filter(([, value]) => value)
    .map(([key, value]) => {
      if (["crit", "dodge", "block", "spellPower", "luck", "healing"].includes(key)) {
        return `+${Math.round(value * 100)}% ${STAT_LABELS[key] || key}`;
      }
      return `+${value} ${STAT_LABELS[key] || key}`;
    })
    .join(" · ");
}

export function itemPower(item) {
  if (!item || !item.stats) return 0;
  const weights = { attack: 3, defense: 2.4, maxHp: 0.7, crit: 40, dodge: 34, block: 24, spellPower: 22, luck: 15, mana: 1.2, healing: 20 };
  return Math.round(
    Object.entries(item.stats).reduce((sum, [key, value]) => sum + value * (weights[key] || 1), 0)
  );
}

export function upgradeCost(item) {
  if (!item) return 0;
  const meta = rarityMeta(item.rarity);
  return Math.round(55 * Math.pow(item.level + 1, 1.45) * meta.value * (1 + (item.floor || 1) * 0.08));
}

export function applyUpgrade(item) {
  if (!item) return item;
  item.level = (item.level || 0) + 1;
  Object.entries(item.stats || {}).forEach(([key, value]) => {
    const step = ["crit", "dodge", "block", "spellPower", "luck", "healing"].includes(key)
      ? Math.max(0.005, Math.round(value * 0.12 * 1000) / 1000)
      : Math.max(1, Math.round(value * 0.16));
    item.stats[key] = Math.round((value + step) * 1000) / 1000;
  });
  item.value = Math.round((item.value || 0) * 1.25 + 20);
  return item;
}

export function sellValue(item) {
  if (!item) return 0;
  return Math.max(1, Math.round((item.value || 10) * 0.5));
}

export function compareText(candidate, current) {
  if (!candidate) return "";
  const candidateLine = statLine(candidate.stats);
  if (!current) return `${candidateLine} (Slot frei)`;
  return `${candidateLine} vs. ${statLine(current.stats)}`;
}

export function rarityChanceTable(floor, options = {}) {
  const { elite = false, boss = false, luck = 0 } = options;
  const depth = Math.max(0, Math.floor(floor) - 1);
  const weights = {
    common: Math.max(6, 100 - depth * 3.5 - (elite ? 20 : 0) - (boss ? 30 : 0) - luck * 22),
    rare: Math.max(4, 16 + depth * 3 + (elite ? 14 : 0) + luck * 18),
    epic: Math.max(2, 1.5 + depth * 2.1 + (elite ? 9 : 0) + (boss ? 16 : 0) + luck * 11),
    legendary: Math.max(1, depth * 0.9 + (elite ? 3.5 : 0) + (boss ? 7 : 0) + luck * 8),
  };
  const total = RARITY_ORDER.reduce((sum, id) => sum + weights[id], 0);
  return RARITY_ORDER.map((id) => ({
    id,
    name: RARITIES[id].name,
    color: RARITIES[id].color,
    percent: Math.round((weights[id] / total) * 1000) / 10,
  }));
}

/* -------------------------------------------------------------------------
   Pixel icons (no emoji) for the inventory grid, paperdoll and shop cards
   ------------------------------------------------------------------------- */

const icon = (content) =>
  `<svg class="item-sprite" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${content}</svg>`;

export const ITEM_ICONS = {
  sword: icon(`
    <rect x="10" y="1" width="3" height="2" fill="#cfd6e6"/>
    <rect x="8" y="3" width="3" height="3" fill="#cfd6e6"/>
    <rect x="6" y="5" width="3" height="3" fill="#8b90a6"/>
    <rect x="4" y="7" width="4" height="2" fill="var(--icon-accent, #ffcd38)"/>
    <rect x="3" y="8" width="2" height="5" fill="#7a4a1f"/>
    <rect x="2" y="12" width="4" height="2" fill="var(--icon-accent, #ffcd38)"/>
  `),
  axe: icon(`
    <rect x="3" y="2" width="4" height="6" fill="#cfd6e6"/>
    <rect x="5" y="3" width="4" height="4" fill="var(--icon-accent, #ffcd38)"/>
    <rect x="6" y="8" width="2" height="7" fill="#7a4a1f"/>
    <rect x="2" y="3" width="2" height="2" fill="#8b90a6"/>
  `),
  dagger: icon(`
    <rect x="8" y="2" width="2" height="6" fill="#dfe3f0"/>
    <rect x="7" y="3" width="1" height="5" fill="#8b90a6"/>
    <rect x="6" y="8" width="6" height="1" fill="var(--icon-accent, #ffcd38)"/>
    <rect x="8" y="9" width="2" height="5" fill="#7a4a1f"/>
  `),
  shield: icon(`
    <rect x="4" y="2" width="8" height="3" fill="#cfd6e6"/>
    <rect x="3" y="5" width="10" height="5" fill="#8b90a6"/>
    <rect x="4" y="10" width="8" height="2" fill="#6c7488"/>
    <rect x="6" y="12" width="4" height="2" fill="#6c7488"/>
    <rect x="6" y="5" width="4" height="4" fill="var(--icon-accent, #ffcd38)"/>
  `),
  wand: icon(`
    <rect x="7" y="4" width="2" height="10" fill="#7a4a1f"/>
    <rect x="8" y="5" width="1" height="8" fill="#a96a2c"/>
    <rect x="6" y="1" width="4" height="3" fill="var(--icon-accent, #a78bfa)"/>
    <rect x="7" y="0" width="2" height="1" fill="#eafcff"/>
  `),
  armor: icon(`
    <rect x="4" y="2" width="8" height="2" fill="#cfd6e6"/>
    <rect x="3" y="4" width="10" height="7" fill="#8b90a6"/>
    <rect x="6" y="5" width="4" height="6" fill="var(--icon-accent, #4eef91)"/>
    <rect x="5" y="11" width="6" height="3" fill="#6c7488"/>
  `),
  ring: icon(`
    <rect x="5" y="7" width="6" height="2" fill="var(--icon-accent, #ffcd38)"/>
    <rect x="4" y="9" width="2" height="3" fill="#b8860b"/>
    <rect x="10" y="9" width="2" height="3" fill="#b8860b"/>
    <rect x="6" y="12" width="4" height="2" fill="#b8860b"/>
    <rect x="6" y="3" width="4" height="3" fill="#ff9fae"/>
    <rect x="7" y="4" width="2" height="1" fill="#ffe37a"/>
  `),
  amulet: icon(`
    <rect x="4" y="1" width="1" height="3" fill="#cfd6e6"/>
    <rect x="11" y="1" width="1" height="3" fill="#cfd6e6"/>
    <rect x="4" y="3" width="8" height="1" fill="#cfd6e6"/>
    <rect x="6" y="5" width="4" height="4" fill="var(--icon-accent, #4eef91)"/>
    <rect x="7" y="6" width="2" height="2" fill="#eafcff"/>
    <rect x="7" y="9" width="2" height="3" fill="#b8860b"/>
  `),
  potion: icon(`
    <rect x="6" y="1" width="4" height="3" fill="#cfd6e6"/>
    <rect x="5" y="4" width="6" height="1" fill="#8b90a6"/>
    <rect x="4" y="5" width="8" height="5" fill="var(--icon-accent, #e94560)"/>
    <rect x="3" y="10" width="10" height="4" fill="var(--icon-accent, #e94560)"/>
    <rect x="5" y="6" width="2" height="2" fill="#ffffff" opacity="0.45"/>
    <rect x="6" y="11" width="4" height="1" fill="#101216" opacity="0.35"/>
  `),
  scroll: icon(`
    <rect x="4" y="1" width="8" height="14" fill="#e9e2c8"/>
    <rect x="5" y="2" width="6" height="1" fill="#a7a08a"/>
    <rect x="5" y="4" width="6" height="1" fill="#7a7464"/>
    <rect x="5" y="6" width="4" height="1" fill="#7a7464"/>
    <rect x="5" y="9" width="6" height="1" fill="var(--icon-accent, #e94560)"/>
    <rect x="3" y="2" width="1" height="12" fill="#b8860b"/>
    <rect x="12" y="2" width="1" height="12" fill="#b8860b"/>
  `),
  gold: icon(`
    <rect x="4" y="2" width="8" height="2" fill="#ffcd38"/>
    <rect x="3" y="4" width="10" height="8" fill="#ffcd38"/>
    <rect x="4" y="12" width="8" height="2" fill="#b8860b"/>
    <rect x="5" y="5" width="4" height="2" fill="#ffe37a"/>
    <rect x="9" y="7" width="3" height="4" fill="#b8860b"/>
  `),
  misc: icon(`
    <rect x="3" y="5" width="10" height="7" fill="#8b90a6"/>
    <rect x="5" y="3" width="6" height="2" fill="#cfd6e6"/>
    <rect x="6" y="7" width="4" height="3" fill="var(--icon-accent, #ffcd38)"/>
  `),
};

export const SLOT_ICONS = {
  weapon: ITEM_ICONS.sword,
  offhand: ITEM_ICONS.shield,
  armor: ITEM_ICONS.armor,
  trinket: ITEM_ICONS.ring,
  quick: ITEM_ICONS.potion,
};

export function itemIcon(item) {
  if (!item) return ITEM_ICONS.misc;
  if (item.type === "equipment") return ITEM_ICONS[item.kind] || ITEM_ICONS.misc;
  if (item.kind === "scroll" || item.effect === "upgrade" || item.type === "scroll") return ITEM_ICONS.scroll;
  if (item.effect === "mana") return ITEM_ICONS.potion;
  return ITEM_ICONS.potion;
}

export function iconFor(kind) {
  return ITEM_ICONS[kind] || ITEM_ICONS.misc;
}
