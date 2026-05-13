# 2026-05-10 动态 RBAC 数据库基线记录

> 日期：2026-05-10  
> 目的：记录 Task 07 动态权限数据库模型落地前后的数据库、权限常量、API 映射和默认角色授权基线。  
> 涉及范围：`server/db/schema/**`、`server/db/migrations/**`、`shared/constants/admin_permissions.ts`、`server/rbac/modules/**`、`scripts/*rbac*`。  
> 是否影响后台核心链路：影响。该记录对应后台登录、RBAC、角色授权、动态菜单和 API 权限 matcher 的迁移起点。

## 当前核心表

原 admin 内核表：

- `ta_config`
- `ta_admin_operation_log`
- `ta_admin_user`
- `ta_admin_role`
- `ta_admin_user_role`
- `ta_admin_role_permission`

Task 07 P1 新增动态权限表：

- `ta_admin_permission`
- `ta_admin_permission_sync_log`
- `ta_admin_role_data_scope`

兼容变更：

- `ta_admin_role_permission.permission_code` 保留。
- `ta_admin_role_permission.permission_id` 新增，后续逐步迁移到动态权限 ID。

## 当前静态权限基线

来自 `shared/constants/admin_permissions.ts`：

- `dashboard.read`
- `settings.read`
- `settings.create`
- `settings.update`
- `settings.delete`
- `operation_logs.read`
- `upload.create`
- `admin_accounts.read`
- `admin_accounts.manage`

## 当前 API 映射基线

当前历史基线曾来自 `server/constants/admin_permission_routes.ts`；静态映射现已移除，运行时以数据库 `admin_permission(type=api)` matcher 为准：

- 登录、验证码、当前管理员信息、修改当前密码、权限字典：公开或登录态接口，无业务权限。
- Dashboard：`dashboard.read`
- 系统设置：`settings.read/create/update/delete`
- 操作日志：`operation_logs.read`
- 上传：`upload.create`
- 管理员与角色：`admin_accounts.read/manage`

## 默认角色授权基线

来自 `server/services/auth/admin_permission.ts`：

- `super_admin`：全部静态权限。
- `system_admin`：Dashboard、设置、日志、上传、管理员与角色全部核心权限。
- `auditor`：Dashboard、设置、日志、管理员与角色只读权限。

## 动态权限同步基线

来源文件：

- `server/rbac/modules/admin_core.json`

当前同步结果：

- 动态权限声明：22 条。
- 已同步到 `ta_admin_permission`：22 条。
- API 权限节点使用 `api.*` 唯一码，并通过 `parentCode` 挂到业务菜单/按钮权限下。

验证命令：

```bash
npm run build
npm run rbac:verify-routes
npm run rbac:sync
npm run rbac:verify-db
```

当前验证结果：

- `npm run build`：通过。
- `npm run rbac:verify-routes`：当前版本仅验证数据库 `admin_permission(type=api)` matcher 覆盖真实后台 API。
- `npm run rbac:sync`：通过，动态权限已同步。
- `npm run rbac:verify-db`：通过，声明与数据库均无错误。

## 迁移注意事项

- 运行时已新增 `server/services/auth/admin_permission_catalog.ts`。
- 当前安全边界以数据库 `admin_permission(type=api)` matcher 为主。
- `server/constants/admin_permission_routes.ts` 静态映射和 `ADMIN_RBAC_SOURCE` 双轨模式已移除。
- 必须保持 `rbac:sync`、`rbac:verify-db` 和 `rbac:verify-routes` 通过。
