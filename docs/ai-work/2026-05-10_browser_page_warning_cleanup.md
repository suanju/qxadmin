# 浏览器页面警告排查记录

日期：2026-05-10

目的：使用浏览器打开当前 admin 内核所有页面，排查并处理页面控制台 warning/error 与资源加载异常。

涉及范围：`/login`、`/`、`/dashboard`、`/settings`、`/operation_logs`、`/files`、`/admin_accounts`、`/admin`、`/no_permission`，以及 `nuxt.config.ts` 的 Nuxt Icon 客户端图标预加载配置。

是否影响后台核心链路：不直接改动登录、RBAC、管理员账号、角色、设置、日志、上传 API 或数据库 schema。改动仅补齐前端图标客户端 bundle，降低运行时外部图标请求和开发环境缓存警告风险。

## 处理内容

- 执行 `pnpm db:init` 初始化本地 admin 核心数据，确认默认账号 `admin / admin123456` 可用。
- 执行 `pnpm rbac:sync` 同步动态 RBAC 权限数据。
- 启动 `pnpm dev`，通过浏览器登录后台并逐页打开当前页面路由。
- 首次打开登录页时遇到 Vite 依赖缓存一次性 `504 Outdated Optimize Dep`，硬刷新后恢复。
- 发现 `/operation_logs` 与 `/admin_accounts` 的分页控件会运行时请求 Iconify CDN 的分页图标。
- 在 `nuxt.config.ts` 中补齐当前页面实际使用的 Lucide 图标到 `icon.clientBundle.icons`。

## 页面验证

已打开并验证：

- `/login`
- `/`
- `/dashboard`
- `/settings`
- `/operation_logs`
- `/files`
- `/admin_accounts`
- `/admin`
- `/no_permission`

验证结果：

- 页面均可正常打开。
- 登录后后台 API 均返回 200。
- 复测页面控制台未发现 warning/error。
- 补齐图标后，`/operation_logs` 与 `/admin_accounts` 不再触发 `https://api.iconify.design/lucide.json?...` 运行时请求。

## 风险与验证

风险：

- 本次只处理页面打开阶段与基础页面内 Tab 切换阶段发现的问题，未覆盖所有新增、编辑、删除、上传等写操作弹窗的完整交互链路。

验证：

- `pnpm rbac:verify-routes` 通过。
- `pnpm build` 通过。
- 浏览器复测 `/dashboard`、`/settings`、`/operation_logs`、`/files`、`/admin_accounts` 均无控制台 warning/error。
