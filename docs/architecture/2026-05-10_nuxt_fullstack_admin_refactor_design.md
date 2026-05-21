# Nuxt 全栈 Admin 框架重构设计：数据库动态权限版

日期：2026-05-10

目的：学习 `xin-admin-laravel` 与其他开源 admin 框架的通用后台设计，结合当前 Nuxt 全栈 admin 内核，重新设计以数据库动态存储为核心的 RBAC、系统配置与框架化重构方案。

涉及范围：后台登录、管理员账户、角色权限、动态菜单、按钮权限、API 权限、系统配置、操作日志、上传、Dashboard、未来字典与文件管理等通用 admin 能力。

是否影响后台核心链路：本文档仅为设计方案，不直接修改登录、RBAC、配置、日志或上传代码。后续落地会影响后台核心链路，必须分阶段迁移和验证。

## 设计立场

本方案以“数据库动态存储权限”为目标，不再坚持权限点全部由代码常量作为唯一真源。

但数据库动态权限必须有三条底线：

1. 数据库存权限、菜单、按钮、API 映射，后台可维护。
2. 代码负责自动发现真实页面和真实 API，提供同步、校验、补齐能力。
3. 服务端中间件始终按数据库权限强制校验，不能只靠前端菜单隐藏。

换句话说，最终模型不是“纯代码权限”，也不是“数据库随便填字符串”，而是：

```text
真实代码路由/API -> 权限同步器 -> 数据库权限目录 -> 角色授权 -> 中间件运行时校验
```

## 参考项目

- `xin-admin/xin-admin-laravel`：Laravel 12 + React + Ant Design + TypeScript，全栈 admin 框架。核心启发是 `sys_rule` 将菜单、路由、按钮权限统一放入数据库，并通过路由 Attribute 生成接口 ability。
- `flipped-aurora/gin-vue-admin`：Go Gin + Vue 3 + GORM + Casbin admin 框架。核心启发是菜单权限、API 权限、按钮权限分层入库，API 授权使用 Casbin policy，支持严格角色模式、AutoCode、字典、文件、操作记录、JWT 黑名单、多数据库与对象存储。
- `JaguarJack/catch-admin`：Laravel 12 + Vue 3 + Element Plus 模块化 admin 框架。核心启发是模块独立、权限菜单可导入、代码生成器自动写路由和菜单、角色支持数据范围、部门岗位模型、动态系统配置缓存、操作日志终止中间件。
- `vbenjs/vue-vben-admin`：Vue 3 + Vite + TypeScript admin 模板。核心启发是动态路由、菜单、按钮权限统一由接口下发给前端。
- `pure-admin/vue-pure-admin`：Vue 3 + Vite + Element Plus admin 模板。核心启发是菜单与路由解耦，前端有角色/按钮权限控制，但安全边界仍应在服务端。

## 当前仓库基线

当前项目已经收缩为通用 admin 内核，结构是 Nuxt 默认拆分：

- `app/`：页面、布局、组件、composable。
- `server/`：API、service、db、lib、中间件。
- `shared/`：前后端共享常量。

当前 RBAC 相关文件：

- 权限类型与数据库权限树构建工具：`shared/constants/admin_permissions.ts`
- API 权限声明：`server/rbac/modules/*.json`
- 服务端安全边界：`server/middleware/admin_auth.ts`
- 角色授权读取：`server/services/auth/admin_permission.ts`
- 前端权限体验：`app/composables/admin/use_auth.ts`、`app/middleware/auth.global.ts`

当前系统配置：

- 表：`server/db/schema/system/config.ts`
- service：`server/services/config/admin_config.ts`
- 模型：单表 `name/group/title/tip/type/value`

当前优势：

- 登录、token version、最后一个超级管理员保护、操作日志链路已经存在。
- 权限映射清晰，可审计。
- 结构简单。

当前不足：

- 权限点和菜单需要改代码，后台不能动态维护。
- 页面权限、按钮权限、API 权限没有数据库统一视图。
- 系统配置分组元数据弱，缺少 typed getter、缓存、敏感配置保护。
- 还不是一个可扩展的 Nuxt 全栈 admin 框架。

## xin-admin-laravel 设计观察

### RBAC

`xin-admin-laravel` 的 RBAC 核心表是：

- `sys_user`
- `sys_role`
- `sys_user_role`
- `sys_rule`
- `sys_role_rule`
- `sys_access_token`

