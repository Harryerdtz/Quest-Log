// battle.js — turn-based grid combat: movement, melee, ranged spells and skills
import { createRoomEnemy, elementMultiplier, ELEMENTS } from "./dungeon.js";
import { getClass } from "./classes.js";

export const GRID_W = 7;
export const GRID_H = 5;

const key = (x, y) => `${x},${y}`;

export function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function battleDistance(battle) {
  return battle ? distance(battle.hero, battle.enemy) : 99;
}

function obstacleLayout(seed = 0) {
  const layout = [];
  const pattern = seed % 3;
  if (pattern === 0) {
    layout.push([3, 1], [3, 3]);
  } else if (pattern === 1) {
    layout.push([2, 0], [4, 4], [3, 2]);
  } else {
    layout.push([2, 3], [4, 1]);
  }
  return layout;
}

export function createBattle({
  floor = 1,
  roomType = "monster",
  mode = "normal",
  heroClass = "warrior",
  stats = {},
  hp = 1,
  mana = 0,
  rune = null,
  rng = Math.random,
} = {}) {
  const cls = getClass(heroClass);
  const enemy = createRoomEnemy(floor, roomType, mode);
  const enemyX = 5;
  const layout = obstacleLayout(Math.floor(floor) + (roomType === "boss" ? 1 : 0));
  const obstacles = layout.filter(([x, y]) => !(y === 2 && x >= 4)).map(([x, y]) => key(x, y));

  return {
    floor,
    roomType,
    mode,
    heroClass,
    cls: cls?.id || "warrior",
    range: cls?.range || 1,
    w: GRID_W,
    h: GRID_H,
    hero: { x: 0, y: 2 },
    enemy: {
      x: enemyX,
      y: 2,
      hp: enemy.hp,
      maxHp: enemy.hp,
      name: enemy.name,
      attack: enemy.attack,
      dodge: enemy.dodge,
      crit: enemy.crit,
      reward: enemy.reward,
      element: enemy.element,
      weakness: enemy.weakness,
      elite: enemy.elite,
      boss: enemy.boss,
      range: enemy.boss ? 3 : 2,
      sprite: enemy.sprite,
    },
    obstacles,
    hp,
    maxHp: stats.maxHp || hp,
    mana: Math.min(mana, stats.maxMana || mana),
    maxMana: stats.maxMana || mana,
    buffs: { attack: 0, defense: 0 },
    cooldowns: {},
    enemyStunned: false,
    invisible: false,
    turn: "hero",
    round: 1,
    status: "ongoing", // ongoing | won | lost | fled
    log: [`${enemy.name} erscheint!`],
    rng,
  };
}

export function isObstacle(battle, x, y) {
  return battle.obstacles.includes(key(x, y));
}

export function canStep(battle, x, y) {
  if (x < 0 || y < 0 || x >= battle.w || y >= battle.h) return false;
  if (isObstacle(battle, x, y)) return false;
  if (battle.hero.x === x && battle.hero.y === y) return false;
  if (battle.enemy.x === x && battle.enemy.y === y) return false;
  return true;
}

export function canMove(battle, dx, dy) {
  if (!battle || battle.status !== "ongoing") return false;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  return canStep(battle, battle.hero.x + dx, battle.hero.y + dy);
}

export function canAttack(battle, ranged = false) {
  if (!battle || battle.status !== "ongoing") return false;
  const dist = battleDistance(battle);
  if (ranged) return dist >= 1 && dist <= battle.range;
  return dist <= 1;
}

function pushLog(battle, text) {
  if (!text) return;
  battle.log.push(text);
  if (battle.log.length > 6) battle.log.shift();
}

function rollCrit(battle, chance) {
  return battle.rng() < chance;
}

function refreshMana(battle) {
  const cls = getClass(battle.cls);
  const regen = cls?.manaRegen || 0;
  if (regen > 0 && battle.maxMana > 0) {
    battle.mana = Math.min(battle.maxMana, battle.mana + regen);
  }
  Object.keys(battle.cooldowns).forEach((id) => {
    battle.cooldowns[id] = Math.max(0, battle.cooldowns[id] - 1);
  });
}

