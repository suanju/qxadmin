# 2026-05-10 代码与目录命名规范化记录

日期：2026-05-10

目的：根据 `AGENTS.md` 对当前仓库的目录、文件命名与导出函数类型声明做一次小范围规范化。

涉及范围：

- `app/types/**`
- `app/composables/**`
- `app/pages/settings/blocks/**`
- `server/middleware/**`
- `server/utils/log/**`
- `docs/**`
- `AGENTS.md`

是否影响后台核心链路：不直接改动登录、RBAC、管理员账号、角色、设置 API、操作日志、上传 API 或数据库 schema。改动涉及 `/settings` 页面引用路径和 app composable 文件名，需要通过构建验证 Nuxt 自动导入与页面编译是否正常。

## 变更内容

- 修正 `app/types/peges.settings.ts` 拼写错误，改为 `app/types/page_settings.ts`。
- 将 settings 页面私有 block 文件统一为 `index_xxx.vue` 风格：
  - `index.groups.vue` -> `index_groups.vue`
  - `index.form_modal.vue` -> `index_form_modal.vue`
  - `index.verify_guard.vue` -> `index_verify_guard.vue`
- 将 `app/composables` 下模块文件名统一为 snake_case，同时保持导出函数名不变：
  - `useAdminAuth.ts` -> `use_admin_auth.ts`
  - `useAdminFetch.ts` -> `use_admin_fetch.ts`
  - `useAdminMutationFeedback.ts` -> `use_admin_mutation_feedback.ts`
  - `useAdminPagedList.ts` -> `use_admin_paged_list.ts`
  - `useAppNav.ts` -> `use_app_nav.ts`
- 将服务端内部模块文件名统一为 snake_case：
  - `server/middleware/admin-auth.ts` -> `server/middleware/admin_auth.ts`
  - `server/middleware/admin-audit.ts` -> `server/middleware/admin_audit.ts`
  - `server/middleware/api-logger.ts` -> `server/middleware/api_logger.ts`
  - `server/utils/log/logger-file-reporter.ts` -> `server/utils/log/logger_file_reporter.ts`
- 同步更新服务端日志插件与日志工具中的导入路径。
- 为 app 层新增或调整的导出 composable 补充显式返回类型。
- 同步更新 `AGENTS.md` 与 `docs/**` 中指向当前文件路径的引用。

## 风险与验证

- 风险：Nuxt composable 自动导入需要重新扫描重命名后的文件。
- 风险：`/settings` 页面私有 block 引用路径变更可能导致构建失败。
- 验证：`npm run build` 已通过，Nuxt client、Nitro server 和 `ecosystem.config.js` 生成均成功。
- 验证：`npm run rbac:verify-routes` 已通过，后台 API 路由文件 24 个，静态与数据库权限映射未发现遗漏。
- 备注：构建过程中出现来自依赖包 exports 尾随斜杠映射的 Node `DEP0155` warning，构建结果为成功；本次未改动依赖版本。
