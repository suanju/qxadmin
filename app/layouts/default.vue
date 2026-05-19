<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui";

const route = useRoute();
const colorMode = useColorMode();
const router = useRouter();
const toast = useToast();
const { adminFetch } = useAdminFetch();
const {
  currentAdmin,
  can,
  navGroups,
  navItems,
  permissionGroups,
  allPermissionCodes,
  highRiskPermissionCodes,
  refreshCurrentAdmin,
  clearCurrentAdmin,
} = useAdminAuth();

interface PermissionTreeNode {
  key: string;
  label: string;
  type: "menu" | "group" | "permission";
  menuName?: string;
  description?: string;
  permissionCount?: number;
  code?: string;
  highRisk?: boolean;
  children?: PermissionTreeNode[];
  defaultExpanded?: boolean;
}

interface PermissionTreeSelectEventLike {
  preventDefault: () => void;
}

const sidebarOpen = ref(false);
const sidebarCollapsed = ref(false);
const isDesktop = ref(false);
const expandedGroupState = reactive<Record<string, boolean>>({});
const adminQuickActionsOpen = ref(false);
const permissionInfoModal = ref(false);
const changePasswordModal = ref(false);
const changePasswordSubmitting = ref(false);
const footerActionContainerRef = ref<HTMLElement | null>(null);
const themeLabelMeasureRef = ref<HTMLElement | null>(null);
const logoutLabelMeasureRef = ref<HTMLElement | null>(null);
const footerActionResizeObserverRef = ref<ResizeObserver | null>(null);
const footerActionLabelsVisible = ref(true);
const changePasswordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const currentNavItem = computed(() =>
  navItems.value.find(
    (item) => route.path === item.to || route.path.startsWith(`${item.to}/`)
  )
);
const currentNavGroup = computed(() =>
  navGroups.value.find((group) => group.key === currentNavItem.value?.menuKey)
);

const currentPageSection = computed(() => currentNavItem.value?.menuName || "后台导航");
const currentPageTitle = computed(() => currentNavItem.value?.label || "工作台");

const pageHeaderState = useState<{
  activePath: string | null;
  ownerId: string | null;
}>("admin-page-header-state", () => ({
  activePath: null,
  ownerId: null,
}));
const hasCustomPageHeader = computed(
  () => pageHeaderState.value.activePath === route.fullPath
);
const fallbackBreadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [];
  const sectionLabel = currentPageSection.value.trim();
  const titleLabel = currentPageTitle.value.trim();

  if (sectionLabel) {
    items.push({
      label: sectionLabel,
      icon: currentNavGroup.value?.icon,
    });
  }

  if (!sectionLabel || sectionLabel !== titleLabel) {
    items.push({
      label: titleLabel,
      icon: currentNavItem.value?.icon,
    });
  }

  return items;
});
const currentRoleLabel = computed(() => {
  if (!currentAdmin.value) return "未登录";

  if (currentAdmin.value.isSuperAdmin) return "超级管理员";

  const roleNames = currentAdmin.value.roles.map((role) => role.name).join(" / ");
  return roleNames || "未分配角色";
});
const currentAdminPrimaryLabel = computed(() => {
  if (!currentAdmin.value) return "未登录";

  return currentAdmin.value.displayName || currentRoleLabel.value || currentAdmin.value.username;
});
const currentAdminSecondaryLabel = computed(() => {
  if (!currentAdmin.value) return "";

  const labels = [currentAdmin.value.username];
  if (
    currentRoleLabel.value &&
    currentRoleLabel.value !== currentAdmin.value.username &&
    currentRoleLabel.value !== currentAdminPrimaryLabel.value
  ) {
    labels.push(currentRoleLabel.value);
  }

  return Array.from(new Set(labels.filter(Boolean))).join(" · ");
});
const currentRoleNames = computed(() => {
  if (!currentAdmin.value) return [];
  if (currentAdmin.value.isSuperAdmin) return ["超级管理员"];

  const roleNames = currentAdmin.value.roles
    .map((role) => role.name.trim())
    .filter(Boolean);
  return roleNames.length > 0 ? roleNames : ["未分配角色"];
});
const currentPermissionCodeSet = computed<Set<string>>(() => {
  if (!currentAdmin.value) return new Set<string>();

  return new Set(
    currentAdmin.value.isSuperAdmin
      ? allPermissionCodes.value
      : currentAdmin.value.permissions
  );
});
const currentPermissionCount = computed(() =>
  currentPermissionCodeSet.value.size
);
const currentHighRiskPermissionCount = computed(() => {
  if (!currentAdmin.value) return 0;
  return highRiskPermissionCodes.value.filter((code) =>
    currentPermissionCodeSet.value.has(code)
  ).length;
});
const currentPermissionTreeItems = computed<PermissionTreeNode[]>(() => {
  const menuNodes = new Map<string, PermissionTreeNode>();

  for (const group of permissionGroups.value) {
    const groupNode: PermissionTreeNode = {
      key: `group:${group.key}`,
      label: group.name,
      type: "group",
      menuName: group.menuName,
      description: `${group.menuName}下的权限分组`,
      permissionCount: group.permissions.length,
      defaultExpanded: true,
      children: group.permissions.map((permission) => ({
        key: `permission:${permission.code}`,
        label: permission.name,
        type: "permission",
        code: permission.code,
        highRisk: permission.highRisk,
      })),
    };

    const existingMenuNode = menuNodes.get(group.menuKey);
    if (existingMenuNode) {
      existingMenuNode.children = [...(existingMenuNode.children ?? []), groupNode];
      existingMenuNode.permissionCount =
        (existingMenuNode.permissionCount ?? 0) + group.permissions.length;
      continue;
    }

    menuNodes.set(group.menuKey, {
      key: `menu:${group.menuKey}`,
      label: group.menuName,
      type: "menu",
      description: "后台菜单域",
      permissionCount: group.permissions.length,
      defaultExpanded: true,
      children: [groupNode],
    });
  }

  return Array.from(menuNodes.values());
});
const currentPermissionTreeSelection = computed<PermissionTreeNode[]>(() =>
  buildSelectedPermissionTreeItems(
    currentPermissionTreeItems.value,
    currentPermissionCodeSet.value
  )
);
const adminQuickActionsPopoverMode = computed(() => (isDesktop.value ? "hover" : "click"));
const adminQuickActionsContent = computed<{
  side: "right" | "top";
  align: "end";
  sideOffset: number;
  collisionPadding: number;
}>(() => ({
  side: sidebarCollapsed.value ? "right" : "top",
  align: "end",
  sideOffset: 12,
  collisionPadding: 12,
}));
const shouldShowFooterActionLabel = computed(
  () => !sidebarCollapsed.value && footerActionLabelsVisible.value
);

