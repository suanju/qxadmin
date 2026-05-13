# 2026-05-10 Node DEP0155 Warning 处理记录

日期：2026-05-10

目的：处理 `npm run build` 过程中出现的 Node `DEP0155` deprecation warning，保证项目构建与常用脚本输出不再出现该 warning。

涉及范围：

- `package.json`
- Nuxt/Nitro 构建脚本
- RBAC 校验与 ecosystem 生成脚本

是否影响后台核心链路：不影响。未改动登录、RBAC 中间件、管理员账号、角色、设置、操作日志、上传 API 或数据库 schema。

## 问题定位

`npm run build` 在 Nitro server 构建完成后输出：

- `DEP0155 DeprecationWarning`
- 来源为 Nitro 解析依赖包导出路径时触发的 Node deprecation warning
- trace 指向 `exsolve` 的 package exports 解析逻辑
- 触发链路包含 `@nuxt/icon -> @iconify/utils` 与 `@nuxt/nitro-server -> @vue/shared`

该 warning 来自依赖包导出映射与 Node 当前解析器的 deprecation 提示，不是业务代码 warning。

## 处理方式

将项目脚本中直接走 Nuxt CLI 或 Node 的入口统一改为显式：

```bash
node --no-deprecation ...
```

这样只关闭 Node deprecation warning，不关闭普通 warning、错误或构建失败输出。

同时将 Drizzle CLI 脚本改为显式通过 `node --no-deprecation node_modules/drizzle-kit/bin.cjs` 启动，保持项目脚本入口一致。

## 验证

- `npm run build` 通过。
- 已扫描 `npm run build` 的 stdout/stderr，未匹配到 `warning`、`DeprecationWarning` 或 `DEP0155`。
- `npm run rbac:verify-routes` 通过，且未匹配到 warning。
- `npm run ecosystem:generate` 通过，且未匹配到 warning。
- `node --no-deprecation node_modules/drizzle-kit/bin.cjs --help` 通过，且未匹配到 warning。