`sys_rule` 同时承载菜单、路由和按钮/接口权限：

- `type`: `menu | route | rule`
- `key`: 权限唯一标识
- `path`: 前端路径
- `icon`: 菜单图标
- `parent_id`: 树形结构
- `status/hidden/order`: 启用、显示、排序

控制器通过 PHP Attribute 声明路由与能力，例如控制器级 `abilitiesPrefix` 加方法级 `authorize`，最终形成类似 `system.role.query`、`system.role.setRule` 的接口 ability。登录后使用 Sanctum token abilities 承载权限，前端通过 `info` 获取 `access`，通过 `menu` 获取动态菜单。

适合当前项目吸收的点：

- 权限目录入库，后台可动态维护菜单、按钮、页面、接口权限。
- 权限树同时服务菜单树和角色授权树，减少重复配置。
- API 权限不靠人工散落维护，而是通过声明/同步机制生成。
- 前端登录后从服务端拿菜单和按钮权限，而不是前端硬编码完整菜单。

需要改造后吸收的点：

- 当前项目不能使用 Laravel Attribute，但可以用 Nuxt/Nitro 文件路由扫描和显式元数据文件实现同步。
- 当前项目使用 JWT cookie + `token_version`，不需要改成 Sanctum token abilities。
- 当前项目应保留最后一个超级管理员保护、角色变更提升 `token_version`、操作日志。

## gin-vue-admin 设计观察

### 权限与菜单

`gin-vue-admin` 的权限设计把角色、菜单、按钮、API 拆得更细：

- 角色：`sys_authorities`
- 菜单：`sys_base_menus`
- 菜单按钮：`sys_base_menu_btns`
- API：`sys_apis`
- API 授权规则：`casbin_rule`
- 角色菜单关联：`sys_authority_menus`

运行时使用 JWT 做认证，Casbin 做 API 授权。菜单树由角色关联菜单生成，按钮权限挂在菜单下，API 权限由 `path + method` 进入策略规则。

适合当前项目吸收的点：

- API 权限和菜单权限可以拆表，避免一个 `permission` 表承载过多含义。
- API matcher 应以 `method + path` 为核心，并保留分组和描述。
- 按钮权限应挂在菜单/页面下，前端可一次拿到页面按钮授权。
- 严格角色模式值得吸收：父角色只能给子角色分配自己拥有的菜单和 API 权限，避免普通管理员越权创建更高权限角色。
- AutoCode 的思路值得吸收：新增模块时自动生成 API、页面、权限、菜单和字典入口。

需要改造后吸收的点：

- 当前项目不必直接引入 Casbin 依赖；可以先实现轻量 `method + path matcher`，后续再评估是否接入 Casbin 风格策略。
- 当前项目已有 JWT cookie 和 `token_version`，不需要采用 GVA 的 JWT 黑名单作为第一优先级，但可以借鉴“主动失效/黑名单”用于高风险退出或封禁。
- 当前项目是 Nuxt 全栈，不需要复制 Go 的分层目录，但可以吸收 `api/service/model/router` 的职责边界。

### 系统模块

`gin-vue-admin` 的基础模块包括：

- 字典管理。
- 文件上传与下载。
- 操作历史。
- AutoCode 与代码历史。
- 系统配置。
- 多数据库与对象存储。

对当前项目的启发：

- 字典、文件、操作日志应成为 admin 框架的基础模块，而不是业务模块。
- 代码生成器不要只生成页面和接口，还应生成权限声明、菜单、按钮权限和审计默认配置。
- 操作日志需要可按用户、接口、模块、状态查询。

## catch-admin 设计观察

### 模块化与权限

`catch-admin` 使用 `modules/**` 组织功能模块，每个模块有自己的 controller、route、model、migration、seeder、installer。权限表 `permissions` 同时存目录、菜单、按钮：

- `permission_name`
- `route`
- `icon`
- `module`
- `permission_mark`
- `component`
- `redirect`
- `keepalive`
- `type`: 目录、菜单、按钮
- `hidden`
- `active_menu`
- `sort`

角色通过 `role_has_permissions` 关联权限。用户权限聚合时，超级管理员直接拥有全部权限；普通用户从角色权限汇总。按钮权限使用 `module@controller@action` 或 `controller@action` 形式映射到当前路由 action。

