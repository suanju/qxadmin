# Admin 框架参考项目学习记录

日期：2026-05-10

目的：补充学习 `gin-vue-admin` 与 `catch-admin`，更新 Nuxt 全栈 Admin 框架重构方案。

涉及范围：动态 RBAC、菜单、按钮权限、API 权限、系统配置、字典、文件、代码生成器、模块化。

是否影响后台核心链路：本文档仅为研究记录，不直接修改代码。

## gin-vue-admin

参考来源：

- GitHub：`flipped-aurora/gin-vue-admin`
- 官方文档：权限、角色、菜单、API、字典、AutoCode 相关说明
- 源码关注：
  - `server/initialize/ensure_tables.go`
  - `server/model/system/sys_api.go`
  - `server/model/system/sys_base_menu.go`
  - `server/model/system/sys_menu_btn.go`
  - `server/model/system/sys_authority_btn.go`

关键设计：

- 使用 JWT 做认证，Casbin 做 API 授权。
- API 权限以 `path + method` 进入策略规则。
- 菜单、按钮、API 分层管理。
- 角色支持菜单权限、API 权限、按钮权限。
- 支持严格角色模式，父角色只能给子角色分配自己拥有的权限。
- 内置字典、文件上传、操作记录、系统配置、AutoCode、代码历史。

适合当前项目吸收：

- API matcher 设计为 `subject(role) + object(path) + action(method)` 的 Casbin 兼容结构。
- 按钮权限挂在页面/菜单下，前端按页面拿按钮权限。
- 增加严格角色模式，防止普通管理员越权创建高权限角色。
- 代码生成器生成 CRUD 时，必须同步生成权限声明、菜单、按钮和审计事件。
- 字典、文件、操作日志应作为 admin 框架基础模块。

暂不直接照搬：

- 不立即引入完整 Casbin 依赖，先用数据库 matcher 实现。
- 不迁移当前 JWT cookie + `token_version` 模型。
- 不照搬 GVA 的多表完整拆分作为第一阶段主路径。当前项目模块较少，先用 `admin_permission(type=api)` 能更快把菜单、按钮、API 放到同一棵授权树里；后续 API 权限复杂后再拆 `admin_api_permission`。

## catch-admin

参考来源：

- GitHub：`JaguarJack/catch-admin`
- 本地阅读路径：`modules/Permissions/**`、`modules/System/**`、`modules/Develop/**`、`modules/User/**`
- 源码关注：
  - `modules/Permissions/Models/Permissions.php`
  - `modules/Common/Support/ImportPermissions.php`
  - `modules/Permissions/database/seeder/PermissionsMenusSeeder.php`
  - `modules/System/database/seeder/SystemMenusSeeder.php`

关键设计：

- Laravel 模块化架构：每个模块有 routes、models、controllers、migrations、seeders、installer。
- `permissions` 表统一存目录、菜单、按钮。
- 权限字段包含 `route`、`module`、`permission_mark`、`component`、`active_menu`、`keepalive`、`hidden`、`sort`。
- `ImportPermissions` 支持树形权限导入。
- 代码生成器可自动生成 route、controller、model、migration、前端页面，并创建菜单和按钮 action。
- 角色支持 `data_range`，并可绑定部门。
- 系统配置使用点分 key，保存后刷新缓存，并加载到运行时配置。
- 操作日志通过请求结束后的 middleware 统一记录。

适合当前项目吸收：

- 每个模块自带 `rbac.ts`、migration、seed、installer，安装时导入权限、字典和配置。
- 权限表增加 `component_key`、`active_menu`、`keepalive`、`visible`。
- 生成器不只生成代码，还要生成菜单、按钮、API 权限和审计事件。
- 角色表或扩展表预留 `data_scope`，后续支持部门数据权限。
- 配置服务支持 `group.key` 点分读取、typed getter 和缓存刷新。
- 操作日志应尽量统一收口，减少业务代码侵入。

## 当前项目取舍结论

当前项目要吸收两者优点，但不能把 Go/Laravel 的结构硬搬进 Nuxt：

- 权限表建模优先采用 `catch-admin` 式统一树：`catalog/menu/page/button/api` 都进入 `admin_permission`，角色授权只面对一棵树。
- API matcher 吸收 `gin-vue-admin` 的 Casbin 思路：按 `subject(role) + object(path) + action(method)` 设计，但先不引入 Casbin 依赖。
- API 权限节点第一阶段使用独立 `api.*` code，并通过 `parentCode` 挂到页面或按钮节点下，避免一个业务 code 同时代表按钮和多个 API。
- 菜单体验字段吸收 `catch-admin`：保留 `component_key`、`active_menu`、`keepalive`、`visible/hidden`、`sort`。
- 按钮动作吸收 `catch-admin` 的默认 action：`list/create/read/update/delete/enable/import/export` 可由生成器自动挂到页面节点下。
- 严格角色模式吸收 `gin-vue-admin`：普通管理员只能分配自己拥有的权限，真正校验放在服务端。
- 字典、文件、配置、操作日志、代码生成器作为 admin 框架基础能力推进，但不能重新引入已下线业务模块。

## 对当前方案的更新

已更新：

- `docs/architecture/2026-05-10_nuxt_fullstack_admin_refactor_design.md`
- `docs/ai-work/agent_task/07_nuxt_fullstack_admin_framework_tasks.md`

新增重点：

- Casbin 兼容三元组，但不立即引入 Casbin。
- `admin_permission` 增加 `component_key`、`active_menu`、`keepalive`、`data_scope_supported`。
- 模块权限导入器与模块安装/禁用机制。
- 严格角色模式 `ADMIN_STRICT_ROLE_MODE`。
- 代码生成器 `admin:make-module`、`admin:make-crud`。
- 字典展示工具、文件分片上传与对象存储扩展点。
- 数据权限预留。
