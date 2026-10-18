// inventory.js — paperdoll equipment, quick slots, upgrade and sell rules
import {
  EQUIPMENT_SLOTS,
  SLOT_ICONS,
  applyUpgrade,
  itemPower,
  sellValue,
  upgradeCost,
  rarityMeta,
} from "./items.js";

export const SLOT_META = {
  weapon: { id: "weapon", label: "Hauptwaffe", icon: SLOT_ICONS.weapon, hint: "Haupt-Hand" },
  offhand: { id: "offhand", label: "Nebenhand", icon: SLOT_ICONS.offhand, hint: "Schild oder Zauberstab" },
  armor: { id: "armor", label: "Rüstung", icon: SLOT_ICONS.armor, hint: "Körper" },
  trinket: { id: "trinket", label: "Ring / Amulett", icon: SLOT_ICONS.trinket, hint: "Schmuck" },
};

export const QUICK_ICON = SLOT_ICONS.quick;

export const SLOT_ORDER = [...EQUIPMENT_SLOTS];
export const QUICK_SLOT_COUNT = 6;

export function createInventory() {
  return {
    items: [],
    equipped: { weapon: null, offhand: null, armor: null, trinket: null },
    quick: Array(QUICK_SLOT_COUNT).fill(null),
  };
}

function isConsumable(item) {
  return Boolean(item) && (item.type === "consumable" || item.type === "scroll" || item.kind === "potion" || item.kind === "scroll");
}

export function normalizeInventory(raw) {
  const base = createInventory();
  if (!raw || typeof raw !== "object") return base;

  const items = Array.isArray(raw.items) ? raw.items.filter((item) => item && typeof item.id === "string") : [];
  base.items = items;

  SLOT_ORDER.forEach((slot) => {
    const id = raw.equipped?.[slot];
    const item = items.find((entry) => entry.id === id) || null;
    base.equipped[slot] = item ? item.id : null;
  });

  base.quick = Array.from({ length: QUICK_SLOT_COUNT }, (_, index) => {
    const id = Array.isArray(raw.quick) ? raw.quick[index] : null;
    const item = items.find((entry) => entry.id === id && isConsumable(entry));
    return item ? item.id : null;
  });

  return base;
}

export function findItem(inv, id) {
  if (!inv || !id) return null;
  return inv.items.find((item) => item.id === id) || null;
}

export function equippedItem(inv, slot) {
  return findItem(inv, inv?.equipped?.[slot]);
}

export function addItem(inv, item) {
  if (!inv || !item) return null;
  inv.items.push(item);
  return item;
}

export function bagItems(inv) {
  if (!inv) return [];
  const equippedIds = new Set(Object.values(inv.equipped).filter(Boolean));
  const quickIds = new Set(inv.quick.filter(Boolean));
  return inv.items.filter((item) => !equippedIds.has(item.id) && !quickIds.has(item.id));
}

export function equipItem(inv, id) {
  const item = findItem(inv, id);
  if (!item || item.type !== "equipment" || !SLOT_ORDER.includes(item.slot)) {
    return { ok: false, reason: "invalid" };
  }
  const previous = equipItemSnapshot(inv, item.slot);
  inv.equipped[item.slot] = item.id;
  const quickIndex = inv.quick.indexOf(item.id);
  if (quickIndex >= 0) inv.quick[quickIndex] = null;
  return { ok: true, item, previous, slot: item.slot };
}

function equipItemSnapshot(inv, slot) {
  const current = equippedItem(inv, slot);
  return current ? { id: current.id, name: current.name } : null;
}

export function unequipItem(inv, slot) {
  if (!SLOT_ORDER.includes(slot)) return { ok: false, reason: "invalid" };
  const current = equippedItem(inv, slot);
  if (!current) return { ok: false, reason: "empty" };
  inv.equipped[slot] = null;
  return { ok: true, item: current };
}

export function sellItem(inv, id) {
  const index = inv?.items?.findIndex((item) => item.id === id) ?? -1;
  if (index < 0) return { ok: false, reason: "missing" };
  const item = inv.items[index];
  const equippedIn = SLOT_ORDER.find((slot) => inv.equipped[slot] === id);
  if (equippedIn) return { ok: false, reason: "equipped" };
  const gold = sellValue(item);
  inv.items.splice(index, 1);
  const quickIndex = inv.quick.indexOf(id);
  if (quickIndex >= 0) inv.quick[quickIndex] = null;
  return { ok: true, item, gold };
}

export function upgradeItem(inv, id, { gold = 0, useScroll = false } = {}) {
  const item = findItem(inv, id);
  if (!item || item.type !== "equipment") return { ok: false, reason: "invalid" };
  const cost = upgradeCost(item);
  if (!useScroll && gold < cost) return { ok: false, reason: "gold", cost };
  applyUpgrade(item);
  return { ok: true, item, cost: useScroll ? 0 : cost, level: item.level };
}

export function assignQuickSlot(inv, id, index) {
  if (!Number.isInteger(index) || index < 0 || index >= QUICK_SLOT_COUNT) return { ok: false, reason: "slot" };
  const item = findItem(inv, id);
  if (!isConsumable(item)) return { ok: false, reason: "invalid" };
  inv.quick[index] = item.id;
  return { ok: true, item, index };
}

export function quickItem(inv, index) {
  return findItem(inv, inv?.quick?.[index]);
}

export function consumeQuickSlot(inv, index) {
  const item = quickItem(inv, index);
  if (!item) return null;
  inv.quick[index] = null;
  const itemIndex = inv.items.findIndex((entry) => entry.id === item.id);
  if (itemIndex >= 0) inv.items.splice(itemIndex, 1);
  return item;
}

export function consumeItemById(inv, id) {
  const index = inv?.items?.findIndex((item) => item.id === id) ?? -1;
  if (index < 0) return null;
  const item = inv.items[index];
  inv.items.splice(index, 1);
  const quickIndex = inv.quick.indexOf(id);
  if (quickIndex >= 0) inv.quick[quickIndex] = null;
  return item;
}

export function gearBuffs(inv) {
  const totals = {};
  SLOT_ORDER.forEach((slot) => {
    const item = equippedItem(inv, slot);
    if (!item || !item.stats) return;
    Object.entries(item.stats).forEach(([key, value]) => {
      totals[key] = Math.round(((totals[key] || 0) + value) * 1000) / 1000;
    });
  });
  return totals;
}

export function gearScore(inv) {
  return SLOT_ORDER.reduce((sum, slot) => sum + itemPower(equippedItem(inv, slot)), 0);
}

export function inventorySummary(inv) {
  return {
    total: inv?.items?.length || 0,
    equipped: SLOT_ORDER.filter((slot) => inv?.equipped?.[slot]).length,
    quick: (inv?.quick || []).filter(Boolean).length,
    score: gearScore(inv),
    best: (inv?.items || [])
      .filter((item) => item.type === "equipment")
      .reduce((best, item) => (itemPower(item) > itemPower(best) ? item : best), null),
  };
}

export function rarityLabel(item) {
  return rarityMeta(item?.rarity).name;
}
