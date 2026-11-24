import { api } from './api.js';
import * as D from './data.js';
import * as E from './engine.js';

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
const MAP_W = 40, MAP_H = 28;

const S = {
  route: { page: 'home' }, campaign: null, b: null, version: 0, tab: 'overview', save: 'saved', error: null, loading: false,
  plan: newPlan(),
  ui: { open: new Set(), picker: false, srcs: new Set(['DMG']), ignoreReq: false, tool: 'erase', floor: 0 },
};
function newPlan() { return { mode: 'orders', days: null, orders: {} }; }

// --- recents (per browser) ---------------------------------------------------
const recents = {
  get() { try { return JSON.parse(localStorage.getItem('bm.campaigns')) || []; } catch { return []; } },
  add(c) { try { localStorage.setItem('bm.campaigns', JSON.stringify([{ id: c.id, name: c.name }, ...this.get().filter((x) => x.id !== c.id)].slice(0, 8))); } catch { /* storage unavailable */ } },
  remove(id) { try { localStorage.setItem('bm.campaigns', JSON.stringify(this.get().filter((x) => x.id !== id))); } catch { /* storage unavailable */ } },
};

// --- routing ---------------------------------------------------------------------
function parseRoute() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (p[0] === 'c' && p[1] && p[2] === 'b' && p[3]) return { page: 'bastion', cid: p[1], bid: p[3] };
  if (p[0] === 'c' && p[1]) return { page: 'campaign', cid: p[1] };
  return { page: 'home' };
}
async function navigate() {
  await flush();
  S.route = parseRoute();
  S.error = null; S.b = null; S.loading = true; S.plan = newPlan(); S.ui.picker = false;
  render();
  try {
    if (S.route.page === 'campaign') {
      S.campaign = await api.getCampaign(S.route.cid);
      recents.add(S.campaign);
    } else if (S.route.page === 'bastion') {
      const r = await api.getBastion(S.route.cid, S.route.bid);
      S.b = normalize(r.data); S.version = r.version; S.campaign = r.campaign; S.save = 'saved';
      recents.add(r.campaign);
    }
  } catch (e) {
    S.error = e.status === 404 ? 'That campaign or bastion could not be found. Check the link.' : e.message;
  }
  S.loading = false;
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);

function normalize(data) {
  const base = E.newBastion();
  const b = { ...base, ...data };
  b.settings = { ...base.settings, ...data.settings };
  b.walls = { ...base.walls, ...data.walls };
  b.map = data.map?.floors?.length ? data.map : base.map;
  b.specials = (b.specials || []).filter((s) => D.FACILITY_BY_KEY[s.key]);
  for (const k of ['traits', 'flags']) b[k] ||= {};
  for (const k of ['memberships', 'inventory', 'effects', 'log', 'basics']) b[k] ||= [];
  return b;
}

