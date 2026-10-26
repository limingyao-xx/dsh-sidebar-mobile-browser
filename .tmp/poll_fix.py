root = r'D:\prj\dsh-sidebar-mobile-browser'


def patch(path, pairs):
    full = root + '\\' + path
    s = open(full, encoding='utf-8').read()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f'{path}: anchor missing -> {old[:70]!r}')
        s = s.replace(old, new, 1)
    open(full, 'w', encoding='utf-8', newline='').write(s)
    print('patched', path)


patch('client.js', [
    ("""            console.log('MIRROR?', JSON.stringify(next), '| url:', JSON.stringify(urlRef.current), '| loading:', JSON.stringify(loadingRef.current));
""", ""),
])

patch('test/smoke.mjs', [
    # refs must survive a re-render, exactly like React's, or the poll would
    # read a fresh element that the page never touched
    ("""let hookCursor = 0;
const hookStore = [];""",
     """let hookCursor = 0;
const hookStore = [];
/** Persistent `useRef` cells, sharing the hook cursor so both reset together. */
const refStore = [];"""),
    ("""  useRef: () => ({ current: null }),""",
     """  useRef: (initial) => {
    const slot = hookCursor++;
    if (!(slot in refStore)) refStore[slot] = { current: initial === undefined ? null : initial };
    return refStore[slot];
  },"""),
    # drive the newest guest: every render builds a fresh element in this harness
    ("""guestElement.url = 'https://other.test/spa/route/2';
console.log('DEBUG intervals:', intervals.length);
for (const tick of intervals) tick();
console.log('DEBUG store:', JSON.stringify(hookStore.slice(0, 8)));""",
     """const latestGuest = (tree) => {
  let host;
  walk(tree, (node) => {
    if (host === undefined && node.props.className === 'dmb-frame dmb-guest') host = node;
  });
  if (host === undefined) throw new Error('expected a guest host');
  return host.children.find((child) => child !== null && typeof child === 'object' && child.tag === 'webview');
};
hookCursor = 0;
latestGuest(body(driftProps)).url = 'https://other.test/spa/route/2';
for (const tick of intervals) tick();"""),
])
print('ok')
