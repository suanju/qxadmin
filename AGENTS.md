# AGENTS.md

## 0. 适用范围

本规范仅适用于当前仓库：`qxadmin`。

当前仓库已经从原业务运营后台收缩为“通用 admin 后台内核”项目，核心关注点不再是订单、支付、投诉、报表或投放追踪，而是后台基础设施本身，包括：

- 后台登录
- 管理员账户与角色
- RBAC 权限
- 系统设置
- 操作日志
- 上传能力
- 通用 Dashboard
- MySQL 持久化与 Drizzle ORM

本仓库当前基线不是别的项目里那种 `src/` 单根目录结构，而是 Nuxt 默认拆分结构：

- `app/` 负责页面、布局、组件、组合式函数
- `server/` 负责 API、服务层、数据库、工具、Nitro server
- `shared/` 负责前后端共享常量

本项目当前最高优先级目标：

- 保持后台登录、RBAC、账号角色、设置、日志链路稳定
- 保持 admin 内核目录结构清晰、可维护
- 所有新增功能优先贴合当前仓库真实技术栈与目录结构
- 不把别的项目规范硬套进当前仓库

---

## 1. 项目目标

当前项目不是支付业务后台、不是报表业务后台，也不是营销官网，而是一个偏后台基础设施的通用 admin 内核。

必须持续围绕以下目标设计：

- 提供稳定的后台登录、鉴权与 token 失效机制
- 提供稳定的管理员、角色、权限管理能力
- 提供稳定的系统设置、操作日志、资源上传能力
- 提供便于开发、运维、审计排障的后台查询能力
- 让关键字段、关键状态、关键错误日志足够可读、可追踪

不以以下目标为优先：

- 恢复已下线的订单、支付、报表、投诉、投放追踪业务能力
- 脱离真实 admin 场景的演示页面
- 只为“好看”而破坏当前后台能力稳定性
- 将当前项目强行改造成别的技术栈模板

---

## 2. 固定技术栈

### 2.1 当前固定栈

- Node.js >= 20
- TypeScript
- Nuxt 4
- Nitro Server API
- Vue 3 Composition API
- Tailwind CSS v4
- `@nuxt/ui`
- Drizzle ORM
- MySQL
- `jose`
- `consola`

### 2.2 当前项目特征

- `nuxt.config.ts` 中 `srcDir = 'app'`
- 当前 `ssr = false`，后台以客户端渲染管理界面为主
- 服务端接口位于顶层 `server/`
- 数据库 schema 位于 `server/db/schema/`
- 日志插件位于 `server/plugins/logger.ts`
- 当前 runtimeConfig 仅保留后台公共配置，不再承载支付、广告、报表相关配置

### 2.3 升级原则

- Nuxt、Vue、Tailwind、`@nuxt/ui` 优先跟随当前仓库可兼容的稳定版本
- 升级前先确认后台登录、RBAC、设置、日志、上传链路不受影响
- 不因为升级 UI 或构建依赖而破坏现有 API 路径、数据库结构或运行脚本

### 2.4 明确禁止

- 禁止把当前仓库重构成 `src/server/api/**` 这一套完全不同的根结构
- 禁止把 `@nuxt/ui` 体系整体替换成与当前页面不兼容的大型 UI 体系
- 禁止重新引入已下线的支付、报表、前台下单、公开分享等高耦合业务模块

---

## 3. 目录规范

当前仓库推荐并优先遵循以下结构：

```text
app/
  assets/        # 全局样式与静态样式资源
  components/    # 可复用页面组件
  composables/   # 组合式函数
  layouts/       # Nuxt 布局
  middleware/    # 前端路由中间件
  pages/         # 页面路由
  types/         # 页面层类型

server/
  api/           # JSON API
  constants/     # 服务端常量
  db/            # Drizzle 连接、schema、migration
  lib/           # 底层能力，如鉴权 token、密码、验证码
  middleware/    # 服务端中间件
  plugins/       # Nitro 插件
  services/      # 后台业务服务层
  utils/         # 服务端工具函数

shared/
  constants/     # 前后端共享常量

docs/
  README.md      # 项目文档总索引
  deployment/    # 部署、启动、环境变量、发布、回滚
  ai-work/       # AI 工作过程、阶段任务、执行总结
  audits/        # 审计与收缩评估
  architecture/  # 架构、目录结构、模块边界、设计说明
  api/           # 接口清单、入参出参
  database/      # 数据库结构、迁移、归档方案
  operations/    # 运维、日志、排障
```

