#!/usr/bin/env node
/**
 * QuestLog browser E2E — dependency-free.
 *
 * Starts a local static server, launches headless Chrome/Chromium, drives the
 * real UI over the Chrome DevTools Protocol and verifies shop, dungeon,
 * persistence and mobile layout flows.
 *
 * Set CHROME_PATH if Chrome is installed in a non-standard location.
 */
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;

  for (const binary of ["google-chrome", "chromium", "chrome"]) {
    const result = spawnSync("which", [binary], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForCdp(port, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still booting.
    }
    await sleep(150);
  }
  throw new Error(`Chrome DevTools endpoint on port ${port} did not start.`);
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(root, `.${pathname}`);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const chromePath = findChrome();
if (!chromePath) {
  console.error("Chrome/Chromium not found. Set CHROME_PATH to run the browser E2E suite.");
  process.exit(2);
}

const { server, port: appPort } = await startServer();
const debugPort = await freePort();
const userDataDir = await mkdtemp(path.join(tmpdir(), "questlog-e2e-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

let ws;
let nextId = 1;
const pending = new Map();
const waiters = new Map();
const exceptions = [];
const consoleErrors = [];

async function connect() {
  await waitForCdp(debugPort);
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No Chrome page target found.");

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("Could not connect to the page WebSocket."));
  });

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails?.text || "exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(
        message.params.args.map((arg) => arg.value ?? arg.description).join(" ")
      );
    }
    const waiter = waiters.get(message.method);
    if (waiter) {
      waiters.delete(message.method);
      waiter(message.params);
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
}

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function waitEvent(method, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(method);
      reject(new Error(`Timeout waiting for ${method}`));
    }, timeout);
    waiters.set(method, (params) => {
      clearTimeout(timer);
      resolve(params);
    });
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function navigate(pathname) {
  const loaded = waitEvent("Page.loadEventFired");
  await send("Page.navigate", { url: `http://127.0.0.1:${appPort}${pathname}` });
  await loaded;
  await sleep(700);
}

function stateExpression(callback) {
  return `(() => {
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return (${callback})(state);
  })()`;
}