适合当前项目吸收的点：

- 每个模块应自带权限种子或权限声明，可通过导入器写入数据库。
- 权限表应保留 `component_key`、`active_menu`、`keepalive`、`hidden/visible` 这类前端路由体验字段。
- 代码生成器生成模块时，应同时生成路由、页面、菜单、按钮权限和 API 权限。
- 操作日志可使用“请求完成后统一记录”的终止/after-response 思路，减少业务代码侵入。

### 数据权限、部门与岗位

`catch-admin` 的角色表含 `data_range`，部门和岗位独立建模：

- `roles.data_range`：全部、自定义、本人、部门、部门及以下。
- `departments`：树形组织。
- `positions`：岗位。
- 角色可绑定部门，用于数据范围控制。

对当前项目的启发：

- 第一阶段仍聚焦功能权限，但 schema 应预留 `data_scope` 或 `data_range`。
- 如果未来做多部门后台或数据隔离，数据权限应和 RBAC 分层设计，不能混在按钮权限里。
- 部门/岗位应作为可选模块加入，不应阻塞当前 admin 内核重构。

### 系统配置

`catch-admin` 的 `system_config` 使用点分 key，例如 `upload.driver`、`upload.limit_size`，保存后刷新缓存，并加载到运行时配置。

适合当前项目吸收的点：

- 配置 key 使用 `group.name` 或多级点分形式，适合 typed getter。
- 写配置后统一刷新缓存。
- 上传配置、系统设置等可以复用同一配置底座。

需要补强的点：

- 当前项目需要比 `key/value` 更完整的配置项元数据，例如类型、选项、props、敏感标记、排序、分组。
- 敏感配置必须脱敏进入操作日志。

## 数据库动态 RBAC 总体方案

### 推荐模型：数据库真源 + 代码发现 + 同步校验

权限数据库成为运行时真源：

- 菜单从数据库读取。
- 页面权限从数据库读取。
- 按钮权限从数据库读取。
- API 权限从数据库读取。
- 角色授权存数据库。

代码负责：

- 扫描 `app/pages/**` 发现后台页面。
- 扫描 `server/api/admin/**` 发现后台 API。
- 读取模块权限声明文件，生成建议权限目录。
- 同步缺失权限到数据库。
- 校验数据库权限是否覆盖真实 API。

运行时负责：

- `server/middleware/admin_auth.ts` 从数据库/缓存读取 API 权限映射。
- 普通管理员无权限时返回 403。
- 角色、权限、菜单变化后提升相关账号 `token_version` 或刷新权限缓存。

### 新增核心表

建议新增或改造为以下表。

有两种可选建模：

- 单表统一模型：`admin_permission` 同时承载目录、菜单、页面、按钮、API，接近 `xin-admin-laravel` 和 `catch-admin`。
- 拆表模型：`admin_menu`、`admin_menu_button`、`admin_api`、`admin_role_api` 分离，接近 `gin-vue-admin`。

当前 Nuxt 项目建议第一阶段采用“统一表 + 类型字段”，但字段预留 API 独立拆表空间。理由是当前模块还少，统一表更快落地；后续 API matcher 复杂后，可把 `type=api` 迁移到 `admin_api_permission`。

### 当前取舍：统一权限树优先，API 拆表预留

对比两个参考项目后，当前项目的落地策略是：

| 设计点 | `gin-vue-admin` | `catch-admin` | 当前项目选择 |
| --- | --- | --- | --- |
| 菜单/按钮/API | 菜单、按钮、API 分表，API 进入 Casbin policy | 目录、菜单、动作统一进 `permissions` 树 | 第一阶段统一进 `admin_permission` |
| API 授权 | `path + method`，Casbin enforcement | 动作权限随菜单树导入 | 使用 `api_method + api_path + api_match_type`，保留 Casbin 三元组语义 |
| 角色授权体验 | 菜单、API、按钮可分开授权 | 一棵权限树授权 | 一棵树授权，API 节点默认挂在页面/按钮下 |
| 模块导入 | 初始化 source + AutoCode | `ImportPermissions` 导入树形 seed | `server/rbac/modules/**` 声明 + `rbac:sync` |
| 代码生成 | AutoCode + history | 生成模块、菜单、action | 轻量生成器必须生成权限、菜单、API matcher、审计事件 |

这样设计的原因：

