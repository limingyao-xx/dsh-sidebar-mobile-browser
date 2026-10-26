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
    # a ref that remembers the URL we asked for, so a slow old page cannot
    # write its address back while the new one is still loading
    ("""          const sizeRef = React.useRef(size);
          sizeRef.current = size;
""",
     """          const sizeRef = React.useRef(size);
          sizeRef.current = size;
          /** The address we last handed to the guest; '' once it arrived. */
          const loadingRef = React.useRef('');
"""),

    # mirror: one place that writes the guest's URL into the address bar
    ("""          /** Ask the guest to show one page; it is born on `about:blank`. */
""",
     """          /**
           * Put the guest's own URL in the address bar. Every path that can move
           * a page funnels through here - navigation events and the poll below -
           * so an in-page link, a redirect or a form post all land the same way.
           */
          const mirror = (next) => {
            if (next === '' || next.startsWith('about:blank')) return;
            if (next === urlRef.current) {
              loadingRef.current = '';
              return;
            }
            /** Still loading the address we asked for: this is the old page. */
            if (loadingRef.current !== '' && next !== loadingRef.current) return;
            loadingRef.current = '';
            const api = apiRef.current;
            if (api === null) return;
            api.setUrl(next);
            api.setDraft(next);
          };

          /** Ask the guest to show one page; it is born on `about:blank`. */
"""),

    ("""            if (guestUrl(element) === target) return;
            try {
              void element.loadURL(target).catch(() => {});""",
     """            if (guestUrl(element) === target) {
              loadingRef.current = '';
              return;
            }
            loadingRef.current = target;
            try {
              void element.loadURL(target).catch(() => {});"""),

    ("""              const api = apiRef.current;
              const sync = () => {
                const next = guestUrl(element);
                if (next === '' || next === urlRef.current) return;
                api.setUrl(next);
                api.setDraft(next);
              };""",
     """              const api = apiRef.current;
              const sync = () => mirror(guestUrl(element));"""),

    ("""          /** A size edit that crosses phone/tablet/desktop restarts in a new class. */""",
     """          /**
           * Follow the guest by asking it, not by trusting an event: a page that
           * navigates itself reports through `did-navigate-in-page` in most Electron
           * builds, but not for every kind of hop, and a missed event used to leave
           * the address bar frozen on the page the user arrived from.
           */
          React.useEffect(() => {
            if (!attached) return undefined;
            const timer = window.setInterval(() => {
              mirror(guestUrl(frameRef.current));
            }, 900);
            return () => window.clearInterval(timer);
          }, [attached]);

          /** A size edit that crosses phone/tablet/desktop restarts in a new class. */"""),
])

patch('test/smoke.mjs', [
    # the window shim needs intervals, and the test needs to fire them
    ("""  setTimeout: () => 0,
  clearTimeout: () => {},
};""",
     """  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: (fn) => { intervals.push(fn); return intervals.length; },
  clearInterval: () => {},
};"""),
    ("""globalThis.document = documentShim;""",
     """/** Intervals the body registered - the guest poll lives on one of these. */
const intervals = [];
globalThis.document = documentShim;"""),
    # a page that moved without emitting a navigation event must still show up
    ("""console.log('guest webview: in-page navigation is mirrored into the address bar');""",
     """console.log('guest webview: in-page navigation is mirrored into the address bar');

// The reported bug: a page moved, no event arrived, the address bar froze.
guestElement.url = 'https://other.test/spa/route/2';
for (const tick of intervals) tick();
hookCursor = 0;
const polled = body(driftProps);
let polledAddress;
walk(polled, (node) => {
  if (polledAddress === undefined && node.props.className === 'dmb-url') polledAddress = node;
});
if (polledAddress === undefined || polledAddress.props.value !== 'https://other.test/spa/route/2') {
  throw new Error(`the poll must mirror the guest, got ${String(polledAddress === undefined ? undefined : polledAddress.props.value)}`);
}
console.log('guest webview: the poll mirrors a page that moved silently');"""),
])

# version + changelog
p = root + r'\package.json'
s = open(p, encoding='utf-8').read()
s = s.replace('"version": "0.4.5"', '"version": "0.4.6"', 1)
open(p, 'w', encoding='utf-8', newline='').write(s)

p = root + r'\CHANGELOG.md'
s = open(p, encoding='utf-8').read()
entry = """## v0.4.6 — 2026-10-26

**修复**

- 地址栏跟不住页面的情况：网页自己跳转（站内路由、表单提交、重定向）靠 `did-navigate-in-page`
  这类事件回报，而事件并不总会到；漏一次，地址栏就永远停在旧地址上。现在除了事件，
  还每 900ms 直接问一次 guest「你现在在哪个 URL」，两条路都写进同一个 `mirror()`。
- 顺带修掉一个竞态：点了主页/新地址后，旧页面还没卸载完时 `getURL()` 仍返回旧地址，
  会被当成新地址写回地址栏。现在记下"正在加载哪个地址"，到货前忽略旧页面的回报。

**测试**

- `npm test` 的 window stub 补上 `setInterval`；新增断言：页面在**没有任何导航事件**的情况下换了地址，
  轮询也要把它写进地址栏。

"""
s = s.replace('# Changelog\n\n', '# Changelog\n\n' + entry, 1)
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
