import test from 'node:test';
import assert from 'node:assert/strict';
import { FACILITIES, EVENTS, HAUNTINGS } from '../public/js/data.js';
import * as E from '../public/js/engine.js';

// rng that replays a scripted list of rolls, then falls back to a fixed value
const script = (rolls, fallback = 3) => ({ d: (n) => Math.min(n, rolls.length ? rolls.shift() : fallback) });

const withSpecials = (keys, init = {}) => {
  const b = E.newBastion({ level: 17, ...init });
  for (const k of keys) E.addSpecial(b, k, script([]));
  return b;
};
const spec = (b, key) => b.specials.find((s) => s.key === key);
const optIndex = (key, name) => FACILITIES.find((f) => f.key === key).options.findIndex((o) => o.name === name);

test('data is well formed', () => {
  assert.equal(new Set(FACILITIES.map((f) => f.key)).size, FACILITIES.length);
  assert.equal(FACILITIES.length, 29 + 8 + 10 + 8 + 9);
  for (const f of FACILITIES) {
    assert.ok(['Cramped', 'Roomy', 'Vast'].includes(f.space), f.key);
    assert.ok(f.options.length > 0, f.key);
    assert.ok(E.prereqText(f).length > 0);
  }
  assert.equal(EVENTS.at(-1)[0], 100);
  assert.equal(HAUNTINGS.at(-1)[0], 100);
});

test('slots and prerequisites', () => {
  assert.deepEqual([4, 5, 9, 13, 17, 20].map(E.slotsForLevel), [0, 2, 4, 5, 6, 6]);
  const b = E.newBastion({ level: 5 });
  const def = (k) => FACILITIES.find((f) => f.key === k);
  assert.deepEqual(E.blockers(b, def('library')), []);
  assert.ok(E.blockers(b, def('arcane-study')).length === 1);
  b.traits.arcane = true;
  assert.deepEqual(E.blockers(b, def('arcane-study')), []);
  assert.ok(E.blockers(b, def('archive'))[0].includes('level 13'));
  assert.ok(E.blockers(b, def('harper-hideout'))[0].includes('Harpers'));
  b.memberships.push('harpers');
  assert.deepEqual(E.blockers(b, def('harper-hideout')), []);
  E.addSpecial(b, 'library');
  assert.deepEqual(E.blockers(b, def('library')), ['Already built']);
});

test('orders take time: issued one turn, finished the next', () => {
  const b = withSpecials(['arcane-study', 'barrack'], { gold: 100 });
  const study = spec(b, 'arcane-study');
  const barrack = spec(b, 'barrack');
  E.takeTurn(b, { mode: 'orders', orders: { [study.id]: { opt: optIndex('arcane-study', 'Book') }, [barrack.id]: { opt: 0 } } }, script([]));
  assert.equal(b.turn, 1);
  assert.equal(b.day, 0);
  assert.equal(b.gold, 90);
  assert.equal(barrack.defenders, 4, 'instant orders resolve immediately');
  assert.equal(study.order.daysLeft, 7);
  assert.equal(E.canOrder(b, study), 'Busy');
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(b.day, 7);
  assert.equal(study.order, null);
  assert.ok(b.inventory.some((i) => i.text === 'Blank book'));
});

test('barrack capacity', () => {
  const b = withSpecials(['barrack']);
  const s = spec(b, 'barrack');
  for (let i = 0; i < 5; i++) E.takeTurn(b, { mode: 'orders', orders: { [s.id]: { opt: 0 } } }, script([]));
  assert.equal(s.defenders, 12);
  assert.equal(E.defenderCount(b), 12);
});

test('armory cost scales with defenders and smithy', () => {
  const b = withSpecials(['armory', 'barrack', 'smithy']);
  spec(b, 'barrack').defenders = 4;
  const a = spec(b, 'armory');
  assert.equal(E.orderCost(b, a, E.defOf(a).options[0]), 250);
  E.takeTurn(b, { mode: 'orders', orders: { [a.id]: { opt: 0 } } }, script([]));
  assert.equal(a.stocked, true);
  assert.equal(b.gold, -250);
});

test('attack: walls remove dice, armory uses d8, ones kill defenders', () => {
  const b = withSpecials(['barrack', 'armory']);
  spec(b, 'barrack').defenders = 6;
  spec(b, 'armory').stocked = true;
  b.walls.enclosed = true;
  // event roll 51 = attack, then 4 dice: 1, 1, 8, 5
  const lines = E.takeTurn(b, { mode: 'maintain' }, script([51, 1, 1, 8, 5]));
  assert.equal(spec(b, 'barrack').defenders, 4);
  assert.equal(spec(b, 'armory').stocked, false);
  assert.ok(lines.some((l) => l.includes('4d8')));
});

test('attack with no defenders shuts a facility for one turn', () => {
  const b = withSpecials(['library']);
  E.takeTurn(b, { mode: 'maintain' }, script([55], 6));
  const lib = spec(b, 'library');
  assert.equal(lib.offline, 1);
  assert.equal(E.canOrder(b, lib), 'Unusable this turn');
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(lib.offline, 0);
});