- 当前后台核心模块数量少，一张 `admin_permission` 更容易保证角色授权、动态菜单、按钮权限和 API 覆盖校验一致。
- `gin-vue-admin` 的 API 拆表和 Casbin 很成熟，但直接引入会把第一阶段复杂度抬高，且与当前 `token_version`、Drizzle、Nitro middleware 需要额外适配。
- `catch-admin` 的统一树和模块权限导入更贴近当前目标，但它的 action 权限不能直接等同于服务端 API 安全边界，所以当前项目必须额外保留 `type=api` 节点。
- 如果后续 API 数量明显增长，或需要资源级策略、通配策略、条件策略，再把 `type=api` 平滑迁移到独立 `admin_api_permission` 与 `admin_role_api_permission`。

#### `admin_permission`

统一权限目录表，类似 `xin-admin-laravel` 的 `sys_rule`，但字段更贴合 Nuxt admin：

```text
id
parent_id
type                  # catalog | menu | page | button | api
code                  # 唯一权限码，如 settings.update
name
description
module                # dashboard/settings/rbac/logs/files
route_path            # 前端页面路径，如 /settings
api_method            # GET/POST/PUT/DELETE/*，api 类型使用
api_path              # /api/admin/config 或 pattern
api_match_type        # exact | prefix | regex
component_key         # 页面组件或模块标识，可选
active_menu           # 隐藏页对应高亮菜单
keepalive             # 前端页面缓存开关
icon
sort
status                # 1 启用，0 禁用
visible               # 1 菜单可见，0 不进菜单
is_system             # 系统内置，不允许删除，只允许改名称/排序/可见性
is_high_risk
data_scope_supported  # 是否支持数据权限，预留
created_by
updated_by
created_at
updated_at
```

关键约束：

- `code` 唯一。
- `type=api` 时必须有 `api_method/api_path/api_match_type`。
- `type=page/menu` 时建议有 `route_path`。
- `type=button` 必须挂在页面或菜单节点下。

#### `admin_role_permission`

保留现有角色权限关联表，但从 `permission_code` 逐步迁移为 `permission_id + permission_code` 双字段：

```text
id
role_id
permission_id
permission_code
created_at
```

兼容策略：

- 第一阶段保留 `permission_code`。
- 新逻辑优先按 `permission_id` 关联。
- `permission_code` 用于兼容旧授权和日志可读性。

#### `admin_permission_sync_log`

记录权限同步结果，便于排障：

```text
id
source                # scanner | seed | manual
action                # create | update | disable | conflict
permission_code
before_data
after_data
message
created_at
```

#### `admin_role_data_scope`（可选，第二阶段）

借鉴 `catch-admin` 的 `data_range` 与部门绑定能力，预留数据权限表：

```text
id
role_id
scope_type             # all | self | department | department_and_children | custom
department_ids_json
created_at
updated_at
```

第一阶段不强制实现，只在角色表或权限表中预留扩展点。

#### `admin_menu_override`（可选）

如果希望菜单展示和权限目录解耦，可加展示覆盖表：

```text
id
permission_id
title
icon
sort
visible
created_at
updated_at
```

第一阶段可以不加，直接用 `admin_permission` 的菜单字段。

### 权限类型设计

建议权限类型分为五类：

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| `catalog` | 菜单目录，不直接授权 API | 系统管理 |
| `menu` | 左侧菜单项，通常有页面路径 | 系统设置 |
| `page` | 页面访问权限，可与 menu 合并，也可用于隐藏页 | 配置详情 |
| `button` | 页面操作按钮权限 | 新增配置、删除角色 |
| `api` | 服务端 API 权限 | PUT `/api/admin/config/:id` |

角色授权时可以展示树：

```text
系统管理 catalog
  系统设置 menu/page
    查看设置 page
    新增设置 button
    修改设置 button
    删除设置 button
    GET /api/admin/config api
    POST /api/admin/config api
```

实际体验上，管理员通常不直接勾 API，而是勾页面/按钮后自动包含关联 API。实现上可以通过 `admin_permission_relation` 表或约定父子关系完成。

如果采用 `gin-vue-admin` 式拆分，等价关系是：

```text
menu/page -> admin_permission(type=menu/page)
button    -> admin_permission(type=button)
api       -> admin_permission(type=api) 或 admin_api_permission
role api  -> admin_role_permission 或 casbin-like policy
```

