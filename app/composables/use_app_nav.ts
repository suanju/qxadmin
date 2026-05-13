export function useAppNav(): ReturnType<typeof useAdminAuth>['navItems'] {
  const { navItems } = useAdminAuth()
  return navItems
}
