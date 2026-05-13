# qxadmin

`qxadmin` 是一个通用 admin 后台内核，聚焦后台登录、RBAC 权限、管理员与角色、系统设置、操作日志、文件上传与基础 Dashboard。

## 文档入口

- 仓库级 AI 工作规范：[`AGENTS.md`](AGENTS.md)
- 项目文档总索引：[`docs/README.md`](docs/README.md)

## 当前范围

- 后台登录与鉴权
- 管理员账户与角色授权
- RBAC 权限字典与路由保护
- 系统设置、资源上传与文件管理
- 操作日志与后台概览

## 本地启动

1. 安装依赖：`pnpm install`
2. 初始化数据库：`pnpm db:init`
3. 同步动态权限：`pnpm rbac:sync`
4. 启动开发服务：`pnpm dev`

默认开发库为 `qxadmin`，MySQL 账号为 `root`，密码为 `root`。初始化脚本会创建 admin 内核表，并创建本地默认账号 `admin / admin123456`。

## 根目录约定

根目录只保留项目入口型文档，部署文档、AI 工作过程、审计报告、接口说明、数据库说明等统一放入 `docs/**` 并按类型分类维护。