其他当前存在且需要继续兼容的目录：

- `public/`
- `scripts/`
- `log/`

### 3.1 页面目录规则

- 所有 Nuxt 页面放在 `app/pages/**`
- 页面内部私有区块可以继续使用 `blocks/` 目录
- `blocks/` 下文件仅用于页面内部复用，不作为公共组件出口

### 3.2 服务端目录规则

- JSON API 放到 `server/api/**`
- 底层鉴权、密码、token、验证码能力放到 `server/lib/**`
- 账号、角色、配置、日志等后台业务编排逻辑放到 `server/services/**`
- 通用工具放到 `server/utils/**`

### 3.3 数据库目录规则

- 数据库连接统一使用 `server/db/index.ts`
- 表结构定义统一维护在 `server/db/schema/**`
- 数据库迁移统一放在 `server/db/migrations/**`
- `drizzle.config.ts` 必须与上述目录保持一致

---

## 4. 命名与引用规范

### 4.1 文件与目录

- 新增目录优先使用 `snake_case`
- 新增模块文件优先使用 `snake_case`
- 页面私有块文件可沿用当前 `index_xxx.vue` 风格

### 4.2 变量与类型

- 变量、函数使用 `camelCase`
- 类型、接口使用 `PascalCase`
- 常量使用 `UPPER_CASE`

### 4.3 路径引用

- App 内部优先使用 Nuxt 别名，如 `~/`、`~~/`
- 服务端内部允许使用 `#server/*`
- 共享模块可使用 `~~/shared/*`
- 禁止新增过深的 `../../../`

### 4.4 路由命名

- API 文件命名继续遵循 Nitro 习惯：`index.get.ts`、`[id].put.ts`、`xxx.post.ts`
- 动态参数页面与接口沿用当前 Nuxt/Nitro 约定：`[id].vue`、`[id].get.ts`
- 重命名路由文件时必须确认对外 URL 不变

---

## 5. 页面与后台规范

### 5.1 页面定位

当前前端页面统一按“后台基础设施 + 权限管理 + 审计运维”设计。

页面目标：

- 信息清晰
- 操作高效
- 状态可追踪
- 兼顾桌面端与移动端基础可用性

### 5.2 当前主要页面范围

当前后台页面主要围绕以下域展开：

- `/dashboard`
- `/settings`
- `/operation_logs`
- `/admin_accounts`

新增页面应优先贴合这些既有 admin 核心域，而不是重新扩散业务域。

### 5.3 页面职责

Nuxt 页面主要负责：

- 页面布局
- 调用 `useFetch`、`useAsyncData` 或封装后的 composable
- 组合 `app/components/**` 与页面私有 `blocks/**`
- 承载筛选、分页、弹窗、表单、表格等交互

页面不应承担：

- 数据库连接与 SQL 拼装
- 复杂的服务端业务编排
- 鉴权 token 签发与密码校验逻辑

### 5.4 页面数据来源

- 后台页面统一来自 `server/api/admin/**`
- 页面层不直接连数据库
- 页面层不直接解析 token 明文做复杂权限推断

### 5.5 后台交互要求

当前后台存在配置、管理员、角色等写操作。

所有写操作必须满足：

- 参数校验明确
- 成功与失败提示明确
- 高风险操作可追踪
- 管理员、角色、权限、系统设置修改必须记录审计日志

---

## 6. 组件与组合式函数规范

### 6.1 组件优先级

页面中重复出现的结构优先抽到 `app/components/**`，例如：

- 表格分页条
- 过滤栏
- 弹窗编辑器
- 公共统计面板
- 公共表单片段

页面私有但较复杂的区块可放在对应页面目录下的 `blocks/`。

### 6.2 组件设计要求

- props 类型必须明确
- 组件优先服务当前 admin 核心业务，不做过度抽象
- 公共组件放 `app/components/**`
- 页面私有组件放 `app/pages/**/blocks/**`

### 6.3 组合式函数要求

- 通用数据请求、导航、选项构造逻辑优先放在 `app/composables/**`
- 后台接口请求优先复用已有封装，例如 `useAdminFetch`
- 不要在多个页面重复堆同一套请求容错逻辑

