// https://nuxt.com/docs/api/configuration/nuxt-config

import vueJsx from '@vitejs/plugin-vue-jsx'

const ADMIN_LAYOUT_EAGER_ICON_NAMES = [
  'lucide:alert-circle',
  'lucide:arrow-left',
  'lucide:arrow-right',
  'lucide:badge-info',
  'lucide:calendar',
  'lucide:chevron-down',
  'lucide:chevron-left',
  'lucide:chevron-right',
  'lucide:chevrons-left',
  'lucide:chevrons-right',
  'lucide:circle-alert',
  'lucide:circle-x',
  'lucide:clipboard-list',
  'lucide:ellipsis',
  'lucide:external-link',
  'lucide:eye',
  'lucide:eye-off',
  'lucide:file-text',
  'lucide:folder',
  'lucide:folder-open',
  'lucide:house',
  'lucide:key-round',
  'lucide:layout-dashboard',
  'lucide:leaf',
  'lucide:loader-circle',
  'lucide:lock',
  'lucide:lock-keyhole',
  'lucide:log-out',
  'lucide:moon',
  'lucide:panel-left',
  'lucide:pencil',
  'lucide:plus',
  'lucide:rotate-ccw',
  'lucide:search',
  'lucide:settings',
  'lucide:shield-alert',
  'lucide:shield-check',
  'lucide:shield-plus',
  'lucide:sliders-horizontal',
  'lucide:sun',
  'lucide:trash-2',
  'lucide:triangle-alert',
  'lucide:upload',
  'lucide:user',
  'lucide:user-plus',
  'lucide:user-round-cog',
  'lucide:users',
  'lucide:x'
]

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  srcDir: 'app',
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },
  pages: {
    pattern: ['**/*.vue', '!**/blocks/**']
  },
  modules: ['@nuxt/ui'],
  icon: {
    clientBundle: {
      icons: ADMIN_LAYOUT_EAGER_ICON_NAMES,
      scan: {
        globInclude: ['app/**/*.vue', 'app/**/*.ts', 'shared/**/*.ts']
      }
    }
  },
  ui: {
    theme: {
      colors: [
        'primary', 'secondary',
        'success', 'warning', 'error'
      ]
    }
  },
  ssr: false,
  devServer: {
    host: '0.0.0.0',
    port: 3000
  },
  css: ['~/assets/css/main.css'],
  fonts: {
    providers: {
      google: false,
      googleicons: false
    }
  },
  vite: {
    plugins: [vueJsx()] as any
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_API_URL
    }
  }
})