function startHeroTurn(battle) {
  battle.turn = "hero";
  battle.round += 1;
  refreshMana(battle);
}

function awardEnemyDefeat(battle, events) {
  battle.status = "won";
  events.push(`${battle.enemy.name} besiegt!`);
  pushLog(battle, `${battle.enemy.name} besiegt!`);
}

function enemyAttackHero(battle, events) {
  const enemy = battle.enemy;
  const heroDodged = rollCrit(battle, battle.heroDodge || 0.02);
  const blocked = rollCrit(battle, battle.heroBlock || 0);
  const crit = rollCrit(battle, enemy.crit);
  let damage = Math.max(1, Math.round(enemy.attack - (battle.heroDefense || 0) - (battle.buffs.defense || 0)));
  if (blocked) damage = Math.round(damage * 0.5);
  if (crit) damage = Math.round(damage * 1.5);
  if (heroDodged) damage = 0;

  if (damage <= 0) {
    events.push(heroDodged ? "Du weichst aus!" : "Block! Kein Schaden.");
    pushLog(battle, heroDodged ? "Ausgewichen!" : "Block!");
    return;
  }

  battle.hp = Math.max(0, battle.hp - damage);
  events.push(`Konter −${damage} HP${crit ? " (Krit!)" : ""}`);
  pushLog(battle, `${enemy.name} trifft dich für ${damage}.`);

  if (battle.hp <= 0) {
    battle.status = "lost";
    events.push("Niedergeschlagen!");
    pushLog(battle, "Du gehst zu Boden.");
  }
}

function enemyStep(battle) {
  const dx = Math.sign(battle.hero.x - battle.enemy.x);
  const dy = Math.sign(battle.hero.y - battle.enemy.y);
  const candidates = [];
  if (dx !== 0) candidates.push([dx, 0]);
  if (dy !== 0) candidates.push([0, dy]);
  for (const [mx, my] of candidates) {
    const nx = battle.enemy.x + mx;
    const ny = battle.enemy.y + my;
    if (nx < 0 || ny < 0 || nx >= battle.w || ny >= battle.h) continue;
    if (isObstacle(battle, nx, ny)) continue;
    if (battle.hero.x === nx && battle.hero.y === ny) continue;
    battle.enemy.x = nx;
    battle.enemy.y = ny;
    return true;
  }
  return false;
}

export function enemyTurn(battle, events = []) {
  if (battle.status !== "ongoing") return events;
  if (battle.enemyStunned) {
    battle.enemyStunned = false;
    events.push("Gegner ist betäubt.");
    pushLog(battle, "Der Gegner ist betäubt.");
    startHeroTurn(battle);
    return events;
  }

  const dist = battleDistance(battle);
  if (battle.invisible) {
    battle.invisible = false;
    enemyStep(battle);
    events.push("Gegner sucht dich.");
    pushLog(battle, "Du bist getarnt — der Gegner sucht dich.");
    startHeroTurn(battle);
    return events;
  }

  if (dist <= enemyAttackRange(battle)) {
    enemyAttackHero(battle, events);
    if (battle.status !== "ongoing") return events;
  } else {
    const moved = enemyStep(battle);
    if (moved && battleDistance(battle) <= enemyAttackRange(battle)) {
      enemyAttackHero(battle, events);
      if (battle.status !== "ongoing") return events;
    } else if (!moved) {
      events.push("Gegner wartet.");
    }
  }

  startHeroTurn(battle);
  return events;
}

function enemyAttackRange(battle) {
  return battle.enemy.boss ? 3 : 1;
}

export function moveHero(battle, dx, dy) {
  const events = [];
  if (!canMove(battle, dx, dy)) return { ok: false, reason: "blocked", events };
  battle.hero.x += dx;
  battle.hero.y += dy;
  events.push("Bewegt.");
  pushLog(battle, "Du bewegst dich.");
  enemyTurn(battle, events);
  return { ok: true, events };
}

