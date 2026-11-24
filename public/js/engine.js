// Pure rules engine: operates on a plain bastion object, no DOM. Dice come from an injectable rng.
import {
  FACILITY_BY_KEY, SLOTS_BY_LEVEL, EVENTS, ALL_WELL, TREASURE, GAMBLING, HAUNTINGS, PLANES, CURIO_COUNT,
  GARDEN_YIELD, BASIC_ADD, BASIC_ENLARGE, WALL, TRAITS, MEMBERSHIPS,
} from './data.js';

export const uid = () => Math.random().toString(36).slice(2, 10);
export const defaultRng = { d: (n) => 1 + Math.floor(Math.random() * n) };

export function newBastion(init = {}) {
  return {
    v: 1,
    name: 'New Bastion', player: '', character: '', level: 5,
    traits: {}, memberships: [],
    gold: 0,
    settings: { turnDays: 7, haunted: false },
    turn: 0, day: 0,
    basics: [
      { id: uid(), type: 'Bedroom', space: 'Cramped', label: '' },
      { id: uid(), type: 'Kitchen', space: 'Roomy', label: '' },
    ],
    specials: [],
    extraDefenders: 0,
    walls: { built: 0, queue: [], enclosed: false },
    inventory: [], effects: [], flags: {},
    notes: '',
    log: [],
    pending: null,
    map: { floors: [{ name: 'Ground floor', cells: {} }] },
    ...init,
  };
}

// --- lookups ----------------------------------------------------------------
export const defOf = (spec) => FACILITY_BY_KEY[spec.key];
export const specName = (spec) => spec.label || defOf(spec).name;
export const specSpace = (spec) => (spec.enlarged && defOf(spec).enlarge ? defOf(spec).enlarge.to : defOf(spec).space);
export const hirelingCount = (spec) => defOf(spec).hirelings + (spec.enlarged ? defOf(spec).enlarge?.hirelings || 0 : 0);
export const slotsForLevel = (level) => (SLOTS_BY_LEVEL.find(([l]) => level >= l) || [0, 0])[1];
export const housingCap = (spec) => (spec.enlarged && defOf(spec).housesVast) || defOf(spec).houses || 0;
export const configCount = (spec, c) => (spec.enlarged && c.vastCount) || c.count;
const has = (b, pred) => b.specials.some((s) => pred(defOf(s), s));
const hasKey = (b, key) => b.specials.some((s) => s.key === key);

function meetsToken(b, tok) {
  if (Array.isArray(tok)) return tok.some((t) => meetsToken(b, t));
  const t = b.traits || {};
  if (tok.startsWith('m:')) return (b.memberships || []).includes(tok.slice(2));
  if (tok === 'arcane') return !!(t.arcane || t.artisan);
  if (tok === 'anyfocus') return !!(t.arcane || t.divine || t.focus || t.artisan);
  return !!t[tok];
}
function tokenText(tok) {
  if (Array.isArray(tok)) return tok.map(tokenText).join(' or ');
  if (tok.startsWith('m:')) {
    const m = MEMBERSHIPS[tok.slice(2)];
    return /^Renown/.test(m) ? m : `Membership in the ${m}`;
  }
  if (tok === 'anyfocus') return 'Ability to use a Spellcasting Focus';
  return TRAITS[tok].replace(/^Can use/, 'Ability to use').replace(/^Has an?/, '').replace(/^Has/, '').replace(/^Proficient in/, 'Proficiency in').trim();
}
export const prereqText = (def) => (def.prereq.length ? def.prereq.map(tokenText).join('; ') : 'None');

/** Why a facility can't be added right now (empty array = it can). */
export function blockers(b, def) {
  const out = [];
  if (b.level < def.level) out.push(`Requires level ${def.level}`);
  for (const tok of def.prereq) if (!meetsToken(b, tok)) out.push(tokenText(tok));
  if (!def.multiple && hasKey(b, def.key)) out.push('Already built');
  return out;
}

export function defenderCount(b) {
  let n = b.extraDefenders || 0;
  for (const s of b.specials) {
    n += s.defenders || 0;
    if (defOf(s).occupantKind && defOf(s).occupantKind !== 'animal') n += (s.occupants || []).filter((o) => o.defender !== false).length;
  }
  return n;
}

export function lieutenants(b) {
  return b.specials.filter((s) => defOf(s).lieutenants).reduce((n, s) => n + (s.lieutenants ?? 2), 0);
}

// --- mutations used by the builder -----------------------------------------------
function log(b, k, m) {
  b.log.push({ t: b.turn, d: b.day, k, m });
  if (b.log.length > 600) b.log.splice(0, b.log.length - 600);
  return m;
}
export const addLog = log;

