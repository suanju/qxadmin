# 目录与文件命名规范化

日期：2026-05-12

目的：按当前 `app/ + server/ + shared/` 项目结构规范化服务层、组件、类型文件和过渡兼容目录，减少泛命名与已废弃文件残留。

涉及范围：`app/components/**`、`app/pages/**`、`app/types/**`、`server/services/**`、`server/utils/**`、`docs/**`。

是否影响后台核心链路：轻微影响。改动主要是文件位置和引用路径调整；不改变后台 API URL、数据库结构、登录、RBAC 权限码或页面主路径。

## 修改内容

- `server/services/auth/admin.ts` 重命名为 `server/services/auth/admin_login.ts`。
- `server/services/config/config_admin.ts` 重命名为 `server/services/config/admin_config.ts`。
- `server/services/dashboard/admin.ts` 重命名为 `server/services/dashboard/admin_dashboard.ts`。
- `app/types/page_settings.ts` 重命名为 `app/types/settings.ts`。
- `app/components/table_search/index.vue` 移动为 `app/components/admin/admin_table_search.vue`，并删除空的 `table_search` 目录。
- 删除冗余 `/admin` 重定向页面目录 `app/pages/admin/**`。
- 删除未使用的旧响应兼容目录 `server/utils/response/**`。
- 删除已空置的 `server/constants/` 目录。
- 更新所有源码 import 和相关文档路径。

## 风险与验证

- 风险：如果外部仍手动访问 `/admin`，该旧重定向页已不存在，应改用 `/dashboard`。
- 风险：如果后续代码引用旧 service 路径，构建会失败。
- 验证：执行 `npm run rbac:verify-routes`、`npm run build`。