export function heroAttack(battle, { ranged = false, stats = {}, rune = null } = {}) {
  const events = [];
  if (battle.status !== "ongoing") return { ok: false, reason: "over", events };
  const dist = battleDistance(battle);
  if (!ranged && dist > 1) return { ok: false, reason: "melee-range", events };
  if (ranged && (dist > battle.range || dist < 1)) return { ok: false, reason: "spell-range", events };
  if (ranged && battle.range <= 1) return { ok: false, reason: "no-spell", events };

  const enemy = battle.enemy;
  const multiplier = elementMultiplier(rune, { element: enemy.element, weakness: enemy.weakness });
  const critChance = (stats.crit || 0.05) + (rune === "storm" ? 0.15 : 0);
  const crit = rollCrit(battle, critChance);
  const dodged = rollCrit(battle, enemy.dodge);
  let damage = 0;

  if (!dodged) {
    const base = (stats.attack || 10) + (battle.buffs.attack || 0);
    damage = Math.round(base * multiplier * (1 + (stats.elementPower || 0)));
    if (crit) damage = Math.round(damage * 1.9);
    enemy.hp = Math.max(0, enemy.hp - damage);
  }

  events.push(
    dodged
      ? `${enemy.name} weicht aus!`
      : `${crit ? "KRITISCH! " : ""}${damage} Schaden${ranged ? " (Fernkampf)" : ""}${multiplier > 1 ? " · Schwäche ×1,5" : multiplier < 1 ? " · Widerstand ×0,7" : ""}`
  );
  pushLog(battle, dodged ? "Der Gegner weicht aus." : `${damage} Schaden an ${enemy.name}.`);

  if (enemy.hp <= 0) {
    awardEnemyDefeat(battle, events);
    return { ok: true, events, damage, crit, dodged, defeated: true, multiplier };
  }

  enemyTurn(battle, events);
  return { ok: true, events, damage, crit, dodged, defeated: false, multiplier };
}

export function useSkill(battle, { stats = {}, rune = null } = {}) {
  const events = [];
  const cls = getClass(battle.cls);
  const skill = cls?.skill;
  if (!skill || battle.status !== "ongoing") return { ok: false, reason: "unavailable", events };
  if ((battle.cooldowns[skill.id] || 0) > 0) return { ok: false, reason: "cooldown", events };
  if (battle.mana < skill.cost) return { ok: false, reason: "mana", events };

  const dist = battleDistance(battle);
  if (skill.id === "shield_bash" && dist > 1) return { ok: false, reason: "melee-range", events };
  if (skill.id === "arcane_bolt" && dist > battle.range) return { ok: false, reason: "spell-range", events };

  battle.mana -= skill.cost;
  battle.cooldowns[skill.id] = skill.cooldown;
  const enemy = battle.enemy;
  const base = (stats.attack || 10) + (battle.buffs.attack || 0);

  if (skill.id === "shield_bash") {
    const damage = Math.round(base * 1.5);
    enemy.hp = Math.max(0, enemy.hp - damage);
    battle.enemyStunned = true;
    events.push(`Schildstoß: ${damage} Schaden · Gegner betäubt`);
    pushLog(battle, `Schildstoß trifft für ${damage}.`);
  } else if (skill.id === "arcane_bolt") {
    const damage = Math.round(base * 1.8);
    enemy.hp = Math.max(0, enemy.hp - damage);
    events.push(`Arkaner Blitz: ${damage} Schaden`);
    pushLog(battle, `Arkaner Blitz trifft für ${damage}.`);
  } else if (skill.id === "shadowstep") {
    const spots = [
      [enemy.x - 1, enemy.y],
      [enemy.x + 1, enemy.y],
      [enemy.x, enemy.y - 1],
      [enemy.x, enemy.y + 1],
    ];
    const target = spots.find(([x, y]) => x >= 0 && y >= 0 && x < battle.w && y < battle.h && !isObstacle(battle, x, y));
    if (target) {
      battle.hero.x = target[0];
      battle.hero.y = target[1];
    }
    const damage = Math.round(base * 2);
    enemy.hp = Math.max(0, enemy.hp - damage);
    events.push(`Schattenschritt: garantierter Treffer für ${damage}`);
    pushLog(battle, `Schattenschritt für ${damage} Schaden.`);
  } else if (skill.id === "blessing") {
    const heal = Math.round(battle.maxHp * 0.35);
    battle.hp = Math.min(battle.maxHp, battle.hp + heal);
    events.push(`Segnung: +${heal} HP`);
    pushLog(battle, `Segnung heilt ${heal} HP.`);
  }

  if (enemy.hp <= 0) {
    awardEnemyDefeat(battle, events);
    return { ok: true, events, skill: skill.id, defeated: true };
  }

  if (skill.id === "shield_bash") {
    // The stun replaces the enemy's turn; the next action consumes it.
    startHeroTurn(battle);
    return { ok: true, events, skill: skill.id, defeated: false };
  }

  enemyTurn(battle, events);
  return { ok: true, events, skill: skill.id, defeated: false };
}

