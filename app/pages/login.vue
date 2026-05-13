<script setup lang="ts">
definePageMeta({ layout: false });

useHead({
  title: "后台登录",
});

interface LoginCaptchaResponse {
  captchaId: string;
  imageDataUrl: string;
  expiresInSec: number;
}

const username = ref("");
const password = ref("");
const captchaCode = ref("");
const captchaId = ref("");
const captchaImage = ref("");
const rememberMe = ref(false);
const passwordVisible = ref(false);
const loading = ref(false);
const captchaLoading = ref(false);
const toast = useToast();
const router = useRouter();
const { refreshCurrentAdmin } = useAdminAuth();
const colorMode = useColorMode();

const errors = reactive({
  username: false,
  password: false,
  captcha: false,
});

const passwordInputType = computed(() => (passwordVisible.value ? "text" : "password"));
const passwordIcon = computed(() =>
  passwordVisible.value ? "i-lucide-eye" : "i-lucide-eye-off"
);
const colorModeIcon = computed(() =>
  colorMode.value === "dark" ? "i-lucide-sun" : "i-lucide-moon"
);
const colorModeLabel = computed(() =>
  colorMode.value === "dark" ? "切换为浅色" : "切换为深色"
);
const canSubmit = computed(() => {
  return (
    !!username.value.trim() &&
    !!password.value.trim() &&
    !!captchaCode.value.trim() &&
    !!captchaId.value &&
    !loading.value &&
    !captchaLoading.value
  );
});

function clearError(field: keyof typeof errors): void {
  errors[field] = false;
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  const typed = error as { data?: { message?: string }; message?: string };
  return typed?.data?.message || typed?.message || fallback;
}

async function loadCaptcha(showError = true): Promise<void> {
  if (captchaLoading.value) return;

  captchaLoading.value = true;
  try {
    const result = await $fetch<LoginCaptchaResponse>("/api/admin/auth/captcha");
    captchaId.value = result.captchaId;
    captchaImage.value = result.imageDataUrl;
    captchaCode.value = "";
  } catch (error: unknown) {
    captchaId.value = "";
    captchaImage.value = "";
    if (showError) {
      toast.add({
        title: "验证码加载失败",
        description: getRequestErrorMessage(error, "请稍后重试"),
        color: "error",
        icon: "i-lucide-circle-x",
      });
    }
  } finally {
    captchaLoading.value = false;
  }
}

async function refreshCaptcha(): Promise<void> {
  await loadCaptcha(true);
  clearError("captcha");
}

function togglePasswordVisible(): void {
  passwordVisible.value = !passwordVisible.value;
}

function toggleColorMode(): void {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
}

function showForgotPasswordTip(): void {
  toast.add({
    title: "请联系超级管理员重置密码",
    color: "warning",
    icon: "i-lucide-circle-alert",
  });
}

async function submitLogin(): Promise<void> {
  if (loading.value || captchaLoading.value) return;

  const usernameValue = username.value.trim();
  const passwordValue = password.value.trim();
  const captchaValue = captchaCode.value.trim();

  errors.username = !usernameValue;
  errors.password = !passwordValue;
  errors.captcha = !captchaValue || !captchaId.value;

  if (errors.username || errors.password || errors.captcha) {
    toast.add({
      title: "请完善登录信息",
      description: errors.username
        ? "请输入用户名"
        : errors.password
          ? "请输入密码"
          : captchaValue
            ? "请刷新验证码后重试"
            : "请输入图片验证码",
      color: "warning",
      icon: "i-lucide-triangle-alert",
    });
    if (!captchaId.value) {
      await refreshCaptcha();
    }
    return;
  }

  loading.value = true;
  try {
    await $fetch("/api/admin/auth/login", {
      method: "POST",
      body: {
        username: usernameValue,
        password: passwordValue,
        captchaId: captchaId.value,
        captchaCode: captchaValue,
        rememberMe: rememberMe.value,
      },
    });

    toast.add({
      title: "登录成功",
      description: "正在跳转...",
      color: "success",
      icon: "i-lucide-check",
    });

    await refreshCurrentAdmin();
    await router.push("/dashboard");
  } catch (error: unknown) {
    toast.add({
      title: "登录失败",
      description: getRequestErrorMessage(error, "请检查登录信息后重试"),
      color: "error",
      icon: "i-lucide-circle-x",
    });
    await loadCaptcha(false);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadCaptcha(false);
});
</script>

