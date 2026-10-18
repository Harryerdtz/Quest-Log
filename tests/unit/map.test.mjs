import test from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_TYPES,
  createFloor,
  mapSize,
  isCombatRoom,
  move,
  moveTo,
  canMove,
  currentRoom,
  isVisible,
  normalizeDungeon,
  roomTypesRemaining,
} from "../../js/map.js";

function seeded(seed = 7) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

test("floors grow from 3x3 to 5x5 rooms", () => {
  assert.equal(mapSize(1), 3);
  assert.equal(mapSize(2), 3);
  assert.equal(mapSize(3), 4);
  assert.equal(mapSize(5), 5);
  assert.equal(mapSize(99), 5);
});

test("a floor always has entrance, boss and every special room type", () => {
  const floor = createFloor(5, seeded());
  assert.equal(floor.size, 5);
  assert.equal(floor.types.length, 25);
  assert.equal(floor.types[0], "start");
  assert.equal(floor.types[24], "boss");
  assert.ok(floor.types.includes("monster"));
  assert.ok(floor.types.includes("treasure"));
  assert.ok(floor.types.includes("merchant"));
  assert.ok(floor.types.includes("trap"));
  assert.ok(floor.types.includes("altar"));
  floor.types.forEach((type) => assert.ok(ROOM_TYPES[type]));
});

test("movement only walks to adjacent rooms and reveals them", () => {
  const floor = createFloor(1, seeded());
  assert.equal(currentRoom(floor), "start");
  assert.equal(canMove(floor, "up"), false);
  assert.equal(canMove(floor, "left"), false);
  assert.equal(canMove(floor, "right"), true);

  const result = move(floor, "right");
  assert.equal(result.ok, true);
  assert.equal(floor.pos, 1);
  assert.equal(floor.visited[1], true);
  assert.equal(isVisible(floor, 2), true);

  assert.equal(moveTo(floor, 8), false);
  assert.equal(moveTo(floor, 4), true);
  assert.equal(floor.pos, 4);
});

test("only monster and boss rooms start combat", () => {
  assert.equal(isCombatRoom("monster"), true);
  assert.equal(isCombatRoom("boss"), true);
  ["start", "treasure", "merchant", "trap", "altar"].forEach((type) => {
    assert.equal(isCombatRoom(type), false);
  });
});

test("normalization repairs missing or invalid maps", () => {
  const floor = createFloor(2, seeded(3));
  const restored = normalizeDungeon(
    { ...floor, pos: 4, enemyHp: 12.7, burn: 1, frozen: true },
    2
  );
  assert.equal(restored.size, 3);
  assert.equal(restored.pos, 4);
  assert.equal(restored.enemyHp, 12);
  assert.equal(restored.frozen, true);

  const repaired = normalizeDungeon({ size: 9, types: [] }, 2);
  assert.equal(repaired.size, 3);
  assert.equal(repaired.types.length, 9);
});

test("cleared rooms are removed from the remaining count", () => {
  const floor = createFloor(3, seeded(11));
  const monsters = floor.types.filter((type) => type === "monster").length;
  assert.ok(monsters > 0);
  assert.equal(roomTypesRemaining(floor, "monster"), monsters);
  const index = floor.types.indexOf("monster");
  floor.cleared[index] = true;
  assert.equal(roomTypesRemaining(floor, "monster"), monsters - 1);
});