当前建议先不引入完整 Casbin，但 API matcher 的数据结构要保留 `subject(role)`、`object(path)`、`action(method)` 三元组兼容空间。

### 权限码命名规范

数据库动态存储不代表权限码随便命名。建议统一：

```text
<module>.<resource>.<action>
```

示例：

- `dashboard.read`
- `settings.read`
- `settings.create`
- `settings.update`
- `settings.delete`
- `operation_logs.read`
- `admin_accounts.read`
- `admin_accounts.manage`
- `rbac.permissions.manage`
- `dicts.read`
- `dicts.manage`
- `files.read`
- `files.manage`

API 类型权限可复用按钮权限，也可以细化为：

- `api.settings.config.list`
- `api.settings.config.create`
- `api.settings.config.update`

推荐第一阶段使用独立 `api.*` 权限码，并通过 `parentCode` 挂到对应页面或按钮权限下。这样角色授权树仍然可读，同时避免一个业务权限码既代表按钮又代表多个 API matcher，后续做 API 覆盖校验也更清晰。

约定：

- 页面/按钮权限使用业务语义：`settings.update`、`admin_accounts.manage`。
- API 权限使用接口语义：`api.settings.config.update`、`api.admin_accounts.roles.list`。
- API 节点默认 `visible=false`，角色授权页面可以选择折叠到父按钮下。
- 勾选按钮权限时，服务端可自动带上其子级 API 权限；取消按钮权限时同步取消子级 API 权限，除非该 API 被其他已授权按钮引用。

## 权限同步机制

### 模块权限声明文件

建议新增：

```text
server/rbac/modules/
  dashboard.ts
  settings.ts
  admin_accounts.ts
  operation_logs.ts
  upload.ts
```

每个模块声明：

```ts
export default {
  module: 'settings',
  permissions: [
    {
      type: 'menu',
      code: 'settings.read',
      name: '系统设置',
      routePath: '/settings',
      icon: 'i-lucide-settings',
      sort: 20
    },
    {
      type: 'button',
      code: 'settings.update',
      name: '修改系统配置',
      parentCode: 'settings.read',
      highRisk: true
    },
    {
      type: 'api',
      code: 'api.settings.config.update',
      name: '修改系统配置接口',
      parentCode: 'settings.update',
      apiMethod: 'PUT',
      apiPath: '/api/admin/config/:id',
      apiMatchType: 'pattern'
    }
  ]
}
```

这不是运行时真源，而是“代码侧发现/同步来源”。运行时仍以数据库为准。

模块声明必须满足：

- `code` 全局唯一。
- `parentCode` 必须引用同文件或已存在数据库权限。
- `type=api` 必须声明 `apiMethod`、`apiPath`、`apiMatchType`。
- `type=button` 建议声明 `action`，例如 `create/update/delete/import/export/enable`。
- `isSystem=true` 的权限只能由同步器创建和修复，后台管理页不允许物理删除。

### 同步命令

建议新增脚本：

```text
npm run rbac:sync
npm run rbac:verify-db
npm run rbac:verify-routes
```

职责：

- `rbac:sync`：读取模块声明和文件路由，向 `admin_permission` upsert 权限。
- `rbac:verify-db`：检查数据库权限树完整性、孤儿节点、无效 parent、重复 code、禁用 API 被路由引用等。
- `rbac:verify-routes`：扫描真实 `server/api/admin/**`，检查每个非公开 API 都能匹配数据库中的启用 API 权限。

### 模块安装与权限导入

吸收 `catch-admin` 的 `ImportPermissions` 与模块 `Installer` 思路，建议每个可选模块包含：

```text
server/modules/<module>/
  rbac.ts
  installer.ts
  migrations/
  seeders/
```

安装模块时：

1. 执行 schema/migration。
2. 导入权限树。
3. 导入默认配置。
4. 导入字典项。
5. 记录安装日志。

禁用模块时：

1. 隐藏或禁用模块菜单。
2. 禁用相关 API 权限。
3. 不物理删除系统权限，防止恢复困难。

### 自动发现 API

Nitro 文件路由映射示例：

| 文件 | 方法 | 路径 |
| --- | --- | --- |
| `server/api/admin/config/index.get.ts` | GET | `/api/admin/config` |
| `server/api/admin/config/index.post.ts` | POST | `/api/admin/config` |
| `server/api/admin/config/[id].put.ts` | PUT | `/api/admin/config/:id` |

