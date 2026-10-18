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
  buildTileMap,
  roomTile,
  tileMapSize,
  tileMapSummary,
  ROOM_SPRITES,
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

test("tile map builds walls, corridors and one tile per room", () => {
  const floor = createFloor(1, seeded());
  const map = buildTileMap(floor);
  assert.equal(tileMapSize(3), 7);
  assert.equal(map.dim, 7);
  assert.equal(map.tiles.length, 49);

  const rooms = map.tiles.filter((tile) => tile.kind === "room");
  const corridors = map.tiles.filter((tile) => tile.kind === "corridor");
  const walls = map.tiles.filter((tile) => tile.kind === "wall");
  assert.equal(rooms.length, 9);
  assert.equal(corridors.length, 12);
  assert.equal(walls.length, 28);
  rooms.forEach((tile) => assert.ok(ROOM_TYPES[tile.roomType]));
  corridors.forEach((tile) => {
    assert.equal(tile.link.length, 2);
    assert.notEqual(tile.link[0], tile.link[1]);
  });
});

test("tile map reveals visited rooms and hides unexplored ones", () => {
  const floor = createFloor(1, seeded());
  const summary = tileMapSummary(floor);
  assert.equal(summary.rooms, 9);
  assert.ok(summary.fog >= 4, `${summary.fog} fogged tiles`);

  const start = roomTile(floor, 0);
  assert.deepEqual(start, { x: 1, y: 1 });
  const map = buildTileMap(floor);
  const startTile = map.tiles.find((tile) => tile.index === 0);
  assert.equal(startTile.seen, true);
  assert.equal(startTile.lit, true);

  const bossTile = map.tiles.find((tile) => tile.index === 8);
  assert.equal(bossTile.seen, false);
  assert.equal(bossTile.lit, false);

  floor.pos = 1;
  floor.visited[1] = true;
  const advanced = buildTileMap(floor);
  const revealed = advanced.tiles.find((tile) => tile.index === 1);
  assert.equal(revealed.lit, true);
  assert.ok(advanced.tiles.filter((tile) => tile.seen).length > map.tiles.filter((tile) => tile.seen).length);
});

test("every room type has a pixel sprite", () => {
  Object.keys(ROOM_TYPES).forEach((type) => {
    assert.match(ROOM_SPRITES[type], /<svg/);
    assert.match(ROOM_SPRITES[type], /<rect/);
  });
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