<template>
  <main class="min-h-screen w-screen overflow-hidden bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <div class="absolute right-4 top-4 z-30">
      <UButton
        :icon="colorModeIcon"
        color="neutral"
        variant="soft"
        size="md"
        class="rounded-full border border-white/70 bg-white/85 shadow-lg backdrop-blur-sm transition-transform hover:scale-105 dark:border-slate-700/80 dark:bg-slate-900/85"
        :aria-label="colorModeLabel"
        :title="colorModeLabel"
        @click="toggleColorMode"
      />
    </div>

    <section class="flex min-h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 max-lg:flex-col">
      <aside
        class="login-visual relative flex min-h-screen flex-[1.05] items-center justify-center overflow-hidden bg-[#DBEBE5] px-10 py-12 text-slate-900 dark:bg-slate-900 dark:text-slate-50 max-lg:min-h-105"
      >
        <div class="absolute inset-0 bg-white/20 dark:bg-slate-950/55" />
        <div class="relative z-10 flex w-full max-w-150 flex-col items-center">
          <div class="mt-10 text-center">
            <h1
              class="text-[30px] font-bold leading-tight tracking-normal text-slate-950 dark:text-white"
            >
              管理后台系统
            </h1>
            <p class="mt-2 text-sm font-medium text-[#008D2E] dark:text-emerald-300">
              Administration & Management Platform
            </p>
          </div>
        </div>
      </aside>

      <section
        class="relative flex flex-1 items-center justify-center overflow-hidden bg-white px-6 py-12 dark:bg-slate-950 sm:px-10 lg:px-20"
      >
        <div class="pointer-events-none absolute inset-y-0 left-0 w-px bg-slate-200 dark:bg-slate-800" />

        <form class="relative z-10 w-full max-w-100" @submit.prevent="submitLogin">
          <div class="mb-12 flex items-center gap-2.5">
            <div
              class="flex size-11 items-center justify-center rounded-xl bg-[#00C950] text-white shadow-lg shadow-[#00C950]/20"
            >
              <UIcon name="i-lucide-leaf" class="size-6" />
            </div>
            <div>
              <p class="text-lg font-bold tracking-normal text-slate-950 dark:text-white">
                LandingPageAdmin
              </p>
              <p class="text-xs font-medium text-[#008D2E] dark:text-emerald-300">Management Console</p>
            </div>
          </div>

          <div class="mb-5">
            <label
              class="mb-2 block text-[13px] font-medium tracking-normal text-slate-700 dark:text-slate-200"
              >用户名</label
            >
            <div class="relative">
              <UIcon
                name="i-lucide-user"
                class="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                v-model="username"
                class="h-12 w-full rounded-xl border bg-white px-4 pl-11 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#00C950] focus:ring-4 focus:ring-[#00C950]/15 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-[#00C950]/20"
                :class="
                  errors.username
                    ? 'border-red-500 ring-4 ring-red-100 dark:ring-red-950/50'
                    : 'border-slate-200 dark:border-slate-700'
                "
                type="text"
                placeholder="请输入用户名"
                autocomplete="username"
                @input="clearError('username')"
              />
            </div>
            <p v-if="errors.username" class="mt-1.5 text-xs text-red-600">请输入用户名</p>
          </div>

          <div class="mb-5">
            <label
              class="mb-2 block text-[13px] font-medium tracking-normal text-slate-700 dark:text-slate-200"
              >密码</label
            >
            <div class="relative">
              <UIcon
                name="i-lucide-lock"
                class="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                v-model="password"
                class="h-12 w-full rounded-xl border bg-white px-11 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#00C950] focus:ring-4 focus:ring-[#00C950]/15 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-[#00C950]/20"
                :class="
                  errors.password
                    ? 'border-red-500 ring-4 ring-red-100 dark:ring-red-950/50'
                    : 'border-slate-200 dark:border-slate-700'
                "
                :type="passwordInputType"
                placeholder="请输入密码"
                autocomplete="current-password"
                @input="clearError('password')"
                @keydown.enter.prevent="submitLogin"
              />
              <button
                class="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#DBEBE5] hover:text-[#008D2E] dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-emerald-300"
                type="button"
                aria-label="显示或隐藏密码"
                @click="togglePasswordVisible"
              >
                <UIcon :name="passwordIcon" class="size-4.5" />
              </button>
            </div>
            <p v-if="errors.password" class="mt-1.5 text-xs text-red-600">请输入密码</p>
          </div>

          <div class="mb-5">
            <label
              class="mb-2 block text-[13px] font-medium tracking-normal text-slate-700 dark:text-slate-200"
              >验证码</label
            >
            <div class="flex items-stretch gap-3">
              <div class="relative min-w-0 flex-1">
                <UIcon
                  name="i-lucide-shield-check"
                  class="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  v-model="captchaCode"
                  class="h-12 w-full rounded-xl border bg-white px-4 pl-11 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#00C950] focus:ring-4 focus:ring-[#00C950]/15 disabled:cursor-not-allowed dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-[#00C950]/20"
                  :class="
                    errors.captcha
                      ? 'border-red-500 ring-4 ring-red-100 dark:ring-red-950/50'
                      : 'border-slate-200 dark:border-slate-700'
                  "
                  type="text"
                  placeholder="请输入验证码"
                  maxlength="4"
                  autocomplete="one-time-code"
                  :disabled="captchaLoading"
                  @input="clearError('captcha')"
                  @keydown.enter.prevent="submitLogin"
                />
              </div>
              <button
                class="flex h-12 w-29 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 shadow-sm transition hover:border-[#00C950]/50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                type="button"
                title="点击刷新验证码"
                :disabled="captchaLoading"
                @click="refreshCaptcha"
              >
                <img
                  v-if="captchaImage"
                  :src="captchaImage"
                  alt="登录验证码"
                  class="block h-full w-full object-cover"
                />
                <span v-else>{{ captchaLoading ? "加载中..." : "点击刷新" }}</span>
              </button>
            </div>
            <p v-if="errors.captcha" class="mt-1.5 text-xs text-red-600">验证码不正确</p>
          </div>

          <div class="mb-6 mt-1 flex items-center justify-between">
            <label class="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300">
              <span class="relative flex size-4 shrink-0 items-center justify-center">
                <input
                  v-model="rememberMe"
                  class="peer size-4 appearance-none rounded border border-slate-300 bg-white shadow-sm transition checked:border-[#008D2E] checked:bg-[#008D2E] focus:outline-none focus:ring-4 focus:ring-[#00C950]/15 dark:border-slate-600 dark:bg-slate-900"
                  type="checkbox"
                />
                <UIcon
                  name="i-lucide-check"
                  class="pointer-events-none absolute size-3 text-white opacity-0 transition peer-checked:opacity-100"
                />
              </span>
              记住我
            </label>
            <button
              class="text-[13px] font-medium text-[#008D2E] transition hover:text-[#006B24]"
              type="button"
              @click="showForgotPasswordTip"
            >
              忘记密码？
            </button>
          </div>

          <button
            class="flex h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#008D2E] text-[15px] font-semibold tracking-normal text-white shadow-lg shadow-[#008D2E]/20 transition hover:-translate-y-0.5 hover:bg-[#007A28] hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-[#008D2E]"
            type="submit"
            :disabled="!canSubmit"
          >
            <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" />
            {{ loading ? "登录中..." : "登 录" }}
          </button>

          <p class="mt-8 text-center text-xs text-slate-400">
            © 2026 LandingPageAdmin · 后台管理系统 · 保留所有权利
          </p>
        </form>
      </section>
    </section>

  </main>
</template>

<style scoped>
.login-visual {
  background-image: url("~/assets/images/login_bg.png");
  background-position: center;
  background-size: cover;
}

@keyframes floatUp {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-14px);
  }
}

@keyframes pulseSoft {
  0%,
  100% {
    opacity: 0.85;
  }

  50% {
    opacity: 1;
  }
}

.float-anim {
  animation: floatUp 4s ease-in-out infinite;
}

.float-anim-delay {
  animation: floatUp 5s ease-in-out 1.5s infinite;
}

.pulse-soft {
  animation: pulseSoft 3s ease-in-out infinite;
}

</style>
