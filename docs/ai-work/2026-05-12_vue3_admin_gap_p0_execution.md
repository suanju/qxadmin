# Vue 3 Admin 差距方案 P0 执行记录

日期：2026-05-12

目的：开始落地 `docs/audits/2026-05-12_vue3_admin_framework_gap_analysis.md` 中的 P0 稳定基线与边界确认任务。

涉及范围：接口文档、RBAC 运行模式说明、新增后台 API 自检项、验证命令。

是否影响后台核心链路：不影响。本次只更新文档，不修改登录、RBAC 中间件、数据库 schema、service 或页面代码。

## 本次完成

- 明确当前项目继续保持 `app/ + server/ + shared/` 同仓分层，不迁移到其他 admin 框架技术栈。
- 补齐 `docs/api/README.md` 的后台 API 说明框架。
- 梳理当前 `/api/admin/**` 鉴权边界、登录态接口、RBAC 运行模式与环境建议。
- 将“新增后台 API 必须进入静态权限映射或数据库 API 权限声明”写入自检项。
- 根据当前 `server/api/admin/**` 文件扫描结果整理当前后台 API 清单。

## 当前 RBAC 基线

当前 RBAC 运行入口仍是 `server/middleware/admin_auth.ts`：

- `ADMIN_RBAC_SOURCE=static`：使用 `server/constants/admin_permission_routes.ts`。
- `ADMIN_RBAC_SOURCE=hybrid`：同时比较静态映射和数据库 matcher，记录不一致日志。
- `ADMIN_RBAC_SOURCE=database`：使用数据库 `admin_permission` 中 `type=api` 的 matcher。
- `ADMIN_RBAC_ENFORCE=true`：普通管理员无权限或接口未映射时返回 `403`。

当前阶段推荐生产切换数据库主路径前，先使用 `hybrid + true` 做一致性观察。

## 风险与验证

本次没有改动运行时代码，主要风险是文档与真实接口不一致。

已通过以下方式降低风险：

- 用 `scripts/lib/admin_api_route_scanner.mjs` 扫描当前后台 API 文件，基于扫描结果整理接口清单。
- 对照 `server/middleware/admin_auth.ts`、`server/constants/admin_permission_routes.ts`、`server/services/auth/admin_permission_catalog.ts` 写入 RBAC 模式说明。

待执行验证：

```bash
npm run rbac:verify-routes
npm run build
```

## 后续建议

- P1 继续推进数据库权限目录主路径闭环，补齐 `rbac:sync`、`rbac:verify-db`、`rbac:verify-routes` 作为上线门槛。
- P2 再拆分后台布局与统一列表基础件，避免在 RBAC 基线未验证前扩大页面改动面。
