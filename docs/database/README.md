# 数据库文档

用于存放表结构、迁移说明、数据修复、Drizzle 使用说明。

当前仓库运行时只保留 admin 内核所需表：

- `config`
- `admin_user`
- `admin_role`
- `admin_user_role`
- `admin_role_permission`
- `admin_permission`
- `admin_permission_sync_log`
- `admin_role_data_scope`
- `admin_operation_log`
- `admin_file_group`
- `admin_file`

当前本地默认数据库为 `qxadmin`，连接信息来自 `.env.development`。

首次初始化执行 `pnpm db:init`，动态权限同步执行 `pnpm rbac:sync`。

## 文档索引

- [`2026-05-10_qxadmin_db_init.md`](2026-05-10_qxadmin_db_init.md)：`qxadmin` 本地数据库初始化与验证记录。
- [`2026-05-10_dynamic_rbac_baseline.md`](2026-05-10_dynamic_rbac_baseline.md)：Task 07 动态 RBAC 数据库模型与权限迁移基线记录。
