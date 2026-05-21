# 日志管理说明

日期：2026-05-10

目的：说明当前服务端日志分割、轮转、保留期清理、归档压缩和排障查看方式。

涉及范围：服务端 consola 文件日志、API 请求日志、PM2 标准输出日志、日志维护脚本。

是否影响后台核心链路：不直接影响登录、RBAC、管理员账号、角色、设置、操作日志或上传 API。日志文件写入失败不会中断主请求。

## 当前日志能力

运行时文件日志：

- 使用 `consola` + `server/utils/log/logger_file_reporter.ts` 写入文件。
- 按标签拆分：`api`、`service`、`db`、`thirdparty`、`callback`、`app`。
- 按月份目录：`logs/YYYYMM/`。
- 按日期文件：如 `logs/202605/api-2026-05-10.log`。
- 按大小轮转：单文件超过 `LOG_MAX_FILE_SIZE_MB` 后重命名为带时间戳的历史文件，再继续写新文件。
- 按保留天数清理：服务启动时执行一次，删除超过 `LOG_RETENTION_DAYS` 的 `.log` / `.gz` 文件。

PM2 标准输出日志：

- `scripts/deployment/generate_ecosystem.mjs` 会在 `.output/ecosystem.config.js` 中生成：
  - `logs/pm2-out.log`
  - `logs/pm2-error.log`
- 业务 API 日志仍以项目自己的 `logs/YYYYMM/*.log` 为主。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LOG_LEVEL` | development 为 `debug`，production 为 `info` | consola 日志级别 |
| `LOG_DIR` | `logs` | 日志根目录 |
| `LOG_MAX_FILE_SIZE_MB` | `50` | 单个日志文件超过该大小时轮转 |
| `LOG_RETENTION_DAYS` | `30` | 运行时自动清理超过该天数的日志；`0` 表示关闭自动清理 |
| `LOG_ARCHIVE_AFTER_DAYS` | `7` | 运维脚本归档压缩时的默认天数 |

## 常用命令

查看日志目录概况：

```bash
pnpm logs:summary
```

预览清理 30 天前日志：

```bash
pnpm logs:cleanup -- --dry-run --days 30
```

实际清理 30 天前日志：

```bash
pnpm logs:cleanup -- --days 30
```

预览压缩 7 天前 `.log` 文件：

```bash
pnpm logs:archive -- --dry-run --archive-days 7
```

压缩 7 天前 `.log` 文件，并删除原始 `.log`：

```bash
pnpm logs:archive -- --archive-days 7 --delete-source
```

指定日志目录：

```bash
pnpm logs:summary -- --dir /data/qxadmin/logs
```

## 排障建议

- 查后台 API 请求与响应：优先看 `logs/YYYYMM/api-YYYY-MM-DD.log`。
- 查 service 层异常：优先看 `logs/YYYYMM/service-YYYY-MM-DD.log`。
- 查第三方接口：优先看 `logs/YYYYMM/thirdparty-YYYY-MM-DD.log`。
- 查 PM2 进程级 stdout/stderr：看 `logs/pm2-out.log` 和 `logs/pm2-error.log`。
- 生产环境建议把 `LOG_DIR` 指向持久化磁盘目录，不要放在临时目录。
- 大流量环境建议由 crontab 每天执行一次 `pnpm logs:archive -- --archive-days 7 --delete-source`，并定期执行 `pnpm logs:cleanup -- --days 30`。
