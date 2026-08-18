import { Home, Search, Settings } from 'lucide-svelte'

interface NavItem {
  title: string
  /** 应用内路由，满足 resolve() 的字面量类型约束 */
  href: '/' | '/search' | '/settings'
  /** lucide-svelte 图标组件（SvelteComponentTyped 类，非 Svelte 5 Component） */
  icon: typeof Home
}

export const navItems: NavItem[] = [
  {
    title: '首页',
    href: '/',
    icon: Home,
  },
  {
    title: '搜索',
    href: '/search',
    icon: Search,
  },
  {
    title: '设置',
    href: '/settings',
    icon: Settings,
  },
]
