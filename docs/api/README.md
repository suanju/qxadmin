# 后台 API 文档

日期：2026-05-12

目的：记录当前 admin 内核后台 API 的目录边界、鉴权边界、RBAC 接入方式、通用响应约定和新增接口自检项，作为后续补全接口契约与生成器的基础。

涉及范围：`server/api/admin/**`、`server/middleware/admin_auth.ts`、`server/rbac/modules/*.json`、`shared/constants/admin_permissions.ts`。

是否影响后台核心链路：本文档仅描述当前接口契约与自检门槛，不修改登录、RBAC、数据库或页面代码。

## 当前边界

当前项目保持 Nuxt 4 同仓分层结构：

- 前端页面与组合式函数位于 `app/**`。
- 后台 JSON API 位于 `server/api/admin/**`。
- 服务层编排位于 `server/services/**`。
- 鉴权、密码、token、验证码等底层能力位于 `server/lib/**`。
- 前后端共享权限类型与数据库权限树转换工具位于 `shared/constants/admin_permissions.ts`。

当前项目不迁移到 Go、PHP、Laravel、Midway、Element Plus 或 `src/server/api/**` 目录模板。后续接口契约化应基于现有 `app/ + server/ + shared/` 结构推进。

## 通用约定

后台 API 前缀统一为：

```text
/api/admin
```

后台 API 路由文件遵循 Nitro 文件路由：

```text
server/api/admin/<resource>/index.get.ts
server/api/admin/<resource>/index.post.ts
server/api/admin/<resource>/[id].put.ts
server/api/admin/<resource>/[id].delete.ts
```

页面层不直接访问数据库，所有页面数据应来自 `server/api/admin/**`。

复杂业务逻辑优先收敛到 `server/services/**`，API 路由层只负责：

- 解析 `query`、`body`、`params`
- 调用 service
- 返回 JSON
- 抛出明确的 HTTP 错误

## 鉴权边界

后台接口统一经过 `server/middleware/admin_auth.ts`。