test('criminal hireling: bribe or lose staff', () => {
  const b = withSpecials(['library'], { gold: 1000 });
  E.takeTurn(b, { mode: 'maintain' }, script([56, 1, 4]));
  assert.equal(b.pending.type, 'criminal');
  assert.equal(b.pending.bribe, 400);
  assert.throws(() => E.takeTurn(b, { mode: 'maintain' }));
  E.resolvePending(b, 'pay', script([]));
  assert.equal(b.gold, 600);
  assert.equal(b.pending, null);

  E.takeTurn(b, { mode: 'maintain' }, script([56, 1, 2]));
  E.resolvePending(b, 'refuse', script([]));
  assert.equal(spec(b, 'library').offline, 1);
});

test('opportunity rerolls a different event', () => {
  const b = withSpecials([], { gold: 500 });
  E.takeTurn(b, { mode: 'maintain' }, script([60]));
  assert.equal(b.pending.type, 'opportunity');
  E.resolvePending(b, 'accept', script([60, 65, 2])); // 60 is rerolled, 65 = visitors paying 200
  assert.equal(b.gold, 200);
});

test('request for aid', () => {
  const b = withSpecials(['barrack']);
  spec(b, 'barrack').defenders = 3;
  E.takeTurn(b, { mode: 'maintain' }, script([95]));
  assert.equal(b.pending.type, 'aid');
  E.resolvePending(b, 2, script([2, 3, 4])); // total 5 < 10; reward 400 halved
  assert.equal(b.gold, 200);
  assert.equal(E.defenderCount(b), 2);
});

test('inner peace lets you choose between two events', () => {
  const b = withSpecials(['meditation-chamber']);
  const m = spec(b, 'meditation-chamber');
  E.takeTurn(b, { mode: 'orders', orders: { [m.id]: { opt: 0 } } }, script([]));
  assert.equal(b.flags.innerPeace, true);
  E.takeTurn(b, { mode: 'maintain' }, script([51, 99]));
  assert.deepEqual(b.pending, { type: 'chooseEvent', rolls: [51, 99] });
  E.resolvePending(b, 1, script([80]));
  assert.ok(b.inventory.some((i) => i.text.startsWith('Treasure')));
});

test('selling uses level-based profit', () => {
  const b = withSpecials(['storehouse'], { level: 13 });
  const s = spec(b, 'storehouse');
  E.takeTurn(b, { mode: 'orders', orders: { [s.id]: { opt: optIndex('storehouse', 'Sell Goods'), input: { value: 1000, what: 'silk' } } } }, script([]));
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(b.gold, 1500);
});

test('picks set cost, duration and occupants', () => {
  const b = withSpecials(['construct-forge', 'menagerie'], { gold: 10000 });
  const forge = spec(b, 'construct-forge');
  const zoo = spec(b, 'menagerie');
  E.takeTurn(b, { mode: 'orders', orders: { [forge.id]: { opt: 0, input: { pick: 0 } }, [zoo.id]: { opt: 0, input: { pick: 10 } } } }, script([]));
  assert.equal(b.gold, 10000 - 1000 - 3500);
  assert.equal(forge.order.daysLeft, 14);
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(zoo.occupants[0].name, 'Owlbear');
  assert.equal(forge.occupants.length, 0);
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(forge.occupants[0].name, 'Animated Armor');
  assert.equal(E.defenderCount(b), 2);
});

test('buffs expire', () => {
  const b = withSpecials(['demiplane']);
  const d = spec(b, 'demiplane');
  E.takeTurn(b, { mode: 'orders', orders: { [d.id]: { opt: 0 } } }, script([]));
  assert.equal(b.effects.length, 1);
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(b.effects.length, 0);
});

test('haunted bastions: first facility is haunted, poltergeist cancels research', () => {
  const b = E.newBastion({ level: 5, settings: { turnDays: 7, haunted: true } });
  E.addSpecial(b, 'library', script([]));
  const lib = spec(b, 'library');
  assert.equal(lib.haunted, true);
  // d6 = 1 triggers a haunting, d100 = 75 is Poltergeist
  const lines = E.takeTurn(b, { mode: 'orders', orders: { [lib.id]: { opt: 0, input: { what: 'dragons' } } } }, script([1, 75]));
  assert.equal(lib.order, null);
  assert.ok(lines.some((l) => l.includes('Poltergeist')));
});

test('basic facilities and walls build over time', () => {
  const b = E.newBastion({ gold: 5000 });
  E.addBasic(b, 'Parlor', 'Cramped');
  E.buildWalls(b, 2);
  assert.equal(b.gold, 5000 - 500 - 500);
  for (let i = 0; i < 3; i++) E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.ok(b.basics.at(-1).build, 'still building after 14 days');
  assert.equal(b.walls.built, 0);
  E.takeTurn(b, { mode: 'orders', orders: {} }, script([]));
  assert.equal(b.basics.at(-1).build, undefined);
  assert.equal(b.walls.built, 2);
});

test('every option of every facility can be issued and completed', () => {
  for (const f of FACILITIES) {
    f.options.forEach((o, i) => {
      const b = E.newBastion({ level: 20, gold: 1e6 });
      const s = E.addSpecial(b, f.key, script([]));
      E.takeTurn(b, { mode: 'orders', orders: { [s.id]: { opt: i, input: { what: 'x', pick: 0, days: 7, cost: 5, value: 10 } } } }, script([], 2));
      for (let t = 0; t < 40 && s.order; t++) {
        if (b.pending) E.resolvePending(b, 'decline', script([], 2));
        E.takeTurn(b, { mode: 'orders', orders: {} }, script([], 2));
      }
      assert.equal(s.order, null, `${f.key} / ${o.name}`);
    });
  }
});
