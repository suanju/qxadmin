<script setup lang="ts">
import { CalendarDate, type DateValue } from '@internationalized/date'

type DateInputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface DateRangeModel {
  start: DateValue | undefined
  end: DateValue | undefined
}

const props = withDefaults(defineProps<{
  dateStart?: string
  dateEnd?: string
  size?: DateInputSize
  numberOfMonths?: number
  ariaLabel?: string
  disabled?: boolean
}>(), {
  dateStart: '',
  dateEnd: '',
  size: 'sm',
  numberOfMonths: 2,
  ariaLabel: '选择日期范围',
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:dateStart', value: string): void
  (e: 'update:dateEnd', value: string): void
  (e: 'update:dateRange', value: { dateStart: string; dateEnd: string }): void
}>()

const inputDate = useTemplateRef('inputDate')
const dateRange = shallowRef<DateRangeModel>(createDateRange(props.dateStart, props.dateEnd))
const dateRangeModel = computed<DateRangeModel>({
  get: () => dateRange.value,
  set: (value) => {
    dateRange.value = normalizeDateRange(value)
  }
})

function parseDateValue(value: string | undefined): CalendarDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return new CalendarDate(year, month, day)
}

function formatDateValue(date: DateValue | undefined): string {
  if (!date) return ''

  const y = date.year
  const m = String(date.month).padStart(2, '0')
  const d = String(date.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function createDateRange(dateStart: string | undefined, dateEnd: string | undefined): DateRangeModel {
  const start = parseDateValue(dateStart)
  const end = parseDateValue(dateEnd)

  return { start, end }
}

function normalizeDateRange(value: DateRangeModel | null | undefined): DateRangeModel {
  return {
    start: value?.start,
    end: value?.end
  }
}

watch(
  () => [props.dateStart, props.dateEnd] as const,
  ([dateStart, dateEnd]) => {
    const currentStart = formatDateValue(dateRange.value?.start)
    const currentEnd = formatDateValue(dateRange.value?.end)

    if (currentStart === dateStart && currentEnd === dateEnd) return

    dateRange.value = createDateRange(dateStart, dateEnd)
  }
)

watch(dateRange, (range) => {
  const dateStart = formatDateValue(range.start)
  const dateEnd = formatDateValue(range.end)

  if (dateStart !== props.dateStart) {
    emit('update:dateStart', dateStart)
  }

  if (dateEnd !== props.dateEnd) {
    emit('update:dateEnd', dateEnd)
  }

  if (dateStart !== props.dateStart || dateEnd !== props.dateEnd) {
    emit('update:dateRange', { dateStart, dateEnd })
  }
})
</script>

<template>
  <UInputDate
    ref="inputDate"
    v-model="dateRangeModel"
    range
    locale="zh-CN"
    granularity="day"
    separator-icon="i-lucide-arrow-right"
    :size="size"
    :disabled="disabled"
    :aria-label="ariaLabel"
  >
    <template #trailing>
      <UPopover :reference="inputDate?.inputsRef[0]?.$el">
        <UButton
          color="neutral"
          variant="link"
          :size="size"
          icon="i-lucide-calendar"
          aria-label="打开日期范围选择器"
          class="px-0"
          :disabled="disabled"
        />

        <template #content>
          <UCalendar
            v-model="dateRangeModel"
            range
            locale="zh-CN"
            class="p-2"
            :number-of-months="numberOfMonths"
            :disabled="disabled"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
