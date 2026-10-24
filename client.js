window.__ModuleLoader__.load({
  id: 'dsh-sidebar-mobile-browser',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace for every string this bundle renders. */
    const NS = 'sidebarMobileBrowser';
    /** Registered tab type id; also the key of the two seats it draws into. */
    const TYPE_ID = 'sidebar-mobile-browser';
    /** Tab kind other plugins and shortcuts use to open a page of this type. */
    const KIND = 'mobile-browser';
    /** Per-profile memory of the last device size. */
    const SIZE_STORAGE_KEY = 'dsh.sidebar-mobile-browser.size';
    /** Plugin stylesheet identity inside the page. */
    const STYLE_KEY = 'dsh-sidebar-mobile-browser/client.css';
    /** How long a remembered page stays offered to the `@` menu. */
    const PAGE_TTL_MS = 12 * 60 * 60 * 1000;
    /** Rows the `@` menu offers at most. */
    const PAGE_LIMIT = 5;

    /** Common device sizes, plus the custom escape hatch. */
    const PRESETS = [
      { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
      { id: 'iphone-14', label: 'iPhone 14 / 13', width: 390, height: 844 },
      { id: 'iphone-14-plus', label: 'iPhone 14 Plus', width: 428, height: 926 },
      { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
      { id: 'pixel-7', label: 'Pixel 7', width: 412, height: 915 },
      { id: 'galaxy-s23', label: 'Galaxy S23', width: 360, height: 780 },
      { id: 'ipad-mini', label: 'iPad mini', width: 768, height: 1024 },
      { id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834, height: 1194 },
      { id: 'laptop', label: 'Laptop 1280', width: 1280, height: 800 },
    ];

    /** Narrowest and widest side the custom fields accept. */
    const MIN_SIDE = 180;
    const MAX_SIDE = 2560;

    /**
     * Live pages per tab, read by the `@` source. The sidebar body is the only
     * writer. Entries outlive an unmount — the sidebar hides without closing its
     * tabs — and are pruned by age when the menu asks.
     */
    const pages = new Map();
    /** Most recently touched tab per Session, so the mention row can lead with it. */
    const lastTabBySession = new Map();

    const zh = {
      'type.label': '移动端预览',
      'guide.title': '移动端预览浏览器',
      'guide.description': '按手机 / 平板尺寸打开网页',
      'address.placeholder': '输入网址，回车打开',
      'action.reload': '重新加载',
      'action.copy': '复制 URL',
      'action.copied': '已复制',
      'action.rotate': '横竖屏切换',
      'device.label': '尺寸',
      'device.custom': '自定义',
      'empty.title': '输入网址后按回车',
      'empty.body': '页面会以所选设备尺寸渲染，可随时切换机型或改宽高。',
      'error.empty': '请先输入网址。',
      'error.scheme': '只支持 http / https 地址。',
      'error.clipboard': '复制失败，请手动选择地址栏内容。',
      'mention.current': '当前页面地址',
      'mention.other': '预览页：{host}',
      'action.mention': '插入到对话框',
      'action.mentioned': '已插入',
      'command.url': '引用当前预览页地址',
      'command.urlHint': '把预览页 URL 写进输入框',
      'error.insert': '插入失败：该会话的输入框尚未就绪。',
    };

    const en = {
      'type.label': 'Mobile preview',
      'guide.title': 'Mobile preview browser',
      'guide.description': 'Open a page at a phone or tablet size',
      'address.placeholder': 'Enter a URL and press Enter',
      'action.reload': 'Reload',
      'action.copy': 'Copy URL',
      'action.copied': 'Copied',
      'action.rotate': 'Rotate',
      'device.label': 'Size',
      'device.custom': 'Custom',
      'empty.title': 'Enter a URL and press Enter',
      'empty.body': 'The page renders at the selected device size; switch devices or edit the size at any time.',
      'error.empty': 'Enter a URL first.',
      'error.scheme': 'Only http and https addresses are supported.',
      'error.clipboard': 'Copy failed; select the address bar text instead.',
      'mention.current': 'Current page URL',
      'mention.other': 'Preview: {host}',
      'action.mention': 'Insert into chat',
      'action.mentioned': 'Inserted',
      'command.url': 'Insert the preview page URL',
      'command.urlHint': 'Write the preview page URL into the composer',
      'error.insert': 'Insertion failed: this session has no composer yet.',
    };

    /** Stylesheet: inherits the surrounding ink with color-mix, no fixed palette. */
    const CSS = `
.dmb-root{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;font-size:12px;color:inherit}
.dmb-bar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);flex:0 0 auto}
.dmb-url{flex:1 1 auto;min-width:0;height:26px;padding:0 8px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:color-mix(in srgb,currentColor 4%,transparent);color:inherit;font:inherit;outline:none}
.dmb-url:focus{border-color:color-mix(in srgb,currentColor 46%,transparent)}
.dmb-btn{flex:0 0 auto;height:26px;padding:0 8px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:transparent;color:inherit;font:inherit;cursor:pointer;white-space:nowrap}
.dmb-btn:hover:not(:disabled){background:color-mix(in srgb,currentColor 8%,transparent)}
.dmb-btn:disabled{opacity:.42;cursor:default}
.dmb-btn-icon{width:26px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.dmb-btn-icon svg{display:block}
.dmb-select{height:26px;max-width:158px;padding:0 4px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:transparent;color:inherit;font:inherit;cursor:pointer}
.dmb-select option{color:#111}
.dmb-dim{width:52px;height:26px;padding:0 4px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:transparent;color:inherit;font:inherit;text-align:center}
.dmb-meta{opacity:.6;font-variant-numeric:tabular-nums;white-space:nowrap}
.dmb-stage{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px;background:color-mix(in srgb,currentColor 3%,transparent)}
.dmb-device{position:relative;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 6px 24px color-mix(in srgb,currentColor 22%,transparent),0 0 0 1px color-mix(in srgb,currentColor 18%,transparent);flex:0 0 auto}
.dmb-frame{position:absolute;top:0;left:0;border:0;background:#fff;transform-origin:top left}
.dmb-empty{max-width:280px;text-align:center;opacity:.72;line-height:1.6}
.dmb-empty-title{font-weight:600;margin-bottom:4px}
.dmb-error{padding:0 10px 8px;color:#d9534f}
.dmb-title{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

    /** Read the remembered device size, falling back to a common phone. */
    function readSize() {
      try {
        const raw = window.localStorage.getItem(SIZE_STORAGE_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          const width = Number(parsed && parsed.width);
          const height = Number(parsed && parsed.height);
          if (Number.isFinite(width) && Number.isFinite(height) && width >= MIN_SIDE && height >= MIN_SIDE) {
            return {
              preset: typeof parsed.preset === 'string' ? parsed.preset : 'custom',
              width: clampSide(width),
              height: clampSide(height),
            };
          }
        }
      } catch (error) {
        void error;
      }
      const fallback = PRESETS[1];
      return { preset: fallback.id, width: fallback.width, height: fallback.height };
    }

    /** Remember a device size for the next page and the next Session. */
    function writeSize(size) {
      try {
        window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify({ preset: size.preset, width: size.width, height: size.height }));
      } catch (error) {
        void error;
      }
    }

    /** Clamp one side of a custom size into the accepted range. */
    function clampSide(value) {
      const number = Math.round(Number(value));
      if (!Number.isFinite(number)) return MIN_SIDE;
      return Math.min(MAX_SIDE, Math.max(MIN_SIDE, number));
    }

    /** Turn typed input into an addressable http(s) URL. */
    function normalizeUrl(raw) {
      const value = String(raw === undefined || raw === null ? '' : raw).trim();
      if (value === '') return { ok: false, reason: 'empty' };
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        if (/^https?:\/\//i.test(value)) return { ok: true, url: value };
        return { ok: false, reason: 'scheme' };
      }
      if (value.startsWith('//')) return { ok: true, url: `https:${value}` };
      return { ok: true, url: `https://${value}` };
    }

    /** Host name of one URL, for chip-sized labels. */
    function hostOf(raw) {
      try {
        return new URL(raw).host;
      } catch (error) {
        void error;
      }
      return String(raw === undefined || raw === null ? '' : raw).replace(/^https?:\/\//i, '').split('/')[0];
    }

    /** The registered preset matching one size, or `custom`. */
    function presetFor(width, height) {
      const match = PRESETS.find((preset) => preset.width === width && preset.height === height);
      return match === undefined ? 'custom' : match.id;
    }

    /** Record the page a preview tab is showing, for the `@` menu and the chip title. */
    function rememberPage(tabId, sessionId, url) {
      if (url === '') {
        pages.delete(tabId);
        return;
      }
      pages.set(tabId, { sessionId, url, host: hostOf(url), at: Date.now() });
      lastTabBySession.set(sessionId, tabId);
    }

    /** The URL one Session is previewing right now: the tab touched last, else the freshest live one. */
    function pageUrlFor(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return '';
      const now = Date.now();
      const newest = lastTabBySession.get(sessionId);
      const current = newest === undefined ? undefined : pages.get(newest);
      if (current !== undefined && current.sessionId === sessionId && now - current.at <= PAGE_TTL_MS) {
        return current.url;
      }
      let found = '';
      let at = -1;
      for (const page of pages.values()) {
        if (page.sessionId !== sessionId || now - page.at > PAGE_TTL_MS) continue;
        if (page.at > at) {
          at = page.at;
          found = page.url;
        }
      }
      return found;
    }

    /**
     * Write text into one Session's composer through the public action face.
     * The composer's own span is captured right before the edit, so the text
     * lands at the caret and keeps whatever the user already typed.
     * @param ctx - this bundle's context (needs the sessions service).
     * @param sessionId - Session whose composer receives the text.
     * @param text - literal text to insert.
     * @returns whether the composer applied the edit.
     */
    function insertIntoComposer(ctx, sessionId, text) {
      if (typeof text !== 'string' || text === '' || typeof sessionId !== 'string' || sessionId === '') return false;
      try {
        const sessions = ctx.get('sessions');
        const actx = sessions === undefined ? undefined : sessions.scope(sessionId);
        const conversation = actx === undefined ? undefined : actx.get('conversation');
        const input = conversation === undefined || conversation === null ? undefined : conversation.input;
        if (input === undefined || typeof input.shell !== 'function') return false;
        const shell = input.shell(sessionId);
        const actions = shell === undefined || shell === null ? undefined : shell.actions;
        if (actions === undefined || typeof actions.captureInsertion !== 'function' || typeof actions.insertText !== 'function') return false;
        return actions.insertText(text, actions.captureInsertion()) === true;
      } catch (error) {
        console.warn('[mobile-browser] could not insert the page URL into the composer:', error);
        return false;
      }
    }

    /** A phone outline for the tab title, the guide card, and mention rows. */
    function PhoneGlyph({ size }) {
      const side = size === undefined ? 14 : size;
      return h(
        'svg',
        { width: side, height: side, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, style: { flex: '0 0 auto' } },
        h('rect', { x: 4, y: 1.5, width: 8, height: 13, rx: 2, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M6.6 3.4h2.8', stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' }),
        h('circle', { cx: 8, cy: 12.2, r: 0.9, fill: 'currentColor' }),
      );
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'commandUi', 'sidebarRight', 'sidebarRightTabs', 'inputTriggers'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mobile-browser: copy');

        ctx.effect(() => {
          if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_KEY)}]`) !== null) return undefined;
          const element = document.createElement('style');
          element.setAttribute('data-plugin-css', STYLE_KEY);
          element.textContent = CSS;
          document.head.appendChild(element);
          return () => element.remove();
        }, 'mobile-browser: styles');

        /** The tab type: its chip title and the guide card that opens it. */
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: TYPE_ID,
          kind: KIND,
          multiple: true,
          priority: 'extension',
          keepMounted: true,
          title: () => t('type.label'),
          guide: [{
            id: 'open',
            order: 26,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            icon: PhoneGlyph,
          }],
        }), 'mobile-browser: type');

        /** One page: address bar, device chrome, and the framed page. */
        function MobileBrowserBody(props) {
          const copy = typeof props.t === 'function' ? props.t : t;
          const sessionId = props.sessionId;
          const tabInfo = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined;
          const tab = tabInfo === undefined ? undefined : tabInfo.tab;
          const tabId = tab !== undefined && tab.id !== undefined ? tab.id : 'singleton';
          const navigation = tab === undefined ? undefined : tab.navigation;
          const seed = navigation !== undefined && navigation.params !== undefined ? navigation.params.url : undefined;
          const seeded = React.useMemo(() => normalizeUrl(seed), [seed]);
          /** A remount keeps showing the page the tab showed before it was disposed. */
          const remembered = React.useMemo(() => {
            const entry = pages.get(tabId);
            return entry === undefined ? '' : entry.url;
          }, [tabId]);
          const initial = seeded.ok ? seeded.url : remembered;

          const [size, setSize] = React.useState(readSize);
          const [draft, setDraft] = React.useState(initial);
          const [dims, setDims] = React.useState({ width: String(size.width), height: String(size.height) });
          const [url, setUrl] = React.useState(initial);
          const [revision, setRevision] = React.useState(0);
          const [copied, setCopied] = React.useState(false);
          const [inserted, setInserted] = React.useState(false);
          const [error, setError] = React.useState('');
          const [scale, setScale] = React.useState(1);
          const stageRef = React.useRef(null);

          React.useEffect(() => { writeSize(size); }, [size]);

          React.useEffect(() => {
            setDims({ width: String(size.width), height: String(size.height) });
            rememberPage(tabId, sessionId, url);
          }, [size.width, size.height, tabId, sessionId, url]);

          React.useEffect(() => {
            const stage = stageRef.current;
            if (stage === null) return undefined;
            const measure = () => {
              const rect = stage.getBoundingClientRect();
              if (rect.width < 1 || rect.height < 1) return;
              const availableWidth = Math.max(0, rect.width - 24);
              const availableHeight = Math.max(0, rect.height - 24);
              const next = Math.min(1, availableWidth / size.width, availableHeight / size.height);
              setScale(Number.isFinite(next) && next > 0 ? next : 1);
            };
            measure();
            if (typeof ResizeObserver === 'undefined') return undefined;
            const observer = new ResizeObserver(measure);
            observer.observe(stage);
            return () => observer.disconnect();
          }, [size.width, size.height]);

          React.useEffect(() => {
            if (!copied) return undefined;
            const timer = window.setTimeout(() => setCopied(false), 1400);
            return () => window.clearTimeout(timer);
          }, [copied]);

          React.useEffect(() => {
            if (!inserted) return undefined;
            const timer = window.setTimeout(() => setInserted(false), 1400);
            return () => window.clearTimeout(timer);
          }, [inserted]);

          const open = () => {
            const result = normalizeUrl(draft);
            if (!result.ok) {
              setError(result.reason === 'scheme' ? copy('error.scheme') : copy('error.empty'));
              return;
            }
            setError('');
            setDraft(result.url);
            setUrl(result.url);
            setRevision((value) => value + 1);
          };

          const copyUrl = () => {
            if (url === '') return;
            const done = () => setCopied(true);
            const failed = () => setError(copy('error.clipboard'));
            if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
              navigator.clipboard.writeText(url).then(done, failed);
              return;
            }
            try {
              const carrier = document.createElement('textarea');
              carrier.value = url;
              carrier.setAttribute('readonly', 'readonly');
              carrier.style.position = 'fixed';
              carrier.style.opacity = '0';
              document.body.appendChild(carrier);
              carrier.select();
              const ok = document.execCommand('copy');
              carrier.remove();
              if (ok) done();
              else failed();
            } catch (failure) {
              void failure;
              failed();
            }
          };

          /** Put the page URL into this Session's composer, at its caret. */
          const insertUrl = () => {
            if (url === '') return;
            if (insertIntoComposer(ctx, sessionId, url)) {
              setError('');
              setInserted(true);
              return;
            }
            setError(copy('error.insert'));
          };

          const pickPreset = (id) => {
            if (id === 'custom') {
              setSize((current) => ({ ...current, preset: 'custom' }));
              return;
            }
            const preset = PRESETS.find((candidate) => candidate.id === id);
            if (preset === undefined) return;
            setSize({ preset: preset.id, width: preset.width, height: preset.height });
          };

          /** Commit one edited dimension; a half-typed value is simply ignored. */
          const commitSide = (key, raw) => {
            const number = Math.round(Number(raw));
            if (!Number.isFinite(number)) {
              setDims({ width: String(size.width), height: String(size.height) });
              return;
            }
            const next = clampSide(number);
            setSize((current) => {
              const width = key === 'width' ? next : current.width;
              const height = key === 'height' ? next : current.height;
              return { preset: presetFor(width, height), width, height };
            });
          };

          const rotate = () => {
            setSize((current) => ({
              preset: presetFor(current.height, current.width),
              width: current.height,
              height: current.width,
            }));
          };

          const currentPreset = size.preset === undefined ? 'custom' : size.preset;

          return h(
            'div',
            { className: 'dmb-root' },
            h(
              'div',
              { className: 'dmb-bar' },
              h('input', {
                className: 'dmb-url',
                value: draft,
                placeholder: copy('address.placeholder'),
                spellCheck: false,
                autoComplete: 'off',
                onChange: (event) => setDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    open();
                  }
                },
              }),
              h('button', {
                type: 'button',
                className: 'dmb-btn',
                title: copy('action.reload'),
                disabled: url === '',
                onClick: () => setRevision((value) => value + 1),
              }, '⟳'),
              h('button', {
                type: 'button',
                className: 'dmb-btn dmb-btn-icon',
                title: copied ? copy('action.copied') : copy('action.copy'),
                disabled: url === '',
                onClick: copyUrl,
              }, copied
                ? h('svg', {
                    width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
                    stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
                    strokeLinejoin: 'round', 'aria-hidden': true,
                  }, h('path', { d: 'M3.4 8.4l3.1 3.1 6.1-6.3' }))
                : h('svg', {
                    width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
                    stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
                    strokeLinejoin: 'round', 'aria-hidden': true,
                  },
                  h('rect', { x: 5.2, y: 5.2, width: 8.1, height: 8.1, rx: 1.6 }),
                  h('path', { d: 'M10.8 5.2V3.7c0-.7-.6-1.3-1.3-1.3H3.7c-.7 0-1.3.6-1.3 1.3v5.8c0 .7.6 1.3 1.3 1.3h1.5' }))),
              h('button', {
                type: 'button',
                className: 'dmb-btn dmb-btn-icon',
                title: inserted ? copy('action.mentioned') : copy('action.mention'),
                disabled: url === '',
                onClick: insertUrl,
              }, '@'),
            ),
            h(
              'div',
              { className: 'dmb-bar' },
              h('select', {
                className: 'dmb-select',
                value: currentPreset,
                onChange: (event) => pickPreset(event.target.value),
                title: copy('device.label'),
              }, [
                ...PRESETS.map((preset) => h('option', { key: preset.id, value: preset.id },
                  `${preset.label} · ${preset.width}×${preset.height}`)),
                h('option', { key: 'custom', value: 'custom' }, copy('device.custom')),
              ]),
              h('input', {
                className: 'dmb-dim',
                type: 'text',
                inputMode: 'numeric',
                value: dims.width,
                title: 'width',
                onChange: (event) => setDims((current) => ({ ...current, width: event.target.value })),
                onBlur: (event) => commitSide('width', event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitSide('width', event.currentTarget.value);
                  }
                },
              }),
              h('span', { className: 'dmb-meta' }, '×'),
              h('input', {
                className: 'dmb-dim',
                type: 'text',
                inputMode: 'numeric',
                value: dims.height,
                title: 'height',
                onChange: (event) => setDims((current) => ({ ...current, height: event.target.value })),
                onBlur: (event) => commitSide('height', event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitSide('height', event.currentTarget.value);
                  }
                },
              }),
              h('button', { type: 'button', className: 'dmb-btn', title: copy('action.rotate'), onClick: rotate }, '⟲'),
            ),
            h(
              'div',
              { className: 'dmb-stage', ref: stageRef },
              url === ''
                ? h('div', { className: 'dmb-empty' },
                    h('div', { className: 'dmb-empty-title' }, copy('empty.title')),
                    h('div', null, copy('empty.body')))
                : h('div', {
                    className: 'dmb-device',
                    style: { width: `${Math.round(size.width * scale)}px`, height: `${Math.round(size.height * scale)}px` },
                  }, h('iframe', {
                    className: 'dmb-frame',
                    key: `${url}#${revision}`,
                    src: url,
                    title: hostOf(url),
                    referrerPolicy: 'no-referrer-when-downgrade',
                    allow: 'clipboard-write; fullscreen',
                    style: { width: `${size.width}px`, height: `${size.height}px`, transform: `scale(${scale})` },
                  })),
            ),
            error === '' ? null : h('div', { className: 'dmb-error' }, error),
          );
        }

        /** Tab chip: the hosted site while a page is loaded, the type name otherwise. */
        function MobileBrowserTitle(props) {
          const copy = typeof props.t === 'function' ? props.t : t;
          const tabInfo = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined;
          const tab = tabInfo === undefined ? undefined : tabInfo.tab;
          const navigation = tab === undefined ? undefined : tab.navigation;
          const tabId = tab !== undefined && tab.id !== undefined ? tab.id : 'singleton';
          const seed = navigation !== undefined && navigation.params !== undefined ? navigation.params.url : undefined;
          const live = pages.get(tabId);
          const label = live !== undefined
            ? live.host
            : seed === undefined || seed === '' ? copy('type.label') : hostOf(String(seed));
          return h('span', { className: 'dmb-title' }, h(PhoneGlyph, { size: 13 }), label);
        }

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TYPE_ID,
          locale: NS,
          inject: (sessionId) => ({ sessionId }),
        }, MobileBrowserBody)), 'mobile-browser: body');

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: TYPE_ID,
          locale: NS,
        }, MobileBrowserTitle)), 'mobile-browser: title');

        /** `@` source: every preview page of this Session, newest first. */
        const source = {
          trigger: '@',
          name: 'webpage',
          showGroupTitle: false,
          async candidates(session, request) {
            const sessionId = session === undefined ? undefined : session.sessionId;
            const newest = lastTabBySession.get(sessionId);
            const now = Date.now();
            const rows = [];
            for (const entry of pages) {
              const [tabId, page] = entry;
              if (page.sessionId !== sessionId) continue;
              if (now - page.at > PAGE_TTL_MS) {
                pages.delete(tabId);
                continue;
              }
              rows.push({ tabId, url: page.url, host: page.host, recent: tabId === newest ? 1 : 0, at: page.at });
            }
            rows.sort((left, right) => right.recent - left.recent || right.at - left.at);
            const query = request === undefined || request.query === undefined ? '' : String(request.query).toLowerCase();
            return rows
              .filter((row) => query === '' || row.url.toLowerCase().includes(query) || row.host.toLowerCase().includes(query))
              .slice(0, PAGE_LIMIT)
              .map((row) => ({
                name: row.host,
                label: row.recent === 1 ? t('mention.current') : t('mention.other', { host: row.host }),
                description: row.url,
                icon: PhoneGlyph,
                value: row.url,
              }));
          },
          onPick({ candidate }) {
            if (candidate === undefined || typeof candidate.value !== 'string' || candidate.value === '') return undefined;
            return { text: candidate.value };
          },
        };

        ctx.effect(() => ctx.inputTriggers.registerSource(source), 'mobile-browser: @ source');

        /** `/url`: the same URL, one keystroke away — no menu, no mouse. */
        ctx.effect(() => ctx.commandUi.register({
          name: 'url',
          label: () => t('command.url'),
          description: () => t('command.urlHint'),
          available: (session) => pageUrlFor(session === undefined || session === null ? undefined : session.sessionId) !== '',
          ui: {
            kind: 'action',
            run: (session) => {
              const url = pageUrlFor(session === undefined || session === null ? undefined : session.sessionId);
              if (url === '') return;
              insertIntoComposer(ctx, session.sessionId, url);
            },
          },
        }), 'mobile-browser: /url');
      },
    };
  },
});
