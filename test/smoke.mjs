// Smoke test: load the authored client bundle in Node with shims and check that
// it registers the tab type, the two slot bodies, and the `@` source, then that
// the source offers the page a body reports.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../client.js', import.meta.url));
const source = fs.readFileSync(file, 'utf8');

let declaration;
const storage = new Map();
const documentShim = {
  querySelector: () => null,
  createElement: () => ({ setAttribute() {}, remove() {}, style: {}, select() {}, textContent: '' }),
  head: { appendChild() {} },
  body: { appendChild() {}, removeChild() {} },
  execCommand: () => true,
};

globalThis.window = {
  __ModuleLoader__: { load: (decl) => { declaration = decl; } },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
  },
  setTimeout: () => 0,
  clearTimeout: () => {},
};
globalThis.document = documentShim;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };

/** Minimal hooks shim: effects run immediately, state is read-only. */
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useMemo: (fn) => fn(),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: () => ({ current: null }),
  useEffect: (fn) => { fn(); },
};
const requireShim = (id) => {
  if (id === 'react') return React;
  throw new Error(`unexpected require: ${id}`);
};

new Function('window', 'document', 'navigator', 'ResizeObserver', source)(
  globalThis.window, documentShim, globalThis.navigator, globalThis.ResizeObserver,
);

if (declaration === undefined) throw new Error('bundle did not call window.__ModuleLoader__.load');
const exportsObject = declaration.factory(requireShim);
console.log('bundle id:', declaration.id);
console.log('inject:', JSON.stringify(exportsObject.inject));

const registered = { types: [], slots: [], sources: [], commands: [] };
/** What the fake composer received, so the insert paths can be asserted. */
const inserted = [];
const composerShell = {
  actions: {
    captureInsertion: () => ({ draftRev: 7, anchor: 0, focus: 0 }),
    insertText: (text, span) => {
      if (span === undefined || span.draftRev !== 7) return false;
      inserted.push(text);
      return true;
    },
  },
};
const ctx = {
  get: (name) => (name === 'sessions' ? ctx.sessions : undefined),
  sessions: {
    scope: (sessionId) => ({
      get: (name) => (name === 'conversation' ? { input: { shell: () => (sessionId === 'sess-1' ? composerShell : undefined) } } : undefined),
    }),
  },
  commandUi: { register: (contribution) => { registered.commands.push(contribution); return () => {}; } },
  locale: {
    register: (ns, dicts) => { registered.locale = { ns, dicts }; return () => {}; },
    bind: () => (key, params) => (params === undefined ? key : `${key}${JSON.stringify(params)}`),
  },
  effect: (fn) => fn(),
  slots: {
    inject: (name, callback) => callback(),
    register: (spec, component) => { registered.slots.push({ spec, component }); return () => {}; },
  },
  sidebarRightTabs: {
    register: (definition) => { registered.types.push(definition); return () => {}; },
  },
  sidebarRight: { openTab: (kind, options) => { registered.opened = { kind, options }; } },
  inputTriggers: { registerSource: (src) => { registered.sources.push(src); return () => {}; } },
};

exportsObject.apply(ctx);

const type = registered.types[0];
console.log('type:', JSON.stringify({ id: type.id, kind: type.kind, multiple: type.multiple, priority: type.priority, keepMounted: type.keepMounted, guide: type.guide.map((entry) => entry.id) }));
console.log('title():', type.title());
if (type.id !== 'sidebar-mobile-browser') throw new Error('unexpected type id');
if (declaration.id !== 'dsh-sidebar-mobile-browser') throw new Error(`bundle id must equal package name, got ${declaration.id}`);
if (type.guide.length !== 1) throw new Error('expected one guide entry');
if (type.keepMounted !== true) throw new Error('expected keepMounted');

console.log('slots:', JSON.stringify(registered.slots.map((row) => ({ name: row.spec.name, key: row.spec.key, hasComponent: typeof row.component === 'function' }))));
if (registered.slots.length !== 2) throw new Error('expected two slot registrations');

const source_ = registered.sources[0];
console.log('source:', source_.trigger + source_.name);
if (source_.trigger !== '@' || source_.name !== 'webpage') throw new Error('unexpected source');

const empty = await source_.candidates({ sessionId: 'sess-1' }, { query: '', signal: undefined });
console.log('candidates before any page:', JSON.stringify(empty));

const body = registered.slots[0].component;
const element = body({
  sessionId: 'sess-1',
  t: ctx.locale.bind(),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'mobile-browser', navigation: { params: { url: 'example.com/docs?x=1' } } } }),
});
console.log('body root class:', element && element.props && element.props.className);
const rows = await source_.candidates({ sessionId: 'sess-1' }, { query: '', signal: undefined });
console.log('candidates after render:', JSON.stringify(rows));
if (rows.length !== 1) throw new Error('expected one remembered page');
if (rows[0].value !== 'https://example.com/docs?x=1') throw new Error(`unexpected candidate value ${rows[0].value}`);
const outcome = source_.onPick({ candidate: rows[0] });
console.log('onPick:', JSON.stringify(outcome));
if (outcome === undefined || outcome.text !== 'https://example.com/docs?x=1') throw new Error('unexpected onPick outcome');

const narrowed = await source_.candidates({ sessionId: 'sess-1' }, { query: 'nope', signal: undefined });
console.log('candidates for a non-matching query:', narrowed.length);
if (narrowed.length !== 0) throw new Error('query filter did not apply');

// The composer-facing half: both the toolbar button and the `/url` command go
// through the same insert helper, which captures the caret span right before
// the edit and leaves whatever the user typed in place.
const command = registered.commands[0];
console.log('command:', command === undefined ? 'none' : `/${command.name}`);
if (command === undefined) throw new Error('expected a /url command contribution');
if (command.name !== 'url') throw new Error(`unexpected command name ${command.name}`);
if (typeof command.available !== 'function') throw new Error('command.available must be a function');
if (command.ui.kind !== 'action') throw new Error('command must be an action');
if (command.available({ sessionId: 'sess-2' }) !== false) throw new Error('command must stay unavailable for a session with no preview');
if (command.available({ sessionId: 'sess-1' }) !== true) throw new Error('command must be available once a page is open');

command.ui.run({ sessionId: 'sess-1' });
console.log('composer received from /url:', JSON.stringify(inserted));
if (inserted.length !== 1) throw new Error('the /url command must insert the page URL once');
if (inserted[0] !== 'https://example.com/docs?x=1') throw new Error(`unexpected inserted text ${inserted[0]}`);

// A Session without a composer must fail quietly instead of throwing.
command.ui.run({ sessionId: 'sess-2' });
if (inserted.length !== 1) throw new Error('an unavailable Session must not insert anything');

// The address bar's `@` button is the same write, so a plain render must show it.
const walk = (node, visit) => {
  if (node === null || typeof node !== 'object') return;
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
};
const labels = [];
walk(element, (node) => {
  if (node.type === 'button' && typeof node.props.title === 'string') labels.push(node.props.title);
});
console.log('toolbar buttons:', JSON.stringify(labels));
if (!labels.includes('action.mention')) throw new Error('the address bar must offer the insert button');

console.log('SMOKE_OK');