try {
  await connect();
  await navigate(`/index.html?e2e=${Date.now()}`);
  await evaluate("localStorage.clear()");
  await navigate(`/index.html?e2e=${Date.now()}`);
  await evaluate(stateExpression(`(state) => {
    state.gold = 5000;
    state.runes = ["fire", "frost", "storm", "shadow"];
    state.rune = "frost";
    state.heroClass = null;
    localStorage.setItem('questlog_state_v1', JSON.stringify(state));
    return true;
  }`));
  await navigate(`/index.html?e2e=${Date.now()}`);

  // --- Structure -------------------------------------------------------------
  const structure = await evaluate(`(() => ({
    tabs: [...document.querySelectorAll('.tab-nav__btn')].map((b) => b.textContent.trim()),
    shopPanel: !!document.querySelector('#tab-shop'),
    modal: !!document.querySelector('#shop-modal'),
    nativeSelects: document.querySelectorAll('select').length,
    bodyTab: document.body.dataset.tab,
    headerHeight: Math.round(document.querySelector('.app-header').getBoundingClientRect().height),
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }))()`);
  check("Five main tabs render", structure.tabs.length === 5, structure.tabs.join(" | "));
  check(
    "Inventory tab and Shop naming are live",
    structure.tabs.some((tab) => tab.includes("Inventar")) && structure.tabs.some((tab) => tab.trim() === "Shop"),
    structure.tabs.join(" | ")
  );
  check("No Basar naming remains in the UI", !structure.tabs.some((tab) => /Basar/i.test(tab)));
  check("Shop is a full tab, not a modal", structure.shopPanel && !structure.modal);
  check("No native select controls", structure.nativeSelects === 0);
  check("Compact mobile header", structure.headerHeight < 170, `${structure.headerHeight}px`);
  check("No horizontal mobile overflow", structure.overflow <= 0, `${structure.overflow}px`);

  // --- Visual hero select ----------------------------------------------------
  const classSelect = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click();
    const cards = [...document.querySelectorAll('.class-card')];
    return {
      cards: cards.length,
      portraits: cards.filter((card) => card.querySelector('.class-card__portrait svg')).length,
      squareCards: cards.every((card) => {
        const box = card.querySelector('.class-card__portrait').getBoundingClientRect();
        return box.width > 40 && Math.abs(box.width - box.height) <= 2;
      }),
      selectOverflow: document.querySelector('#class-select').scrollWidth - document.querySelector('#class-select').clientWidth,
      selectVisible: !document.querySelector('#class-select').hidden,
      bodyHidden: document.querySelector('#dungeon-body').hidden,
      detailName: document.querySelector('.hero-detail__name')?.textContent.trim() || '',
      detailBuffs: document.querySelectorAll('.hero-detail__buffs li').length
    };
  })()`);
  check("Hero select offers all five classes", classSelect.cards === 5, String(classSelect.cards));
  check("Every class is a square pixel card, not a text link", classSelect.portraits === 5 && classSelect.squareCards, String(classSelect.portraits));
  check("Hero select fits the mobile screen", classSelect.selectOverflow <= 0, `${classSelect.selectOverflow}px`);
  check("Dungeon stays locked until a hero is chosen", classSelect.selectVisible && classSelect.bodyHidden);
  check(
    "A preselected hero shows its name, description and start buffs",
    classSelect.detailName.length > 0 && classSelect.detailBuffs >= 3,
    `${classSelect.detailName} · ${classSelect.detailBuffs} buffs`
  );

  const classChosen = await evaluate(`(() => {
    document.querySelector('.class-card[data-class-id="mage"]').click();
    const afterClick = {
      selected: document.querySelector('.class-card.is-selected')?.dataset.classId || '',
      marked: document.querySelectorAll('.class-card.is-selected').length,
      name: document.querySelector('.hero-detail__name')?.textContent.trim() || '',
      skill: document.querySelector('.hero-detail__skill-name')?.textContent.trim() || '',
      skillDesc: document.querySelector('.hero-detail__skill-desc')?.textContent.trim() || '',
      bodyHidden: document.querySelector('#dungeon-body').hidden,
      selectHidden: document.querySelector('#class-select').hidden
    };
    document.querySelector('[data-class-start="mage"]').click();
    return {
      ...afterClick,
      lockedBodyHidden: afterClick.bodyHidden,
      lockedSelectHidden: afterClick.selectHidden,
      bodyHidden: document.querySelector('#dungeon-body').hidden,
      selectHidden: document.querySelector('#class-select').hidden,
      badge: document.querySelector('#class-badge').textContent.trim(),
      badgeSprite: !!document.querySelector('#class-badge .class-sprite'),
      skillButton: document.querySelector('#dungeon-skill').textContent.trim()
    };
  })()`);
  check(
    "Clicking a portrait marks it and reveals its class details",
    classChosen.selected === "mage" && classChosen.marked === 1 && classChosen.name === "Magier" && classChosen.skill.includes("Blitz"),
    `${classChosen.name} · ${classChosen.skill}`
  );
  check(
    "The class detail stays open until the run is confirmed",
    classChosen.lockedBodyHidden && !classChosen.lockedSelectHidden,
    classChosen.skillDesc
  );
  check("Starting the run unlocks the dungeon", !classChosen.bodyHidden && classChosen.selectHidden, classChosen.badge);
  check("Class badge uses the selected pixel portrait", classChosen.badgeSprite, classChosen.badge);
  check("Class skill is wired to the chosen hero", classChosen.skillButton.includes("Blitz"), classChosen.skillButton);

  // --- Shop ------------------------------------------------------------------
  const shop = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="shop"]').click();
    document.querySelector('.shop-tab[data-shop-tab="cosmetic"]').click();
    const before = Number(document.querySelector('.wallet__amount').textContent);
    document.querySelector('[data-item-id="avatar_mage"]').click();
    document.querySelector('[data-item-id="avatar_mage"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      before,
      after: Number(document.querySelector('.wallet__amount').textContent),
      owned: state.owned.includes('avatar_mage'),
      equipped: state.equippedAvatar,
      frame: document.querySelector('#avatar-frame').dataset.avatar,
      grid: getComputedStyle(document.querySelector('#shop-grid')).gridTemplateColumns.split(' ').length
    };
  })()`);
  check("Buying an avatar deducts gold", shop.after === shop.before - 650, `${shop.before} -> ${shop.after}`);
  check("Bought avatar can be equipped", shop.owned && shop.equipped === "avatar_mage" && shop.frame === "avatar_mage");
  check("Shop grid is two columns on mobile", shop.grid === 2, String(shop.grid));

  const scrollShop = await evaluate(`(() => {
    document.querySelector('.shop-tab[data-shop-tab="scroll"]').click();
    document.querySelector('[data-item-id="shop_scroll_upgrade"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      tabCards: document.querySelectorAll('.shop-tab').length,
      hasScroll: state.inventory.items.some((item) => item.templateId === 'scroll_upgrade'),
      gold: state.gold
    };
  })()`);
  check("Shop offers five categories including Schriftrollen", scrollShop.tabCards === 5, String(scrollShop.tabCards));
  check("Bought scrolls land in the inventory bag", scrollShop.hasScroll, `${scrollShop.gold} Gold übrig`);

  // --- Quest + boss ----------------------------------------------------------
  const quest = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="quests"]').click();
    const input = document.querySelector('#quest-title');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'E2E Quest');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#quest-form').requestSubmit();
    const bossBefore = Number(document.querySelector('[data-boss="hp"]').textContent);
    document.querySelector('.quest-check').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      quests: state.quests.length,
      done: state.quests[0].done,
      xp: state.xp,
      bossBefore,
      bossAfter: Number(document.querySelector('[data-boss="hp"]').textContent),
      gold: state.gold
    };
  })()`);
  check("Quest is created and completed", quest.quests === 1 && quest.done);
  check("Completion grants XP and damages the boss", quest.xp > 0 && quest.bossAfter < quest.bossBefore);

  // --- Room-by-room exploration ---------------------------------------------
  await evaluate(stateExpression(`(state) => {
    state.dungeon = {
      floor: 2,
      size: 3,
      types: ["start", "monster", "treasure", "merchant", "trap", "altar", "monster", "monster", "boss"],
      pos: 0,
      visited: [true, false, false, false, false, false, false, false, false],
      cleared: [true, false, false, false, false, false, false, false, false],
      hp: 9999,
      enemyHp: 0,
      burn: 0,
      frozen: false
    };
    localStorage.setItem('questlog_state_v1', JSON.stringify(state));
    return true;
  }`));
  await navigate(`/index.html?e2e=${Date.now()}`);
  const explore = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click();
    document.querySelector('[data-move="right"]').click();
    const heroToken = document.querySelector('.battle-token--hero');
    return {
      roomType: document.querySelector('#room-card').dataset.roomType,
      arenaHidden: document.querySelector('#dungeon-arena').hidden,
      currentIndex: document.querySelector('.map-cell.is-current')?.dataset.mapIndex,
      enemyName: document.querySelector('[data-dungeon="enemy-name"]').textContent.trim(),
      gridCells: document.querySelectorAll('.battle-tile').length,
      heroToken: Boolean(heroToken),
      enemyToken: Boolean(document.querySelector('#dungeon-enemy-sprite')),
      attackLabel: document.querySelector('#dungeon-attack').textContent.trim(),
      heroHp: Number(document.querySelector('[data-dungeon="hero-hp"]').textContent),
      tiles: document.querySelectorAll('.dungeon-tiles .tile').length,
      walls: document.querySelectorAll('.tile--wall').length,
      corridors: document.querySelectorAll('.tile--corridor').length,
      fogRooms: document.querySelectorAll('.tile--room.is-fog').length,
      roomSprites: document.querySelectorAll('.tile--room .tile-sprite').length,
      mapHero: !!document.querySelector('.map-hero .class-sprite'),
      logLines: document.querySelectorAll('.battle-log__line').length,
      logText: document.querySelector('#battle-log').textContent.trim()
    };
  })()`);
  check("Moving with the DPad enters the next room", explore.currentIndex === "1", String(explore.currentIndex));
  check("Monster room opens the combat arena", explore.roomType === "monster" && !explore.arenaHidden, explore.enemyName);
  check("Tactical grid spawns hero and enemy tokens", explore.gridCells === 35 && explore.heroToken && explore.enemyToken, `${explore.gridCells} tiles`);
  check("Ranged hero can attack on distance", explore.attackLabel.includes("Fernkampf"), explore.attackLabel);
  check("Dungeon renders a real tile map with walls and corridors", explore.tiles === 49 && explore.walls > 20 && explore.corridors === 12, `${explore.tiles} tiles · ${explore.walls} walls · ${explore.corridors} corridors`);
  check("Unexplored rooms stay behind fog of war", explore.fogRooms >= 4 && explore.roomSprites >= 3, `${explore.fogRooms} fogged rooms · ${explore.roomSprites} sprites`);
  check("The hero is drawn on the tile map", explore.mapHero);
  check("Battle log prints a retro terminal log", explore.logLines >= 1 && explore.logText.includes("erscheint"), explore.logLines + " lines");

  const battleMove = await evaluate(`(() => {
    const before = document.querySelector('[data-dungeon="distance"]').textContent.trim();
    document.querySelector('[data-move="right"]').click();
    const heroToken = document.querySelector('.battle-token--hero');
    return {
      before,
      after: document.querySelector('[data-dungeon="distance"]').textContent.trim(),
      column: heroToken?.style.gridColumn || "",
      log: document.querySelector('#battle-log').textContent.trim(),
      lines: document.querySelectorAll('.battle-log__line').length
    };
  })()`);
  check("DPad moves the hero on the battle grid", battleMove.after !== battleMove.before, `${battleMove.before} -> ${battleMove.after}`);
  check(
    "Battle log records every action in the terminal",
    battleMove.lines >= 2 && /bewegst dich/i.test(battleMove.log),
    `${battleMove.lines} lines`
  );

  // --- Shattered map + elite floor + elemental sprite -----------------------
  await evaluate(stateExpression(`(state) => {
    state.gold = 500;
    state.heroClass = "mage";
    state.mana = 24;
    state.runes = ["fire", "frost", "storm", "shadow"];
    state.rune = "frost";
    state.upgrades = { weapon: 60, armor: 0, strength: 0, vitality: 60, wand: 0, amulet: 0, shield: 0, ring: 0 };
    state.dungeon = {
      floor: 5,
      size: 3,
      types: ["start", "boss", "monster", "treasure", "monster", "merchant", "trap", "altar", "monster"],
      pos: 1,
      visited: [true, true, false, false, false, false, false, false, false],
      cleared: [true, false, false, false, false, false, false, false, false],
      hp: 9999,
      enemyHp: 1,
      burn: 0,
      frozen: false
    };
    state.deepestFloor = 5;
    state.lastEliteBonusDate = null;
    localStorage.setItem('questlog_state_v1', JSON.stringify(state));
    return true;
  }`));
  await navigate(`/index.html?e2e=${Date.now()}`);
  await evaluate(`document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click()`);
  await sleep(300);

  const eliteUi = await evaluate(`(() => {
    const sprite = document.querySelector('#dungeon-enemy-sprite');
    return {
      element: sprite.dataset.element,
      crown: !!sprite.querySelector('.enemy-crown'),
      daily: document.querySelector('[data-dungeon="elite-daily"]').textContent.trim(),
      weakness: document.querySelector('[data-dungeon="enemy-weakness"]').textContent.trim(),
      goldBefore: Number(document.querySelector('.wallet__amount').textContent),
      mapCells: document.querySelectorAll('.map-cell').length,
      dpadButtons: document.querySelectorAll('.dpad__btn').length,
      roomType: document.querySelector('#room-card').dataset.roomType,
      attackLabel: document.querySelector('#dungeon-attack').textContent.trim()
    };
  })()`);
  check("Map renders one tile per room", eliteUi.mapCells === 9, String(eliteUi.mapCells));
  check("DPad has four movement directions", eliteUi.dpadButtons === 4, String(eliteUi.dpadButtons));
  check("Boss room starts combat on entry", eliteUi.roomType === "boss");
  check("Attack button uses German terminology", eliteUi.attackLabel.startsWith("Angriff"), eliteUi.attackLabel);
  check("Elite uses an elemental sprite and crown", eliteUi.element === "fire" && eliteUi.crown, eliteUi.element);
  check("Daily elite bonus is advertised", eliteUi.daily.includes("150"), eliteUi.daily);

  const runeMap = { Feuer: "fire", Frost: "frost", Sturm: "storm", Schatten: "shadow" };
  await evaluate(`document.querySelector('.rune-btn[data-rune="${runeMap[eliteUi.weakness]}"]').click()`);
  await evaluate("window.__e2eRandom = Math.random; Math.random = () => 0.5");
  const eliteFight = await evaluate(`(() => {
    for (let i = 0; i < 20 && Number(document.querySelector('[data-dungeon="floor"]').textContent) === 5; i += 1) {
      document.querySelector('#dungeon-attack').click();
    }
    Math.random = window.__e2eRandom;
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      floor: state.dungeon.floor,
      deepest: state.deepestFloor,
      bonusDate: state.lastEliteBonusDate,
      today: new Date().toDateString(),
      gold: state.gold,
      daily: document.querySelector('[data-dungeon="elite-daily"]').textContent.trim(),
      claimed: document.querySelector('[data-dungeon="elite-daily"]').classList.contains('is-claimed')
    };
  })()`);
  check("Elite kill advances to the next floor", eliteFight.floor === 6, String(eliteFight.floor));
  check("Daily elite bonus is granted once", eliteFight.gold >= eliteUi.goldBefore + 150, `${eliteUi.goldBefore} -> ${eliteFight.gold}`);
  check("Elite bonus is marked as claimed", eliteFight.bonusDate === eliteFight.today && eliteFight.claimed, eliteFight.daily);
  check("Deepest floor is tracked", eliteFight.deepest === 6, String(eliteFight.deepest));

  const lootGrid = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="inventory"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    const tiles = [...document.querySelectorAll('#inventory-bag .item-tile[data-inv-id]')];
    const result = {
      items: state.inventory.items.length,
      tiles: tiles.length,
      sprites: tiles.filter((tile) => tile.querySelector('svg')).length,
      labels: tiles.map((tile) => tile.getAttribute('aria-label') || '')
    };
    document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click();
    return result;
  })()`);
  check(
    "Monster loot lands in the inventory grid as sprites",
    lootGrid.items >= 1 && lootGrid.tiles >= 1 && lootGrid.sprites === lootGrid.tiles,
    `${lootGrid.items} items · ${lootGrid.tiles} tiles`
  );

  // A second elite on the same day must not grant the daily bonus again.
  const goldAfterFirstElite = eliteFight.gold;
  await evaluate(stateExpression(`(state) => {
    state.dungeon = {
      floor: 10,
      size: 3,
      types: ["start", "boss", "monster", "treasure", "monster", "merchant", "trap", "altar", "monster"],
      pos: 1,
      visited: [true, true, false, false, false, false, false, false, false],
      cleared: [true, false, false, false, false, false, false, false, false],
      hp: 9999,
      enemyHp: 1,
      burn: 0,
      frozen: false
    };
    state.deepestFloor = 10;
    localStorage.setItem('questlog_state_v1', JSON.stringify(state));
    return true;
  }`));
  await navigate(`/index.html?e2e=${Date.now()}`);
  await evaluate(`document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click()`);
  await evaluate("window.__e2eRandom = Math.random; Math.random = () => 0.5");
  const secondElite = await evaluate(`(() => {
    for (let i = 0; i < 20 && Number(document.querySelector('[data-dungeon="floor"]').textContent) === 10; i += 1) {
      document.querySelector('#dungeon-attack').click();
    }
    Math.random = window.__e2eRandom;
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      gold: state.gold,
      floor: state.dungeon.floor,
      hp: state.dungeon.hp,
      bonusDate: state.lastEliteBonusDate,
      today: new Date().toDateString()
    };
  })()`);
  check(
    "Second elite of the day pays no daily bonus again",
    secondElite.floor === 11 && secondElite.gold > goldAfterFirstElite && secondElite.bonusDate === secondElite.today,
    `${goldAfterFirstElite} -> ${secondElite.gold} · Tagesbonus bleibt bei ${secondElite.bonusDate}`
  );

  // --- Run reset -------------------------------------------------------------
  const reset = await evaluate(`(() => {
    const button = document.querySelector('#dungeon-reset');
    const goldBefore = Number(document.querySelector('.wallet__amount').textContent);
    button.click();
    const armedText = button.textContent.trim();
    button.click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      armedText,
      floor: state.dungeon.floor,
      deepest: state.deepestFloor,
      gold: state.gold,
      goldBefore,
      hp: state.dungeon.hp,
      maxHp: Number(document.querySelector('[data-dungeon="hero-maxhp"]').textContent),
      cells: document.querySelectorAll('.map-cell').length,
      arenaHidden: document.querySelector('#dungeon-arena').hidden
    };
  })()`);
  check("Run reset requires confirmation", reset.armedText.includes("Sicher?"), reset.armedText);
  check("Run reset returns to floor 1 with full HP", reset.floor === 1 && reset.hp === reset.maxHp, `floor ${reset.floor}, ${reset.hp}/${reset.maxHp} HP`);
  check("Run reset preserves gold and deepest floor", reset.gold === reset.goldBefore && reset.deepest === 11);
  check("Run reset builds a fresh 3x3 floor at the entrance", reset.cells === 9 && reset.arenaHidden, `${reset.cells} rooms`);

  // --- Persistence -----------------------------------------------------------
  await navigate(`/index.html?e2e=${Date.now()}`);
  const persisted = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      floor: state.dungeon.floor,
      deepest: state.deepestFloor,
      avatar: state.equippedAvatar,
      owned: state.owned.includes('avatar_mage'),
      quests: state.quests.length,
      done: state.quests[0]?.done,
      bonusDate: state.lastEliteBonusDate,
      today: new Date().toDateString(),
      uiFloor: document.querySelector('[data-dungeon="floor"]').textContent,
      heroClass: state.heroClass,
      dailyClaimed: document.querySelector('[data-dungeon="elite-daily"]').classList.contains('is-claimed')
    };
  })()`);
  check("Save data survives reload", persisted.floor === 1 && persisted.deepest === 11 && persisted.owned && persisted.done);
  check("Cosmetic choice survives reload", persisted.avatar === "avatar_mage");
  check("Daily elite claim survives reload", persisted.bonusDate === persisted.today && persisted.dailyClaimed);
  check("UI reflects persisted floor", persisted.uiFloor === "1", persisted.uiFloor);
  check("Chosen hero class survives reload", persisted.heroClass === "mage", persisted.heroClass);

  // --- Grid inventory --------------------------------------------------------
  const inventory = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="inventory"]').click();
    const before = {
      slots: document.querySelectorAll('.paperdoll-slot').length,
      quick: document.querySelectorAll('.quick-slot-card').length,
      gridSlots: document.querySelectorAll('.bag-grid .item-tile').length,
      bagSprites: [...document.querySelectorAll('.bag-grid .item-tile[data-inv-id]')].every((tile) => tile.querySelector('svg')),
      squareSlots: [...document.querySelectorAll('.paperdoll-slot')].every((slot) => {
        const box = slot.getBoundingClientRect();
        return Math.abs(box.width - box.height) <= 2;
      }),
      squareTiles: [...document.querySelectorAll('.bag-grid .item-tile')].every((tile) => {
        const box = tile.getBoundingClientRect();
        return box.width > 38 && Math.abs(box.width - box.height) <= 2;
      })
    };
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    state.inventory.items.push({
      id: "e2e_sword",
      type: "equipment",
      kind: "sword",
      slot: "weapon",
      label: "Schwert",
      name: "E2E-Klinge",
      rarity: "epic",
      rarityColor: "#a78bfa",
      floor: 6,
      level: 0,
      stats: { attack: 12 },
      value: 220,
      desc: "Testklinge"
    });
    localStorage.setItem('questlog_state_v1', JSON.stringify(state));
    return before;
  })()`);
  check("Paperdoll shows four square equipment slots", inventory.slots === 4 && inventory.squareSlots, String(inventory.slots));
  check("Inventory offers six quick slots", inventory.quick === 6, String(inventory.quick));
  check("Bag renders a 24-slot grid of square tiles", inventory.gridSlots === 24 && inventory.squareTiles, String(inventory.gridSlots));
  check("Every bag item is drawn as a pixel sprite", inventory.bagSprites);

  await navigate(`/index.html?e2e=${Date.now()}`);
  const equipped = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="inventory"]').click();
    const findTile = () => [...document.querySelectorAll('.item-tile[data-inv-id]')]
      .find((tile) => (tile.getAttribute('aria-label') || '').includes('E2E-Klinge'));
    const tile = findTile();
    const tileSprite = Boolean(tile?.querySelector('svg'));
    const draggable = tile?.draggable === true;
    tile.click();
    const inspector = document.querySelector('#item-inspector');
    const hasCompare = Boolean(inspector.querySelector('.item-card__compare'));
    const compareText = inspector.querySelector('.item-card__compare')?.textContent.trim() || '';
    inspector.querySelector('[data-inv-action="equip"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return {
      name: document.querySelector('#item-inspector .item-card__name')?.textContent.trim(),
      tileSprite,
      draggable,
      dropZones: document.querySelectorAll('[data-drop-slot]').length,
      hasCompare,
      compareText,
      equippedId: state.inventory.equipped.weapon,
      filled: document.querySelectorAll('.paperdoll-slot.is-filled').length,
      slotSprite: Boolean(document.querySelector('.paperdoll-slot[data-slot="weapon"] .item-sprite')),
      stats: document.querySelector('#inventory-stats').textContent.trim().length,
      score: document.querySelector('[data-inventory="score"]').textContent.trim()
    };
  })()`);
  check("Loot in the bag is a pixel sprite tile", equipped.tileSprite && equipped.draggable, `${equipped.name}`);
  check("Tile clicks open the item inspector with a stat comparison", equipped.hasCompare && equipped.name === "E2E-Klinge", equipped.compareText);
  check("Equipping fills the paperdoll with a sprite", equipped.equippedId === "e2e_sword" && equipped.filled >= 1 && equipped.slotSprite, equipped.equippedId);
  check("Inventory derives hero stats and gear score", equipped.stats > 0 && /Ausrüstung \d+/.test(equipped.score), equipped.score);
  check("Drag & drop targets exist for every slot", equipped.dropZones >= 10, String(equipped.dropZones));

  const clickEquip = await evaluate(`(() => {
    const inspector = document.querySelector('#item-inspector');
    inspector.querySelector('[data-inv-action="unequip"]').click();
    const tile = [...document.querySelectorAll('.item-tile[data-inv-id]')]
      .find((entry) => (entry.getAttribute('aria-label') || '').includes('E2E-Klinge'));
    tile.click();
    document.querySelector('.paperdoll-slot[data-slot="weapon"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    return { equippedId: state.inventory.equipped.weapon, filled: document.querySelectorAll('.paperdoll-slot.is-filled').length };
  })()`);
  check("Click-to-equip works directly on the paperdoll slot", clickEquip.equippedId === "e2e_sword" && clickEquip.filled >= 1, clickEquip.equippedId);

  const upgraded = await evaluate(`(() => {
    const goldBefore = Number(document.querySelector('[data-gold]').textContent);
    document.querySelector('#item-inspector [data-inv-action="upgrade"]').click();
    const state = JSON.parse(localStorage.getItem('questlog_state_v1'));
    const item = state.inventory.items.find((entry) => entry.id === "e2e_sword");
    return { level: item?.level || 0, goldBefore, goldAfter: state.gold };
  })()`);
  check("Upgrading gear consumes gold", upgraded.level >= 1 && upgraded.goldAfter < upgraded.goldBefore, `Stufe ${upgraded.level}, ${upgraded.goldBefore} -> ${upgraded.goldAfter}`);

  // --- Final layout + errors -------------------------------------------------
  const layout = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="inventory"]').click();
    const invPanel = document.querySelector('#inventory-panel');
    const quiet = {
      paperdoll: document.querySelectorAll('.paperdoll-slot').length,
      quickCards: document.querySelectorAll('.quick-slot-card').length,
      invOverflow: invPanel.scrollWidth - invPanel.clientWidth
    };
    document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click();
    const nav = document.querySelector('.tab-nav');
    const panel = document.querySelector('#dungeon-panel');
    const attack = document.querySelector('#dungeon-attack');
    const dpadButton = document.querySelector('.dpad__btn');
    const controls = document.querySelector('.dungeon-controls');
    return {
      ...quiet,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      navPosition: getComputedStyle(nav).position,
      touchAction: getComputedStyle(document.querySelector('.tab-nav__btn')).touchAction,
      inputFont: getComputedStyle(document.querySelector('#quest-title')).fontSize,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      attackHeight: Math.round(attack.getBoundingClientRect().height),
      dpadSize: Math.round(dpadButton.getBoundingClientRect().width),
      controlsPosition: getComputedStyle(controls).position
    };
  })()`);
  check("No horizontal overflow after full flow", layout.overflow <= 0, `${layout.overflow}px`);
  check("Tab navigation is sticky", layout.navPosition === "sticky");
  check("Touch manipulation is enabled", layout.touchAction === "manipulation");
  check("Form inputs avoid iOS zoom", layout.inputFont === "16px");
  check("Dungeon panel never overflows horizontally", layout.panelOverflow <= 0, `${layout.panelOverflow}px`);
  check("Attack button is a thumb-sized target", layout.attackHeight >= 44, `${layout.attackHeight}px`);
  check("DPad buttons are thumb-sized", layout.dpadSize >= 44, `${layout.dpadSize}px`);
  check("Dungeon controls stick above the home bar", layout.controlsPosition === "sticky");
  check("Paperdoll and quick slots stay rendered", layout.paperdoll === 4 && layout.quickCards === 6, `${layout.paperdoll} slots / ${layout.quickCards} quick`);
  check("Inventory panel never overflows horizontally", layout.invOverflow <= 0, `${layout.invOverflow}px`);

  // --- Desktop layout pass ---------------------------------------------------
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(`/index.html?e2e=${Date.now()}`);
  const desktop = await evaluate(`(() => {
    document.querySelector('.tab-nav__btn[data-tab="dungeon"]').click();
    const panel = document.querySelector('#dungeon-panel');
    const controls = document.querySelector('.dungeon-controls');
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      cells: document.querySelectorAll('.map-cell').length,
      controlsPosition: getComputedStyle(controls).position,
      dpadWidth: Math.round(document.querySelector('.dpad').getBoundingClientRect().width),
      attackVisible: document.querySelector('#dungeon-attack').getBoundingClientRect().width > 0
    };
  })()`);
  check("Desktop dungeon layout has no overflow", desktop.overflow <= 0 && desktop.panelOverflow <= 0, `${desktop.overflow}px`);
  check("Desktop map and DPad stay side by side", desktop.cells === 9 && desktop.dpadWidth < 200 && desktop.attackVisible, `${desktop.dpadWidth}px dpad`);
  check("Dungeon controls are not sticky on desktop", desktop.controlsPosition === "static", desktop.controlsPosition);

  check("No JS exceptions", exceptions.length === 0, exceptions.join(" | "));
  check("No console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("E2E flow completed", false, error.message);
} finally {
  try {
    ws?.close();
  } catch {
    // ignore
  }
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

const failed = checks.filter((entry) => !entry.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.log(`FAILED: ${failed.map((entry) => entry.name).join(", ")}`);
  process.exitCode = 1;
}
