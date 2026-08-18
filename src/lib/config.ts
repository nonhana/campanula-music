import { Home } from 'lucide-svelte'

export const siteTitle = 'Campanula'
export const siteDescription = 'Campanula Music'
export const siteURL = 'https://campanulamusic.xyz'
export const siteAuthor = 'non_hana'

interface NavItem {
  title: string
  href: string
  icon: any
  disabled?: boolean
}

export const navItems: NavItem[] = [
  {
    title: '主页',
    href: '/',
    icon: Home,
  },
]
