# dsh-sidebar-mobile-browser

给 **DeepSeek Harness（DSH）** 右侧边栏加一个「移动端预览」标签页：按手机 / 平板尺寸打开网页，
在对话框里用 `@` 引用当前页面地址，一键复制 URL。

A mobile-device preview browser for the DSH right sidebar — device-sized frames, `@`-mention of the
current page URL from the composer, one-click copy.

- 标签页类型：**移动端预览**（与内置 Browser 并列，不替换它）
- 设备尺寸：9 个常见预设 + 自定义宽高（180–2560），最近一次尺寸会记住
- 页面超出可用高度时**等比缩放**，不改 iframe 视口宽高（看到的视口就是选定的设备宽度）
- `@` 候选：本会话预览过的页面，最近一个标「当前页面地址」，选中即插入纯文本 URL
- 工具栏：回车即打开、`⟳` 重载、复制图标（成功后短暂变对勾）、`⟲` 横竖屏切换
- 多标签页；切换标签不重载页面（`keepMounted`）；重启 DSH 后能恢复上次打开的页面

## 安装

**从市场安装（推荐）**：在 DSH 的插件市场搜索 `dsh-sidebar-mobile-browser` 后一键安装。

**从本仓目录安装**：把仓库目录当作 bundle 安装到当前 profile（DSH 插件管理器 / 插件市场工具的
“安装 bundle”入口，目标填本仓的绝对路径），装完按提示重载页面。

安装后右侧边栏「+」列表里会出现 **移动端预览**（手机图标）。

## 使用

1. 「+」→ **移动端预览**，或直接点这个标签页类型。
2. 地址栏输入 `example.com` 或完整 URL，**回车**打开（无单独“打开”按钮）。
3. 尺寸栏选预设，或选「自定义」直接改宽高数字（回车 / 失焦生效）。
4. 工具栏：`⟳` 重载、复制图标复制当前 URL、`⟲` 横竖屏互换。
5. 地址栏右侧书签按钮可回跳本会话预览过的页面。
6. 对话框输入 `@` → 选「当前页面地址」即可把 URL 作为纯文本插入。

## 兼容性

- 需要 DSH `0.2.x`（在 `0.2.1-rc.2` 上验证），Web 与 Desktop 两种 profile 都可用。
- 只用到公开扩展点：`ctx.sidebarRightTabs` / `ctx.slots` / `ctx.inputTriggers` / `ctx.locale`，
  不 patch 任何内置模块。

## 已知局限

- 载体是 iframe：目标站点返回 `X-Frame-Options` 或 CSP `frame-ancestors` 时会白屏 —— 改用内置 Browser 标签打开同一地址。
- 只改视口尺寸，**不伪造移动端 User-Agent**；依赖真机 UA 的站点预览会与手机不一致。
- 桌面端嵌入的 webview 标签页不参与尺寸模拟（本插件只作用于自己注册的标签页类型）。
- 跨域页面的地址栏不会跟随站内跳转（浏览器同源策略限制），此时用书签列表或重新输入地址。
- DSH 以 HTTPS 提供服务时，`http://` 页面会被浏览器按混合内容拦截。

## 工作原理

| 扩展点 | 用途 |
| --- | --- |
| `ctx.sidebarRightTabs.register()` | 注册标签页类型 `id = sidebar-mobile-browser`、`kind = mobile-browser` |
| `ctx.slots.register({ name: 'sidebar.right.pane.tab', key })` | 渲染标签页主体（尺寸栏 + iframe + 工具栏） |
| `ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key })` | 标签页标题跟随当前地址的 host |
| `ctx.inputTriggers.registerSource({ trigger: '@', name: 'webpage' })` | 对话框 `@` 候选（按会话记录预览过的 URL） |
| `ctx.locale.register()` | 中英文案内置 |

`index.js` 只是空的 Host 半边（bundle 行需要它）；全部能力在 `client.js`。

## 开发

```bash
node --check index.js && node --check client.js   # 无构建步骤，纯 ESM + 浏览器 classic script
```

- `client.js` 是浏览器端 classic script，`window.__ModuleLoader__.load({ id, factory })` 导出 `{ inject, apply }`；
  直接 `require('react')` 即可，不依赖 DSH 内部客户端包（只通过 `inject` 声明顺序）。
- **改完 `client.js` 不会热替换已加载的模块**：Desktop 需要退出并重新打开应用（正式版没有“重新加载页面”菜单项），
  Web 端刷新页面即可。改了 `package.json` / `cordis.patch.yml` 需要重新安装 bundle。
- 版本：语义化版本，破坏性改动用 minor。

## 发布

1. `npm publish --access public`（`package.json` 已含 `files` / `exports` / `dsh.bundle` / `dsh.client`）。
2. 在 DSH 插件市场提交仓库与包名，审核后即可被搜索安装。
3. 别忘了把 `package.json` 里 `repository` / `homepage` / `bugs` 的 `OWNER` 换成你的 GitHub 账号。

## License

MIT