function addItem(b, text) {
  b.inventory.push({ id: uid(), text });
}

export function addSpecial(b, key, rng = defaultRng) {
  const def = FACILITY_BY_KEY[key];
  const spec = { id: uid(), key, label: '', enlarged: false, haunted: false, config: {}, hirelings: [], order: null, offline: 0 };
  if (def.houses) spec.defenders = 0;
  if (def.occupantKind) spec.occupants = [];
  if (def.lieutenants) spec.lieutenants = 2;
  if (key === 'stable') spec.occupants = [{ id: uid(), name: 'Riding Horse', size: 'Large' }, { id: uid(), name: 'Pony', size: 'Medium' }, { id: uid(), name: 'Pony', size: 'Medium' }];
  if (def.alwaysHaunted) spec.haunted = true;
  else if (b.settings.haunted) {
    const anyHaunted = b.specials.some((s) => s.haunted);
    if (b.specials.length === 0 || (anyHaunted && rng.d(2) === 2)) spec.haunted = true;
  }
  b.specials.push(spec);
  log(b, 'build', `Added special facility: ${def.name}${spec.haunted ? ' (Haunted)' : ''}.`);
  return spec;
}

export function removeSpecial(b, id) {
  const i = b.specials.findIndex((s) => s.id === id);
  if (i < 0) return;
  const [spec] = b.specials.splice(i, 1);
  for (const f of b.map.floors) for (const k of Object.keys(f.cells)) if (f.cells[k] === id) delete f.cells[k];
  log(b, 'build', `Removed special facility: ${specName(spec)}.`);
}

export function enlargeSpecial(b, id) {
  const spec = b.specials.find((s) => s.id === id);
  const e = spec && defOf(spec).enlarge;
  if (!e || spec.enlarged) return;
  spec.enlarged = true;
  b.gold -= e.cost;
  log(b, 'build', `Enlarged ${specName(spec)} to ${e.to} for ${e.cost} GP.`);
}

export function addBasic(b, type, space) {
  const c = BASIC_ADD[space];
  b.gold -= c.cost;
  b.basics.push({ id: uid(), type, space, label: '', build: { kind: 'add', daysLeft: c.days } });
  log(b, 'build', `Started building a ${space} ${type} (${c.cost} GP, ${c.days} days).`);
}

export function enlargeBasic(b, id) {
  const f = b.basics.find((x) => x.id === id);
  const c = f && BASIC_ENLARGE[f.space];
  if (!c || f.build) return;
  b.gold -= c.cost;
  f.build = { kind: 'enlarge', to: c.to, daysLeft: c.days };
  log(b, 'build', `Started enlarging the ${f.type} to ${c.to} (${c.cost} GP, ${c.days} days).`);
}

export function removeBasic(b, id) {
  const i = b.basics.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [f] = b.basics.splice(i, 1);
  for (const fl of b.map.floors) for (const k of Object.keys(fl.cells)) if (fl.cells[k] === id) delete fl.cells[k];
  log(b, 'build', `Removed basic facility: ${f.type}.`);
}

export function buildWalls(b, squares, { free = false, daysPer = WALL.days } = {}) {
  squares = Math.max(0, Math.floor(squares));
  if (!squares) return;
  const cost = free ? 0 : squares * WALL.cost;
  b.gold -= cost;
  b.walls.queue.push({ squares, daysLeft: squares * daysPer });
  log(b, 'build', `Started ${squares} square${squares > 1 ? 's' : ''} of defensive wall (${cost} GP, ${squares * daysPer} days).`);
}

// --- orders -------------------------------------------------------------------
export function canOrder(b, spec) {
  if (spec.offline > 0) return 'Unusable this turn';
  if (spec.order) return 'Busy';
  return '';
}

export function optionsFor(b, spec) {
  return defOf(spec).options.map((o, i) => ({ ...o, i, locked: o.minLevel && b.level < o.minLevel ? `Requires level ${o.minLevel}` : '' }));
}

const pickOf = (opt, input) => (opt.pick && input.pick !== 'custom' ? opt.pick[Number(input.pick) || 0] : null);

