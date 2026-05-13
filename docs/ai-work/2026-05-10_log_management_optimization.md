# 日志管理优化执行记录

日期：2026-05-10

目的：确认当前日志是否具备日志分割能力，并补齐日志管理、轮转、清理、归档和运维说明。

涉及范围：

- `server/plugins/logger.ts`
- `server/utils/log/logger_file_reporter.ts`
- `scripts/manage_logs.mjs`
- `scripts/generate_ecosystem.mjs`
- `package.json`
- `.env.development`
- `.env.production`
- `docs/operations/**`
- `docs/README.md`

是否影响后台核心链路：不直接影响。未改动登录、RBAC、管理员账号、角色、设置、操作日志、上传 API 或数据库 schema。运行时日志写入和清理失败不会中断主请求。

## 当前已有能力

优化前已经具备：

- `consola` 日志级别配置。
- 文件 reporter。
- 按标签拆分文件。
- 按月份目录。
- 按日期文件名分割。

示例：

- `logs/202605/api-2026-05-10.log`
- `logs/202605/service-2026-05-10.log`

## 本次优化

- 新增运行时单文件大小轮转：`LOG_MAX_FILE_SIZE_MB`。
- 新增运行时历史日志保留期清理：`LOG_RETENTION_DAYS`。
- 新增日志维护脚本 `scripts/manage_logs.mjs`：
  - `summary`
  - `cleanup`
  - `archive`
  - `--dry-run`
  - `--dir`
  - `--days`
  - `--archive-days`
  - `--delete-source`
- 新增 npm scripts：
  - `logs:summary`
  - `logs:cleanup`
  - `logs:archive`
- 更新 PM2 ecosystem 生成：
  - `out_file`
  - `error_file`
  - `merge_logs`
  - `time`
- 补充运维文档：`docs/operations/2026-05-10_log_management.md`。

## 风险与验证

风险：

- 运行时自动清理依赖 `LOG_DIR` 配置，配置错误可能导致清理不到预期目录。本次实现加入根目录安全保护，避免对磁盘根目录执行清理。
- gzip 归档由运维脚本执行，不在服务启动时自动压缩，避免启动阶段阻塞。

验证项：

- `pnpm logs:summary`
- `pnpm logs:cleanup -- --dry-run --days 30`
- `pnpm logs:archive -- --dry-run --archive-days 7`
- `pnpm ecosystem:generate`
- `pnpm rbac:verify-routes`
- `pnpm build`
