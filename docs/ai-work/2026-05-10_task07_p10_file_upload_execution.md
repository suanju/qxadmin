# Task 07 P10 文件上传与文件管理执行记录

日期：2026-05-10

目的：补齐当前上传能力只有本地写文件、无数据库记录、无后台检索入口的问题，把上传能力推进为可审计、可查询的 admin 内核文件管理基础能力。

涉及范围：`server/api/admin/upload`、文件管理 API、Drizzle schema、migration、RBAC 权限、左侧导航、文件管理页面、初始化与同步脚本。

是否影响后台核心链路：影响上传、RBAC、操作日志和系统设置中的文件/图片上传；未改动登录和管理员账号核心逻辑。

## 已完成

- 新增 `admin_file_group` 与 `admin_file` schema，并追加 `0003_admin_file_manager.sql`。
- 上传接口改为服务层实现，上传后记录原名、路径、mime、大小、hash、上传人、存储驱动和文件类型。
- 保留原上传返回中的 `path` 字段，兼容系统设置页已有图片/文件上传逻辑。
- 新增 `GET /api/admin/files` 文件列表接口，支持关键词与类型过滤。
- 新增 `DELETE /api/admin/files/:id` 文件记录软删除接口，并写入操作日志。
- 新增 `/files` 文件管理页面，支持左侧导航进入、上传、筛选、分页、打开文件和删除记录。
- 新增 `files.read`、`files.manage` 静态权限和数据库动态权限声明。
- 更新 `db:init` 和 `rbac:sync`，新环境会创建文件表，动态权限同步会覆盖文件管理权限。

## 风险与验证

- 当前删除为软删除数据库记录，不物理删除 `public/uploads` 文件，避免误删仍被配置项引用的资源。
- 分片上传与对象存储仅在 `meta_json` 和表字段中预留扩展点，尚未实现驱动适配。
- 未引用文件清理策略仍待补文档和定时任务。

已执行验证：

- `npm run rbac:sync`
- `npm run rbac:verify-routes`
- `npm run rbac:verify-db`
- `npm run build`
