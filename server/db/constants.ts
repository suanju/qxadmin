/**
 * 数据库表前缀，从环境变量 TABLE_PREFIX 读取，未设置时默认 ta_
 */
export const tablePrefix = (process.env.TABLE_PREFIX ?? 'ta_').replace(/_?$/, '_')