无需登录即可访问的接口仅限登录态建立与登录态自查相关接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/auth/captcha` | 后台登录验证码 |
| `POST` | `/api/admin/auth/login` | 后台登录 |
| `GET` | `/api/admin/auth/me` | 当前管理员信息 |
| `PUT` | `/api/admin/auth/password` | 当前管理员修改密码 |
| `GET` | `/api/admin/auth/permissions` | 当前权限目录 |

注意：除验证码和登录外，其余 auth 接口仍依赖有效 `admin_auth` cookie 才能返回当前管理员上下文或执行当前账号操作。路由扫描脚本会把这些接口视为公共权限映射例外，但运行时仍由中间件校验登录态。

其他 `/api/admin/**` 接口默认必须满足：

- `admin_auth` cookie 存在且 JWT 有效
- 管理员账号启用
- `token_version` 与数据库一致
- RBAC 映射存在
- 非超级管理员具备匹配权限

## RBAC 运行模式

当前 RBAC 运行时只使用数据库权限目录：

- 菜单、页面权限、角色授权树来自 `admin_permission` 表中的目录、菜单、页面和按钮节点。
- API 权限拦截来自 `admin_permission` 表中 `type=api` 的 matcher。
- `server/constants/admin_permission_routes.ts` 静态映射已移除，不再作为运行时兜底。
- 数据库权限目录为空或读取失败时，权限目录接口会返回 500，需要先执行 `npm run rbac:sync` 并检查数据库连接。

`ADMIN_RBAC_ENFORCE` 控制是否严格拦截：

| 值 | 行为 |
| --- | --- |
| `true` | 普通管理员访问未授权或未映射接口时返回 `403` |
| 其他值 | 观察模式，仅记录日志，不对普通管理员强制返回 `403` |

建议环境配置：

| 环境 | 建议配置 | 原因 |
| --- | --- | --- |
| 开发 | `ADMIN_RBAC_ENFORCE=false` | 便于开发时发现缺失数据库 matcher，同时避免频繁阻断调试 |
| 预生产 | `ADMIN_RBAC_ENFORCE=true` | 提前暴露缺失授权和缺失数据库 matcher |
| 生产 | `ADMIN_RBAC_ENFORCE=true` | 严格保护后台 API |

## 当前接口清单

以下清单由 `scripts/lib/admin_api_route_scanner.mjs` 扫描当前 `server/api/admin/**` 文件得到。

| 方法 | 路径 | 鉴权类别 | 权限说明 |
| --- | --- | --- | --- |
| `GET` | `/api/admin/auth/captcha` | 登录前 | 后台登录验证码 |
| `POST` | `/api/admin/auth/login` | 登录前 | 后台登录 |
| `GET` | `/api/admin/auth/me` | 登录态 | 当前管理员信息 |
| `PUT` | `/api/admin/auth/password` | 登录态 | 当前管理员修改密码 |
| `GET` | `/api/admin/auth/permissions` | 登录态 | 权限目录 |
| `GET` | `/api/admin/dashboard/stats` | RBAC | `dashboard.read` |
| `GET` | `/api/admin/config` | RBAC | `settings.read` |
| `POST` | `/api/admin/config` | RBAC | `settings.create` |
| `PUT` | `/api/admin/config/:id` | RBAC | `settings.update` |
| `DELETE` | `/api/admin/config/:id` | RBAC | `settings.delete` |
| `GET` | `/api/admin/operation_logs` | RBAC | `operation_logs.read` |
| `GET` | `/api/admin/operation_logs/:id` | RBAC | `operation_logs.read` |
| `GET` | `/api/admin/files` | RBAC | `files.read` |
| `DELETE` | `/api/admin/files/:id` | RBAC | `files.manage` |
| `POST` | `/api/admin/upload` | RBAC | `upload.create` |
| `GET` | `/api/admin/demo_users` | RBAC | `demo_users.read` |
| `POST` | `/api/admin/demo_users` | RBAC | `demo_users.manage` |
| `POST` | `/api/admin/demo_users/batch` | RBAC | `demo_users.manage` |
| `PUT` | `/api/admin/demo_users/:id` | RBAC | `demo_users.manage` |
| `DELETE` | `/api/admin/demo_users/:id` | RBAC | `demo_users.manage` |
| `GET` | `/api/admin/admin_users` | RBAC | `admin_accounts.read` |
| `POST` | `/api/admin/admin_users` | RBAC | `admin_accounts.manage` |
| `PUT` | `/api/admin/admin_users/:id` | RBAC | `admin_accounts.manage` |
| `DELETE` | `/api/admin/admin_users/:id` | RBAC | `admin_accounts.manage` |
| `PUT` | `/api/admin/admin_users/:id/password` | RBAC | `admin_accounts.manage` |
| `GET` | `/api/admin/admin_roles` | RBAC | `admin_accounts.read` |
| `POST` | `/api/admin/admin_roles` | RBAC | `admin_accounts.manage` |
| `PUT` | `/api/admin/admin_roles/:id` | RBAC | `admin_accounts.manage` |
| `DELETE` | `/api/admin/admin_roles/:id` | RBAC | `admin_accounts.manage` |

## 响应与错误

当前项目主要使用以下返回方式：

- admin API 直接返回 service 结果。
- 错误通过 `createError(...)` 抛出 HTTP 状态码。

后续契约化时应逐步补齐每个接口的：

- 请求参数
- 响应字段
- 分页格式
- 错误码与错误消息
- 是否写入操作日志
- 所需权限码

在统一响应格式前，不应为了文档一致性直接大规模改动现有 API 返回结构。

## 新增后台 API 自检项

新增或调整 `server/api/admin/**` 接口时，必须同时检查以下事项：

1. API 路由是否位于 `server/api/admin/**`，并符合 Nitro 文件命名。
2. 复杂逻辑是否放入 `server/services/**`，而不是堆在 API 文件里。
3. 页面是否通过 `useAdminFetch`、`useFetch` 或封装 composable 调用接口，而不是直接访问数据库。
4. 数据库权限声明是否补入 `server/rbac/modules/*.json` 的 `type=api` 节点。
5. 菜单、页面或按钮权限是否补入 `server/rbac/modules/*.json` 并可同步到数据库。
6. 新权限 code 是否能通过 `npm run rbac:sync` 写入 `admin_permission`。
7. 高风险写操作是否有明确权限码，不复用只读权限。
8. 管理员、角色、权限、系统设置、上传、文件删除等写操作是否记录操作日志。
9. 如果接口改变数据库结构，是否同步 Drizzle schema 与新 migration。
10. 是否运行并通过必要验证命令。

必要验证命令：

```bash
npm run rbac:verify-routes
npm run build
```

如果改动了数据库权限目录或计划切换数据库 matcher，还需运行：

```bash
npm run rbac:sync
npm run rbac:verify-db
```

如果改动了数据库 schema，还需运行：

```bash
npm run db:generate
```

## 后续补齐方向

本文件当前先作为 P0 阶段的接口说明框架。后续 P1-P3 应继续补齐：

- 自动扫描 `server/api/admin/**` 生成接口清单。
- 从 service/API 类型提取 DTO 到 `shared/**` 或 `app/types/**`。
- 为分页、筛选、排序、批量操作建立统一契约。
- 输出每个模块的独立 API 文档，例如 `docs/api/admin_accounts.md`、`docs/api/files.md`。
- 为 CRUD 生成器提供接口文档模板。
