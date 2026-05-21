# 2026-05-10 qxadmin 数据库初始化记录

> 日期：2026-05-10  
> 目的：将本地数据库从历史 `traffic_backend` 规范为 `qxadmin`，并提供可重复执行的 admin 内核初始化流程。  
> 涉及范围：`.env.development`、`.env.production`、`scripts/db/init_admin_core.mjs`、`server/db/migrations/**`、`package.json`。
> 是否影响后台核心链路：影响。该流程直接支撑后台登录、RBAC、账号角色、设置、日志和 Dashboard 查询。

## 当前连接

- 数据库：`qxadmin`
- 主机：`127.0.0.1`
- 端口：`3306`
- 用户：`root`
- 密码：`root`
- 表前缀：`ta_`

## 初始化命令

```bash
pnpm db:init
```

脚本会执行：

- 创建 `qxadmin` 数据库。
- 创建 `ta_config`、`ta_admin_user`、`ta_admin_role`、`ta_admin_user_role`、`ta_admin_role_permission`、`ta_admin_operation_log`。
- 写入系统角色 `super_admin`、`system_admin`、`auditor`。
- 本地开发环境创建默认超级管理员 `admin / admin123456`。

## 风险与验证

- 生产环境不应直接使用开发默认密码，首次初始化时应通过系统环境临时传入 `ADMIN_INIT_PASSWORD`，初始化后立即修改。
- `ADMIN_INIT_FORCE_RESET=true` 会重置同名管理员密码并使旧 token 失效，只应在明确需要时使用。
- 初始化后至少执行 `pnpm rbac:precheck-db` 和 `pnpm build`。