export function orderCost(b, spec, opt, input = {}) {
  if (opt.fx === 'armory') return Math.ceil((100 + 100 * defenderCount(b)) / (hasKey(b, 'smithy') ? 2 : 1));
  if (opt.fx === 'purge') return input.what === 'Blood sacrifice' ? 0 : 1000;
  if (opt.pick) return pickOf(opt, input)?.cost ?? Math.max(0, Number(input.cost) || 0);
  return opt.cost + Math.max(0, Number(input.cost) || 0);
}
export function orderDays(opt, input = {}) {
  const p = pickOf(opt, input);
  if (p?.days) return p.days;
  if (opt.ask?.some((a) => a.k === 'days')) return Math.max(0, Math.floor(Number(input.days) || 0));
  return opt.days;
}

function rollSum(rng, n, sides) {
  let t = 0;
  for (let i = 0; i < n; i++) t += rng.d(sides);
  return t;
}
/** Roll N dice × mult for gold; Open Pockets rolls twice and keeps the better (favor 'high' for income, 'low' for payments). */
function rollGold(b, rng, n, sides, mult, favor = 'high') {
  let r = rollSum(rng, n, sides);
  if (has(b, (d) => d.openPockets)) {
    const r2 = rollSum(rng, n, sides);
    r = favor === 'high' ? Math.max(r, r2) : Math.min(r, r2);
  }
  return r * mult;
}
const table = (rows, roll) => rows.find((r) => roll <= r[0]);
const randomSpec = (b, rng, filter = () => true) => {
  const pool = b.specials.filter(filter);
  return pool.length ? pool[rng.d(pool.length) - 1] : null;
};

function issue(ctx, spec, o) {
  const { b } = ctx;
  const def = defOf(spec);
  const opt = def.options[o.opt];
  if (!opt || canOrder(b, spec) || (opt.minLevel && b.level < opt.minLevel)) return;
  const input = o.input || {};
  const cost = orderCost(b, spec, opt, input);
  const days = orderDays(opt, input);
  const p = pickOf(opt, input);
  const what = p ? p.name : (input.what || '').trim();
  b.gold -= cost;
  spec.order = { opt: o.opt, order: opt.order, name: opt.name, daysLeft: days, total: days, cost, what, size: p?.size ?? input.size ?? '', value: Number(input.value) || 0, issued: b.turn };
  ctx.issued.push(spec);
  ctx.lines.push(log(b, 'order', `${specName(spec)} — ${opt.order}: ${opt.name}${what ? ` (${what})` : ''}${cost ? `, ${cost} GP` : ''}${days ? `, ${days} days` : ''}.`));
  if (spec.haunted) ctx.hauntTrigger = true;
  if (opt.fx === 'travel') ctx.rollEvent = true;
}

