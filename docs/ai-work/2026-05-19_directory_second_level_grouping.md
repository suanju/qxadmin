# 2026-05-19 目录二级归类整理记录

日期：2026-05-19

目的：按功能相近原则整理当前仓库平铺文件，减少 admin 内核继续扩展时的目录噪音。

涉及范围：`app/components/admin/**`、`app/composables/**`、`server/db/schema/**`、`scripts/**`、`package.json`、`AGENTS.md`、少量规范类文档。

是否影响后台核心链路：不改变后台登录、RBAC 权限码、API URL、页面路由、数据库表名或 migration；影响源码文件路径与脚本入口路径。

## 调整内容

- 表格公共组件归入 `app/components/admin/table/**`，保留 `AdminTableBulkBar`、`AdminTablePaginationBar`、`AdminTableSearch` 自动组件名。
- admin 组合式函数归入 `app/composables/admin/**`，继续通过 Nuxt 自动导入暴露 `useAdminAuth`、`useAdminFetch` 等函数。
- 新增 `app/composables/admin.ts` 作为聚合出口，避免组合式函数下沉后自动导入入口不稳定。
- Drizzle schema 按领域归入 `server/db/schema/admin|rbac|system|files|demo/**`，仍由 `server/db/schema/index.ts` 统一导出。
- 脚本按用途归入 `scripts/rbac/**`、`scripts/db/**`、`scripts/logs/**`、`scripts/deployment/**`、`scripts/seeds/**`。
- 更新 `package.json` 脚本入口，修正下沉脚本内的相对路径。

## 风险与验证

- 风险：Nuxt 自动组件名或 composable 自动导入因文件下沉变化失效。
- 风险：Drizzle schema 二级目录后相对导入错误。
- 风险：脚本移动后二级目录下的项目根路径计算错误。

验证结果：

- `npm run postinstall`：通过，自动生成组件与 imports 类型。
- `npm run rbac:sync -- --dry-run`：通过，权限声明可读取。
- `npm run logs:summary`：通过，日志脚本可定位项目根目录。
- `npm run ecosystem:generate`：通过，部署脚本可生成 `.output/ecosystem.config.js`。
- `npm run build`：通过，Nuxt/Nitro 生产构建成功。
