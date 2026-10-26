root = r'D:\prj\dsh-sidebar-mobile-browser'
import io


def patch(path, pairs):
    full = root + '\\' + path
    s = open(full, encoding='utf-8').read()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f'{path}: anchor missing -> {old[:70]!r}')
        s = s.replace(old, new, 1)
    open(full, 'w', encoding='utf-8', newline='').write(s)
    print('patched', path)


# Fall back loudly: the iframe cannot report where it went, and the user needs
# to know that is why the address bar stopped moving.
patch('client.js', [
    ("""              if (shown !== '' && !shown.startsWith('about:blank')) return;
              if (bridge !== undefined) void bridge.release(guest.lease);
              setGuest({ phase: 'off' });""",
     """              if (shown !== '' && !shown.startsWith('about:blank')) return;
              if (bridge !== undefined) void bridge.release(guest.lease);
              setError(copy('error.fallback'));
              setGuest({ phase: 'off' });"""),
    ("""      'error.frame': '页面加载失败（{code}）',""",
     """      'error.frame': '页面加载失败（{code}）',
      'error.fallback': '桌面端未能承载页面，已退回 iframe：地址栏不会跟随站内跳转',"""),
    ("""      'error.frame': 'Could not load the page ({code})',""",
     """      'error.frame': 'Could not load the page ({code})',
      'error.fallback': 'The desktop shell could not host the page; fell back to an iframe, so the address bar cannot follow in-page navigation',"""),
])

p = root + r'\package.json'
s = open(p, encoding='utf-8').read()
s = s.replace('"version": "0.4.6"', '"version": "0.4.7"', 1)
open(p, 'w', encoding='utf-8', newline='').write(s)

p = root + r'\CHANGELOG.md'
s = open(p, encoding='utf-8').read()
entry = """## v0.4.7 — 2026-10-26

**变更**

- 退回 iframe 时不再静默：页面顶部会明说「桌面端未能承载页面，已退回 iframe：地址栏不会跟随站内跳转」。
  iframe 读不到自己的地址，静默退回会让人以为这是插件的 bug。

"""
s = s.replace('# Changelog\n\n', '# Changelog\n\n' + entry, 1)
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