function complete(ctx, spec) {
  const { b, rng } = ctx;
  const def = defOf(spec);
  const o = spec.order;
  const opt = def.options[o.opt];
  spec.order = null;
  const head = `${specName(spec)} — ${opt.name}`;
  const say = (m, k = 'done') => ctx.lines.push(log(b, k, `${head}: ${m}`));
  const gain = (amt, why) => { b.gold += amt; say(`${why} +${amt} GP.`, 'gold'); };
  const addOccupant = () => {
    spec.occupants = spec.occupants || [];
    spec.occupants.push({ id: uid(), name: o.what || 'Creature', size: o.size || '', defender: true });
  };
  switch (opt.fx) {
    case 'item': {
      let text = opt.yield ? opt.yield + (o.what ? ` — ${o.what}` : '') : o.what || opt.name;
      if (opt.yieldFromConfig && spec.config[opt.yieldFromConfig]?.[0]) text += ` — ${spec.config[opt.yieldFromConfig][0]}`;
      if (spec.key === 'sacristy' && opt.yield && o.cost >= 100) text += ` (+${Math.min(5, Math.floor(o.cost / 100))}d8 damage)`;
      if (spec.key === 'infirmary' && spec.enlarged) text = text.replace('×2', '×4');
      addItem(b, text);
      say(`complete. Added to stores: ${text}.`);
      break;
    }
    case 'garden': {
      const types = spec.config.types?.length ? spec.config.types : ['Decorative'];
      for (const t of types) addItem(b, `${t} garden harvest: ${GARDEN_YIELD[t] || t}`);
      say(`harvested (${types.join(', ')}). Added to stores.`);
      break;
    }
    case 'defenders': {
      const cap = housingCap(spec);
      const add = Math.min(4, cap - (spec.defenders || 0));
      spec.defenders = (spec.defenders || 0) + Math.max(0, add);
      say(add > 0 ? `${add} Bastion Defender${add > 1 ? 's' : ''} recruited (${spec.defenders}/${cap}).` : 'No room for more defenders.');
      break;
    }
    case 'armory':
      spec.stocked = true;
      say('The armory is stocked.');
      break;
    case 'gamble': {
      const roll = rng.d(100);
      const n = table(GAMBLING, roll)[1];
      gain(rollGold(b, rng, n, 6, 10), `Rolled ${roll}: winnings of ${n}d6 × 10.`);
      break;
    }
    case 'gold': {
      const [n, s, m] = opt.dice;
      gain(rollGold(b, rng, n, s, m), `Proceeds of ${n}d${s} × ${m}.`);
      break;
    }
    case 'sell': {
      const pct = opt.profit.find(([l]) => b.level >= l)[1];
      const amt = Math.round(o.value * (1 + pct / 100));
      gain(amt, `Sold${o.what ? ` ${o.what}` : ''} at ${pct}% over standard price.`);
      break;
    }
    case 'parity': {
      const roll = rng.d(20);
      const win = (roll % 2 === 0) === (opt.win === 'even');
      say(`Rolled ${roll} (${roll % 2 ? 'odd' : 'even'}). ${win ? opt.success : opt.fail}`);
      if (win) {
        if (opt.buffOnSuccess) b.effects.push({ id: uid(), text: opt.buffOnSuccess, expires: b.day + opt.buffDays });
        if (opt.itemOnSuccess) addItem(b, opt.itemOnSuccess);
        if (opt.occupantOnSuccess) addOccupant();
      }
      break;
    }
    case 'occupant':
      addOccupant();
      say(`${o.what || 'A creature'} joins the Bastion.`);
      break;
    case 'lieutenant':
      if ((spec.lieutenants ?? 2) >= 10) say('You already have ten lieutenants.');
      else { spec.lieutenants = (spec.lieutenants ?? 2) + 1; say(`A new lieutenant joins (${spec.lieutenants} total).`); }
      break;
    case 'buff': {
      let text = opt.buff;
      if (opt.buffFromConfig && spec.config[opt.buffFromConfig]?.[0]) text += `: ${spec.config[opt.buffFromConfig][0]}`;
      if (o.what) text += ` (${o.what})`;
      b.effects.push({ id: uid(), text, expires: b.day + opt.buffDays });
      say(`${text} — lasts ${opt.buffDays} days.`);
      break;
    }
    case 'innerPeace':
      b.flags.innerPeace = true;
      say('The next Bastion event is rolled twice and you choose the result.');
      break;
    case 'soup':
      b.flags.soupKitchen = true;
      say('The kitchen served the hungry. A volunteer will replace the next defender or hireling you would lose to a Bastion event.');
      break;
    case 'liminal': {
      const roll = rng.d(20);
      if (roll % 2 === 0) {
        if ((spec.occupants || []).length >= 3) say(`Rolled ${roll} (even), but the Liminal Space already holds three entities.`);
        else { o.what = 'Entity (Unspeakable Horror)'; addOccupant(); say(`Rolled ${roll} (even). An entity takes up residence.`); }
      } else {
        spec.offline = 1;
        say(`Rolled ${roll} (odd). The entity refuses and kills the hireling. The facility is unusable until your next Bastion turn.`);
      }
      break;
    }
    case 'spiritVault': {
      const roll = rng.d(6);
      if (roll > 1) say(`Rolled ${roll}. Answers come as if by Contact Other Plane.`);
      else if (o.what === 'You') say(`Rolled 1. The work is psychically taxing: you take ${rollSum(rng, 6, 6)} Psychic damage.`);
      else { spec.offline = 1; say('Rolled 1. The hireling dies; the vault is unusable until your next Bastion turn.'); }
      break;
    }
    case 'secrets':
      say(`Your hirelings learn ${rng.d(4)} fact(s) about ${o.what || 'the creature'} and how its power compares to yours.`);
      break;
    case 'gate': {
      if (/^Chosen/.test(o.what)) say('The gate opens for 1 minute to the place you specified. The diamond is consumed.');
      else { const roll = rng.d(100); say(`The gate opens for 1 minute. Rolled ${roll}: ${PLANES[Math.ceil(roll / 4) - 1]}.`); }
      break;
    }
    case 'purge': {
      const target = b.specials.find((s) => s.haunted && !defOf(s).alwaysHaunted);
      say(`The ritual is complete. Choose a Haunted facility to cleanse${target ? ' (untick Haunted on it in Facilities)' : ''}.`);
      if (o.what === 'Blood sacrifice') haunting(ctx, true);
      break;
    }
    case 'curios': {
      const h = b.specials.filter((s) => s.haunted).length;
      const row = CURIO_COUNT.find(([max]) => h <= max) || CURIO_COUNT[CURIO_COUNT.length - 1];
      const n = row[1] ? rng.d(row[1]) : 1;
      const cursed = row[2] && rng.d(100) <= row[2];
      for (let i = 0; i < n; i++) addItem(b, `${o.what} magic item (roll on a random ${o.what} table)`);
      say(`The hireling returns with ${n} ${o.what} magic item${n > 1 ? 's' : ''} (${h} Haunted facilit${h === 1 ? 'y' : 'ies'}).${cursed ? ' One of them is cursed (DM chooses).' : ''}`);
      break;
    }
    case 'travel':
      say(`The Bastion travelled${o.what ? ` toward ${o.what}` : ''}.`);
      break;
    default:
      say(opt.done || `complete${o.what ? ` (${o.what})` : ''}.`);
  }
}

