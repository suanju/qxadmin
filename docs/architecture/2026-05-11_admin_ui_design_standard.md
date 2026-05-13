# 2026-05-11 Admin UI 统一设计规范

## 基本信息

- 日期：2026-05-11
- 目的：参考 `xin-admin-laravel` 的前端组织方式，规范 qxadmin 后台的表格、表单、模态框和批量操作样式。
- 涉及范围：`app/pages/**`、`app/components/admin/**`、后台 API 页面交互规范。
- 是否影响后台核心链路：影响页面与交互规范；不改变登录、RBAC、token、管理员角色核心机制。

## 参考结论

`xin-admin-laravel` 的前端核心不是某个视觉皮肤，而是把后台 CRUD 页面固定成一套可配置结构：

- `XinTable` 统一承载搜索、关键字查询、表格、分页、列设置、刷新、密度、操作列。
- `XinForm` 统一承载新增、编辑、抽屉或弹窗表单，并通过字段配置生成控件。
- 列表页默认具备顶部操作栏、右侧工具栏、行级操作和权限按钮。
- 系统设置采用左侧分组、右侧配置项表单的结构，配置项按类型渲染输入控件。
- 文件管理、用户管理等高频后台页都默认支持多选和批量操作。

qxadmin 当前技术栈是 Nuxt 4 + Vue 3 + `@nuxt/ui`，因此只学习结构和交互模式，不引入 React、Ant Design 或 xin-admin 的目录结构。

## 页面骨架

所有后台列表页建议使用以下顺序：

1. `AdminPageHeader`
2. 筛选工具栏
3. 批量操作条
4. 表格区域
5. `AdminTablePaginationBar`
6. 新增/编辑 `UModal`
7. 删除或高风险操作 `AdminConfirmModal`

页面根容器统一：

```vue
<div class="min-h-[calc(100vh-8rem)] p-6 md:p-8">
```

普通后台卡片统一：

```vue
<UCard class="overflow-hidden shadow-lg ring-1 ring-gray-200/50 dark:ring-gray-700/50">
```

## 表格规范

每个后台表格都必须具备：

- 第一列为多选框。
- 表头多选支持当前页全选和半选态。
- 选择后展示 `AdminTableBulkBar`。
- 至少提供一个批量操作；只读表格也应展示选择能力，批量操作可以是“导出、标记、清除选择”等安全动作。
- 右侧操作列固定，避免横向滚动时丢失操作入口。
- 分页统一使用 `AdminTablePaginationBar`。
- 空状态统一使用 `UEmpty`。
- 加载态统一使用 `i-lucide-loader-circle`。

表格最小宽度按内容密度使用 Tailwind scale，例如：

- 常规列表：`min-w-280`
- 字段较多列表：`min-w-305`、`min-w-310`
- 不使用 `min-w-[1120px]` 这类可被 scale 替代的任意值。

## 批量操作条

统一组件：`app/components/admin/admin_table_bulk_bar.vue`

使用规则：

- 仅在 `selectedCount > 0` 时显示。
- 左侧显示已选数量。
- 右侧放批量操作按钮和取消选择。
- 高风险批量操作必须二次确认。
- 后端批量写操作必须记录审计日志。

## 搜索与筛选栏

筛选栏放在表格卡片顶部，背景为 `bg-muted/35`，底部边框为 `border-default/60`。

常规布局：

```vue
<div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto_auto] lg:items-end">
```

要求：

- 关键词输入框在最左侧，占主要宽度。
- 状态、类型等短筛选放右侧固定宽度列。
- 提供“重置”和“刷新”。
- 搜索输入变化可 debounce，状态筛选变化可立即刷新。

## 表单规范

新增和编辑优先使用 `UModal` + `UFormField`，布局统一：

- 简单表单：`max-w-xl`
- 常规双列表单：`max-w-4xl`
- 复杂授权或多区块表单：`max-w-6xl`
- `body` 使用 `sm:p-6`
- `footer` 使用 `border-t border-default/60 bg-muted/20`

表单区块使用 8px 圆角：

```vue
<section class="rounded-lg border border-default/60 bg-default/90 p-4">
```

字段布局：

- 移动端单列。
- 桌面端两列：`grid grid-cols-1 gap-4 md:grid-cols-2`
- 长文本、备注、JSON 配置跨两列：`md:col-span-2`
- 控件统一 `class="w-full"`。

## 模态框规范

所有新增、编辑、重置密码、详情弹窗遵循：

- 标题为动作 + 对象，例如“新增用户”“编辑用户”“重置密码”。
- `description` 说明业务用途，不写冗长帮助。
- 底部按钮右对齐，取消按钮 `neutral/subtle`，主按钮 `primary`。
- 删除、高风险操作统一用 `AdminConfirmModal`，不散落自定义确认弹窗。

## 系统设置规范

系统设置页面从“多卡片堆叠”调整为：

- 左侧配置分组。
- 右侧当前分组配置项。
- 每个配置项保留标题、变量名、说明、输入控件、删除按钮。
- 配置项支持多选和批量删除。
- 写操作继续走 `/api/admin/config`，不绕过现有审计链路。

后续如要进一步接近 xin-admin，可新增独立的“配置分组表”，但当前 qxadmin 仍复用 `config.group`，避免为视觉调整引入不必要数据库复杂度。

## 用户列表示例

已新增 `/user_management/demo_users` 作为 UI 规范展示页，并归入独立“用户管理”菜单目录：

- 数据表：`admin_demo_user`
- 页面：`app/pages/user_management/demo_users/index.vue`
- API：`/api/admin/demo_users`
- 权限：`demo_users.read`、`demo_users.manage`
- 种子脚本：`npm run demo-users:seed`

该页面仅用于展示统一后台列表交互，不代表 qxadmin 重新扩展为业务用户系统。

## 风险与验证

- 新增后台 API 必须进入 `server/rbac/modules/*.json` 的 `type=api` 节点。
- 新增页面权限必须进入 `server/rbac/modules/*.json` 的菜单、页面或按钮节点。
- RBAC 运行时只读取数据库权限目录，需要执行 `npm run rbac:sync` 同步权限数据。
- 数据库需要应用 `server/db/migrations/0004_admin_demo_user.sql`，本地可通过 `npm run demo-users:seed` 创建并填充示例表。

建议验证：

- `npm run build`
- `npm run rbac:verify-routes`
- 打开 `/user_management/demo_users` 检查多选、批量操作和表单弹窗。
- 打开 `/settings` 检查左侧分组、右侧配置项、多选批量删除。
