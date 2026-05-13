# 移除 RBAC 静态兜底

日期：2026-05-12

目的：移除上一版本为动态 RBAC 迁移保留的静态菜单、静态 API 权限映射和 `ADMIN_RBAC_SOURCE` 双轨运行模式，让数据库权限目录成为唯一运行来源。

涉及范围：`shared/constants/admin_permissions.ts`、`app/composables/use_admin_auth.ts`、`server/middleware/admin_auth.ts`、`server/services/auth/admin_permission*.ts`、`scripts/verify_admin_rbac_routes.mjs`、环境变量与接口文档。

是否影响后台核心链路：影响。后台登录后的菜单渲染、角色授权树、超级管理员权限补全和 API RBAC matcher 均依赖 `admin_permission` 表。

## 修改内容

- 删除 `shared/constants/admin_permissions.ts` 中的静态菜单、静态权限分组、静态页面权限和 `ADMIN_STATIC_PERMISSION_CATALOG`。
- 前端 `use_admin_auth` 初始状态改为空权限目录，只使用 `/api/admin/auth/me` 返回的数据库权限目录。
- 服务端权限目录读取失败或为空时不再静态兜底，改为返回 500 并提示检查数据库权限目录。
- `server/middleware/admin_auth.ts` 移除 `ADMIN_RBAC_SOURCE=static|hybrid|database` 分支，只使用数据库 `type=api` matcher。
- 删除 `server/constants/admin_permission_routes.ts` 静态 API 权限映射文件。
- `scripts/verify_admin_rbac_routes.mjs` 改为只验证数据库 matcher 覆盖受保护后台 API。
- `.env.development` 与 `.env.production` 移除 `ADMIN_RBAC_SOURCE`。
- `docs/api/README.md` 更新为数据库 RBAC 唯一来源说明。

## 风险与验证

- 风险：如果未执行 `npm run rbac:sync` 或数据库 `admin_permission` 表为空，登录后权限目录会不可用。
- 风险：新增后台 API 若只写页面和接口、不补 `server/rbac/modules/*.json`，严格模式下会返回 403。
- 验证：执行 `npm run rbac:sync`、`npm run rbac:verify-routes`、`npm run build`。
