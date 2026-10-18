import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
});

const { loadState, saveState } = await import("../../js/storage.js");

test("state survives a save/load roundtrip", () => {
  store.clear();
  const state = {
    gold: 321,
    quests: [{ id: "q1", title: "Test", done: false }],
    settings: { difficulty: "heroic" },
  };
  saveState(state);
  assert.deepEqual(loadState(), state);
});

test("missing saves return null", () => {
  store.clear();
  assert.equal(loadState(), null);
});

test("corrupt saves fall back to null instead of throwing", () => {
  store.clear();
  store.set("questlog_state_v1", "{not valid json");
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(loadState(), null);
  } finally {
    console.error = original;
  }
});