// --- attacks, events, hauntings -----------------------------------------------------
function loseDefenders(b, n) {
  let left = n;
  const take = (avail) => { const t = Math.min(avail, left); left -= t; return t; };
  b.extraDefenders -= take(b.extraDefenders || 0);
  for (const s of b.specials) if (s.defenders) s.defenders -= take(s.defenders);
  for (const s of b.specials) {
    if (!left) break;
    if (!defOf(s).occupantKind || defOf(s).occupantKind === 'animal') continue;
    while (left && s.occupants.some((o) => o.defender !== false)) {
      s.occupants.splice(s.occupants.findIndex((o) => o.defender !== false), 1);
      left--;
    }
  }
  return n - left;
}

export function attackDice(b, base) {
  let n = base;
  const notes = [];
  if (b.walls.enclosed) { n -= 2; notes.push('−2 defensive walls'); }
  const lt = lieutenants(b);
  if (lt) { n -= lt; notes.push(`−${lt} lieutenants`); }
  for (const s of b.specials) {
    const d = defOf(s);
    if (d.attackDiceMinus) { n -= d.attackDiceMinus; notes.push(`−${d.attackDiceMinus} ${d.name} knight`); }
    if (d.attackDicePerOccupant && s.occupants?.length) { n -= s.occupants.length; notes.push(`−${s.occupants.length} Liminal entities`); }
  }
  return { n: Math.max(0, n), notes };
}

function attack(ctx, base, who = 'A hostile force') {
  const { b, rng } = ctx;
  const say = (m) => ctx.lines.push(log(b, 'event', m));
  if (b.flags.refugees) { say('The refugees flee the fighting.'); delete b.flags.refugees; }
  if (b.flags.monsterGuest) {
    delete b.flags.monsterGuest;
    say(`${who} attacks but your monstrous guest drives it off. No Bastion Defenders are lost; the guest departs.`);
    return;
  }
  const before = defenderCount(b);
  const armory = b.specials.find((s) => s.key === 'armory' && s.stocked);
  const sides = armory ? 8 : 6;
  const { n, notes } = attackDice(b, base);
  const rolls = Array.from({ length: n }, () => rng.d(sides));
  let rerolls = b.specials.filter((s) => defOf(s).triage).reduce((t, s) => t + hirelingCount(s), 0);
  let rerolled = 0;
  for (let i = 0; i < rolls.length && rerolls > 0; i++) if (rolls[i] === 1) { rolls[i] = rng.d(sides); rerolls--; rerolled++; }
  let losses = rolls.filter((r) => r === 1).length;
  let soup = '';
  if (losses && b.flags.soupKitchen) { losses--; soup = ' A Soup Kitchen volunteer steps in for one of the fallen.'; }
  const lost = loseDefenders(b, losses);
  say(`${who} attacks and is defeated. Rolled ${n}d${sides}${notes.length ? ` (${notes.join(', ')})` : ''}: [${rolls.join(', ')}]${rerolled ? `, ${rerolled} rerolled by Infirmary triage` : ''}. ${lost} Bastion Defender${lost === 1 ? '' : 's'} lost.${soup}`);
  if (armory) { armory.stocked = false; say('The Armory\'s stock is expended.'); }
  if (before === 0) {
    const s = randomSpec(b, rng);
    if (s) { s.offline = 1; say(`With no defenders, ${specName(s)} is damaged and can't be used on your next Bastion turn.`); }
  }
}