同步器应该能将 `[id]` 转为 `:id` 或 regex pattern。

扫描规则建议：

- 扫描范围只包含 `server/api/admin/**`，不扩到非后台接口。
- `*.get.ts`、`*.post.ts`、`*.put.ts`、`*.delete.ts`、`*.patch.ts` 映射为对应 HTTP method。
- `index.get.ts` 映射到当前目录路径。
- `[id].put.ts` 映射为 `:id` pattern。
- `server/api/admin/auth/login.post.ts`、`captcha.get.ts`、`logout.post.ts` 等登录态或公开接口进入 allowlist，不要求业务权限。
- 对真实存在但数据库没有启用 API 权限的接口，`rbac:verify-routes` 必须失败。
- 对数据库里存在但文件路由已删除的 `type=api` 权限，`rbac:verify-routes` 应提示 stale，默认不自动删除，只建议禁用或人工确认。

## 运行时权限校验

### 中间件读取流程

`server/middleware/admin_auth.ts` 未来流程：

1. 校验 JWT cookie。
2. 校验账号状态和 `token_version`。
3. 从缓存读取当前请求匹配的 API 权限。
4. 超级管理员直接通过。
5. 普通管理员根据角色权限判断。
6. 无权限返回 403。
7. 未匹配 API 的处理：
   - 开发环境：记录 warning，可选择放行。
   - 生产且 `ADMIN_RBAC_ENFORCE=true`：返回 403。

### 缓存设计

新增 RBAC 缓存：

- `adminPermissionTreeCache`
- `adminApiPermissionMatcherCache`
- `adminUserPermissionCache:{userId}:{tokenVersion}`

缓存刷新时机：

- 权限目录变化。
- 角色授权变化。
- 角色状态变化。
- 用户角色变化。
- 用户状态变化。

### token version 策略

必须保留并扩大使用：

- 修改用户角色：提升该用户 `token_version`。
- 修改角色权限：提升所有绑定该角色用户的 `token_version`。
- 禁用角色：提升所有绑定该角色用户的 `token_version`。
- 修改权限目录中 API 映射：建议提升所有非超级管理员 `token_version`，或至少刷新全局权限缓存。

### 严格角色模式

吸收 `gin-vue-admin` 的严格角色模式，建议新增：

```text
ADMIN_STRICT_ROLE_MODE=true|false
```

开启后：

- 顶级超级管理员可管理全部角色、菜单、按钮、API 权限。
- 普通管理员只能看见下级角色。
- 普通管理员只能给下级角色分配自己已经拥有的权限。
- 普通管理员不能创建高于或等于自己的角色。
- 角色授权接口必须在服务端校验可分配权限集合，前端禁用只是体验层。

## 前端动态菜单与按钮权限

### 新接口

建议新增：

```text
GET /api/admin/auth/me
GET /api/admin/auth/permissions
GET /api/admin/auth/menus
```

返回结构：

```ts
interface AdminMeResponse {
  admin: AdminContext
  permissions: string[]
  menus: AdminMenuNode[]
}
```

`menus` 从数据库 `admin_permission` 的 `catalog/menu/page` 节点生成。

### 前端控制

新增：

- `app/components/admin/admin_access.vue`
- `can()`
- `canAny()`
- `canAll()`

菜单渲染：

- 不再完全依赖 `shared/constants/admin_permissions.ts`。
- 登录后从服务端拿菜单树。
- 本地只保留真实页面组件；菜单与页面权限来自数据库权限目录。

页面访问：

- 前端中间件根据 `route.path` 和后端返回的页面权限判断跳转体验。
- 直接访问 API 仍由服务端中间件强制校验。

## 系统配置重构方案

### 推荐模型：配置分组 + 配置项 + typed getter + 缓存

系统配置本来就适合数据库动态存储，建议从当前单表逐步演进。

目标结构：

```text
admin_config_group
  id
  key
  title
  description
  sort
  status
  is_system
  created_at
  updated_at

admin_config
  id
  group_id
  group_key
  name
  title
  tip
  type
  value
  default_value
  options_json
  props_json
  sort
  is_public
  is_sensitive
  is_system
  created_at
  updated_at
```

兼容策略：

- 保留现有 `config` 表能力。
- 第一阶段新增分组表和扩展字段，不破坏已有 `name/group/type/value`。
- API 返回兼容旧字段，同时补充新 UI 元数据。

