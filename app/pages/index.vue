<script setup lang="ts">
definePageMeta({
  middleware: [
    () => navigateTo('/dashboard', { replace: true })
  ]
})
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)]" />
</template>
