# 严格角色模式执行记录

日期：2026-05-12

目的：开始落地 `docs/audits/2026-05-12_vue3_admin_framework_gap_analysis.md` 中 P1/P5 提到的严格角色模式，防止普通管理员在角色创建、编辑授权时分配自己没有的权限。

涉及范围：管理员与角色 service、环境变量、部署文档、阶段任务清单。

是否影响后台核心链路：影响管理员角色授权链路。默认 `ADMIN_STRICT_ROLE_MODE=false`，未开启时保持现有行为；开启后普通管理员的角色授权会增加服务端约束。

## 本次完成

- 在 `server/services/auth/admin_account.ts` 增加 `ADMIN_STRICT_ROLE_MODE` 开关读取。
- 在角色创建与角色编辑授权前增加服务端校验。
- 严格模式下，超级管理员仍可分配全部已知权限。
- 严格模式下，普通管理员只能分配自己当前 `AdminContext.permissions` 中已有的权限。
- 无效权限 code 仍先按原有逻辑返回 `400`，不会被误判为越权 `403`。
- `.env.development`、`.env.production` 增加 `ADMIN_STRICT_ROLE_MODE=false` 默认值。
- `docs/deployment/README.md` 增加该环境变量入口。
- `docs/ai-work/agent_task/07_nuxt_fullstack_admin_framework_tasks.md` 勾选严格角色模式最小服务端约束。

## 当前边界

本次实现的是“可分配权限集合”服务端约束，不包含完整上下级角色树：

- 已完成：普通管理员不能给角色分配自己没有的权限。
- 已保留：超级管理员角色不可禁用，超级管理员账号保护，角色权限变更后提升绑定用户 `token_version`。
- 待后续：普通管理员只能看见/管理下级角色、不能创建高于或等于自己的角色、角色层级模型。

## 风险与验证

主要风险：

- 开启严格模式后，如果普通管理员自身权限不完整，会无法保存包含更高权限的角色。
- 数据库权限目录缺失时，角色授权仍会按已知权限校验，需保证 `rbac:sync` 与 `rbac:verify-db` 通过。

建议验证：

```bash
npm run rbac:verify-routes
npm run build
```

涉及数据库权限目录切换时额外执行：

```bash
npm run rbac:sync
npm run rbac:verify-db
```
