export interface ConfigItem {
  id: number
  name: string
  group: string
  title: string
  tip: string
  type: ConfigType
  value: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type ConfigType = 'string' | 'text' | 'int' | 'bool' | 'array' | 'datetime' | 'date' | 'file' | 'image'

export interface ConfigTypeOption {
  value: ConfigType
  label: string
}

export interface ConfigFormModel {
  name: string
  group: string
  title: string
  tip: string
  type: ConfigType
  value: string
}

export interface ConfigGroup {
  name: string
  label: string
  items: ConfigItem[]
}

export interface ConfigApiResponse {
  success: boolean
  data: ConfigItem | ConfigItem[] | null
  message?: string
  total?: number
}
