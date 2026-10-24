// Smoke test: load the authored client bundle in Node with shims and check that
// it registers the tab type, the two slot bodies, and the `@` source, then that
// the source offers the page a body reports.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../client.js', import.meta.url));
const source = fs.readFileSync(file, 'utf8');

let declaration;
const storage = new Map();

/** Tiny DOM stand-in: enough to build and drive the guest webview element. */
function fakeNode(tag) {
  const node = {
    tag,
    type: tag,
    props: {},
    children: [],
    parentNode: null,
    dataset: {},
    attrs: {},
    listeners: {},
    style: {},
    textContent: '',
    setAttribute(name, value) { node.attrs[name] = String(value); },
    addEventListener(name, fn) { (node.listeners[name] ??= []).push(fn); },
    removeEventListener(name, fn) { node.listeners[name] = (node.listeners[name] ?? []).filter((it) => it !== fn); },
    appendChild(child) { child.parentNode = node; node.children.push(child); return child; },
    removeChild(child) { node.children = node.children.filter((it) => it !== child); child.parentNode = null; },
    remove() { if (node.parentNode !== null) node.parentNode.removeChild(node); },
    select() {},
    querySelector(selector) { return node.children.find((it) => it.tag === selector) ?? null; },
    getURL() { return node.url ?? node.attrs.src ?? 'about:blank'; },
    loadURL(target) { node.url = String(target); return Promise.resolve(); },
    setUserAgent(agent) { node.ua = String(agent); },
    reload() { node.reloads = (node.reloads ?? 0) + 1; },
  };
  return node;
}

const documentShim = {
  querySelector: () => null,
  createElement: (tag) => fakeNode(tag),
  head: { appendChild() {} },
  body: { appendChild() {}, removeChild() {} },
  execCommand: () => true,
};

globalThis.window = {
  __ModuleLoader__: { load: (decl) => { declaration = decl; } },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); },
  },
  setTimeout: () => 0,
  clearTimeout: () => {},
};
globalThis.document = documentShim;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };

/**
 * Minimal hooks shim: state survives a re-render. Setters only record the value —
 * a real render loop would re-run effects that set state (the size row measures
 * itself), so the test drives re-renders explicitly after a click instead.
 */
let hookCursor = 0;
const hookStore = [];
/** Assigned once the body component is resolved; the test calls it after a click. */
let rerender = () => { throw new Error('rerender() ran before the body was resolved'); };
const React = {
  createElement: (type, props, ...children) => {
    const node = fakeNode(typeof type === 'string' ? type : 'component');
    node.type = type;
    node.props = props ?? {};
    node.children = children;
    const ref = node.props.ref;
    if (typeof ref === 'function') ref(node);
    else if (ref !== null && typeof ref === 'object') ref.current = node;
    return node;
  },
  useMemo: (fn) => fn(),
  useState: (initial) => {
    const slot = hookCursor++;
    if (!(slot in hookStore)) hookStore[slot] = typeof initial === 'function' ? initial() : initial;
    const set = (next) => {
      hookStore[slot] = typeof next === 'function' ? next(hookStore[slot]) : next;
    };
    return [hookStore[slot], set];
  },
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
const bodyProps = {
  sessionId: 'sess-1',
  t: ctx.locale.bind(),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'mobile-browser', navigation: { params: { url: 'example.com/docs?x=1' } } } }),
};
/** Hook index resets per pass, exactly like a real render. */
let element = body(bodyProps);
rerender = () => {
  hookCursor = 0;
  element = body(bodyProps);
  return element;
};
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
if (!labels.includes('action.shot')) throw new Error('the address bar must offer the screenshot button');
if (!labels.includes('action.home.set')) throw new Error('the address bar must offer the default-page button');