function runEvent(ctx, roll, { noOpportunity = false } = {}) {
  const { b, rng } = ctx;
  let [, key, name] = table(EVENTS, roll);
  while (noOpportunity && key === 'opportunity') { roll = rng.d(100); [, key, name] = table(EVENTS, roll); }
  const say = (m) => ctx.lines.push(log(b, 'event', `Event (${roll}) ${name}: ${m}`));
  const income = (why) => { const g = rollGold(b, rng, 1, 6, 100); b.gold += g; return `${why} +${g} GP.`; };
  switch (key) {
    case 'allWell': say(ALL_WELL[rng.d(8) - 1]); break;
    case 'attack': say('Your Bastion comes under attack!'); attack(ctx, 6); break;
    case 'criminal': {
      const s = randomSpec(b, rng);
      if (!s) { say('Officials come asking about a hireling, but you have none.'); break; }
      const bribe = rollGold(b, rng, 1, 6, 100, 'low');
      if (b.flags.soupKitchen) { say(`Officials arrive with a warrant for a hireling in ${specName(s)}. A Soup Kitchen volunteer is ready to take their place, so nothing is lost.`); break; }
      b.pending = { type: 'criminal', specId: s.id, bribe };
      say(`Officials arrive with a warrant for a hireling in ${specName(s)}. Pay a ${bribe} GP bribe or lose them.`);
      break;
    }
    case 'opportunity':
      b.pending = { type: 'opportunity' };
      say('Your Bastion can host a festival, fund research, or appease a noble. Pay 500 GP to seize the opportunity (and roll another event), or decline.');
      break;
    case 'visitors': say(income('Friendly visitors pay for brief use of one of your special facilities.')); break;
    case 'guest': {
      const g = rng.d(4);
      if (g === 1) { addItem(b, 'Letter of recommendation'); say('A renowned guest stays 7 days and leaves you a letter of recommendation.'); }
      else if (g === 2) say(income('A guest seeking sanctuary stays 7 days and leaves a gift.'));
      else if (g === 3) { b.extraDefenders = (b.extraDefenders || 0) + 1; say('A mercenary guest joins as an additional Bastion Defender (needs no housing).'); }
      else { b.flags.monsterGuest = true; say('A Friendly monster settles in. It will defend your Bastion once, preventing all defender losses, then leave.'); }
      break;
    }
    case 'lostHirelings': {
      const s = randomSpec(b, rng);
      if (!s) say('Nothing to lose: you have no special facilities.');
      else if (b.flags.soupKitchen) say(`The hirelings of ${specName(s)} leave, but Soup Kitchen volunteers take over at once.`);
      else { s.offline = 1; say(`${specName(s)} loses its hirelings and can't be used on your next Bastion turn. They are replaced afterwards at no cost.`); }
      break;
    }
    case 'magical': addItem(b, 'Uncommon Potion or Scroll of your choice'); say('Your hirelings discover or create an Uncommon magic item of your choice (a Potion or Scroll).'); break;
    case 'refugees': {
      const n = rollSum(rng, 2, 4);
      b.flags.refugees = n;
      say(income(`${n} refugees seek shelter and pay for your hospitality. They stay until rehomed or the Bastion is attacked.`));
      break;
    }
    case 'aid':
      if (defenderCount(b) === 0) say('A local leader asks for help, but you have no Bastion Defenders to send.');
      else { b.pending = { type: 'aid' }; say('A local leader asks for help. Choose how many Bastion Defenders to send (roll 1d6 each; 10+ succeeds outright).'); }
      break;
    case 'treasure': {
      const r = rng.d(100);
      const t = table(TREASURE, r)[1];
      addItem(b, `Treasure: ${t}`);
      say(`Rolled ${r}. Your Bastion acquires ${t}.`);
      break;
    }
  }
  delete b.flags.soupKitchen;
}

function rollEvent(ctx) {
  const { b, rng } = ctx;
  if (b.flags.innerPeace) {
    delete b.flags.innerPeace;
    const rolls = [rng.d(100), rng.d(100)];
    b.pending = { type: 'chooseEvent', rolls };
    ctx.lines.push(log(b, 'event', `Inner Peace: rolled ${rolls[0]} (${table(EVENTS, rolls[0])[2]}) and ${rolls[1]} (${table(EVENTS, rolls[1])[2]}). Choose one.`));
  } else runEvent(ctx, rng.d(100));
}

export const eventName = (roll) => table(EVENTS, roll)[2];

