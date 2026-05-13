# qxadmin 文档中心

当前仓库是新的通用 admin 后台内核。除 `AGENTS.md` 与根目录 `README.md` 外，AI 或开发过程新增的过程记录、部署说明、接口说明、数据库说明、审计报告等都必须放入 `docs/**` 对应分类目录。

## 分类目录

| 目录 | 类型 | 放置内容 |
| --- | --- | --- |
| `deployment/` | 部署文档 | 部署、启动、环境变量、发布、回滚、服务器配置 |
| `ai-work/` | AI 工作过程 | AI 执行过程、阶段任务清单、重构记录、阶段验收总结 |
| `audits/` | 审计文档 | 接口、权限、稳定性审计 |
| `architecture/` | 架构文档 | 系统架构、目录结构、模块边界、技术选型、设计说明 |
| `api/` | 接口文档 | 后台 API 清单、入参出参、鉴权边界说明 |
| `database/` | 数据库文档 | 表结构、迁移说明、Drizzle 使用说明 |
| `operations/` | 运维与排障 | 日志查看、后台运维处理流程、故障排查 |

## 当前重点索引

### AI 工作过程

- [`ai-work/agent_task/07_nuxt_fullstack_admin_framework_tasks.md`](ai-work/agent_task/07_nuxt_fullstack_admin_framework_tasks.md)：Task 07 Nuxt 全栈 Admin 框架化重构任务清单（数据库动态权限版）
- [`ai-work/2026-05-10_admin_framework_reference_study.md`](ai-work/2026-05-10_admin_framework_reference_study.md)：`gin-vue-admin` 与 `catch-admin` 参考设计学习记录
- [`ai-work/2026-05-10_task07_p0_p2_execution.md`](ai-work/2026-05-10_task07_p0_p2_execution.md)：Task 07 P0-P2 动态 RBAC 执行记录
- [`ai-work/2026-05-10_task07_p10_file_upload_execution.md`](ai-work/2026-05-10_task07_p10_file_upload_execution.md)：Task 07 P10 文件上传与文件管理执行记录
- [`ai-work/2026-05-10_ts_type_audit.md`](ai-work/2026-05-10_ts_type_audit.md)：TS 类型审查与弱类型收敛记录
- [`ai-work/2026-05-10_code_directory_naming_normalization.md`](ai-work/2026-05-10_code_directory_naming_normalization.md)：代码、目录与文件命名规范化记录
- [`ai-work/2026-05-10_browser_page_warning_cleanup.md`](ai-work/2026-05-10_browser_page_warning_cleanup.md)：浏览器打开页面与控制台 warning/error 排查记录
- [`ai-work/2026-05-10_log_management_optimization.md`](ai-work/2026-05-10_log_management_optimization.md)：日志管理、轮转、清理与归档优化记录
- [`ai-work/2026-05-12_dynamic_menu_database_rendering.md`](ai-work/2026-05-12_dynamic_menu_database_rendering.md)：参考 xin-admin 的动态菜单数据库渲染改造记录
- [`ai-work/2026-05-12_vue3_admin_gap_p0_execution.md`](ai-work/2026-05-12_vue3_admin_gap_p0_execution.md)：Vue 3 admin 差距方案 P0 接口文档与 RBAC 边界执行记录
- [`ai-work/2026-05-12_strict_role_mode_execution.md`](ai-work/2026-05-12_strict_role_mode_execution.md)：严格角色模式服务端授权约束执行记录
- [`ai-work/2026-05-12_remove_rbac_static_fallback.md`](ai-work/2026-05-12_remove_rbac_static_fallback.md)：移除 RBAC 静态兜底与双轨运行模式记录
- [`ai-work/2026-05-12_directory_file_naming_normalization.md`](ai-work/2026-05-12_directory_file_naming_normalization.md)：目录与文件命名规范化记录
- [`ai-work/2026-05-12_nuxt_ui_table_pinning_standard.md`](ai-work/2026-05-12_nuxt_ui_table_pinning_standard.md)：Nuxt UI Table 操作列 pinning 规范化记录

### 架构文档

- [`architecture/2026-05-10_nuxt_fullstack_admin_refactor_design.md`](architecture/2026-05-10_nuxt_fullstack_admin_refactor_design.md)：Nuxt 全栈 Admin 框架重构设计（数据库动态权限版）
- [`architecture/2026-05-11_admin_ui_design_standard.md`](architecture/2026-05-11_admin_ui_design_standard.md)：参考 xin-admin 的后台表格、表单、模态框与批量操作统一规范

### 审计文档

- [`audits/2026-05-12_vue3_admin_framework_gap_analysis.md`](audits/2026-05-12_vue3_admin_framework_gap_analysis.md)：Vue 3 admin 参考框架对比、当前项目不足与分阶段改进方案

### 数据库文档

- [`database/2026-05-10_qxadmin_db_init.md`](database/2026-05-10_qxadmin_db_init.md)：`qxadmin` 本地数据库初始化与验证记录
- [`database/2026-05-10_dynamic_rbac_baseline.md`](database/2026-05-10_dynamic_rbac_baseline.md)：动态 RBAC 数据库模型与权限迁移基线记录
- [`database/README.md`](database/README.md)：当前 admin 内核数据库范围说明

### 运维与排障

- [`operations/2026-05-10_log_management.md`](operations/2026-05-10_log_management.md)：日志分割、大小轮转、保留期清理与归档说明
- [`operations/2026-05-10_node_dep0155_warning_cleanup.md`](operations/2026-05-10_node_dep0155_warning_cleanup.md)：Node `DEP0155` warning 排查与脚本处理记录

## 说明

新增文档前先判断主要用途并放入对应目录；如果横跨多个主题，按主要用途归类，并在本索引补充入口。
