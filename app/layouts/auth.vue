<script setup lang="ts">
const colorMode = useColorMode();

function toggleColorMode() {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
}
</script>

<template>
  <div class="auth-layout relative min-h-screen overflow-hidden bg-default">
    <!-- 主题切换 -->
    <div class="absolute right-4 top-4 z-10">
      <UButton
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="soft"
        size="md"
        class="rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
        :aria-label="colorMode.value === 'dark' ? '切换为浅色' : '切换为深色'"
        @click="toggleColorMode"
      />
    </div>
    <main class="relative min-h-screen">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.auth-bg-gradient {
  background: linear-gradient(
    135deg,
    hsl(var(--color-primary-500) / 0.12) 0%,
    hsl(var(--color-primary-400) / 0.06) 25%,
    transparent 50%,
    hsl(var(--color-primary-600) / 0.08) 75%,
    hsl(var(--color-primary-500) / 0.1) 100%
  );
  background-size: 400% 400%;
  animation: gradient-shift 15s ease infinite;
}

.dark .auth-bg-gradient {
  background: linear-gradient(
    135deg,
    hsl(var(--color-primary-500) / 0.18) 0%,
    hsl(var(--color-primary-600) / 0.08) 30%,
    transparent 50%,
    hsl(var(--color-primary-400) / 0.1) 70%,
    hsl(var(--color-primary-500) / 0.14) 100%
  );
  background-size: 400% 400%;
  animation: gradient-shift 18s ease infinite;
}

.auth-bg-grid {
  color: hsl(var(--color-neutral-400));
}

.dark .auth-bg-grid {
  color: hsl(var(--color-neutral-600));
}

@keyframes gradient-shift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
</style>