function haunting(ctx, force = false) {
  const { b, rng } = ctx;
  if (ctx.haunted) return;
  if (!force && rng.d(6) !== 1) return;
  ctx.haunted = true;
  let roll = rng.d(100);
  let [, key, name] = table(HAUNTINGS, roll);
  if (key === 'freeSpirit' && b.specials.every((s) => s.haunted)) {
    do { roll = rng.d(100); [, key, name] = table(HAUNTINGS, roll); } while (key === 'freeSpirit');
  }
  const say = (m) => ctx.lines.push(log(b, 'haunt', `Haunting (${roll}) ${name}: ${m}`));
  const cancel = (orders, why) => {
    const hit = ctx.issued.filter((s) => s.order && orders.includes(s.order.order));
    for (const s of hit) s.order = null;
    say(`${why} ${hit.length ? `No effect this turn: ${hit.map(specName).join(', ')}.` : 'No orders were affected.'}`);
  };
  switch (key) {
    case 'cursedHireling': { const s = randomSpec(b, rng); say(`A hireling${s ? ` in ${specName(s)}` : ''} is cursed. They won't leave their facility and work there takes twice as long until the curse is lifted.`); break; }
    case 'freeSpirit': { const s = randomSpec(b, rng, (x) => !x.haunted); s.haunted = true; say(`${specName(s)} becomes Haunted.`); break; }
    case 'friendlyGhost': say('A benevolent spirit possesses a hireling (DM\'s choice) for 14 days. If their facility produces items or gold, it produces twice as much.'); break;
    case 'hiddenRoom': say('The spirits reveal a hidden closet. Add a 5-foot square to your Bastion; something may lie inside.'); break;
    case 'lightningStorm':
      if (hasKey(b, 'lightning-generator')) say('A storm rages, but your Lightning Generator absorbs it.');
      else cancel(['Trade'], 'A lightning storm disrupts trade.');
      break;
    case 'livingDead': say('Mindless undead shamble from the Mists.'); attack(ctx, 3, 'A group of undead'); break;
    case 'mistWanderers': say(`${rng.d(4)} stranger(s) emerge from the Mists seeking shelter. They join as hirelings if there is room, otherwise linger ${rng.d(4)} day(s) and vanish.`); break;
    case 'priest': {
      const r = rng.d(20);
      const names = (keys) => b.specials.filter((s) => keys.includes(s.key)).map(specName);
      if (r % 2 === 0) {
        const targets = names(['ancient-altar', 'arcane-study', 'cabinet-of-curiosities', 'seance-parlor']);
        if (targets.length) say(`A witch-hunting inquisitor arrives and destroys one of: ${targets.join(', ')}. Replace it with a different special facility.`);
        else { say('A witch-hunting inquisitor finds nothing to condemn. An Extraordinary Opportunity arises instead.'); if (!b.pending) b.pending = { type: 'opportunity' }; }
      } else if (names(['reliquary', 'sacristy', 'sanctuary', 'sanctum']).length) say('An exorcist offers to cleanse one Haunted facility. If you agree, untick Haunted on it in Facilities.');
      else say('An exorcist visits but finds no holy place to work from, and moves on.');
      break;
    }
    case 'illLuck': cancel(['Harvest'], 'Accidents and bad luck plague the Bastion.'); break;
    case 'poltergeist': cancel(['Empower', 'Research'], 'Disruptive happenings plague the Bastion.'); break;
    case 'spatialWarp':
      if (rng.d(4) === 4) say('Replace one of your special facilities with another for which you qualify.');
      else say('Enlarge one Cramped special facility to Roomy, or one Roomy to Vast, at no cost.');
      break;
    case 'spectralVision': say('A ghostly vision of the past plays out. You gain insight into the spirits or the land, as if by Legend Lore.'); break;
    case 'vistani': say('Vistani travelers ask for a night\'s shelter and offer an Augury or tarokka reading. If you turn them away, your highest-level non-Haunted special facility becomes Haunted.'); break;
  }
}

// --- the turn ---------------------------------------------------------------------
/**
 * plan: { mode: 'orders' | 'maintain', days?: number, orders?: { [specId]: { opt: number, input?: {} } } }
 * Time since the previous turn passes first (finishing work), then the new orders are issued.
 */