// --- saving ----------------------------------------------------------------------
let saveTimer, saving = false, again = false;
function touch() {
  if (S.save !== 'conflict') S.save = 'dirty';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 700);
  paintSave();
}
async function flush() {
  clearTimeout(saveTimer);
  if (!S.b || S.save === 'saved' || S.save === 'conflict') return;
  if (saving) { again = true; return; }
  saving = true; S.save = 'saving'; paintSave();
  const { cid, bid } = S.route;
  try {
    const r = await api.saveBastion(cid, bid, S.b, E.summary(S.b), S.version);
    S.version = r.version;
    S.save = again ? 'dirty' : 'saved';
  } catch (e) {
    S.save = e.status === 409 ? 'conflict' : 'error';
    if (S.save === 'conflict') render();
  }
  saving = false;
  paintSave();
  if (again) { again = false; await flush(); }
}
const SAVE_TEXT = { saved: 'Saved', dirty: 'Unsaved changes…', saving: 'Saving…', conflict: 'Out of date', error: 'Save failed. Retrying on next change' };
function paintSave() {
  const el = document.getElementById('save');
  if (el) { el.className = `save ${S.save}`; el.textContent = SAVE_TEXT[S.save]; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('beforeunload', (e) => { if (S.b && S.save !== 'saved' && S.save !== 'conflict') { flush(); e.preventDefault(); } });

function mutate(fn, rerender = true) {
  fn(S.b);
  touch();
  if (rerender) render();
}

// --- render ----------------------------------------------------------------------
function render() {
  const focusKey = document.activeElement?.dataset?.fk;
  const scrolls = [...document.querySelectorAll('[data-keep-scroll]')].map((el) => [el.dataset.keepScroll, el.scrollLeft, el.scrollTop]);
  let html;
  if (S.loading) html = top() + '<p class="loading">Loading…</p>';
  else if (S.error) html = top() + `<div class="card alert"><h2>Something went wrong</h2><p>${esc(S.error)}</p><a class="btn" href="#/">Back to start</a></div>`;
  else if (S.route.page === 'campaign') html = top() + campaignPage();
  else if (S.route.page === 'bastion') html = top() + bastionPage();
  else html = homePage();
  $app.innerHTML = `<div class="wrap">${html}</div>`;
  if (focusKey) document.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  for (const [k, x, y] of scrolls) { const el = document.querySelector(`[data-keep-scroll="${k}"]`); if (el) { el.scrollLeft = x; el.scrollTop = y; } }
}

function top() {
  const c = S.campaign;
  return `<div class="top">
    <a class="brand" href="#/">🏰 Bastionmaker</a>
    <div class="crumbs">
      ${c && S.route.page !== 'home' ? `<span class="muted">/</span><a href="#/c/${c.id}">${esc(c.name)}</a>` : ''}
      ${S.b ? `<span class="muted">/</span><strong>${esc(S.b.name)}</strong>` : ''}
    </div>
    ${S.b ? `<span id="save" class="save ${S.save} right">${SAVE_TEXT[S.save]}</span>` : ''}
  </div>`;
}

function homePage() {
  const rec = recents.get();
  return `<div class="hero"><h1>🏰 Bastionmaker</h1>
    <p>Build your party's Bastions, save them, and run Bastion turns together. One shared link per campaign, no accounts.</p></div>
  <div class="grid2">
    <form class="card stack" data-submit="createCampaign">
      <h2>Start a campaign</h2>
      <label class="field">Campaign name<input name="name" required maxlength="80" placeholder="The Sunless Citadel Crew"></label>
      <div><button class="primary">Create campaign</button></div>
      <p class="small muted">You get a private link to share with your group. Anyone with the link can view and edit the campaign's bastions.</p>
    </form>
    <form class="card stack" data-submit="openCampaign">
      <h2>Join a campaign</h2>
      <label class="field">Campaign link or code<input name="code" required placeholder="Paste the link your group shared"></label>
      <div><button>Open</button></div>
      ${rec.length ? `<div><h3>Recent on this device</h3><ul class="plain">${rec.map((r) => `<li><a class="grow" href="#/c/${esc(r.id)}">${esc(r.name)}</a><button class="ghost" data-act="forget" data-id="${esc(r.id)}" title="Forget">✕</button></li>`).join('')}</ul></div>` : ''}
    </form>
  </div>`;
}

function campaignPage() {
  const c = S.campaign;
  const link = `${location.origin}/#/c/${c.id}`;
  return `<div class="stack">
    <div class="row"><h1>${esc(c.name)}</h1><button class="ghost" data-act="renameCampaign">Rename</button></div>
    <div class="card">
      <h3>Share with your group</h3>
      <div class="share"><input readonly value="${esc(link)}" aria-label="Campaign link" onfocus="this.select()"><button data-act="copy" data-text="${esc(link)}">Copy link</button></div>
      <p class="small muted" style="margin:.6em 0 0">Anyone with this link can open and edit every bastion in the campaign. Treat it like a key.</p>
    </div>
    <div class="row"><h2>Bastions</h2><button class="primary right" data-act="newBastion">+ New bastion</button></div>
    ${c.bastions.length ? `<div class="bastions">${c.bastions.map(bastionCard).join('')}</div>` : '<div class="card muted">No bastions yet. Create the first one.</div>'}
  </div>`;
}
function bastionCard({ id, summary: s, updatedAt }) {
  return `<a class="card bastion" href="#/c/${S.campaign.id}/b/${id}">
    <h3>${esc(s.name || 'Bastion')}</h3>
    <p class="muted small">${esc(s.character || 'Unnamed character')}${s.player ? ` · ${esc(s.player)}` : ''} · Level ${s.level ?? '?'}</p>
    <div class="fac-meta"><span class="tag">Turn ${s.turn ?? 0}</span><span class="tag">${fmt(s.gold)} GP</span><span class="tag">${plural(s.defenders || 0, 'defender')}</span>${s.pending ? '<span class="tag bad">Event waiting</span>' : ''}</div>
    <p class="small">${(s.specials || []).map(esc).join(', ') || '<span class="muted">No special facilities yet</span>'}</p>
    <p class="small muted" style="margin:0">Updated ${new Date(updatedAt).toLocaleString()}</p>
  </a>`;
}

const TABS = { overview: 'Overview', facilities: 'Facilities', turn: 'Bastion turn', map: 'Map', log: 'Log' };
function bastionPage() {
  const b = S.b;
  const body = { overview: overviewTab, facilities: facilitiesTab, turn: turnTab, map: mapTab, log: logTab }[S.tab]();
  return `${S.save === 'conflict' ? `<div class="card alert row" style="margin-bottom:14px"><div class="grow"><strong>Someone else changed this bastion.</strong> Reload to get their version; your most recent edit here was not saved.</div><button class="primary" data-act="reload">Reload latest</button></div>` : ''}
  <div class="row"><h1>${esc(b.name)}</h1>${b.pending ? '<span class="tag bad">Event waiting</span>' : ''}</div>
  <div class="tabs" role="tablist">${Object.entries(TABS).map(([k, v]) => `<button role="tab" aria-selected="${S.tab === k}" data-act="tab" data-tab="${k}">${v}</button>`).join('')}</div>
  ${body}`;
}

// generic bound inputs: data-bind is a path into the bastion ("specials.#id.label")
const bind = (path, type = 'str') => `data-bind="${path}" data-type="${type}" data-fk="${path}"`;
const text = (label, path, extra = '') => `<label class="field">${label}<input type="text" ${bind(path)} value="${esc(get(path))}" ${extra}></label>`;
const number = (label, path, extra = '') => `<label class="field">${label}<input type="number" ${bind(path, 'num')} value="${esc(get(path) ?? 0)}" ${extra}></label>`;
const check = (label, path, extra = '') => `<label class="check"><input type="checkbox" ${bind(path, 'bool')} ${get(path) ? 'checked' : ''} ${extra}><span>${label}</span></label>`;

function walk(path) {
  const segs = path.split('.');
  let o = S.b;
  for (const seg of segs.slice(0, -1)) o = seg[0] === '#' ? o.find((x) => x.id === seg.slice(1)) : o[seg];
  return [o, segs.at(-1)];
}
function get(path) { const [o, k] = walk(path); return o?.[k]; }

// --- overview ---------------------------------------------------------------------
function overviewTab() {
  const b = S.b;
  const slots = E.slotsForLevel(b.level);
  const flags = [
    b.flags.monsterGuest && 'A Friendly monster guest will repel the next attack',
    b.flags.refugees && `${b.flags.refugees} refugees are sheltering here`,
    b.flags.innerPeace && 'Inner Peace: next event is rolled twice',
    b.flags.soupKitchen && 'Soup Kitchen volunteers will cover the next loss',
  ].filter(Boolean);
  return `<div class="stack">
    <div class="stats">
      <div class="stat"><b>${b.turn}</b><span>Bastion turns · day ${b.day}</span></div>
      <div class="stat"><b class="${b.gold < 0 ? 'neg' : ''}">${fmt(b.gold)}</b><span>GP in the treasury</span></div>
      <div class="stat"><b>${b.specials.length}/${slots}</b><span>Special facilities</span></div>
      <div class="stat"><b>${E.defenderCount(b)}</b><span>Bastion Defenders</span></div>
      <div class="stat"><b>${b.specials.reduce((n, s) => n + E.hirelingCount(s), 0)}</b><span>Hirelings</span></div>
    </div>
    ${flags.length ? `<div class="card"><ul class="plain">${flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
    <div class="grid2">
      <div class="card stack">
        <h2>Bastion</h2>
        <div class="fields">
          ${text('Bastion name', 'name', 'maxlength="80"')}
          ${text('Character', 'character', 'maxlength="80"')}
          ${text('Player', 'player', 'maxlength="80"')}
          ${number('Character level', 'level', 'min="1" max="20"')}
          ${number('Treasury (GP)', 'gold')}
          ${number('Days per Bastion turn', 'settings.turnDays', 'min="1"')}
          ${number('Extra defenders (unhoused)', 'extraDefenders', 'min="0"')}
        </div>
        ${b.level < 5 ? '<p class="small muted">Characters gain a Bastion at level 5.</p>' : ''}
        ${check('Use Haunted Bastion rules (Ravenloft)', 'settings.haunted')}
      </div>
      <div class="card">
        <h2>What your character qualifies for</h2>
        <p class="small muted">Used to check special facility prerequisites.</p>
        ${Object.entries(D.TRAITS).map(([k, v]) => check(esc(v), `traits.${k}`)).join('')}
        <details ${S.ui.open.has('memberships') ? 'open' : ''} data-open="memberships"><summary>Factions, houses and societies (${b.memberships.length})</summary>
          ${Object.entries(D.MEMBERSHIPS).map(([k, v]) => `<label class="check"><input type="checkbox" data-change="membership" data-k="${k}" ${b.memberships.includes(k) ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}
        </details>
      </div>
      <div class="card">
        <h2>Active effects</h2>
        ${b.effects.length ? `<ul class="plain">${b.effects.map((e) => `<li><span class="grow">${esc(e.text)}</span><span class="tag">${e.expires - b.day > 0 ? `${e.expires - b.day} days left` : 'expires next turn'}</span><button class="ghost" data-act="rmEffect" data-id="${e.id}" title="Remove">✕</button></li>`).join('')}</ul>` : '<p class="muted small">Empower benefits and visiting guests appear here.</p>'}
      </div>
      <div class="card">
        <h2>Stores</h2>
        ${b.inventory.length ? `<ul class="plain">${b.inventory.map((i) => `<li><span class="grow">${esc(i.text)}</span><button class="ghost" data-act="rmItem" data-id="${i.id}" title="Claimed / remove">✕</button></li>`).join('')}</ul>` : '<p class="muted small">Items your hirelings produce wait here until claimed.</p>'}
        <form class="row" data-submit="addItem" style="margin-top:8px"><input name="text" placeholder="Add an item" style="flex:1" required><button>Add</button></form>
      </div>
    </div>
    <div class="card"><h2>Notes</h2><textarea ${bind('notes')} placeholder="History, hireling personalities, plans…">${esc(b.notes)}</textarea></div>
    <div class="row"><button data-act="export">Export as JSON</button><button class="ghost right" data-act="deleteBastion">Delete this bastion</button></div>
  </div>`;
}

// --- facilities --------------------------------------------------------------------
function facilitiesTab() {
  const b = S.b;
  const slots = E.slotsForLevel(b.level);
  const over = b.specials.length > slots;
  return `<div class="stack">
    <div class="row"><h2>Special facilities</h2><span class="tag ${over ? 'bad' : ''}">${b.specials.length} of ${slots} slots</span>
      <button class="primary right" data-act="togglePicker">${S.ui.picker ? 'Close' : '+ Add special facility'}</button></div>
    ${over ? '<p class="small neg">More special facilities than your level allows (2 at level 5, 4 at 9, 5 at 13, 6 at 17).</p>' : ''}
    ${S.ui.picker ? picker() : ''}
    ${b.specials.length ? b.specials.map(specialCard).join('') : '<div class="card muted">No special facilities yet. A level 5 character starts with two.</div>'}
    <h2>Basic facilities</h2>
    <div class="card">
      <ul class="plain">${b.basics.map(basicRow).join('')}</ul>
      <form class="row" data-submit="addBasic" style="margin-top:12px">
        <select name="type">${D.BASIC_TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
        <select name="space">${D.SPACES.map((s) => `<option value="${s}">${s} · ${fmt(D.BASIC_ADD[s].cost)} GP · ${D.BASIC_ADD[s].days} days</option>`).join('')}</select>
        <button name="how" value="build">Build</button><button name="how" value="free" title="Add instantly at no cost (starting facility or DM grant)">Add free</button>
      </form>
      <p class="small muted" style="margin:.8em 0 0">A Bastion starts with two free basic facilities, one Cramped and one Roomy.</p>
    </div>
    <h2>Defensive walls</h2>
    <div class="card stack">
      <div class="fields">
        ${number('Wall squares built', 'walls.built', 'min="0"')}
        <label class="field">In progress<span>${b.walls.queue.length ? b.walls.queue.map((q) => `${q.squares} sq. (${q.daysLeft} days)`).join(', ') : 'None'}</span></label>
      </div>
      ${check('The Bastion is completely enclosed by walls (2 fewer dice when attacked)', 'walls.enclosed')}
      <form class="row" data-submit="buildWalls"><input type="number" name="squares" min="1" value="4" aria-label="Squares"><span class="small muted">5-ft squares at ${D.WALL.cost} GP and ${D.WALL.days} days each</span><button>Build</button></form>
    </div>
  </div>`;
}

function picker() {
  const b = S.b;
  const full = b.specials.length >= E.slotsForLevel(b.level);
  const list = D.FACILITIES.filter((f) => S.ui.srcs.has(f.src));
  const levels = [5, 9, 13, 17];
  return `<div class="card stack">
    <div class="chips">${Object.entries(D.SOURCES).map(([k, v]) => `<label><input type="checkbox" data-change="src" data-k="${k}" ${S.ui.srcs.has(k) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div>
    <label class="check"><input type="checkbox" data-change="ignoreReq" ${S.ui.ignoreReq ? 'checked' : ''}><span>Ignore requirements and slot limit (DM approval)</span></label>
    <div class="picker">${levels.map((lv) => {
      const rows = list.filter((f) => f.level === lv);
      if (!rows.length) return '';
      return `<h3>Level ${lv}</h3>` + rows.map((f) => {
        const why = E.blockers(b, f);
        if (full && !why.length) why.push('No free slot');
        const ok = !why.length || (S.ui.ignoreReq && !why.includes('Already built'));
        return `<div class="pick ${ok ? '' : 'blocked'}"><div class="grow">
          <strong>${esc(f.name)}</strong> <span class="tag">${f.space}</span> ${[...new Set(f.options.map((o) => o.order))].map((o) => `<span class="tag order">${o}</span>`).join(' ')}
          <div class="small">${esc(f.desc)}</div>
          ${f.prereq.length ? `<div class="small muted">Prerequisite: ${esc(E.prereqText(f))}</div>` : ''}
          ${why.length ? `<div class="small neg">${esc(why.join(' · '))}</div>` : ''}
        </div><button data-act="addSpecial" data-key="${f.key}" ${ok ? '' : 'disabled'}>Add</button></div>`;
      }).join('');
    }).join('') || '<p class="muted" style="padding:12px">Pick at least one source.</p>'}</div>
  </div>`;
}

function orderTag(spec) {
  if (spec.offline > 0) return '<span class="tag bad">Unusable next turn</span>';
  if (spec.order) return `<span class="tag busy">${esc(spec.order.order)}: ${esc(spec.order.name)} · ${spec.order.daysLeft} days left</span>`;
  return '';
}

function specialCard(spec) {
  const b = S.b;
  const def = E.defOf(spec);
  const p = `specials.#${spec.id}`;
  const hire = E.hirelingCount(spec);
  const showHaunt = b.settings.haunted || spec.haunted;
  const cap = E.housingCap(spec);
  const parts = [];
  for (const c of def.config || []) {
    const n = E.configCount(spec, c);
    parts.push(`<div class="fields">${Array.from({ length: n }, (_, i) => {
      const cur = spec.config[c.k]?.[i] || '';
      const taken = c.repeat ? [] : (spec.config[c.k] || []).filter((v, j) => j !== i);
      return `<label class="field">${esc(c.label)}${n > 1 ? ` ${i + 1}` : ''}<select data-change="config" data-id="${spec.id}" data-k="${c.k}" data-i="${i}" data-fk="cfg.${spec.id}.${c.k}.${i}"><option value="">Choose…</option>${c.choices.filter((ch) => !taken.includes(ch)).map((ch) => `<option ${ch === cur ? 'selected' : ''}>${esc(ch)}</option>`).join('')}</select></label>`;
    }).join('')}</div>`);
  }
  if (cap) parts.push(`<div class="fields">${number(`Bastion Defenders housed (max ${cap})`, `${p}.defenders`, `min="0" max="${cap}"`)}</div>`);
  if (def.lieutenants) parts.push(`<div class="fields">${number('Lieutenants (max 10)', `${p}.lieutenants`, 'min="0" max="10"')}</div>`);
  if (spec.key === 'armory') parts.push(check('Armory is stocked', `${p}.stocked`));
  if (def.occupantKind) {
    const capN = (spec.enlarged && def.capacityVast) || def.capacity;
    parts.push(`<div><div class="small muted">${{ creature: 'Creatures', construct: 'Constructs', entity: 'Entities', animal: 'Animals' }[def.occupantKind]}${capN ? ` (room for ${capN}${def.occupantKind === 'entity' ? '' : ' Large'})` : ''}</div>
      <ul class="plain">${(spec.occupants || []).map((o) => `<li><span class="grow">${esc(o.name)}${o.size ? ` <span class="muted small">${esc(o.size)}</span>` : ''}</span>
        ${def.occupantKind !== 'animal' ? `<label class="check small"><input type="checkbox" ${bind(`${p}.occupants.#${o.id}.defender`, 'bool')} ${o.defender !== false ? 'checked' : ''}><span>Defender</span></label>` : ''}
        <button class="ghost" data-act="rmOccupant" data-id="${spec.id}" data-oid="${o.id}" title="Remove">✕</button></li>`).join('')}</ul>
      <form class="row" data-submit="addOccupant" data-id="${spec.id}"><input name="name" placeholder="Add by name" required style="flex:1"><button>Add</button></form></div>`);
  }
  parts.push(`<div class="fields">${text('Custom name', `${p}.label`, `placeholder="${esc(def.name)}" maxlength="60"`)}${Array.from({ length: hire }, (_, i) => `<label class="field">Hireling ${hire > 1 ? i + 1 : ''}<input type="text" data-change="hireling" data-id="${spec.id}" data-i="${i}" data-fk="hire.${spec.id}.${i}" value="${esc(spec.hirelings[i] || '')}" placeholder="Name and personality"></label>`).join('')}</div>`);
  return `<div class="card ${spec.haunted ? 'haunted' : ''}">
    <div class="fac-head"><h3>${esc(E.specName(spec))}</h3>${spec.label ? `<span class="muted small">${esc(def.name)}</span>` : ''}
      <span class="right row">${orderTag(spec)}${spec.haunted ? '<span class="tag haunt">Haunted</span>' : ''}</span></div>
    <div class="fac-meta"><span class="tag">Level ${def.level}</span><span class="tag">${E.specSpace(spec)}</span><span class="tag">${plural(hire, 'hireling')}</span><span class="tag">${esc(D.SOURCES[def.src])}</span>${[...new Set(def.options.map((o) => o.order))].map((o) => `<span class="tag order">${o}</span>`).join('')}</div>
    <p class="small">${esc(def.desc)}</p>
    <div class="stack">${parts.join('')}</div>
    <details ${S.ui.open.has(spec.id) ? 'open' : ''} data-open="${spec.id}" style="margin-top:8px"><summary>Rules, orders and options</summary>
      ${def.prereq.length ? `<p class="passive"><strong>Prerequisite.</strong> ${esc(E.prereqText(def))}</p>` : ''}
      ${def.passives.map((x) => `<p class="passive"><strong>${esc(x.name)}.</strong> ${esc(x.text)}</p>`).join('')}
      ${def.options.map((o) => `<p class="passive"><span class="tag order">${o.order}</span> <strong>${esc(o.name)}.</strong> ${esc(o.text)}</p>`).join('')}
      ${def.enlarge ? `<p class="passive"><strong>Enlarging.</strong> ${esc(def.enlarge.to)} for ${fmt(def.enlarge.cost)} GP. ${esc(def.enlarge.text)}</p>` : ''}
      <div class="row">
        ${def.enlarge && !spec.enlarged ? `<button data-act="enlargeSpecial" data-id="${spec.id}">Enlarge to ${def.enlarge.to} (${fmt(def.enlarge.cost)} GP)</button>` : ''}
        ${spec.order ? `<button data-act="cancelOrder" data-id="${spec.id}">Cancel current order</button>` : ''}
        ${showHaunt && !def.alwaysHaunted ? check('Haunted', `${p}.haunted`) : ''}
        <button class="ghost right" data-act="rmSpecial" data-id="${spec.id}">Remove facility</button>
      </div>
    </details>
  </div>`;
}

function basicRow(f) {
  const p = `basics.#${f.id}`;
  const en = D.BASIC_ENLARGE[f.space];
  return `<li style="align-items:center;flex-wrap:wrap">
    <select ${bind(`${p}.type`)}>${D.BASIC_TYPES.map((t) => `<option ${t === f.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <span class="tag">${f.space}</span>
    <input class="grow" type="text" ${bind(`${p}.label`)} value="${esc(f.label)}" placeholder="Name or description" maxlength="60">
    ${f.build ? `<span class="tag busy">${f.build.kind === 'enlarge' ? `Enlarging to ${f.build.to}` : 'Under construction'} · ${f.build.daysLeft} days left</span>` : en ? `<button data-act="enlargeBasic" data-id="${f.id}">Enlarge to ${en.to} (${fmt(en.cost)} GP, ${en.days} days)</button>` : ''}
    <button class="ghost" data-act="rmBasic" data-id="${f.id}" title="Remove">✕</button></li>`;
}

// --- turn ----------------------------------------------------------------------------
function turnTab() {
  const b = S.b;
  const plan = S.plan;
  const last = b.log.filter((l) => l.t === b.turn && l.k !== 'build' && l.k !== 'note');
  const defaultDays = b.turn === 0 ? 0 : b.settings.turnDays;
  const busy = b.specials.filter((s) => s.order);
  let total = 0;
  const rows = b.specials.map((spec) => {
    const blocked = E.canOrder(b, spec);
    if (blocked) return `<div class="order-row"><div><strong>${esc(E.specName(spec))}</strong></div><div>${orderTag(spec)}</div></div>`;
    const opts = E.optionsFor(b, spec);
    const chosen = plan.orders[spec.id];
    const opt = chosen && opts[chosen.opt];
    let detail = '';
    if (opt) {
      const cost = E.orderCost(b, spec, opt, chosen.input);
      const days = E.orderDays(opt, chosen.input);
      total += cost;
      detail = `<p class="small" style="margin:6px 0 0">${esc(opt.text)}</p><div class="inputs">${planInputs(spec, opt, chosen.input)}</div>
        <p class="small muted" style="margin:6px 0 0">${cost ? `Costs ${fmt(cost)} GP` : 'No cost'} · ${days ? `takes ${days} days` : 'takes effect immediately'}</p>`;
    }
    return `<div class="order-row"><div><strong>${esc(E.specName(spec))}</strong>${spec.haunted ? ' <span class="tag haunt">Haunted</span>' : ''}</div>
      <div><select data-plan="${spec.id}" data-pk="opt" data-fk="plan.${spec.id}.opt"><option value="">No order</option>${opts.map((o) => `<option value="${o.i}" ${chosen?.opt === o.i ? 'selected' : ''} ${o.locked ? 'disabled' : ''}>${o.order}: ${esc(o.name)}${o.locked ? ` (${o.locked})` : ''}</option>`).join('')}</select>${detail}</div></div>`;
  }).join('');

  return `<div class="stack">
    ${b.pending ? pendingCard() : ''}
    ${last.length ? `<div class="card"><h2>Turn ${b.turn} · day ${b.day}</h2><ul class="results">${last.map((l) => `<li class="${l.k}">${esc(l.m)}</li>`).join('')}</ul></div>` : ''}
    ${busy.length ? `<div class="card"><h2>Work in progress</h2><ul class="plain">${busy.map((s) => `<li><span class="grow"><strong>${esc(E.specName(s))}</strong> — ${esc(s.order.order)}: ${esc(s.order.name)}${s.order.what ? ` (${esc(s.order.what)})` : ''}</span><span class="tag busy">${s.order.daysLeft} days left</span></li>`).join('')}</ul></div>` : ''}
    <div class="card stack">
      <h2>Take Bastion turn ${b.turn + 1}</h2>
      ${b.turn > 0 ? `<label class="field" style="max-width:240px">Days since the last Bastion turn<input type="number" min="0" data-plan="_" data-pk="days" data-fk="plan.days" value="${plan.days ?? defaultDays}"></label>` : ''}
      <div class="modes">
        <label><input type="radio" name="mode" value="orders" data-plan="_" data-pk="mode" ${plan.mode === 'orders' ? 'checked' : ''}><strong>Issue orders</strong><div class="small muted">You are at the Bastion (or can reach it by magic).</div></label>
        <label><input type="radio" name="mode" value="maintain" data-plan="_" data-pk="mode" ${plan.mode === 'maintain' ? 'checked' : ''}><strong>Maintain</strong><div class="small muted">You are away. No orders; roll a Bastion event.</div></label>
      </div>
      ${plan.mode === 'orders' ? (b.specials.length ? `<div>${rows}</div>` : '<p class="muted">Add special facilities to issue orders.</p>') : '<p class="small muted">Work already under way continues. The event is rolled and resolved automatically.</p>'}
      <div class="row">
        <button class="primary big" data-act="takeTurn" ${b.pending ? 'disabled' : ''}>Take turn ${b.turn + 1}</button>
        ${plan.mode === 'orders' && total ? `<span class="${total > b.gold ? 'neg' : 'muted'}">Orders cost ${fmt(total)} GP of ${fmt(b.gold)} GP${total > b.gold ? ': not enough in the treasury' : ''}</span>` : ''}
        ${b.pending ? '<span class="neg">Resolve the waiting event first.</span>' : ''}
      </div>
    </div>
  </div>`;
}

function planInputs(spec, opt, input) {
  const attr = (k) => `data-plan="${spec.id}" data-pk="${k}" data-fk="plan.${spec.id}.${k}"`;
  const out = [];
  if (opt.pick) {
    out.push(`<select ${attr('pick')}>${opt.pick.map((p, i) => `<option value="${i}" ${String(input.pick) === String(i) ? 'selected' : ''}>${esc(p.name)}${p.size ? ` · ${p.size}` : ''}${p.cost ? ` · ${fmt(p.cost)} GP` : ''}${p.days ? ` · ${p.days} days` : ''}</option>`).join('')}${opt.pickCustom ? `<option value="custom" ${input.pick === 'custom' ? 'selected' : ''}>Other creature (DM consent)…</option>` : ''}</select>`);
    if (input.pick === 'custom') {
      out.push(`<input type="text" ${attr('what')} value="${esc(input.what || '')}" placeholder="Creature">`);
      out.push(`<select ${attr('size')}>${['Small', 'Medium', 'Large'].map((s) => `<option ${input.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`);
      out.push(`<input type="number" min="0" ${attr('cost')} value="${esc(input.cost ?? '')}" placeholder="Cost (GP)" aria-label="Cost (GP)">`);
    }
  }
  for (const a of opt.ask || []) {
    if (a.choices) out.push(`<select ${attr(a.k)} aria-label="${esc(a.label)}">${a.choices.map((c) => `<option ${input[a.k] === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`);
    else if (a.num) out.push(`<label class="field">${esc(a.label)}<input type="number" min="0" ${attr(a.k)} value="${esc(input[a.k] ?? '')}"></label>`);
    else out.push(`<input type="text" ${attr(a.k)} value="${esc(input[a.k] || '')}" placeholder="${esc(a.label)}" aria-label="${esc(a.label)}" maxlength="120">`);
  }
  return out.join('');
}

function pendingCard() {
  const b = S.b, p = b.pending;
  let body = '';
  if (p.type === 'criminal') body = `<p>Officials have a warrant for one of your hirelings.</p><div class="row"><button class="primary" data-act="pending" data-choice="pay">Pay the ${fmt(p.bribe)} GP bribe</button><button data-act="pending" data-choice="refuse">Let them be arrested</button></div>`;
  else if (p.type === 'opportunity') body = `<p>An extraordinary opportunity: host a festival, fund a spellcaster's research, or appease a noble. It costs 500 GP and brings another event.</p><div class="row"><button class="primary" data-act="pending" data-choice="accept">Seize it (500 GP)</button><button data-act="pending" data-choice="decline">Decline</button></div>`;
  else if (p.type === 'aid') body = `<p>A local leader asks for help. Roll 1d6 per Bastion Defender sent: 10 or more earns 1d6 × 100 GP; less halves the reward and costs one defender.</p><form class="row" data-submit="sendAid"><label class="field">Defenders to send (of ${E.defenderCount(b)})<input type="number" name="n" min="0" max="${E.defenderCount(b)}" value="${Math.min(3, E.defenderCount(b))}"></label><button class="primary">Send them</button><button type="button" data-act="pending" data-choice="0">Send no one</button></form>`;
  else if (p.type === 'chooseEvent') body = `<p>Inner Peace: two events were rolled. Choose which one happens.</p><div class="row">${p.rolls.map((r, i) => `<button class="primary" data-act="pending" data-choice="${i}">${r}: ${esc(E.eventName(r))}</button>`).join('')}</div>`;
  return `<div class="card alert"><h2>Event waiting for your decision</h2>${body}</div>`;
}

// --- map -----------------------------------------------------------------------------
function mapItems() {
  const b = S.b;
  const items = [
    ...b.basics.map((f) => ({ id: f.id, name: f.label || f.type, max: D.SPACE[f.build?.kind === 'enlarge' ? f.space : f.space] })),
    ...b.specials.filter((s) => !E.defOf(s).noMap).map((s) => ({ id: s.id, name: E.specName(s), max: D.SPACE[E.specSpace(s)] })),
  ];
  items.forEach((it, i) => { it.color = `hsl(${Math.round((i * 137.5) % 360)} 58% 68%)`; it.abbr = it.name.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); });
  return items;
}
function mapUsage() {
  const used = {};
  for (const f of S.b.map.floors) for (const v of Object.values(f.cells)) used[v] = (used[v] || 0) + 1;
  return used;
}
function mapTab() {
  const b = S.b;
  const items = mapItems();
  const used = mapUsage();
  const fi = Math.min(S.ui.floor, b.map.floors.length - 1);
  const floor = b.map.floors[fi];
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const tool = (id, label, extra = '') => `<button data-act="tool" data-tool="${id}" aria-pressed="${S.ui.tool === id}">${label}${extra}</button>`;
  let cells = '';
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const v = floor.cells[`${x},${y}`];
    const it = byId[v];
    cells += `<div class="cell${v === 'wall' ? ' wall' : ''}" data-k="${x},${y}"${it ? ` style="background:${it.color}" title="${esc(it.name)}"` : ''}>${it ? it.abbr : ''}</div>`;
  }
  return `<div class="stack">
    <div class="row">
      ${b.map.floors.map((f, i) => `<button data-act="floor" data-i="${i}" aria-pressed="${i === fi}" class="${i === fi ? 'primary' : ''}">${esc(f.name)}</button>`).join('')}
      <button data-act="addFloor">+ Floor</button>
      <span class="right row"><button class="ghost" data-act="renameFloor">Rename</button>${b.map.floors.length > 1 ? '<button class="ghost" data-act="rmFloor">Delete floor</button>' : ''}</span>
    </div>
    <div class="map-layout">
      <div class="card palette" id="palette">
        <p class="small muted">Pick a facility, then click or drag on the grid. Each square is 5 feet.</p>
        ${tool('erase', '⌫ Erase')}
        ${tool('wall', '<span class="swatch cell wall" style="width:14px;height:14px"></span>Defensive wall', ` <span class="muted small">${used.wall || 0} drawn · ${b.walls.built} built</span>`)}
        ${items.map((it) => tool(it.id, `<span class="swatch" style="background:${it.color}"></span>${esc(it.name)}`, ` <span class="small ${(used[it.id] || 0) > it.max ? 'over' : 'muted'}">${used[it.id] || 0}/${it.max}</span>`)).join('')}
      </div>
      <div class="map-scroll" data-keep-scroll="map"><div class="map-grid" id="grid" style="grid-template-columns:repeat(${MAP_W},22px)">${cells}</div></div>
    </div>
  </div>`;
}

let painting = false;
function paintCell(cell) {
  if (!cell?.dataset.k) return;
  const b = S.b, k = cell.dataset.k, tool = S.ui.tool;
  const floor = b.map.floors[Math.min(S.ui.floor, b.map.floors.length - 1)];
  const cur = floor.cells[k];
  if (tool === 'erase') { if (cur === undefined) return; delete floor.cells[k]; }
  else {
    if (cur === tool) return;
    if (tool !== 'wall') {
      const it = mapItems().find((i) => i.id === tool);
      if (!it || (mapUsage()[tool] || 0) >= it.max) return;
    }
    floor.cells[k] = tool;
  }
  const it = mapItems().find((i) => i.id === floor.cells[k]);
  cell.className = `cell${floor.cells[k] === 'wall' ? ' wall' : ''}`;
  cell.style.background = it ? it.color : '';
  cell.textContent = it ? it.abbr : '';
  cell.title = it ? it.name : '';
  touch();
}
$app.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('#grid .cell');
  if (!cell) return;
  e.preventDefault();
  painting = true;
  paintCell(cell);
});
window.addEventListener('pointermove', (e) => { if (painting) paintCell(document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#grid .cell')); });
window.addEventListener('pointerup', () => { if (painting) { painting = false; render(); } });

// --- log -----------------------------------------------------------------------------
function logTab() {
  const b = S.b;
  const turns = [...new Set(b.log.map((l) => l.t))].sort((a, c) => c - a);
  return `<div class="stack log">
    <form class="row" data-submit="addNote"><input name="text" placeholder="Add a note to the log" style="flex:1" required maxlength="400"><button>Add note</button></form>
    <div class="card">${turns.length ? turns.map((t) => `<h3>${t === 0 ? 'Before the first turn' : `Turn ${t}`}</h3><ul class="results">${b.log.filter((l) => l.t === t).map((l) => `<li class="${l.k}">${esc(l.m)}</li>`).join('')}</ul>`).join('') : '<p class="muted">Nothing has happened yet.</p>'}</div>
  </div>`;
}

// --- actions ---------------------------------------------------------------------------
const byId = (id) => S.b.specials.find((s) => s.id === id);
const acts = {
  tab(el) { S.tab = el.dataset.tab; render(); },
  forget(el) { recents.remove(el.dataset.id); render(); },
  async copy(el) { try { await navigator.clipboard.writeText(el.dataset.text); el.textContent = 'Copied!'; } catch { el.textContent = 'Select and copy the link'; } },
  async renameCampaign() {
    const name = prompt('Campaign name', S.campaign.name);
    if (!name?.trim()) return;
    const r = await api.renameCampaign(S.campaign.id, name);
    S.campaign.name = r.name; recents.add(S.campaign); render();
  },
  async newBastion() {
    const b = E.newBastion();
    const r = await api.createBastion(S.campaign.id, b, E.summary(b));
    location.hash = `#/c/${S.campaign.id}/b/${r.id}`;
  },
  reload() { S.save = 'saved'; navigate(); },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S.b, null, 2)], { type: 'application/json' }));
    a.download = `${S.b.name.replace(/[^\w-]+/g, '_') || 'bastion'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  async deleteBastion() {
    if (!confirm(`Delete "${S.b.name}" for everyone in the campaign? This cannot be undone.`)) return;
    clearTimeout(saveTimer);
    const { cid, bid } = S.route;
    S.b = null;
    await api.deleteBastion(cid, bid);
    location.hash = `#/c/${cid}`;
  },
  rmEffect(el) { mutate((b) => { b.effects = b.effects.filter((e) => e.id !== el.dataset.id); }); },
  rmItem(el) { mutate((b) => { b.inventory = b.inventory.filter((e) => e.id !== el.dataset.id); }); },
  togglePicker() { S.ui.picker = !S.ui.picker; render(); },
  addSpecial(el) { mutate((b) => E.addSpecial(b, el.dataset.key)); },
  rmSpecial(el) { const s = byId(el.dataset.id); if (confirm(`Remove ${E.specName(s)}?`)) mutate((b) => E.removeSpecial(b, s.id)); },
  enlargeSpecial(el) { mutate((b) => E.enlargeSpecial(b, el.dataset.id)); },
  cancelOrder(el) { mutate((b) => { const s = byId(el.dataset.id); E.addLog(b, 'order', `${E.specName(s)}: cancelled ${s.order.name}.`); s.order = null; }); },
  rmOccupant(el) { mutate(() => { const s = byId(el.dataset.id); s.occupants = s.occupants.filter((o) => o.id !== el.dataset.oid); }); },
  enlargeBasic(el) { mutate((b) => E.enlargeBasic(b, el.dataset.id)); },
  rmBasic(el) { mutate((b) => E.removeBasic(b, el.dataset.id)); },
  takeTurn() {
    try {
      const plan = { ...S.plan, days: S.plan.days ?? undefined };
      mutate((b) => E.takeTurn(b, plan));
      S.plan = newPlan();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert(e.message); }
  },
  pending(el) { mutate((b) => E.resolvePending(b, el.dataset.choice)); },
  tool(el) { S.ui.tool = el.dataset.tool; render(); },
  floor(el) { S.ui.floor = Number(el.dataset.i); render(); },
  addFloor() { mutate((b) => { b.map.floors.push({ name: `Floor ${b.map.floors.length + 1}`, cells: {} }); S.ui.floor = b.map.floors.length - 1; }); },
  renameFloor() { const f = S.b.map.floors[S.ui.floor]; const name = prompt('Floor name', f.name); if (name?.trim()) mutate(() => { f.name = name.trim().slice(0, 40); }); },
  rmFloor() { if (confirm('Delete this floor and everything drawn on it?')) mutate((b) => { b.map.floors.splice(S.ui.floor, 1); S.ui.floor = 0; }); },
};

const submits = {
  async createCampaign(f) { const c = await api.createCampaign(f.name.value); location.hash = `#/c/${c.id}`; },
  openCampaign(f) {
    const raw = f.code.value.trim();
    const m = raw.match(/c\/([a-z0-9]+)/i);
    location.hash = `#/c/${(m ? m[1] : raw).toLowerCase()}`;
  },
  addItem(f) { mutate((b) => b.inventory.push({ id: E.uid(), text: f.text.value.trim().slice(0, 200) })); },
  addNote(f) { mutate((b) => E.addLog(b, 'note', f.text.value.trim())); },
  addBasic(f, e) {
    const free = e.submitter?.value === 'free';
    mutate((b) => {
      if (free) { b.basics.push({ id: E.uid(), type: f.type.value, space: f.space.value, label: '' }); E.addLog(b, 'build', `Added a ${f.space.value} ${f.type.value} at no cost.`); }
      else E.addBasic(b, f.type.value, f.space.value);
    });
  },
  buildWalls(f) { mutate((b) => E.buildWalls(b, Number(f.squares.value))); },
  addOccupant(f) { mutate(() => { const s = byId(f.dataset.id); (s.occupants ||= []).push({ id: E.uid(), name: f.name.value.trim().slice(0, 60), size: '', defender: true }); }); },
  sendAid(f) { mutate((b) => E.resolvePending(b, Number(f.n.value))); },
};

const changes = {
  membership(el) { mutate((b) => { b.memberships = b.memberships.filter((m) => m !== el.dataset.k); if (el.checked) b.memberships.push(el.dataset.k); }); },
  src(el) { el.checked ? S.ui.srcs.add(el.dataset.k) : S.ui.srcs.delete(el.dataset.k); render(); },
  ignoreReq(el) { S.ui.ignoreReq = el.checked; render(); },
  config(el) { mutate(() => { const s = byId(el.dataset.id); (s.config[el.dataset.k] ||= [])[Number(el.dataset.i)] = el.value; }); },
  hireling(el) { mutate(() => { byId(el.dataset.id).hirelings[Number(el.dataset.i)] = el.value.slice(0, 120); }, false); },
};

function onPlan(el, rerender) {
  const id = el.dataset.plan, k = el.dataset.pk;
  if (id === '_') {
    if (k === 'mode') S.plan.mode = el.value;
    if (k === 'days') S.plan.days = el.value === '' ? null : Math.max(0, Number(el.value));
  } else if (k === 'opt') {
    if (el.value === '') delete S.plan.orders[id];
    else {
      const opt = E.defOf(byId(id)).options[Number(el.value)];
      const input = {};
      if (opt.pick) input.pick = 0;
      for (const a of opt.ask || []) if (a.choices) input[a.k] = a.choices[0];
      S.plan.orders[id] = { opt: Number(el.value), input };
    }
  } else if (S.plan.orders[id]) {
    const input = S.plan.orders[id].input;
    input[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    if (k === 'pick' && el.value === 'custom') input.size ||= 'Medium';
  }
  if (rerender) render();
}

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  Promise.resolve(acts[el.dataset.act](el, e)).catch((err) => alert(err.message));
});
$app.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  Promise.resolve(submits[f.dataset.submit](f, e)).catch((err) => alert(err.message));
});
$app.addEventListener('input', (e) => { if (e.target.dataset.plan && e.target.type === 'text') onPlan(e.target, false); });
$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.plan) return onPlan(el, true);
  if (el.dataset.change) return changes[el.dataset.change](el);
  if (el.dataset.bind) {
    const [o, k] = walk(el.dataset.bind);
    const t = el.dataset.type;
    let v = t === 'bool' ? el.checked : t === 'num' ? Math.round(Number(el.value) || 0) : el.value;
    if (t === 'num' && el.min !== '') v = Math.max(Number(el.min), v);
    if (t === 'num' && el.max !== '') v = Math.min(Number(el.max), v);
    mutate(() => { o[k] = v; });
  }
});
$app.addEventListener('toggle', (e) => {
  const k = e.target.dataset?.open;
  if (k) e.target.open ? S.ui.open.add(k) : S.ui.open.delete(k);
}, true);

navigate();
