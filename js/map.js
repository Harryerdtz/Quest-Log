// map.js — Shattered-Pixel-style room exploration for QuestLog
export const ROOM_TYPES = {
  start: { name: "Eingang", icon: "◆", desc: "Der Eingang. Von hier aus beginnt dein Run." },
  monster: { name: "Monster-Raum", icon: "⚔", desc: "Ein Gegner versperrt den Weg." },
  treasure: { name: "Schatzkammer", icon: "▣", desc: "Eine verstaubte Truhe mit Gold." },
  merchant: { name: "Händler", icon: "⚑", desc: "Ein reisender Händler bietet Tränke und Runen." },
  trap: { name: "Falle", icon: "✖", desc: "Der Boden ist mit Stacheln gespickt." },
  altar: { name: "Magie-Altar", icon: "✦", desc: "Ein Altar mit einer schlummernden Rune." },
  boss: { name: "Boss-Raum", icon: "☠", desc: "Der Wächter der Etage erwartet dich." },
};

export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function mapSize(floor) {
  const safe = Math.max(1, Math.floor(floor));
  if (safe <= 2) return 3;
  if (safe <= 4) return 4;
  return 5;
}

export function isCombatRoom(type) {
  return type === "monster" || type === "boss";
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createFloor(floor, rng = Math.random) {
  const safeFloor = Math.max(1, Math.floor(floor));
  const size = mapSize(safeFloor);
  const total = size * size;
  const types = Array(total).fill("monster");
  types[0] = "start";
  types[total - 1] = "boss";

  const candidates = shuffle(
    Array.from({ length: total - 2 }, (_, index) => index + 1),
    rng
  );
  const counts =
    size === 3
      ? { treasure: 1, merchant: 1, trap: 1, altar: 1 }
      : size === 4
        ? { treasure: 2, merchant: 1, trap: 2, altar: 1 }
        : { treasure: 3, merchant: 1, trap: 3, altar: 2 };

  let cursor = 0;
  Object.entries(counts).forEach(([type, count]) => {
    for (let i = 0; i < count && cursor < candidates.length; i += 1) {
      types[candidates[cursor]] = type;
      cursor += 1;
    }
  });

  return {
    floor: safeFloor,
    size,
    types,
    pos: 0,
    visited: types.map((_, index) => index === 0),
    cleared: types.map((type, index) => index === 0 || type === "start"),
    enemyHp: 0,
    burn: 0,
    frozen: false,
  };
}

function validTypes(types) {
  return (
    Array.isArray(types) &&
    types.length >= 9 &&
    types.every((type) => typeof type === "string" && ROOM_TYPES[type])
  );
}

export function normalizeDungeon(raw, floor) {
  const safeFloor = Math.max(1, Math.floor(floor));
  const size = Number.isFinite(raw?.size) ? Math.floor(raw.size) : 0;
  const types = raw?.types;

  if (
    !raw ||
    !Number.isInteger(size) ||
    size < 3 ||
    size > 5 ||
    !validTypes(types) ||
    types.length !== size * size ||
    !types.includes("boss")
  ) {
    return createFloor(safeFloor);
  }

  const pos = Number.isFinite(raw.pos) ? Math.max(0, Math.min(types.length - 1, Math.floor(raw.pos))) : 0;
  const visited = Array.from({ length: types.length }, (_, index) => Boolean(raw.visited?.[index]));
  visited[pos] = true;
  const cleared = Array.from({ length: types.length }, (_, index) =>
    Boolean(raw.cleared?.[index]) || types[index] === "start"
  );

  return {
    floor: safeFloor,
    size,
    types: [...types],
    pos,
    visited,
    cleared,
    enemyHp: Number.isFinite(raw.enemyHp) ? Math.max(0, Math.floor(raw.enemyHp)) : 0,
    burn: Number.isFinite(raw.burn) ? Math.max(0, Math.floor(raw.burn)) : 0,
    frozen: Boolean(raw.frozen),
  };
}

export function indexAt(dungeon, x, y) {
  if (x < 0 || y < 0 || x >= dungeon.size || y >= dungeon.size) return -1;
  return y * dungeon.size + x;
}

export function positionOf(dungeon, index = dungeon.pos) {
  return { x: index % dungeon.size, y: Math.floor(index / dungeon.size) };
}

export function neighborIndex(dungeon, direction) {
  const vector = DIRECTIONS[direction];
  if (!vector) return -1;
  const { x, y } = positionOf(dungeon);
  return indexAt(dungeon, x + vector.dx, y + vector.dy);
}

export function canMove(dungeon, direction) {
  return neighborIndex(dungeon, direction) >= 0;
}

export function move(dungeon, direction) {
  const target = neighborIndex(dungeon, direction);
  if (target < 0) return { ok: false, pos: dungeon.pos };
  const firstVisit = !dungeon.visited[target];
  dungeon.pos = target;
  dungeon.visited[target] = true;
  return { ok: true, pos: target, firstVisit };
}

export function moveTo(dungeon, index) {
  if (!Number.isInteger(index) || index < 0 || index >= dungeon.types.length) return false;
  const current = positionOf(dungeon);
  const target = positionOf(dungeon, index);
  const distance = Math.abs(current.x - target.x) + Math.abs(current.y - target.y);
  if (distance !== 1) return false;
  dungeon.pos = index;
  dungeon.visited[index] = true;
  return true;
}

export function currentRoom(dungeon) {
  return dungeon.types[dungeon.pos];
}

export function currentMeta(dungeon) {
  return ROOM_TYPES[currentRoom(dungeon)] || ROOM_TYPES.start;
}

export function isVisible(dungeon, index) {
  if (dungeon.visited[index]) return true;
  const target = positionOf(dungeon, index);
  const current = positionOf(dungeon);
  return Math.abs(target.x - current.x) + Math.abs(target.y - current.y) <= 1;
}

export function availableMoves(dungeon) {
  return Object.keys(DIRECTIONS).map((direction) => ({
    direction,
    target: neighborIndex(dungeon, direction),
  }));
}

export function roomTypesRemaining(dungeon, type) {
  return dungeon.types.filter((entry, index) => entry === type && !dungeon.cleared[index]).length;
}
