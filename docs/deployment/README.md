# 部署文档

当前仓库是新的通用 admin 后台内核。部署时只需要关注后台登录、RBAC、账号角色、系统设置、操作日志、文件管理和上传能力。

## 运行前提

- Node.js >= 20
- MySQL 可连接
- 已安装依赖并可执行 `nuxt`

## 当前环境变量

最小必需变量：

- `NUXT_ADMIN_AUTH_SECRET`
- `NUXT_API_URL`
- `TABLE_PREFIX`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

推荐变量：

- `ADMIN_AUTH_COOKIE_SECURE`
- `ADMIN_RBAC_ENFORCE`
- `ADMIN_STRICT_ROLE_MODE`
- `LOG_LEVEL`
- `LOG_DIR`
- `LOG_MAX_FILE_SIZE_MB`
- `LOG_RETENTION_DAYS`
- `LOG_ARCHIVE_AFTER_DAYS`

日志管理说明见 [`../operations/2026-05-10_log_management.md`](../operations/2026-05-10_log_management.md)。

## 部署前检查

1. `npm install`
2. `npm run rbac:sync`
3. `npm run rbac:verify-routes`
4. `npm run rbac:verify-db`
5. `npm run build`

全新本地库初始化执行：

1. `npm run db:init`
2. `npm run rbac:sync`
3. `npm run rbac:precheck-db`

## 部署后验收

- `/login`
- `/dashboard`
- `/settings`
- `/operation_logs`
- `/admin_accounts`
- `/files`
- `/api/admin/auth/me`
- `/api/admin/dashboard/stats`
- `/api/admin/config`
- `/api/admin/operation_logs`
- `/api/admin/admin_users`
- `/api/admin/admin_roles`
- `/api/admin/files`