### 配置类型

建议配置类型：

- `string`
- `text`
- `int`
- `float`
- `bool`
- `json`
- `array`
- `date`
- `datetime`
- `file`
- `image`
- `select`
- `radio`
- `checkbox`

服务层提供：

- `getAdminConfig(name, defaultValue)`
- `getAdminConfigGroup(groupKey)`
- `setAdminConfigValue(event, name, value)`
- `refreshAdminConfigCache()`
- `clearAdminConfigCache()`

### 敏感配置

规则：

- `is_sensitive = 1` 的配置，列表接口默认脱敏。
- 更新敏感配置时操作日志不记录明文。
- 读取敏感配置必须走服务端 service，前端不能直接看到明文。
- `.env` 仍是部署级密钥真源，后台配置只管理运行期可变配置。

### 配置缓存与审计

缓存建议：

- 第一阶段使用进程内缓存。
- 后续可抽象为 Redis。
- 按 `group.key` 访问。
- 写操作后刷新缓存。
- 刷新失败必须抛错或记录可见错误。

审计建议：

- 创建、修改、删除、刷新缓存均写操作日志。
- `beforeData/afterData/changeItems` 对敏感字段脱敏。
- 高风险配置增加二次确认。

### 运行时动态配置

吸收 `catch-admin` 的点分 key 配置缓存思路，建议配置服务支持：

```ts
getAdminConfig('upload.driver')
getAdminConfig('upload.limit_size')
getAdminConfigGroup('upload')
```

并允许服务端启动后将部分公开配置加载为运行时配置快照。但要注意：

- `.env` 仍管理部署级密钥。
- 后台动态配置只管理可在线变更的系统参数。
- 敏感配置只允许服务端读取，不能进入公开 runtimeConfig。

## 模块化框架方向

核心模块：

- `auth`：登录、token、密码、验证码、当前管理员信息。
- `rbac`：动态权限目录、动态菜单、角色授权、API matcher、权限同步器。
- `settings`：配置分组、配置项、缓存、敏感配置。
- `operation_logs`：操作日志、审计上下文、查询。
- `upload`：基础上传、文件校验、存储适配。
- `dashboard`：核心指标与系统健康摘要。

可选模块：

- `dicts`：字典类型、字典项、前端 tag 显示。
- `files`：文件库、文件分组、引用关系、清理任务。
- `departments`：部门/岗位树。
- `data_scope`：角色数据范围、部门数据权限、本人数据权限。
- `code_generator`：按 schema 生成 API、service、页面、权限声明、菜单、审计配置。
- `notifications`：站内通知、系统公告。
- `jobs`：任务队列与任务执行日志。

## 代码生成器方向

`gin-vue-admin` 的 AutoCode 和 `catch-admin` 的模块生成器都说明：admin 框架的效率不只来自现成页面，还来自“生成后自动接入权限和菜单”。

当前项目建议设计轻量生成器：

```text
npm run admin:make-module <module>
npm run admin:make-crud <module> <resource>
```

生成内容：

- `server/api/admin/<resource>/**`
- `server/services/<module>/<resource>.ts`
- `server/db/schema/<domain>/<resource>.ts`
- `app/pages/<resource>/index.vue`
- `server/rbac/modules/<resource>.ts`
- 默认操作日志事件类型。
- 可选字典和配置种子。

生成后必须自动提示执行：

```text
npm run db:generate
npm run rbac:sync
npm run rbac:verify-routes
```

## 迁移路线

### 第一阶段：双轨兼容

- 保留 `shared/constants/admin_permissions.ts` 作为类型与数据库权限树构建工具。
- 新增 `admin_permission` 表。
- 写 `rbac:sync` 将现有权限常量和 API 映射同步入库。
- 中间件继续使用旧映射，但记录数据库匹配结果。

### 第二阶段：数据库运行时读取

- 中间件改为优先读取数据库 API matcher。
- 前端菜单改为读取数据库菜单接口。
- 角色授权页面改为读取数据库权限树。
- API matcher 运行时只读取数据库权限目录。
- 上线前必须确认 `rbac:sync`、`rbac:verify-db`、`rbac:verify-routes` 都通过。

### 第三阶段：数据库成为主路径