export function takeTurn(b, plan, rng = defaultRng) {
  if (b.pending) throw new Error('Resolve the pending event first.');
  const ctx = { b, rng, lines: [], issued: [], hauntTrigger: false, rollEvent: false, haunted: false };
  const elapsed = Math.max(0, Math.floor(plan.days ?? (b.turn === 0 ? 0 : b.settings.turnDays)));
  const wasOffline = b.specials.filter((s) => s.offline > 0);

  // 1. time passes
  b.turn += 1;
  b.day += elapsed;
  for (const s of b.specials) {
    if (!s.order) continue;
    s.order.daysLeft -= elapsed;
    if (s.order.daysLeft <= 0) complete(ctx, s);
  }
  for (const f of b.basics) {
    if (!f.build) continue;
    f.build.daysLeft -= elapsed;
    if (f.build.daysLeft <= 0) {
      if (f.build.kind === 'enlarge') f.space = f.build.to;
      ctx.lines.push(log(b, 'build', `${f.build.kind === 'enlarge' ? `The ${f.type} is now ${f.space}` : `The ${f.space} ${f.type} is finished`}.`));
      delete f.build;
    }
  }
  for (const q of b.walls.queue) {
    q.daysLeft -= elapsed;
    if (q.daysLeft <= 0) { b.walls.built += q.squares; ctx.lines.push(log(b, 'build', `${q.squares} square(s) of defensive wall finished (${b.walls.built} total).`)); }
  }
  b.walls.queue = b.walls.queue.filter((q) => q.daysLeft > 0);
  for (const e of b.effects) if (e.expires <= b.day) ctx.lines.push(log(b, 'done', `Expired: ${e.text}.`));
  b.effects = b.effects.filter((e) => e.expires > b.day);

  // 2. the new turn
  if (plan.mode === 'maintain') {
    ctx.lines.push(log(b, 'order', 'Maintain: the hirelings keep the Bastion running.'));
    ctx.rollEvent = true;
    ctx.hauntTrigger = b.specials.some((s) => s.haunted);
  } else {
    for (const [id, o] of Object.entries(plan.orders || {})) {
      const spec = b.specials.find((s) => s.id === id);
      if (spec && o && o.opt !== '' && o.opt != null) issue(ctx, spec, { ...o, opt: Number(o.opt) });
    }
    if (!ctx.issued.length) ctx.lines.push(log(b, 'order', 'No orders issued this turn.'));
  }
  if (b.settings.haunted && ctx.hauntTrigger) haunting(ctx);
  for (const s of ctx.issued) if (s.order && s.order.daysLeft <= 0) complete(ctx, s);
  if (ctx.rollEvent) rollEvent(ctx);
  for (const s of wasOffline) s.offline = Math.max(0, s.offline - 1);
  return ctx.lines;
}

export function resolvePending(b, choice, rng = defaultRng) {
  const p = b.pending;
  if (!p) return [];
  const ctx = { b, rng, lines: [], issued: [], haunted: true };
  const say = (m) => ctx.lines.push(log(b, 'event', m));
  b.pending = null;
  if (p.type === 'criminal') {
    const s = b.specials.find((x) => x.id === p.specId);
    if (choice === 'pay') { b.gold -= p.bribe; say(`You pay the ${p.bribe} GP bribe and keep your hireling.`); }
    else if (s && hirelingCount(s) <= 1) { s.offline = 1; say(`The hireling is arrested. ${specName(s)} has no staff and can't be used on your next Bastion turn; a replacement arrives afterwards.`); }
    else say(`The hireling is arrested and taken away${s ? ` from ${specName(s)}` : ''}. A replacement arrives at no cost.`);
  } else if (p.type === 'opportunity') {
    if (choice === 'accept') { b.gold -= 500; say('You seize the opportunity for 500 GP. Word spreads…'); runEvent(ctx, rng.d(100), { noOpportunity: true }); }
    else say('You decline the opportunity.');
  } else if (p.type === 'aid') {
    const n = Math.min(defenderCount(b), Math.max(0, Math.floor(Number(choice) || 0)));
    if (!n) say('You send no one. The local leader looks elsewhere.');
    else {
      const rolls = Array.from({ length: n }, () => rng.d(6));
      const total = rolls.reduce((a, c) => a + c, 0);
      const reward = rollGold(b, rng, 1, 6, 100);
      if (total >= 10) { b.gold += reward; say(`You send ${n} defender(s): [${rolls.join(', ')}] = ${total}. The problem is solved. +${reward} GP.`); }
      else {
        const half = Math.floor(reward / 2);
        b.gold += half;
        const lost = b.flags.soupKitchen ? 0 : loseDefenders(b, 1);
        say(`You send ${n} defender(s): [${rolls.join(', ')}] = ${total}. The problem is solved at a cost: ${lost ? 'one Bastion Defender is killed' : 'a volunteer replaces the defender who fell'}. +${half} GP.`);
      }
    }
  } else if (p.type === 'chooseEvent') {
    runEvent(ctx, p.rolls[Number(choice) || 0]);
  }
  return ctx.lines;
}

export function summary(b) {
  return {
    name: b.name, player: b.player, character: b.character, level: b.level, turn: b.turn, day: b.day, gold: b.gold,
    defenders: defenderCount(b), specials: b.specials.map((s) => defOf(s)?.name).filter(Boolean), basics: b.basics.length,
    pending: !!b.pending,
  };
}
