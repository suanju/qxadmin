# Task 07：Nuxt 全栈 Admin 框架化重构任务清单（数据库动态权限版）

日期：2026-05-10

目的：将当前通用 admin 后台内核逐步重构为可复用 Nuxt 全栈 admin 框架，并把 RBAC 演进为数据库动态权限目录。

涉及范围：动态权限、动态菜单、角色授权、API 权限 matcher、系统配置、操作日志、上传、Dashboard、未来字典与文件管理模块。

是否影响后台核心链路：本文档仅定义任务，执行时会影响登录、RBAC、设置、日志等核心链路，必须分阶段验证。

## P0：重构前基线冻结

- [ ] 确认当前登录、`/api/admin/auth/me`、`/api/admin/auth/permissions` 正常。
- [ ] 确认 `/dashboard`、`/settings`、`/operation_logs`、`/admin_accounts` 可打开。
- [x] 执行 `npm run build`。
- [x] 执行现有 `npm run rbac:verify-routes`。
- [x] 记录当前数据库表结构与 migration 状态到 `docs/database/**`。
- [x] 记录当前权限常量、API 映射、默认角色授权为迁移基线。

验收标准：

- 构建通过。
- 当前 RBAC 路由校验通过。
- 核心页面和 API 行为有记录。

## P1：动态权限数据库模型

- [x] 新增 `admin_permission` schema，支持 `catalog/menu/page/button/api` 类型。
- [x] 为 `admin_permission` 增加 `code` 唯一约束、`parent_id`、`module`、`route_path`、`api_method`、`api_path`、`api_match_type`、`component_key`、`active_menu`、`keepalive`、`visible`、`is_system`、`is_high_risk` 等字段。
- [x] 评估是否新增独立 `admin_api_permission` 表，借鉴 `gin-vue-admin` 的 `sys_apis + casbin_rule` 分层；第一阶段可先用 `admin_permission(type=api)`。
- [x] 扩展 `admin_role_permission`，支持 `permission_id`，保留 `permission_code` 兼容旧数据。
- [x] 新增 `admin_permission_sync_log`，记录权限同步、冲突、补齐、禁用。
- [x] 预留 `admin_role_data_scope` 或 `roles.data_scope` 字段，借鉴 `catch-admin` 的数据范围能力。
- [x] 新增 Drizzle migration，不修改已执行历史 migration。
- [x] 更新 `server/db/schema/index.ts` 汇总导出。

验收标准：

- `db:generate` 或手工 migration 与 schema 一致。
- 老角色授权不丢失。
- 系统内置权限支持 `is_system=1` 保护。

## P2：权限同步器与校验脚本

- [x] 新增 `server/rbac/modules/**` 模块权限声明目录。
- [x] 为 dashboard、settings、admin_accounts、operation_logs、upload 编写初始权限声明。
- [x] 新增 `scripts/sync_admin_rbac_permissions.mjs`，将模块声明 upsert 到 `admin_permission`。
- [x] 扫描 `server/api/admin/**`，把真实 Nitro API 路径转换为 `/api/admin/**` pattern。
- [x] 新增可复用 route scanner 工具，支持 `index.get.ts`、`[id].put.ts`、`[...slug].get.ts` 等 Nitro 文件路由。
- [x] 为 route scanner 增加公开/登录态接口 allowlist，例如登录、验证码、登出、当前用户信息。
- [x] 支持模块权限导入器，借鉴 `catch-admin` 的 `ImportPermissions`，允许模块提供树形权限种子。
- [x] 权限导入必须支持 `hidden/visible`、`active_menu`、`component_key`、`keepalive`、按钮 action 自动挂载。
- [x] 固化 API 权限码规则：业务按钮使用 `<module>.<action>`，API 节点使用 `api.<module>.<resource>.<action>` 并通过 `parentCode` 挂载。
- [x] 新增 `npm run rbac:sync`。
- [x] 新增 `npm run rbac:verify-db`，检查重复 code、孤儿节点、无效 API matcher、禁用系统权限等。
- [x] 增强 `npm run rbac:verify-routes`，优先校验数据库 API 权限覆盖真实 API。
- [x] `rbac:verify-routes` 同时提示数据库中已无对应文件路由的 stale API 权限，默认不自动删除。

验收标准：

- 执行 `rbac:sync` 后，数据库生成完整权限树。
- 新增后台 API 但未配置数据库权限时，`rbac:verify-routes` 失败。
- 数据库权限引用不存在 parent 或非法 matcher 时，`rbac:verify-db` 失败。
- 已删除后台 API 对应的数据库权限能被识别为 stale，便于人工禁用或修复。

## P3：RBAC 运行时切换为数据库 matcher

