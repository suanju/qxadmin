# 2026-05-10 TS 类型审查与规范记录

## 基本信息

- 日期：2026-05-10
- 目的：审查并收敛项目内 TypeScript 弱类型写法，减少 `any`、`@ts-ignore`、双重断言和异常对象弱类型。
- 涉及范围：`app/**`、`server/**`、`shared/**`、`scripts/**`
- 是否影响后台核心链路：影响代码类型边界，不改变登录、RBAC、设置、日志、上传 API 行为。

## 本次调整

- 服务端数据库连接：`useDb()` 改为 Drizzle 泛型返回，移除数据库初始化处的双重断言。
- JWT 鉴权：新增 `isAdminTokenPayload` 运行时类型守卫，替代 `payload as unknown as AdminTokenPayload`。
- IP 归属地：`ip2region.js` 搜索器和向量索引改为 `Searcher`、`Buffer` 类型，并让操作日志服务复用 `server/utils/ip/ip_location.ts`。
- 操作日志查询：Drizzle 查询条件数组改为 `SQL[]`，避免 `any[]`。
- 审计工具：移除 H3 socket 访问处的 `@ts-ignore`，并让 `diffObjects` 接收对象类型，减少调用处强转。
- 日志工具：API 日志事件参数改为 `H3Event`，consola 动态方法包装改为有限方法名联合类型。
- 前端组件：搜索框、设置二次验证弹窗的组件 ref 改为显式可聚焦类型。
- 设置上传与操作日志页面：`catch` 统一使用 `unknown`，错误文案复用 `getAdminFetchErrorMessage`；日志详情预览新增显式转换函数。

## 风险与验证

- 风险：类型收敛可能暴露 Nuxt UI 组件实例结构或 Drizzle 条件类型不兼容。
- 处理：保留运行时行为不变，只收紧边界类型；涉及外部库的地方优先使用其导出类型。
- 验证：
  - `rg "\bany\b|@ts-ignore|@ts-expect-error|unknown as|as never|Record<string, any>|catch \(.*: any\)" --glob "*.ts" --glob "*.tsx" --glob "*.vue" app server shared scripts -n`
  - `npm run build`