// The device row is collapsed by default: the toolbar toggle is the only way in,
// so a plain render must not show the preset select at all.
const countByClass = (root, className) => {
  let count = 0;
  walk(root, (node) => {
    const value = node.props === undefined ? undefined : node.props.className;
    if (typeof value === 'string' && value.split(/\s+/).includes(className)) count += 1;
  });
  return count;
};
const findSizeToggle = (root) => {
  let found;
  walk(root, (node) => {
    const title = node.props === undefined ? undefined : node.props.title;
    if (found === undefined && node.type === 'button' && typeof title === 'string' && title.startsWith('action.size')) found = node;
  });
  return found;
};
if (countByClass(element, 'dmb-select') !== 0) throw new Error('the size row must start collapsed');
const sizeToggle = findSizeToggle(element);
if (sizeToggle === undefined) throw new Error('expected a size toggle button in the toolbar');
if (sizeToggle.props['aria-expanded'] !== false) throw new Error('the size toggle must report its row as collapsed');
sizeToggle.props.onClick();
rerender();
if (countByClass(element, 'dmb-select') !== 1) throw new Error('the size toggle must reveal the size row');
findSizeToggle(element).props.onClick();
rerender();
if (countByClass(element, 'dmb-select') !== 0) throw new Error('the size toggle must collapse the row again');
console.log('size row: collapsed by default, opens and closes from the toolbar');

// The default page: the star remembers the page on show, and a tab that opens
// with no address seeds itself from that memory instead of starting blank.
const findButtonByTitle = (root, prefix) => {
  let found;
  walk(root, (node) => {
    const title = node.props === undefined ? undefined : node.props.title;
    if (found === undefined && node.type === 'button' && typeof title === 'string' && title.startsWith(prefix)) found = node;
  });
  return found;
};
/** The star is the only toolbar button that reports a pressed state. */
const findStar = (root) => {
  let found;
  walk(root, (node) => {
    if (found === undefined && node.type === 'button' && node.props !== undefined && 'aria-pressed' in node.props) found = node;
  });
  return found;
};
storage.delete('dsh.sidebar-mobile-browser.home');
rerender();
const starOff = findStar(element);
if (starOff === undefined) throw new Error('expected a default-page button in the toolbar');
if (starOff.props['aria-pressed'] !== false) throw new Error('the star must start unlit');
starOff.props.onClick();
rerender();
console.log('stored default page:', storage.get('dsh.sidebar-mobile-browser.home'));
if (storage.get('dsh.sidebar-mobile-browser.home') !== 'https://example.com/docs?x=1') {
  throw new Error('the star must remember the page it is showing');
}
if (findStar(element).props['aria-pressed'] !== true) {
  throw new Error('the star must light up once the page is the default');
}
findStar(element).props.onClick();
rerender();
if (storage.has('dsh.sidebar-mobile-browser.home')) throw new Error('clicking the lit star must clear the default page');
console.log('default page: stored, lit, cleared');

findStar(element).props.onClick();
rerender();
// A fresh mount: clear the shared hook slots so the draft comes from storage,
// not from the state the previous mount left behind.
hookStore.length = 0;
hookCursor = 0;
const blankBody = body({
  sessionId: 'sess-1',
  t: ctx.locale.bind(),
  useTabInfo: () => ({ tab: { id: 'tab-blank', kind: 'mobile-browser', navigation: { params: {} } } }),
});
const draftField = (() => {
  let found;
  walk(blankBody, (node) => {
    if (found === undefined && node.type === 'input' && node.props.className === 'dmb-url') found = node;
  });
  return found;
})();
console.log('blank tab draft:', draftField === undefined ? 'none' : draftField.props.value);
if (draftField === undefined || draftField.props.value !== 'https://example.com/docs?x=1') {
  throw new Error('a blank tab must open the default page');
}
console.log('blank tab: seeded from the default page');

// The frame's own navigation is invisible from here (cross-origin), so the address
// bar cannot follow a link click. The house button is the way back: it re-opens the
// remembered default page from wherever the frame drifted to.
const iframeOf = (root) => {
  let found;
  walk(root, (node) => {
    if (found === undefined && node.type === 'iframe') found = node;
  });
  return found;
};
const homeUrl = storage.get('dsh.sidebar-mobile-browser.home');
if (homeUrl !== 'https://example.com/docs?x=1') throw new Error('the default page must still be remembered');
const driftProps = {
  sessionId: 'sess-1',
  t: ctx.locale.bind(),
  useTabInfo: () => ({ tab: { id: 'tab-drift', kind: 'mobile-browser', navigation: { params: { url: 'https://other.test/landing' } } } }),
};
hookStore.length = 0;
hookCursor = 0;
const drifted = body(driftProps);
console.log('drifted iframe:', iframeOf(drifted).props.src);
if (iframeOf(drifted).props.src !== 'https://other.test/landing') throw new Error('expected the drifted page to be framed');
const house = findButtonByTitle(drifted, 'action.home.go');
if (house === undefined) throw new Error('expected a house button in the toolbar');
if (house.props.disabled === true) throw new Error('the house button must work once a default page exists');
house.props.onClick();
hookCursor = 0;
const returned = body(driftProps);
console.log('after the house click:', iframeOf(returned).props.src);
if (iframeOf(returned).props.src !== homeUrl) throw new Error('the house button must return to the default page');
console.log('house button: jumps back to the default page');