- [x] 新增 `server/services/auth/admin_permission_catalog.ts`，负责读取权限树和 API matcher。
- [x] `admin_permission_catalog.ts` 提供 `getPermissionTree()`、`getApiMatchers()`、`matchAdminApiPermission()`、`getRolePermissionCodes()`。
- [x] 新增 RBAC 运行时缓存：权限树、API matcher。
- [ ] 新增 RBAC 用户权限缓存：`adminUserPermissionCache:{userId}:{tokenVersion}`。
- [x] 改造 `server/middleware/admin_auth.ts`，支持从数据库 matcher 判断 API 权限。
- [x] 保留旧 `server/constants/admin_permission_routes.ts` 作为过渡兜底。
- [x] 增加运行模式开关，例如 `ADMIN_RBAC_SOURCE=static|database|hybrid`。
- [x] 设计 Casbin 兼容三元组结构：`subject(role)`、`object(path)`、`action(method)`，当前先不强制引入 Casbin 依赖。
- [x] `hybrid` 模式同时计算静态映射和数据库 matcher，差异写入服务端日志但不影响响应。
- [ ] 权限目录、角色授权、用户角色变更后刷新 RBAC 缓存或提升受影响账号 `token_version`。
- [x] 在 `database` 模式下，未匹配后台 API 且 `ADMIN_RBAC_ENFORCE=true` 必须返回 403。

验收标准：

- `hybrid` 模式下旧权限和数据库权限结果可对比记录。
- `database` 模式下普通管理员无权限 API 返回 403。
- 超级管理员仍拥有全部启用权限。

## P4：动态菜单与前端权限入口

- [ ] 新增 `GET /api/admin/auth/menus` 或将菜单合并到 `me` 返回。
- [ ] 前端导航从服务端动态菜单树生成。
- [ ] 新增 `app/components/admin/admin_access.vue`，封装按钮/组件权限显示。
- [ ] 在 `app/composables/use_admin_auth.ts` 中补齐 `canAny()`、`canAll()`。
- [ ] 将 `/settings`、`/admin_accounts` 高风险按钮改为统一权限入口。
- [ ] 页面访问体验层根据数据库 page/menu 权限判断。

验收标准：

- 不同角色登录看到不同菜单。
- 无权限账号看不到对应按钮。
- 直接调用无权限 API 仍由服务端返回 403。
- 页面内不再散落重复权限判断逻辑。

## P5：角色授权页面改造

- [ ] `/admin_accounts` 角色授权树改为读取 `admin_permission`。
- [ ] 支持按模块、菜单、页面、按钮、API 分组展示。
- [ ] 系统权限 `is_system=1` 不允许删除，只允许改显示信息。
- [ ] 勾选页面/按钮时自动关联必要 API 权限，或清晰展示 API 子节点。
- [x] 增加严格角色模式 `ADMIN_STRICT_ROLE_MODE`：普通管理员只能给下级角色分配自己拥有的权限。
- [ ] 角色树支持父子层级，服务端校验操作者可管理角色集合。
- [ ] 修改角色权限后提升受影响管理员 `token_version`。
- [ ] 写入操作日志。

验收标准：

- 角色授权可动态勾选数据库权限树。
- 严格角色模式下，普通管理员无法给下级分配自己没有的菜单、按钮或 API 权限。
- 角色权限变更后旧 token 失效或权限缓存刷新。
- 操作日志记录 before/after 权限差异。

## P6：系统配置分组化与兼容迁移

- [ ] 新增配置分组 schema，例如 `admin_config_group`。
- [ ] 为现有配置补充分组元数据，保持旧 `group` 字段兼容。
- [ ] 扩展配置项字段：`default_value`、`options_json`、`props_json`、`sort`、`is_public`、`is_sensitive`、`is_system`。
- [ ] 新增 Drizzle migration，不修改已执行历史 migration。
- [ ] 更新 `/settings` 页面，使其优先按配置分组展示。

验收标准：

- 旧配置数据可无损显示。
- 新配置分组可创建、编辑、排序。
- `npm run build` 通过。

## P7：系统配置 typed getter、缓存与敏感值保护

- [ ] 新增 `server/services/config/admin_config_cache.ts` 或同等服务。
- [ ] 提供 `getAdminConfig()`、`getAdminConfigGroup()`、`refreshAdminConfigCache()`。
- [ ] 按配置类型转换 `int/float/bool/json/array/date/datetime`。
- [ ] 写操作后刷新缓存，刷新失败可观测。
- [ ] `is_sensitive=1` 配置列表接口默认脱敏。
- [ ] 操作日志记录敏感配置变更时脱敏 `beforeData/afterData/changeItems`。

验收标准：

- 服务端可通过 `group.key` 读取 typed 配置。
- 修改配置后缓存立即更新。
- 前端列表和操作日志不泄漏敏感配置明文。

## P8：权限后台管理页面

- [ ] 新增 `/admin_permissions` 页面或合并到 `/admin_accounts` 的权限管理 tab。
- [ ] 支持权限树查看、排序、显示/隐藏、启用/禁用、名称/图标编辑。
- [ ] 支持查看 API matcher 覆盖结果。
- [ ] 禁止物理删除 `is_system=1` 权限。
- [ ] 接入自身 RBAC：`rbac.permissions.read`、`rbac.permissions.manage`。

