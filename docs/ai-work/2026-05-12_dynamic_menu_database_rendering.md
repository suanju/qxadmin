# 2026-05-12 动态菜单数据库渲染改造记录

## 日期

2026-05-12

## 目的

参考 `xin-admin-laravel` 的菜单与权限规则，将当前后台导航、页面权限解析和角色授权分组从前端静态常量优先，调整为以数据库 `admin_permission` 权限目录为主。

## 涉及范围

- `shared/constants/admin_permissions.ts`
- `server/services/auth/admin_permission_catalog.ts`
- `server/services/auth/admin_permission.ts`
- `server/services/auth/admin_account.ts`
- `server/api/admin/auth/me.get.ts`
- `server/api/admin/auth/permissions.get.ts`
- `server/middleware/admin_auth.ts`
- `app/composables/use_admin_auth.ts`
- `app/middleware/auth.global.ts`
- `app/layouts/default.vue`

## 是否影响后台核心链路

影响后台登录后的菜单渲染、页面级权限判断、角色权限授权树与 RBAC 数据库 matcher 兜底逻辑。

安全边界仍在 `server/middleware/admin_auth.ts`，前端菜单隐藏只作为体验层；接口权限继续由静态/数据库 RBAC 源控制。

## 参考规则

- `xin-admin-laravel` 前端通过登录态权限与菜单接口驱动导航，不把菜单结构硬编码在布局组件中。
- 菜单节点按树形结构组织，核心字段包括节点类型、父级、标识、名称、路径、图标、排序、显示状态。
- 当前仓库对应字段已存在于 `admin_permission` 表，因此本次复用现有 Drizzle schema 与 `server/rbac/modules/admin_core.json` 声明源。

## 实施摘要

- `shared/constants/admin_permissions.ts` 新增数据库权限树到导航、页面权限映射、角色授权分组的转换函数。
- `/api/admin/auth/me` 返回 `permissionCatalog`，前端 `useAdminAuth` 以该目录生成 `navGroups`、`navItems`、`permissionGroups`。
- `/api/admin/auth/permissions` 返回数据库生成的权限分组、导航分组、页面权限映射和权限 code 列表。
- 角色保存时改为使用数据库权限 code 校验，并写入 `permission_id`。
- 页面路由中间件改为在刷新当前管理员信息后，根据接口返回的动态导航目录解析页面权限。
- 数据库 RBAC source 为 `database` 时，登录态接口保留静态白名单，其余接口优先使用数据库 matcher。

## 风险与验证

- 风险：数据库权限目录滞后时，菜单可能指向旧页面路径。
- 处理：执行 `npm run rbac:sync`，将 `demo_users.read` 从旧 `/users` 同步为 `/user_management/demo_users`。
- 验证：
  - `npm run build`
  - `npm run rbac:verify-db`
  - `npm run rbac:verify-routes -- --no-db`
  - `npm run rbac:verify-routes`
  - 浏览器打开 `/dashboard`，确认左侧菜单来自数据库目录并指向 `/user_management/demo_users`
  - 浏览器打开 `/admin_accounts`，确认管理员与角色页面正常加载
  - 浏览器请求 `/api/admin/auth/permissions`，确认返回动态 `navGroups` 与 `groups`

