# Nuxt UI Table Pinning 规范化记录

日期：2026-05-12

目的：参考 Nuxt UI `Table` 的 column pinning 用法，统一后台表格操作列固定在右侧的实现方式。

涉及范围：

- `app/composables/use_admin_table.ts`
- `app/pages/user_management/demo_users/index.vue`
- `app/pages/files/index.vue`
- `app/pages/operation_logs/index.vue`

是否影响后台核心链路：不影响登录、RBAC、数据库 schema、后台 API 或操作日志写入链路。本次只调整后台页面表格展示实现。

## 变更内容

- 新增 `use_admin_table` 表格辅助模块，统一：
  - `columnPinning.right = ['actions']`
  - 操作列表头 pin/unpin 按钮
  - 操作列右侧阴影与背景样式
  - 表头、单元格基础 `ui` 配置
- 将用户列表示例、文件管理、操作日志三处 `UTable` 改为 `v-model:column-pinning` 受控模式。
- 为所有表格列补充 TanStack `size`，让横向滚动和固定列宽度更稳定。
- 将表格最小宽度放入 Nuxt UI `base` slot，避免把 `min-w-*` 加到 `UTable` 根滚动容器后影响 pinned 定位参照。

## 风险与验证

- 风险：固定列依赖 Nuxt UI / TanStack Table 的 pinning 状态，如果未来列 `id` 改名，需同步 `columnPinning.right`。
- 已执行 `npm run build`，构建通过。
- 已在本地 `http://localhost:3101/user_management/demo_users` 与 `/operation_logs` 用窄视口验证横向滚动，操作列保持 `data-pinned="right"` 且 `position: sticky`。
- `/files` 当前本地无文件数据，只验证空态页面正常。