验收标准：

- 超级管理员可维护权限显示信息和排序。
- 普通管理员无权限无法访问权限管理页面和 API。
- 误配置 API matcher 时校验脚本能发现。

## P9：字典管理模块

- [ ] 设计 `admin_dict`、`admin_dict_item` schema。
- [ ] 提供字典类型和字典项 CRUD。
- [ ] 提供前端 `useAdminDict()` composable。
- [ ] 提供 `showDictLabel()` 或同等工具，借鉴 `gin-vue-admin` 字典展示方法。
- [ ] 字典状态、颜色、排序支持后台维护。
- [ ] 接入动态 RBAC：`dicts.read`、`dicts.manage` 写入 `admin_permission`。

验收标准：

- 字典项可用于页面 tag、select、radio 等 UI。
- 新增 API 全部进入数据库权限目录并通过 `rbac:verify-routes`。
- 操作写入审计日志。

## P10：文件管理模块

- [x] 在现有上传能力上扩展文件表与文件分组表。
- [x] 记录文件原名、路径、mime、大小、hash、上传人、分组、存储驱动。
- [x] 支持图片、文档、压缩包等基础类型过滤。
- [x] 预留分片上传和对象存储驱动扩展点，借鉴 `gin-vue-admin` 的分片上传和对象存储方向。
- [x] 接入动态 RBAC：`files.read`、`files.manage` 写入 `admin_permission`。
- [ ] 增加未引用文件清理策略文档。

验收标准：

- 文件上传后可在后台检索。
- 文件删除或移动有操作日志。
- 存储路径与公开 URL 生成规则清晰。

## P11：代码生成器与模块安装器

- [ ] 新增轻量代码生成器设计：`npm run admin:make-module`、`npm run admin:make-crud`。
- [ ] 生成器模板遵循当前 Nuxt 结构：`app/pages/**`、`server/api/admin/**`、`server/services/**`、`server/db/schema/**`、`server/rbac/modules/**`。
- [ ] 生成 CRUD 时同步生成 API、service、schema、页面、权限声明、菜单、按钮权限、审计事件。
- [ ] 默认生成按钮 action：`read/create/update/delete/enable/import/export`，按资源配置选择启用。
- [ ] 生成 API 权限节点时使用 `api.<module>.<resource>.<action>`，并挂到对应页面或按钮权限下。
- [ ] 增加代码生成记录表或文档记录，借鉴 `gin-vue-admin` 的 AutoCode history。
- [ ] 模块安装器支持导入权限、字典、配置和 migration。
- [ ] 模块禁用时隐藏菜单、禁用 API 权限，不物理删除系统权限。
- [ ] 生成后自动提示或执行 `npm run rbac:sync`、`npm run rbac:verify-db`、`npm run rbac:verify-routes`。

验收标准：

- 生成一个测试 CRUD 后，执行 `rbac:sync` 能自动出现菜单、按钮和 API 权限。
- 生成记录可追踪生成路径和权限项。
- 模块禁用后普通管理员无法访问对应菜单和 API。

## P12：框架化文档与部署说明

- [ ] 更新 `README.md`，明确项目定位为 Nuxt 全栈 admin 框架内核。
- [ ] 更新 `docs/README.md` 索引。
- [ ] 新增 `docs/architecture/**` 动态 RBAC 模块边界说明。
- [ ] 新增 `docs/api/**` 后台 API 权限与返回结构说明。
- [ ] 新增 `docs/deployment/**` 环境变量、RBAC 数据库模式、数据库初始化说明。
- [ ] 新增权限误配置恢复手册，例如 `rbac:sync --restore-system`。
- [ ] 新增严格角色模式、模块安装/禁用、代码生成器使用说明。

验收标准：

- 新开发者可根据文档完成本地启动、数据库初始化、默认管理员创建、权限同步。
- 新增后台模块有明确接入动态 RBAC、审计、配置、文档的 checklist。

## 总体验收门槛

每个阶段至少执行：

- [ ] `npm run build`
- [ ] 涉及后台 API 或权限时执行 `npm run rbac:sync`
- [ ] 涉及后台 API 或权限时执行 `npm run rbac:verify-db`
- [ ] 涉及后台 API 或权限时执行 `npm run rbac:verify-routes`
- [ ] 涉及数据库时确认 Drizzle schema 与 migration 同步
- [ ] 涉及页面时手动打开对应页面验证
- [ ] 涉及高风险写操作时确认操作日志记录

## 推荐执行顺序

1. P0
2. P1
3. P2
4. P3
5. P4
6. P5
7. P6
8. P7
9. P8
10. P9
11. P10
12. P11
13. P12

理由：先建动态权限数据模型和同步器，再切运行时中间件和前端菜单，最后扩展配置、权限管理页面、字典、文件、代码生成器等框架模块。