// With nothing remembered there is nowhere to go, so the button stays disabled.
storage.delete('dsh.sidebar-mobile-browser.home');
hookStore.length = 0;
hookCursor = 0;
const noHome = body(driftProps);
if (findButtonByTitle(noHome, 'action.home.go').props.disabled !== true) {
  throw new Error('the house button must be disabled without a default page');
}
console.log('house button: disabled when no default page is set');

// Inside the desktop shell the page rides a guest webview: the main process owns
// the partition, the lease names the element, and only then can the address bar
// follow navigations. The lease arrives on a later tick, so the first paint is a
// placeholder rather than an iframe that would load the page twice.
globalThis.window.dshDesktop = {
  protocolVersion: 1,
  browser: {
    acquire: async () => ({ lease: 'lease-test', partition: 'dsh-sidebar-browser-test' }),
    release: async () => {},
  },
};
hookStore.length = 0;
hookCursor = 0;
const pendingView = body(driftProps);
if (iframeOf(pendingView) !== undefined) throw new Error('a bridged tab must not paint an iframe');
console.log('guest pending: placeholder while the lease is approved');

await Promise.resolve();
await Promise.resolve();
hookCursor = 0;
const bridged = body(driftProps);
let hostNode;
walk(bridged, (node) => {
  if (hostNode === undefined && node.props.className === 'dmb-frame dmb-guest') hostNode = node;
});
if (hostNode === undefined) throw new Error('expected the guest host box once the lease arrives');
const guestElement = hostNode.children.find((child) => child !== null && typeof child === 'object' && child.tag === 'webview');
if (guestElement === undefined) throw new Error('expected the guest webview inside its host');
// The shell approves the attach only when lease name, partition and the
// about:blank source already agree — attribute order is load-bearing.
if (guestElement.attrs.name !== 'lease-test') throw new Error('the webview must carry the lease as its name');
if (guestElement.attrs.partition !== 'dsh-sidebar-browser-test') throw new Error('the webview must carry the approved partition');
if (guestElement.attrs.src !== 'about:blank#lease-test') throw new Error('the webview must start on about:blank');
console.log('guest webview: lease, approved partition, about:blank source');

// Simulate the attach: dom-ready is when the element may be navigated at all.
for (const run of guestElement.listeners['dom-ready'] ?? []) run();
if (guestElement.dataset.attached !== '1') throw new Error('dom-ready must mark the guest attached');
if (String(guestElement.ua ?? '').indexOf('iPhone') < 0) throw new Error('the guest must adopt a phone User-Agent');
const seededPage = driftProps.useTabInfo().tab.navigation.params.url;
if (guestElement.url !== seededPage) throw new Error(`the guest must load the page, got ${String(guestElement.url)}`);
console.log('guest webview: attached, phone UA, page loaded by loadURL');

// A navigation inside the page is what an iframe can never report.
const guestUrlBefore = guestElement.url;
for (const run of guestElement.listeners['did-navigate'] ?? []) run();
if (guestElement.url !== guestUrlBefore) throw new Error('did-navigate must not invent a URL');
guestElement.url = 'https://other.test/deep/link';
for (const run of guestElement.listeners['did-navigate-in-page'] ?? []) run();
hookCursor = 0;
const mirrored = body(driftProps);
let addressNode;
walk(mirrored, (node) => {
  if (addressNode === undefined && node.props.className === 'dmb-url') addressNode = node;
});
if (addressNode === undefined) throw new Error('expected an address bar');
if (addressNode.props.value !== 'https://other.test/deep/link') {
  throw new Error(`the address bar must follow the guest, got ${String(addressNode.props.value)}`);
}
console.log('guest webview: in-page navigation is mirrored into the address bar');

if (findButtonByTitle(bridged, 'action.back') !== undefined) throw new Error('the toolbar must not offer history buttons');
if (findButtonByTitle(bridged, 'action.forward') !== undefined) throw new Error('the toolbar must not offer forward navigation');
console.log('guest webview: no history buttons');
delete globalThis.window.dshDesktop;

console.log('SMOKE_OK');
