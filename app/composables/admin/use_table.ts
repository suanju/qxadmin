import { h, type VNode } from 'vue'
import { UButton } from '#components'

export const ADMIN_TABLE_ACTION_COLUMN_ID = 'actions'

export interface AdminTableColumnPinningState {
  left?: string[]
  right?: string[]
}

interface AdminPinnableColumn {
  getIsPinned: () => false | 'left' | 'right'
  pin: (position: false | 'left' | 'right') => void
}

export const ADMIN_TABLE_UI = {
  th: 'font-semibold whitespace-nowrap',
  td: 'align-middle'
}

/**
 * 创建后台表格默认列固定状态。
 */
export function createAdminActionColumnPinning(): AdminTableColumnPinningState {
  return {
    right: [ADMIN_TABLE_ACTION_COLUMN_ID]
  }
}

/**
 * 渲染可切换固定状态的操作列表头。
 */
export function renderAdminPinnedActionHeader(column: AdminPinnableColumn, label = '操作'): VNode {
  const isPinnedRight = column.getIsPinned() === 'right'

  return h('div', { class: 'flex justify-center' }, [
    h(UButton, {
      color: 'neutral',
      variant: isPinnedRight ? 'soft' : 'ghost',
      size: 'xs',
      icon: isPinnedRight ? 'i-lucide-pin' : 'i-lucide-pin-off',
      label,
      'aria-label': isPinnedRight ? `取消固定${label}列` : `固定${label}列到右侧`,
      onClick: () => column.pin(isPinnedRight ? false : 'right')
    })
  ])
}

/**
 * 生成右侧操作列的通用样式，由 Nuxt UI columnPinning 负责 sticky 定位。
 */
export function createAdminActionColumnMeta(minWidthClass = 'min-w-28'): {
  class: { th: string; td: string }
} {
  return {
    class: {
      th: `text-center ${minWidthClass} bg-default/95 backdrop-blur`,
      td: `text-center ${minWidthClass} bg-default/95 backdrop-blur shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]`
    }
  }
}
