# 2026-05-19 依赖升级与兼容验证记录

## 基本信息

- 日期：2026-05-19
- 目的：将当前项目顶层 npm 依赖升级到 npm registry 最新版本，并验证 Nuxt admin 内核构建、RBAC 路由映射与登录页基础渲染兼容性。
- 涉及范围：`package.json`、`pnpm-lock.yaml`、依赖安装产物与 Nuxt 生成类型。
- 是否影响后台核心链路：不直接改动登录、RBAC、账号角色、设置、日志、上传等业务代码；本次主要风险来自框架与 UI 依赖升级。

## 升级内容

本次使用现有包管理器 pnpm 维护 `pnpm-lock.yaml`，未引入 `package-lock.json`。

顶层依赖升级结果：

| 包 | 升级后版本 |
| --- | --- |
| `@internationalized/date` | `3.12.1` |
| `@nuxt/ui` | `4.7.1` |
| `dotenv` | `17.4.2` |
| `drizzle-orm` | `0.45.2` |
| `jose` | `6.2.3` |
| `mysql2` | `3.22.3` |
| `nuxt` | `4.4.6` |
| `tailwindcss` | `4.3.0` |
| `vue` | `3.5.34` |
| `vue-router` | `5.0.7` |
| `@iconify-json/lucide` | `1.2.108` |
| `@types/node` | `25.9.0` |
| `@vitejs/plugin-vue-jsx` | `5.1.5` |
| `drizzle-kit` | `0.31.10` |

`ip2region.js` 当前最新版本仍为 `3.1.8`，未发生版本变化。

## 兼容验证

已执行：

- `pnpm install --frozen-lockfile`：通过，lockfile 可复现安装。
- `pnpm outdated --format json`：返回 `{}`，顶层依赖无可升级项。
- `pnpm exec npm ls --depth=0`：通过，顶层依赖树可解析。
- `pnpm build`：通过，Nuxt 4.4.6 / Nitro 2.13.4 / Vite 7.3.3 / Vue 3.5.34 生产构建成功。
- `pnpm rbac:verify-routes`：通过，29 个后台 API 文件、24 个数据库受保护路由，未发现未匹配或过期权限。
- 浏览器烟测：访问 `http://127.0.0.1:3000` 自动进入 `/login`，登录页标题、验证码、表单正常渲染，控制台未发现 error/warn。

## 风险与验证

- `vue-router` 已从 `4.6.4` 升级到 `5.0.7`。Nuxt 4.4.6 自身依赖 `vue-router@^5.0.7`，当前构建与登录页烟测已通过。
- 构建输出存在第三方 sourcemap warning，包括 `nuxt:module-preload-polyfill`、`@tailwindcss/vite:generate:build` 与 `@vueuse/core` 的 PURE 注释提示。当前均为构建 warning，未阻断产物生成。
- pnpm 10 提示部分依赖 build scripts 被忽略，包括 `@parcel/watcher`、`esbuild`、`vue-demi` 等。这属于 pnpm 安全策略提示，当前 `nuxt prepare` 与生产构建已通过；如后续本机原生 watcher 或 esbuild 行为异常，可再执行 `pnpm approve-builds` 做本机策略确认。

## 结论

依赖已升级到当前 npm registry 最新版本，现有 admin 内核的生产构建、RBAC 路由映射与登录页基础渲染验证通过。暂未发现需要修改业务代码的兼容问题。