### 6.4 UI 组件栈

新增页面与组件优先使用：

- `@nuxt/ui` 组件
- Tailwind CSS v4
- 少量必要的 TSX 或 JSX 辅助渲染

---

## 7. 服务端与 API 边界

### 7.1 API 路由层职责

`server/api/**` 主要负责：

- 解析参数
- 调用 service
- 返回 JSON
- 统一处理错误状态码与错误消息

API 路由层不应承担：

- 大段业务编排
- 重复的数据库事务细节

### 7.2 Service 层职责

`server/services/**` 负责：

- 管理员账户处理
- 角色与权限处理
- 系统配置处理
- 操作日志查询
- Dashboard 数据汇总

凡是跨多个表、多步骤、带规则的逻辑，优先放在 service 层。

### 7.3 lib 层职责

`server/lib/**` 负责：

- 登录 token
- 密码哈希与校验
- 验证码等底层能力

### 7.4 数据访问职责

- 数据库连接统一走 `useDb()`
- 表结构统一从 `#server/db/schema` 引入
- 简单查询可以放在 service 中
- 不要在页面层直接访问数据库

### 7.5 后台 RBAC 权限系统

当前仓库的后台分账户 + RBAC 权限系统是基础设施，后续所有改动必须默认接入。

关键单一真源如下：

- `shared/constants/admin_permissions.ts`
- `server/constants/admin_permission_routes.ts`
- `server/middleware/admin_auth.ts`
- `server/services/auth/admin_permission.ts`
- `app/composables/use_admin_auth.ts`
- `app/middleware/auth.global.ts`

必须明确：

- 前端菜单隐藏、按钮隐藏、页面跳转限制，只是体验层；真正安全边界始终在 `server/middleware/admin_auth.ts`
- 任何新增后台功能，如果只改前端 `can(...)` 或只藏按钮，但没有补服务端权限映射，都视为未完成
- 任何新增后台 API，如果没有进入 `server/constants/admin_permission_routes.ts`，都视为 RBAC 未接入完成

当前 RBAC 的运行前提：

- `ADMIN_RBAC_ENFORCE=true` 时，后台 API 才会对普通管理员严格返回 403
- 未开启强制模式时，当前中间件默认是“观察模式”

对管理员、角色、权限本身做改动时，还必须注意：

- 不要绕过现有 `server/services/auth/admin_account.ts`
- 如果直接改 `admin_user`、`admin_role`、`admin_user_role`、`admin_role_permission`，必须同时考虑：
  - `token_version` 失效机制
  - 最后一个启用中的超级管理员保护
  - 超级管理员降级/禁用保护
  - 操作日志记录

明确禁止：

- 禁止把 RBAC 中间件扩到非后台接口路径
- 禁止重新引入共享后台密码、匿名超级管理员或 `id=0` 管理员兼容逻辑
- 禁止在前端直接解析 `admin_auth` token 内容做复杂权限逻辑扩散

---

## 8. 数据库规范

### 8.1 当前核心数据域

当前应持续维护以下核心数据：

- 配置项
- 后台管理员
- 后台角色
- 管理员-角色关系
- 角色-权限关系
- 后台操作日志

### 8.2 结构定义规则

- 表结构分文件维护在 `server/db/schema/**`
- 统一由 `server/db/schema/index.ts` 汇总导出
- 数据库变更必须通过 Drizzle 管理

### 8.3 迁移规则

- 新增字段或表时，先改 schema，再生成 migration
- 不要手工修改已执行过的历史 migration
- 如果必须补兼容逻辑，要写新的 migration

### 8.4 数据访问规则

- 服务端所有数据库访问必须通过 `useDb()`
- 不在页面层做数据库访问
- 禁止字符串拼接 SQL 作为常规实现手段
- 优先使用 Drizzle 提供的表达式和查询能力

---

## 9. 代码风格规范

### 9.1 强制要求

- 使用 `async/await`
- 新增代码尽量避免 `any`
- 导出函数应声明明确返回类型
- 新增或重写的导出函数优先补充中文 JSDoc
- 复杂逻辑补充必要中文注释

### 9.2 前端要求

