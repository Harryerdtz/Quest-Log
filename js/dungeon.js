// dungeon.js — dungeon crawler, equipment stats and floor progression
const icon = (content) =>
  `<svg class="shop-icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${content}</svg>`;

export const UPGRADES = [
  {
    id: "weapon",
    name: "Klinge",
    desc: "+4 Angriff pro Stufe. Schneller durch Gegnerwellen.",
    baseCost: 60,
    stat: "ANG",
    icon: icon(`
      <rect x="11" y="1" width="3" height="2" fill="#cfd6e6"/>
      <rect x="9" y="3" width="3" height="3" fill="#cfd6e6"/>
      <rect x="7" y="5" width="3" height="3" fill="#8b90a6"/>
      <rect x="5" y="7" width="3" height="3" fill="#ffcd38"/>
      <rect x="3" y="9" width="3" height="3" fill="#7a4a1f"/>
      <rect x="4" y="12" width="3" height="2" fill="#ffcd38"/>
    `),
  },
  {
    id: "armor",
    name: "Rüstung",
    desc: "+2 Verteidigung und +4 max. HP pro Stufe.",
    baseCost: 70,
    stat: "DEF",
    icon: icon(`
      <rect x="5" y="3" width="6" height="2" fill="#cfd6e6"/>
      <rect x="3" y="5" width="10" height="6" fill="#8b90a6"/>
      <rect x="5" y="7" width="6" height="4" fill="#ffcd38"/>
      <rect x="7" y="8" width="2" height="2" fill="#4eef91"/>
      <rect x="4" y="11" width="8" height="2" fill="#6c7488"/>
    `),
  },
  {
    id: "strength",
    name: "Stärke",
    desc: "+2 Angriff pro Stufe. Für kritische Treffer.",
    baseCost: 50,
    stat: "ANG",
    icon: icon(`
      <rect x="6" y="2" width="4" height="5" fill="#f4c99a"/>
      <rect x="5" y="7" width="6" height="3" fill="#e94560"/>
      <rect x="4" y="8" width="2" height="3" fill="#f4c99a"/>
      <rect x="10" y="8" width="2" height="3" fill="#f4c99a"/>
      <rect x="6" y="10" width="4" height="2" fill="#b32443"/>
    `),
  },
  {
    id: "vitality",
    name: "Vitalität",
    desc: "+12 max. HP pro Stufe. Mehr Etagen pro Lauf.",
    baseCost: 55,
    stat: "HP",
    icon: icon(`
      <rect x="4" y="3" width="2" height="2" fill="#e94560"/>
      <rect x="10" y="3" width="2" height="2" fill="#e94560"/>
      <rect x="3" y="5" width="10" height="3" fill="#e94560"/>
      <rect x="4" y="8" width="8" height="2" fill="#e94560"/>
      <rect x="6" y="10" width="4" height="2" fill="#e94560"/>
      <rect x="7" y="12" width="2" height="2" fill="#e94560"/>
      <rect x="6" y="5" width="2" height="2" fill="#ff9fae"/>
    `),
  },
];

const ENEMY_NAMES = [
  "Goblin-Schreiber",
  "Sumpf-Slime",
  "Skelett-Praktikant",
  "Inbox-Fledermaus",
  "Keller-Golem",
  "Termin-Gespenst",
  "Montags-Ratte",
];

export function upgradeCost(upgrade, level) {
  return Math.round(upgrade.baseCost * Math.pow(1.55, level));
}

export function heroStats(upgrades = {}) {
  const weapon = Math.max(0, upgrades.weapon || 0);
  const armor = Math.max(0, upgrades.armor || 0);
  const strength = Math.max(0, upgrades.strength || 0);
  const vitality = Math.max(0, upgrades.vitality || 0);
  return {
    attack: 10 + weapon * 4 + strength * 2,
    defense: armor * 2,
    maxHp: 50 + vitality * 12 + armor * 4,
  };
}

export function createEnemy(floor) {
  const safeFloor = Math.max(1, Math.floor(floor));
  const boss = safeFloor % 5 === 0;
  const type = ENEMY_NAMES[(safeFloor - 1) % ENEMY_NAMES.length];
  const hp = Math.round((18 + safeFloor * 10) * (boss ? 1.9 : 1));
  return {
    floor: safeFloor,
    boss,
    name: boss ? `Etagenboss: ${type}` : type,
    hp,
    attack: 3 + safeFloor * 2 + (boss ? 3 : 0),
    reward: 10 + safeFloor * 5 + (boss ? 30 : 0),
  };
}

export function attackDungeon(state) {
  const stats = heroStats(state.upgrades);
  const floor = Math.max(1, state.dungeon.floor);
  const enemy = createEnemy(floor);
  const startingHp = Number.isFinite(state.dungeon.enemyHp) ? state.dungeon.enemyHp : enemy.hp;
  const damage = stats.attack;
  const enemyHp = Math.max(0, startingHp - damage);

  if (enemyHp <= 0) {
    state.gold += enemy.reward;
    state.dungeon.floor = floor + 1;
    const nextEnemy = createEnemy(floor + 1);
    state.dungeon.enemyHp = nextEnemy.hp;
    state.dungeon.hp = Math.min(stats.maxHp, Math.max(1, state.dungeon.hp) + Math.round(stats.maxHp * 0.2));
    return { type: "floor", damage, enemy, gold: enemy.reward, nextEnemy, heroHp: state.dungeon.hp, stats };
  }

  const counter = Math.max(1, enemy.attack - stats.defense);
  const heroHp = Math.max(0, state.dungeon.hp - counter);
  state.dungeon.enemyHp = enemyHp;
  state.dungeon.hp = heroHp;

  if (heroHp <= 0) {
    state.dungeon.hp = stats.maxHp;
    state.dungeon.floor = Math.max(1, floor - 1);
    const fallback = createEnemy(state.dungeon.floor);
    state.dungeon.enemyHp = fallback.hp;
    return { type: "down", damage, counter, enemy, heroHp: state.dungeon.hp, stats };
  }

  return { type: "hit", damage, counter, enemy, heroHp, stats };
}