- 权限新增、编辑、排序、隐藏都在后台完成。
- 新模块开发只需写模块声明和 API，执行 `rbac:sync` 入库。
- `rbac:verify-routes` 必须通过才能上线。
- `shared/constants/admin_permissions.ts` 只保留类型与数据库权限树构建能力，不再作为运行时静态权限真源。
- `server/constants/admin_permission_routes.ts` 已删除，API 权限统一由 `server/rbac/modules/*.json` 同步到数据库后生效。

### 第四阶段：模块市场化

- 字典、文件、部门等模块提供自己的 `server/rbac/modules/*.ts`。
- 安装模块时自动同步权限、菜单和默认角色授权。
- 模块禁用只禁用菜单和 API 权限，不物理删除 `is_system=1` 权限。

### 第五阶段：开发效率工具

- 增加轻量代码生成器。
- 支持 CRUD 生成后自动加入权限声明。
- 支持权限、字典、配置、审计事件随模块安装。
- 支持生成记录与回滚清单，借鉴 `gin-vue-admin` 的代码历史思路。

## 近期实现优先级

结合当前已经完成的动态权限表和 `rbac:sync` 基线，后续优先级应为：

1. 先完成 API route scanner，让真实 `server/api/admin/**` 可以和数据库 `type=api` 权限互相校验。
2. 再实现 `admin_permission_catalog` 服务，统一读取权限树、菜单树、API matcher。
3. 再让 `admin_auth` 进入 `hybrid` 模式，对比静态映射和数据库 matcher，不直接切断线上路径。
4. 再做 `GET /api/admin/auth/menus` 和前端动态菜单，保证体验层跟数据库权限一致。
5. 最后改角色授权页面，把当前静态权限勾选切到数据库权限树。

这个顺序的核心原因是：服务端 API 安全边界优先于菜单动态化。只有 `rbac:verify-routes` 能证明所有后台 API 都被数据库权限覆盖后，动态菜单和角色授权才有稳定基础。

## 风险与验证

主要风险：

- 数据库权限目录被误删或误禁用，可能导致后台页面或 API 锁死。
- API matcher 配置错误，可能导致权限绕过或误拦截。
- 角色授权变化如果不提升 `token_version`，旧 token 会继续拥有旧权限。
- 动态菜单如果和页面文件不一致，会出现菜单可见但页面不存在，或页面存在但无菜单入口。
- 严格角色模式如果实现不完整，普通管理员可能给下级分配自己没有的 API 权限。
- 代码生成器如果只生成接口和页面但漏生成权限，会扩大未授权 API 风险。

必要保护：

- 系统内置权限 `is_system=1` 不允许物理删除，只允许禁用显示字段或调整排序。
- 超级管理员账号保留全权限兜底。
- 保留命令行修复脚本，例如 `npm run rbac:sync -- --restore-system`。
- 生产开启 `ADMIN_RBAC_ENFORCE=true` 前必须跑完 `rbac:verify-db` 和 `rbac:verify-routes`。
- 开启严格角色模式后，角色授权 API 必须校验“操作者可分配权限集合”。
- 生成器生成的 API 默认不允许上线，除非权限同步和路由校验通过。

验证门槛：

- `npm run build`
- `npm run rbac:sync`
- `npm run rbac:verify-db`
- `npm run rbac:verify-routes`
- 登录、修改密码、管理员管理、角色授权、动态菜单、配置新增/修改/删除、操作日志查询手动验证。
- 开启 `ADMIN_RBAC_ENFORCE=true` 后，普通管理员无权限 API 必须返回 403。
- 禁用/修改角色权限后，旧 token 必须失效或权限缓存必须刷新。
- 配置敏感字段不在前端列表和操作日志中泄漏明文。

## 结论

如果目标是打造一个更像 `xin-admin-laravel` 的 Nuxt 全栈 admin 框架，数据库动态权限确实更适合长期扩展。

推荐最终架构是：

```text
admin_permission 动态权限目录
admin_role_permission 角色授权
rbac:sync 代码发现与数据库同步
rbac:verify-db 数据完整性校验
rbac:verify-routes API 覆盖校验
admin_auth 中间件运行时强制校验
前端从服务端读取动态菜单和按钮权限
```

这条路线能让后台拥有动态菜单、动态按钮权限、动态 API 权限映射，同时保留当前项目已经具备的登录稳定性、`token_version` 失效机制、超级管理员保护和操作日志能力。