- 页面数据优先使用 `useFetch`、`useAsyncData`、`computed`
- 组件优先使用 `@nuxt/ui`
- 样式优先使用 Tailwind CSS v4
- Tailwind spacing 尺寸优先使用标准 scale 类；能被 4px 整除的宽高、间距、定位偏移、最小/最大宽高不要写任意值，例如 `min-w-[1120px]` 应写成 `min-w-280`、`max-w-[18rem]` 应写成 `max-w-72`、`left-[-8rem]` 应写成 `-left-32`
- 只有 `calc(...)`、复杂阴影、品牌色、非 scale 字号、特殊圆角、复杂 grid template（如 `grid-cols-[minmax(...)]`）或确实不在 Tailwind scale 内的值，才允许保留 `[...]` 任意值写法
- 后台页面优先保证可读性、操作性与信息密度

### 9.3 服务端要求

- 外部依赖调用尽量使用 `try/catch`
- 错误信息必须对排障有帮助
- 高风险业务不能吞错后假装成功

### 9.4 日志要求

- 服务端日志优先使用当前项目的 `consola` 与 `server/utils/log/**`
- 新增服务端日志时优先复用现有 logger
- 不要在服务端核心链路中随意使用 `console.log`
- 敏感字段应避免原样输出，例如：
  - token
  - password
  - secret

---

## 10. 文档、脚本与运维

### 10.1 需要同步关注的文件

完成阶段性重构后，至少检查是否需要同步更新：

- `README.md`
- `docs/README.md`
- `.env.development`
- `.env.production`
- `drizzle.config.ts`
- `AGENTS.md`

### 10.2 当前已有脚本

当前仓库已有并应继续保持可用的脚本：

- `dev`
- `build`
- `generate`
- `preview`
- `postinstall`
- `ecosystem:generate`
- `rbac:verify-routes`
- `rbac:precheck-db`
- `db:generate`
- `db:push`

### 10.3 自检建议

提交前至少根据改动范围验证：

- `npm run build`
- 如果改动了后台权限、后台页面、`/api/admin/**` 路由或管理员角色能力：`npm run rbac:verify-routes`
- 相关页面是否能正常打开
- 对应 API 是否返回预期数据
- 相关 Drizzle schema 与 migration 是否匹配

### 10.4 文档目录规范

所有由 AI 或开发过程新增、整理、审计、总结出来的项目文档，必须统一放入 `docs/**`。

根目录文档只允许保留：

- `AGENTS.md`
- `README.md`

`docs/**` 按以下类型分类维护：

- `docs/deployment/**`
- `docs/ai-work/**`
- `docs/audits/**`
- `docs/architecture/**`
- `docs/api/**`
- `docs/database/**`
- `docs/operations/**`

### 10.5 AI 工作文档要求

AI 每次工作如果产生方案、过程记录、审计报告、验收总结、问题排查记录或阶段任务清单，必须写入 `docs/**` 的对应分类目录，不得写在根目录。

AI 工作文档应满足：

- 文件名清晰，优先使用 `YYYY-MM-DD_主题.md`
- 文档开头写明日期、目的、涉及范围、是否影响后台核心链路
- 涉及高风险改动时必须单列“风险与验证”
- 新增重要文档后同步更新 `docs/README.md` 索引

---

## 11. 当前仓库特殊要求

### 11.1 后台迭代方向

后续改动应继续沿以下方向推进：

- 完善后台管理页面
- 完善账号、角色、权限、设置、日志能力
- 把重复 UI 结构继续抽成组件或 `blocks`
- 保持管理后台与服务端接口边界清晰

### 11.2 兼容性优先级

优先级从高到低：

1. 本文件
2. 当前仓库已有 `app/ + server/ + shared/` 结构
3. 后台登录与 RBAC 稳定性
4. 数据库 schema 与 migration 一致性
5. 后台页面可维护性
6. 通用最佳实践

### 11.3 实施原则

如果前端与后端同时改动：

- 先保登录与 RBAC
- 再保账号、设置、日志
- 再做后台页面体验优化

如果只是继续后台页面重构：

- 优先复用已有 API
- 优先复用已有组件和 composable
- 优先保持现有交互习惯
- 不为了抽象而抽象

如果只是继续服务端重构：

- 优先把复杂逻辑收敛到 `server/services/**`
- 优先把鉴权细节收敛到 `server/lib/**`
- 优先保持现有后台 API 路径与返回结构稳定
