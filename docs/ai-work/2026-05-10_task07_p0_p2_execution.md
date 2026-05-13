# Task 07 P0-P2 执行记录

日期：2026-05-10

目的：开始执行 `docs/ai-work/agent_task/07_nuxt_fullstack_admin_framework_tasks.md`，完成动态 RBAC 的基线冻结、数据库模型、同步脚本首批落地，并启动数据库 matcher 运行时接入。

涉及范围：动态权限 schema、migration、权限声明、同步脚本、校验脚本、数据库 matcher 服务、后台鉴权中间件、任务清单、数据库基线文档。

是否影响后台核心链路：影响。新增动态权限表并同步首批权限数据；中间件新增 `ADMIN_RBAC_SOURCE=static|database|hybrid`，默认仍为 `static`。

## 已完成

### P0 基线冻结

- 已执行 `npm run build`，构建通过。
- 已执行 `npm run rbac:verify-routes`，22 个后台 API 路由文件全部匹配，未知权限为 0。
- 已执行 `npm run rbac:precheck-db`，旧 RBAC 核心表存在。
- 已新增 `docs/database/2026-05-10_dynamic_rbac_baseline.md`，记录数据库、权限常量、API 映射和默认角色授权基线。
- 已启动本地 dev server：`http://127.0.0.1:3000`。
- 已用浏览器打开 `/login`，登录页可渲染。
- 未登录访问 `/dashboard` 会重定向到 `/login`，前端路由守卫生效。
- 已用 HTTP 检查：
  - `GET /api/admin/auth/captcha` 返回 200。
  - `GET /api/admin/auth/me` 未登录返回 401。
  - `GET /api/admin/auth/permissions` 未登录返回 401。

### P1 动态权限数据库模型

- 新增 `server/db/schema/admin_permission.ts`。
- 新增 `adminPermission`，支持 `catalog/menu/page/button/api`。
- 新增 `adminPermissionSyncLog`。
- 新增 `adminRoleDataScope`，预留数据权限。
- 扩展 `adminRolePermission.permission_id`，保留 `permission_code`。
- 新增 `server/db/migrations/0002_dynamic_admin_permissions.sql`。
- 更新 `server/db/schema/index.ts`。

### P2 同步器与校验脚本

- 新增 `server/rbac/modules/admin_core.json`，声明现有 admin 内核权限树。
- 新增 `scripts/lib/admin_api_route_scanner.mjs`，扫描 `server/api/admin/**` 并转换 Nitro 文件路由为 `/api/admin/**` pattern。
- 新增 `scripts/sync_admin_rbac_permissions.mjs`。
- 新增 `scripts/verify_admin_rbac_db.mjs`。
- 增强 `scripts/verify_admin_rbac_routes.mjs`：
  - 保留静态 `server/constants/admin_permission_routes.ts` 校验。
  - 新增数据库 `admin_permission(type=api)` 覆盖真实后台 API 校验。
  - 新增 stale API 权限提示。
  - 复用后台公开/登录态接口 allowlist。
- `scripts/verify_admin_rbac_db.mjs` 新增 API 权限码规则校验：`type=api` 必须使用 `api.*`，非 API 权限不能使用 `api.*`。
- 更新 `package.json`：
  - `rbac:sync`
  - `rbac:verify-db`
- 已执行 `npm run rbac:sync`，同步 22 条动态权限到数据库。
- 已执行 `npm run rbac:verify-db`，声明与数据库校验通过。
- 已执行 `npm run rbac:verify-routes`：
  - 后台 API 路由文件：22。
  - 静态未匹配路由：0。
  - 静态未知权限：0。
  - 数据库需业务权限路由：17。
  - 数据库未匹配路由：0。
  - 数据库 stale API 权限：0。

### P3 数据库 matcher 运行时接入（首批）

- 新增 `server/services/auth/admin_permission_catalog.ts`：
  - `getPermissionTree()`
  - `getApiMatchers()`
  - `matchAdminApiPermission()`
  - `getRolePermissionCodes()`
- 动态权限目录增加进程内短缓存，缓存权限树与 API matcher。
- 数据库 API matcher 支持 `exact`、`prefix`、`pattern`、`regex`。
- API 节点会同时要求自身 `api.*` code 与父业务权限 code；现有角色仍可通过父业务权限匹配，避免旧授权失效。
- 改造 `server/middleware/admin_auth.ts`：
  - 新增 `ADMIN_RBAC_SOURCE=static|database|hybrid`。
  - `static`：默认路径，继续使用旧静态映射。
  - `database`：使用数据库 API matcher 做权限判断。
  - `hybrid`：同时计算静态映射与数据库 matcher，差异写日志但仍按静态映射响应。
  - 登录态但无业务权限要求的接口继续沿用静态空权限映射，避免 `database` 模式误拦 `/api/admin/auth/me` 等接口。
- 更新 `.env.development`、`.env.production`，默认 `ADMIN_RBAC_SOURCE=static`。
- 已做 `database` 强制模式运行时验证：
  - 临时创建无角色、无权限、非超级管理员账号并签发有效 cookie。
  - `ADMIN_RBAC_SOURCE=database`、`ADMIN_RBAC_ENFORCE=true` 下访问 `GET /api/admin/auth/me` 返回 200。
  - 同一账号访问 `GET /api/admin/config` 返回 403。
  - 验证后已删除临时账号。

## 当前限制

- `server/middleware/admin_auth.ts` 已支持数据库 matcher，但默认仍是 `static`，未正式切换为数据库主路径。
- 尚未实现用户权限缓存 `adminUserPermissionCache:{userId}:{tokenVersion}`。
- 权限目录、角色授权、用户角色变更后的缓存刷新入口尚未接入到所有写操作。
- 前端菜单仍来自静态权限常量。
- 登录后的 `/dashboard`、`/settings`、`/operation_logs`、`/admin_accounts` 页面未在本阶段做自动化登录验证；本阶段只验证了登录页、未登录重定向和未登录 API 行为。
- P4 及以后尚未执行。

## 风险与验证

风险：

- 现阶段是双轨准备期，数据库权限和静态权限需要保持同步。
- API 节点使用 `api.*` 唯一码；业务授权节点通过 `parentCode` 关联 API 节点，后续角色授权页面需要处理这种父子关系。
- `database` 模式已经具备未匹配 API 时按 `ADMIN_RBAC_ENFORCE=true` 返回 403 的能力，但生产正式切换前仍需补完角色授权页面、动态菜单和缓存刷新链路。

验证：

```bash
npm run build
npm run rbac:verify-routes
npm run rbac:sync
npm run rbac:verify-db
```

结果：

- 全部通过。`npm run build` 通过但有 Nuxt/Iconify 依赖的 `DEP0155` deprecation warning，不影响本次构建产物。
- 已额外验证 `database` 强制模式运行时行为：登录态接口不误拦，缺少业务权限的后台 API 返回 403。