export function useConsumable(battle, item, { stats = {} } = {}) {
  const events = [];
  if (!item || battle.status !== "ongoing") return { ok: false, reason: "invalid", events };
  const effect = item.effect;
  if (effect === "heal") {
    const heal = Math.round(battle.maxHp * (item.power || 0.45));
    battle.hp = Math.min(battle.maxHp, battle.hp + heal);
    events.push(`${item.name}: +${heal} HP`);
  } else if (effect === "mana") {
    const gain = Math.round(battle.maxMana * (item.power || 0.6));
    battle.mana = Math.min(battle.maxMana, battle.mana + gain);
    events.push(`${item.name}: +${gain} Mana`);
  } else if (effect === "buff") {
    battle.buffs[item.stat || "attack"] = (battle.buffs[item.stat || "attack"] || 0) + (item.amount || 2);
    events.push(`${item.name}: +${item.amount} ${item.stat === "defense" ? "Verteidigung" : "Angriff"}`);
  } else if (effect === "ward") {
    battle.buffs.defense = (battle.buffs.defense || 0) + (item.amount || 4);
    events.push(`${item.name}: +${item.amount} Verteidigung`);
  } else if (effect === "invisible") {
    battle.invisible = true;
    events.push(`${item.name}: getarnt`);
  } else if (effect === "damage") {
    const damage = Math.round(((stats.attack || 10) + (stats.spellPower || 0) * 30) * (item.power || 2));
    battle.enemy.hp = Math.max(0, battle.enemy.hp - damage);
    events.push(`${item.name}: ${damage} Schaden`);
  } else if (effect === "upgrade") {
    return { ok: false, reason: "passive", events };
  }

  pushLog(battle, events[events.length - 1] || item.name);
  if (battle.enemy.hp <= 0) {
    awardEnemyDefeat(battle, events);
    return { ok: true, events, consumed: true, defeated: true };
  }
  enemyTurn(battle, events);
  return { ok: true, events, consumed: true, defeated: false };
}

export function fleeBattle(battle) {
  if (!battle || battle.status !== "ongoing") return { ok: false };
  battle.status = "fled";
  return { ok: true };
}

export function battleSnapshot(battle) {
  if (!battle) return null;
  return {
    floor: battle.floor,
    roomType: battle.roomType,
    hp: battle.hp,
    maxHp: battle.maxHp,
    mana: battle.mana,
    maxMana: battle.maxMana,
    round: battle.round,
    turn: battle.turn,
    status: battle.status,
    distance: battleDistance(battle),
    enemy: { ...battle.enemy },
    hero: { ...battle.hero },
    log: [...battle.log],
  };
}

export function battleElementColor(battle) {
  const element = ELEMENTS[battle?.enemy?.element];
  return element ? element.color : "#a7adbd";
}