function isActivePath(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`);
}

function isGroupActive(group: typeof navGroups.value[number]): boolean {
  return group.items.some((item) => isActivePath(item.to));
}

function isGroupExpanded(group: typeof navGroups.value[number]): boolean {
  return expandedGroupState[group.key] ?? isGroupActive(group);
}

function setGroupExpanded(groupKey: string, value: boolean) {
  expandedGroupState[groupKey] = value;
}

function buildCollapsedDropdownItems(group: typeof navGroups.value[number]) {
  return [
    group.items.map((item) => ({
      label: item.label,
      icon: item.icon,
      to: item.to,
      active: isActivePath(item.to),
    })),
  ];
}

function collectPermissionLeafNodes(items: PermissionTreeNode[]): PermissionTreeNode[] {
  return items.flatMap((item) => {
    if (item.children?.length) {
      return collectPermissionLeafNodes(item.children);
    }

    return item.type === "permission" ? [item] : [];
  });
}

function buildSelectedPermissionTreeItems(
  items: PermissionTreeNode[],
  selectedCodes: Set<string>
): PermissionTreeNode[] {
  return items.flatMap((item) => {
    const childSelections = item.children?.length
      ? buildSelectedPermissionTreeItems(item.children, selectedCodes)
      : [];

    if (item.type === "permission") {
      return item.code && selectedCodes.has(item.code) ? [item] : [];
    }

    const leafNodes = item.children?.length ? collectPermissionLeafNodes(item.children) : [];
    const isFullySelected =
      leafNodes.length > 0 &&
      leafNodes.every((leaf) => leaf.code && selectedCodes.has(leaf.code));

    return isFullySelected ? [item, ...childSelections] : childSelections;
  });
}

function syncViewportState() {
  if (!import.meta.client || typeof window === "undefined") return;
  isDesktop.value = window.innerWidth >= 1024;
  if (!isDesktop.value) {
    sidebarCollapsed.value = false;
  }
}

function toggleSidebar() {
  if (isDesktop.value) {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    return;
  }

  sidebarOpen.value = !sidebarOpen.value;
}

function toggleColorMode() {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
}

/**
 * 根据底部按钮可用宽度，决定是否显示按钮文案。
 */
function syncFooterActionLabels() {
  if (!import.meta.client || sidebarCollapsed.value) {
    footerActionLabelsVisible.value = false;
    return;
  }

  const container = footerActionContainerRef.value;
  const themeMeasure = themeLabelMeasureRef.value;
  const logoutMeasure = logoutLabelMeasureRef.value;

  if (!container || !themeMeasure || !logoutMeasure) {
    footerActionLabelsVisible.value = true;
    return;
  }

  const themeButton = container.querySelector<HTMLElement>(
    '[data-sidebar-footer-action="theme"]'
  );
  const logoutButton = container.querySelector<HTMLElement>(
    '[data-sidebar-footer-action="logout"]'
  );

  if (!themeButton || !logoutButton) {
    footerActionLabelsVisible.value = true;
    return;
  }

  const themeStyles = window.getComputedStyle(themeButton);
  const logoutStyles = window.getComputedStyle(logoutButton);
  const iconWidth = 20;
  const labelGap = 8;
  const safeBuffer = 6;

  const themeRequiredWidth =
    (Number.parseFloat(themeStyles.paddingLeft) || 0) +
    (Number.parseFloat(themeStyles.paddingRight) || 0) +
    iconWidth +
    labelGap +
    themeMeasure.scrollWidth +
    safeBuffer;
  const logoutRequiredWidth =
    (Number.parseFloat(logoutStyles.paddingLeft) || 0) +
    (Number.parseFloat(logoutStyles.paddingRight) || 0) +
    iconWidth +
    labelGap +
    logoutMeasure.scrollWidth +
    safeBuffer;

  footerActionLabelsVisible.value =
    themeButton.clientWidth >= themeRequiredWidth &&
    logoutButton.clientWidth >= logoutRequiredWidth;
}

function queueFooterActionLabelSync() {
  if (!import.meta.client) return;

  requestAnimationFrame(() => {
    syncFooterActionLabels();
  });
}

function resetChangePasswordForm() {
  changePasswordForm.currentPassword = "";
  changePasswordForm.newPassword = "";
  changePasswordForm.confirmPassword = "";
}

function openPermissionInfo() {
  adminQuickActionsOpen.value = false;
  permissionInfoModal.value = true;
}

function openChangePasswordModal() {
  adminQuickActionsOpen.value = false;
  changePasswordModal.value = true;
}

function preventPermissionDetailTreeSelect(event: PermissionTreeSelectEventLike) {
  event.preventDefault();
}

function logout() {
  adminQuickActionsOpen.value = false;
  permissionInfoModal.value = false;
  changePasswordModal.value = false;
  const auth = useCookie("admin_auth");
  auth.value = null;
  clearCurrentAdmin();

  toast.add({
    title: "已退出登录",
    color: "success",
    icon: "i-lucide-log-out",
  });

  router.push("/login");
}

async function submitCurrentPasswordChange() {
  if (!changePasswordForm.currentPassword.trim()) {
    toast.add({
      title: "请输入当前密码",
      color: "warning",
      icon: "i-lucide-lock-keyhole",
    });
    return;
  }

  if (changePasswordForm.newPassword.length < 8) {
    toast.add({
      title: "新密码至少 8 位",
      color: "warning",
      icon: "i-lucide-shield-alert",
    });
    return;
  }

  if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
    toast.add({
      title: "两次输入的新密码不一致",
      color: "warning",
      icon: "i-lucide-shield-alert",
    });
    return;
  }

  changePasswordSubmitting.value = true;
  try {
    await adminFetch("/api/admin/auth/password", {
      method: "PUT",
      body: {
        currentPassword: changePasswordForm.currentPassword,
        newPassword: changePasswordForm.newPassword,
      },
    });

    toast.add({
      title: "密码已更新",
      description: "当前登录会话已自动刷新。",
      color: "success",
      icon: "i-lucide-key-round",
    });
    changePasswordModal.value = false;
    resetChangePasswordForm();
    await refreshCurrentAdmin();
  } catch (error) {
    toast.add({
      title: "修改密码失败",
      description: getAdminFetchErrorMessage(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    changePasswordSubmitting.value = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    if (!isDesktop.value) {
      sidebarOpen.value = false;
    }
  }
);

watch(
  () => sidebarCollapsed.value,
  async () => {
    await nextTick();
    queueFooterActionLabelSync();
  }
);

watch(
  () => colorMode.value,
  async () => {
    await nextTick();
    queueFooterActionLabelSync();
  }
);

watch(
  () => changePasswordModal.value,
  (open) => {
    if (!open) {
      resetChangePasswordForm();
    }
  }
);

onMounted(async () => {
  syncViewportState();
  window.addEventListener("resize", syncViewportState);

  try {
    await refreshCurrentAdmin();
  } catch {
    // useAdminFetch 已处理 401 跳转，布局层保持静默。
  }

  queueFooterActionLabelSync();

  if (typeof ResizeObserver !== "undefined" && footerActionContainerRef.value) {
    footerActionResizeObserverRef.value = new ResizeObserver(() => {
      syncFooterActionLabels();
    });
    footerActionResizeObserverRef.value.observe(footerActionContainerRef.value);
  }
});

onBeforeUnmount(() => {
  if (import.meta.client && typeof window !== "undefined") {
    window.removeEventListener("resize", syncViewportState);
  }

  footerActionResizeObserverRef.value?.disconnect();
  footerActionResizeObserverRef.value = null;
});
</script>

<template>
  <UDashboardGroup
    storage-key="admin-layout-v2"
    class="flex min-h-screen bg-muted/20"
  >
    <UDashboardSidebar
      id="main"
      v-model:open="sidebarOpen"
      v-model:collapsed="sidebarCollapsed"
      :toggle="false"
      collapsible
      :default-size="12"
      :collapsed-size="6"
      resizable
      side="left"
      :ui="{
        root: 'border-r border-default/60 bg-elevated/85 backdrop-blur-xl',
        header: 'p-3',
        body: 'p-3 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        footer: 'border-t border-default/60 p-3',
        content: 'bg-elevated/95 backdrop-blur-xl',
      }"
    >
      <template #header>
        <div class="flex items-center gap-3">
        <svg t="1779177442781"  class="size-10 shrink-0"  viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9219" width="16" height="16"><path d="M692.314944 1023.925046c-5.352983-0.768281-10.712212-1.561547-16.065195-2.304843-24.260193-3.385434-45.778309-12.973332-65.029059-28.089106-22.698646-17.820373-38.170453-40.475296-47.108747-67.839844-4.484763-13.72912-6.65219-27.833012-6.677175-42.130536-0.162401-106.228913-0.087447-212.457826-0.087447-318.686739 0-2.292351 0-4.578456 0-7.532902 2.698353 0 4.959473 0 7.214347 0 107.777968 0 215.562181-0.337294 323.340149 0.218617 29.37582 0.149909 56.165719 10.04387 79.894986 27.90172 17.751665 13.354349 31.480786 29.981701 41.331024 49.67593 7.945151 15.896548 13.12324 32.748762 13.685397 50.750274 0.031231 0.986898 0.724558 1.955057 1.111821 2.935708 0 67.483811 0 134.973868 0 202.45768-0.387264 1.174283-0.91819 2.317336-1.143052 3.516604-1.886349 10.231255-2.829523 20.737343-5.740246 30.662535-8.207491 27.957936-24.753642 50.469196-47.502257 68.458216-18.994657 15.022081-40.500281 24.341393-64.535611 27.701842-5.352983 0.749543-10.699719 1.536562-16.052702 2.304843C823.40993 1023.925046 757.862437 1023.925046 692.314944 1023.925046L692.314944 1023.925046z" fill="#14B007" p-id="9220"></path><path d="M1023.931292 333.939929c-0.774527 4.772087-1.586532 9.544175-2.317336 14.322508-3.697743 24.191485-13.348103 45.709601-28.538831 64.879151-12.192558 15.390606-27.008515 27.714335-44.254239 36.771307-14.291277 7.501671-29.569452 13.035794-45.853263 14.235062-13.25441 0.974405-26.583775 1.218007-39.881908 1.230499-99.451799 0.093693-198.903599 0.04997-298.361645 0.04997-2.273612 0-4.547225 0-7.376748 0 0-2.635891 0-4.715872 0-6.789606 0-107.209564-0.324802-214.419129 0.199878-321.622447 0.156155-31.674417 10.930828-60.238234 31.043553-85.154276 22.436306-27.795535 51.693449-43.654605 86.266097-50.606612 2.323582-0.468464 4.665902-0.836989 6.99573-1.249238 72.524485 0 145.055215 0 217.585946 0 0.780773 0.387264 1.52407 0.905697 2.348567 1.136806 12.548591 3.435403 25.534415 5.746493 37.577065 10.474857 23.648066 9.288081 42.605246 25.147151 57.521142 45.72834 13.010809 17.951543 21.536855 37.795681 24.741149 59.825985 0.699573 4.78458 1.536562 9.544175 2.311089 14.316262C1023.931292 198.966061 1023.931292 266.449872 1023.931292 333.939929L1023.931292 333.939929z" fill="#14B007" p-id="9221"></path><path d="M0 683.008125c1.536562-7.120654 2.873246-14.291277 4.659656-21.343223 4.91575-19.43189 13.872783-36.802538 26.533805-52.405514 17.583018-21.668025 39.632061-36.621398 66.084665-45.20366 13.685397-4.441039 27.758058-6.683421 42.143028-6.689667 105.841649-0.031231 211.683299-0.018739 317.524948-0.018739 2.517214 0 5.028181 0 8.488569 0 0 2.21115 0 4.234915 0 6.264926 0 110.301427 0.243601 220.602855-0.218617 330.898036-0.0812 19.925339-6.852068 38.588947-16.521166 56.228181-7.757765 14.147615-17.526802 26.546297-29.419544 37.171063-18.463731 16.489935-39.819446 27.758058-64.279517 32.442699-7.276809 1.3929-14.77848 1.624009-22.16772 2.467244-0.818251 0.093693-1.574039 0.730804-2.361059 1.111821-65.160229 0-130.320459 0-195.474442 0-1.174283-0.387264-2.336074-1.099329-3.516604-1.111821-19.182042-0.281078-37.183555-5.446676-54.110723-14.016445-17.133293-8.675955-32.217836-20.069001-44.579041-35.122313-13.116994-15.965256-22.761108-33.579505-28.039136-53.504843-2.005026-7.576626-3.173063-15.378114-4.722118-23.073417C0 825.733512 0 754.370819 0 683.008125M139.589801 605.099427 139.589801 605.099427z" fill="#14B007" p-id="9222"></path><path d="M340.923167-0.006246c7.314286 1.549055 14.709772 2.779553 21.924119 4.709625 19.925339 5.334244 37.564572 14.940881 53.523582 28.101598 16.90843 13.941491 29.076003 31.237184 37.889374 50.968891 6.702159 15.009589 11.105722 30.799951 11.118214 47.389826 0.087447 108.952251 0.043723 217.910748 0.043723 326.862999 0 2.273612 0 4.547225 0 7.395486-2.429767 0-4.309869 0-6.196218 0-109.926656 0-219.847066 0.243601-329.773722-0.21237-21.3807-0.087447-41.593363-7.1269-59.838477-18.307576C59.613615 440.768476 49.719654 433.8477 41.474686 425.583994c-14.035184-14.060168-25.309552-30.318995-32.242821-49.301159-4.197438-11.480493-7.582872-23.060925-8.207491-35.334683-0.018739-0.412248-0.662096-0.799512-1.018129-1.193022 0-71.36894 0-142.731634 0-214.094327 0.387264-0.780773 0.949421-1.52407 1.124314-2.348567 2.123704-9.981408 3.17931-20.325095 6.458558-29.906746 8.932048-26.090326 24.922289-47.452287 46.652775-64.385702 13.86029-10.799658 29.038526-19.219519 46.296743-23.385726 7.976382-1.923826 15.977748-3.760205 23.966622-5.640307C196.642479-0.006246 268.7797-0.006246 340.923167-0.006246M327.89362 46.80893 327.89362 46.80893zM417.551397 124.548981 417.551397 124.548981z" fill="#14B007" p-id="9223"></path></svg>
          <span
            v-if="!sidebarCollapsed"
            class="text-lg font-bold tracking-wide text-highlighted"
          >
             Admin Panel
          </span>
        </div>
      </template>

      <template #default>
        <div class="space-y-4 mt-4">
          <div v-if="sidebarCollapsed" class="space-y-2">
            <template v-for="group in navGroups" :key="group.key">
              <UTooltip
                v-if="group.items.length === 1"
                :text="group.items[0]?.label"
                :content="{ side: 'right', sideOffset: 12 }"
              >
                <UButton
                  :to="group.items[0]?.to"
                  color="neutral"
                  variant="ghost"
                  square
                  :aria-label="group.items[0]?.label"
                  class="flex h-14 w-full items-center justify-center rounded-2xl"
                  :class="isActivePath(group.items[0]!.to) ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-muted hover:bg-primary/5 hover:text-highlighted'"
                >
                  <UIcon :name="group.items[0]?.icon" class="size-7" />
                </UButton>
              </UTooltip>

              <UDropdownMenu
                v-else
                :items="buildCollapsedDropdownItems(group)"
                :content="{ side: 'right', align: 'start', sideOffset: 12 }"
                :ui="{
                  content: 'min-w-64 rounded-2xl p-2',
                  item: 'min-h-11 items-center gap-3 rounded-xl px-3 py-2 shadow-none before:rounded-xl before:shadow-none',
                  itemWrapper: 'justify-center',
                  itemLabel: 'text-sm font-medium leading-5',
                  itemLeadingIcon: 'size-5 self-center',
                }"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  square
                  :aria-label="group.name"
                  class="flex h-14 w-full items-center justify-center rounded-2xl"
                  :class="
                    isGroupActive(group)
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                      : 'text-muted hover:bg-primary/5 hover:text-highlighted'
                  "
                >
                  <UIcon :name="group.icon" class="size-7" />
                </UButton>
              </UDropdownMenu>
            </template>
          </div>

          <div v-else class="space-y-2">
            <template v-for="group in navGroups" :key="group.key">
              <NuxtLink
                v-if="group.items.length === 1"
                :to="group.items[0]!.to"
                class="flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-medium transition-colors"
                :class="isActivePath(group.items[0]!.to)
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'text-default hover:bg-primary/5 hover:text-highlighted'"
              >
                <UIcon :name="group.items[0]!.icon" class="size-6 shrink-0" />
                <span class="truncate">{{ group.items[0]!.label }}</span>
              </NuxtLink>

              <UCollapsible
                v-else
                :open="isGroupExpanded(group)"
                @update:open="(value) => setGroupExpanded(group.key, value)"
              >
                <template #default="{ open }">
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-base font-medium transition-colors"
                    :class="
                      open
                        ? 'text-highlighted'
                        : 'text-default hover:bg-primary/5 hover:text-highlighted'
                    "
                    @click="setGroupExpanded(group.key, !open)"
                  >
                    <UIcon :name="group.icon" class="size-6 shrink-0" />
                    <span class="min-w-0 flex-1 truncate">{{ group.name }}</span>
                    <UIcon
                      name="i-lucide-chevron-down"
                      class="size-5 shrink-0 transition-transform"
                      :class="open ? 'rotate-180' : ''"
                    />
                  </button>
                </template>

                <template #content>
                  <div class="ms-6 mt-1 space-y-1 border-s border-default/60 ps-4">
                    <NuxtLink
                      v-for="item in group.items"
                      :key="item.to"
                      :to="item.to"
                      class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors"
                      :class="
                        isActivePath(item.to)
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted hover:bg-primary/5 hover:text-default'
                      "
                    >
                      <UIcon :name="item.icon" class="size-5 shrink-0" />
                      <span class="truncate">{{ item.label }}</span>
                    </NuxtLink>
                  </div>
                </template>
              </UCollapsible>
            </template>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="w-full space-y-2">
          <div
            v-if="currentAdmin"
            class="flex items-center gap-3 rounded-2xl border border-default/60 bg-default/80 px-3 py-3"
            :class="sidebarCollapsed ? 'justify-center px-2' : ''"
          >
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <UIcon name="i-lucide-user-round-cog" class="size-5" />
            </div>

            <div v-if="!sidebarCollapsed" class="min-w-0 flex-1">
              <div class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-base font-medium text-highlighted">
                    {{ currentAdminPrimaryLabel }}
                  </div>
                  <div class="truncate text-xs text-muted">
                    {{ currentAdminSecondaryLabel }}
                  </div>
                </div>

                <UPopover
                  v-model:open="adminQuickActionsOpen"
                  :mode="adminQuickActionsPopoverMode"
                  :open-delay="120"
                  :close-delay="160"
                  :content="adminQuickActionsContent"
                  :ui="{
                    content:
                      'w-80 rounded-3xl border border-default/60 bg-default/95 p-0 shadow-xl backdrop-blur-xl',
                  }"
                >
                  <UButton
                    color="neutral"
                    variant="ghost"
                    square
                    class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl p-0 leading-none"
                    aria-label="管理员快捷操作"
                  >
                    <UIcon name="i-lucide-ellipsis" class="size-4" />
                  </UButton>

                  <template #content>
                    <div class="space-y-3 p-3">
                      <div class="rounded-2xl bg-muted/70 p-3">
                        <div class="flex items-start gap-3">
                          <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
                          >
                            <UIcon name="i-lucide-user-round-cog" class="size-5" />
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="truncate text-sm font-semibold text-highlighted">
                              {{ currentAdminPrimaryLabel }}
                            </div>
                            <div class="truncate text-xs text-muted">
                              {{ currentAdminSecondaryLabel }}
                            </div>
                          </div>
                        </div>

                        <div class="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div class="rounded-2xl bg-default/80 px-2 py-2">
                            <div class="text-base font-semibold text-highlighted">
                              {{ currentRoleNames.length }}
                            </div>
                            <div class="text-[11px] text-muted">角色</div>
                          </div>
                          <div class="rounded-2xl bg-default/80 px-2 py-2">
                            <div class="text-base font-semibold text-highlighted">
                              {{ currentPermissionCount }}
                            </div>
                            <div class="text-[11px] text-muted">权限</div>
                          </div>
                          <div class="rounded-2xl bg-default/80 px-2 py-2">
                            <div class="text-base font-semibold text-highlighted">
                              {{ currentHighRiskPermissionCount }}
                            </div>
                            <div class="text-[11px] text-muted">高风险</div>
                          </div>
                        </div>
                      </div>

                      <div class="space-y-2">
                        <UButton
                          color="neutral"
                          variant="soft"
                          block
                          class="justify-between rounded-2xl"
                          @click="openPermissionInfo"
                        >
                          <span class="flex items-center gap-2">
                            <UIcon name="i-lucide-shield-check" class="size-4" />
                            权限信息
                          </span>
                          <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
                        </UButton>

                        <UButton
                          color="neutral"
                          variant="soft"
                          block
                          class="justify-between rounded-2xl"
                          @click="openChangePasswordModal"
                        >
                          <span class="flex items-center gap-2">
                            <UIcon name="i-lucide-key-round" class="size-4" />
                            修改密码
                          </span>
                          <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
                        </UButton>

                        <UButton
                          color="error"
                          variant="soft"
                          block
                          class="justify-between rounded-2xl"
                          @click="logout"
                        >
                          <span class="flex items-center gap-2">
                            <UIcon name="i-lucide-log-out" class="size-4" />
                            退出登录
                          </span>
                          <UIcon name="i-lucide-chevron-right" class="size-4 opacity-70" />
                        </UButton>
                      </div>
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>
          </div>

          <div
            ref="footerActionContainerRef"
            class="relative grid gap-2"
            :class="sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'"
          >
            <div
              class="pointer-events-none absolute -z-10 overflow-hidden opacity-0"
              aria-hidden="true"
            >
              <span
                ref="themeLabelMeasureRef"
                class="text-sm font-medium whitespace-nowrap"
              >
                {{ colorMode.value === "dark" ? "浅色模式" : "深色模式" }}
              </span>
              <span
                ref="logoutLabelMeasureRef"
                class="text-sm font-medium whitespace-nowrap"
              >
                退出登录
              </span>
            </div>

            <UButton
              data-sidebar-footer-action="theme"
              color="neutral"
              variant="soft"
              :block="!sidebarCollapsed"
              class="justify-center"
              :class="sidebarCollapsed ? 'h-12 w-full' : 'h-11'"
              :aria-label="colorMode.value === 'dark' ? '切换为浅色' : '切换为深色'"
              @click="toggleColorMode"
            >
              <UIcon
                :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
                class="size-5 shrink-0"
              />
              <template v-if="shouldShowFooterActionLabel">
                <span class="ms-2 whitespace-nowrap">{{
                  colorMode.value === "dark" ? "浅色模式" : "深色模式"
                }}</span>
              </template>
            </UButton>

            <UButton
              data-sidebar-footer-action="logout"
              color="neutral"
              variant="soft"
              :block="!sidebarCollapsed"
              class="justify-center"
              :class="sidebarCollapsed ? 'h-12 w-full' : 'h-11'"
              aria-label="退出登录"
              @click="logout"
            >
              <UIcon name="i-lucide-log-out" class="size-5 shrink-0" />
              <template v-if="shouldShowFooterActionLabel">
                <span class="ms-2 whitespace-nowrap">退出登录</span>
              </template>
            </UButton>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <div class="flex min-h-screen min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 border-b border-default/60 bg-default/85 backdrop-blur-xl"
      >
        <div class="flex items-start gap-4 px-4 py-4 md:px-6 md:py-5">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <UButton
              icon="i-lucide-panel-left"
              color="neutral"
              variant="ghost"
              square
              class="shrink-0"
              :aria-label="sidebarOpen ? '收起侧边栏' : '展开侧边栏'"
              @click="toggleSidebar"
            />

            <div class="min-w-0 flex-1">
              <div
                class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
                :class="hasCustomPageHeader ? '' : 'hidden'"
              >
                <div id="admin-page-header-main" class="min-w-0 flex-1" />
                <div
                  id="admin-page-header-actions"
                  class="flex flex-wrap items-center gap-2 xl:justify-end"
                />
              </div>

              <div
                v-if="!hasCustomPageHeader"
                class="min-w-0"
              >
                <UBreadcrumb
                  :items="fallbackBreadcrumbItems"
                  separator-icon="i-lucide-chevron-right"
                  :ui="{
                    root: 'min-w-0',
                    list: 'flex-wrap gap-1.5',
                    item: 'min-w-0',
                    link: 'text-sm font-medium text-muted',
                    linkLeadingIcon: 'size-4 shrink-0 text-muted',
                    linkLabel: 'truncate',
                    separator: 'mx-1 text-muted/70',
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-auto">
        <ClientOnly>
          <template #default>
            <slot />

            <UModal
              v-model:open="permissionInfoModal"
              title="当前账号权限"
              :ui="{ content: 'max-w-3xl' }"
            >
              <template #body>
                <div v-if="currentAdmin" class="space-y-4">
                  <div class="grid gap-3 md:grid-cols-3">
                    <div class="rounded-2xl border border-default/60 bg-muted/40 p-4">
                      <div class="text-xs text-muted">当前账号</div>
                      <div class="mt-2 text-base font-semibold text-highlighted">
                        {{ currentAdminPrimaryLabel }}
                      </div>
                      <div class="mt-1 text-sm text-muted">
                        {{ currentAdminSecondaryLabel }}
                      </div>
                    </div>

                    <div class="rounded-2xl border border-default/60 bg-muted/40 p-4">
                      <div class="text-xs text-muted">角色信息</div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <span
                          v-for="roleName in currentRoleNames"
                          :key="roleName"
                          class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                        >
                          {{ roleName }}
                        </span>
                      </div>
                    </div>

                    <div class="rounded-2xl border border-default/60 bg-muted/40 p-4">
                      <div class="text-xs text-muted">权限概览</div>
                      <div class="mt-2 text-base font-semibold text-highlighted">
                        {{ currentPermissionCount }} 项
                      </div>
                      <div class="mt-1 text-sm text-muted">
                        高风险权限 {{ currentHighRiskPermissionCount }} 项
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="currentAdmin.isSuperAdmin"
                    class="rounded-2xl border border-primary/20 bg-primary/5 p-4"
                  >
                    <div class="flex items-start gap-3">
                      <div
                        class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
                      >
                        <UIcon name="i-lucide-shield-check" class="size-5" />
                      </div>
                      <div>
                        <div class="text-sm font-semibold text-highlighted">
                          当前账号为超级管理员
                        </div>
                        <div class="mt-1 text-sm leading-6 text-muted">
                          已自动拥有全部后台权限，共 {{ currentPermissionCount }} 项可用权限，
                          其中高风险权限 {{ currentHighRiskPermissionCount }} 项。
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-2xl border border-default/60 bg-muted/20 p-4">
                    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div class="text-sm font-semibold text-highlighted">权限树明细</div>
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <UBadge color="success" variant="soft" size="sm">已授权</UBadge>
                        <UBadge color="warning" variant="soft" size="sm">部分授权</UBadge>
                        <UBadge color="neutral" variant="outline" size="sm">未授权</UBadge>
                        <UBadge color="warning" variant="outline" size="sm">高风险</UBadge>
                      </div>
                    </div>

                    <div class="mt-4 rounded-2xl border border-default/60 bg-default/80 p-3">
                      <UTree
                        :model-value="currentPermissionTreeSelection"
                        :items="currentPermissionTreeItems"
                        :get-key="(item) => item.key"
                        :as="{ link: 'div' }"
                        multiple
                        propagate-select
                        bubble-select
                        selection-behavior="toggle"
                        @select="preventPermissionDetailTreeSelect"
                        :ui="{
                          root: 'space-y-3',
                          item: 'list-none',
                          itemWithChildren: 'list-none space-y-2',
                          link: 'group flex items-start gap-3 rounded-xl border border-default/60 bg-default px-3 py-3 text-left transition-colors',
                          linkLabel: 'min-w-0 flex-1',
                          listWithChildren: 'ms-4 mt-2 space-y-2 border-s border-default/50 ps-3',
                        }"
                      >
                        <template #item-leading="{ selected, indeterminate }">
                          <UCheckbox
                            :model-value="indeterminate ? 'indeterminate' : selected"
                            disabled
                            tabindex="-1"
                            class="mt-0.5"
                          />
                        </template>

                        <template #item-label="{ item, selected, indeterminate }">
                          <span class="min-w-0">
                            <span class="flex flex-wrap items-center gap-2">
                              <span class="text-sm font-medium text-highlighted">
                                {{ item.label }}
                              </span>

                              <UBadge
                                v-if="item.type !== 'permission'"
                                color="neutral"
                                variant="subtle"
                                size="sm"
                              >
                                {{ item.permissionCount }} 项
                              </UBadge>

                              <UBadge
                                v-if="item.type === 'permission' && selected"
                                color="success"
                                variant="soft"
                                size="sm"
                              >
                                已授权
                              </UBadge>
                              <UBadge
                                v-else-if="item.type === 'permission'"
                                color="neutral"
                                variant="outline"
                                size="sm"
                              >
                                未授权
                              </UBadge>
                              <UBadge
                                v-else-if="indeterminate"
                                color="warning"
                                variant="soft"
                                size="sm"
                              >
                                部分授权
                              </UBadge>
                              <UBadge
                                v-else-if="selected"
                                color="success"
                                variant="soft"
                                size="sm"
                              >
                                全部授权
                              </UBadge>
                              <UBadge
                                v-else
                                color="neutral"
                                variant="outline"
                                size="sm"
                              >
                                未授权
                              </UBadge>

                              <UBadge
                                v-if="item.highRisk"
                                color="warning"
                                variant="outline"
                                size="sm"
                              >
                                高风险
                              </UBadge>
                            </span>

                            <span
                              v-if="item.type === 'menu'"
                              class="mt-1 block text-xs leading-5 text-muted"
                            >
                              {{ item.description }}，当前菜单域共 {{ item.permissionCount }} 项权限。
                            </span>
                            <span
                              v-else-if="item.type === 'group'"
                              class="mt-1 block text-xs leading-5 text-muted"
                            >
                              所属菜单：{{ item.menuName }}，当前分组共
                              {{ item.permissionCount }} 个功能点。
                            </span>
                            <span
                              v-else-if="item.code"
                              class="mt-1 block font-mono text-[11px] text-muted"
                            >
                              {{ item.code }}
                            </span>
                          </span>
                        </template>
                      </UTree>
                    </div>
                  </div>
                </div>
              </template>
            </UModal>

            <UModal
              v-model:open="changePasswordModal"
              title="修改密码"
              :ui="{ content: 'max-w-md' }"
            >
              <template #body>
                <form class="space-y-4" @submit.prevent="submitCurrentPasswordChange">
                  <div class="rounded-2xl border border-default/60 bg-muted/40 px-4 py-3 text-sm text-muted">
                    当前账号：<span class="font-medium text-highlighted">{{ currentAdmin?.username }}</span>
                    <div class="mt-1 text-xs">
                      修改成功后会自动刷新当前登录会话，无需重新登录。
                    </div>
                  </div>

                  <UFormField label="当前密码" name="current_password" required>
                    <UInput
                      v-model="changePasswordForm.currentPassword"
                      type="password"
                      name="current_password"
                      autocomplete="current-password"
                      placeholder="请输入当前密码"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="新密码" name="new_password" required>
                    <UInput
                      v-model="changePasswordForm.newPassword"
                      type="password"
                      name="new_password"
                      autocomplete="new-password"
                      placeholder="至少 8 位"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="确认新密码" name="confirm_password" required>
                    <UInput
                      v-model="changePasswordForm.confirmPassword"
                      type="password"
                      name="confirm_password"
                      autocomplete="new-password"
                      placeholder="请再次输入新密码"
                      class="w-full"
                    />
                  </UFormField>

                  <div class="flex justify-end gap-2 pt-2">
                    <UButton
                      color="neutral"
                      variant="soft"
                      @click="changePasswordModal = false"
                    >
                      取消
                    </UButton>
                    <UButton
                      type="submit"
                      color="primary"
                      :loading="changePasswordSubmitting"
                    >
                      确认修改
                    </UButton>
                  </div>
                </form>
              </template>
            </UModal>

          </template>

          <template #fallback>
            <div class="min-h-screen" />
          </template>
        </ClientOnly>
      </main>
    </div>
  </UDashboardGroup>
</template>
