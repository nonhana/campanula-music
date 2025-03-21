import { Archive, Home, ListMusic, Music, Music4, Piano } from 'lucide-svelte'

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
  {
    title: '歌曲列表',
    href: '/songs',
    icon: Music,
  },
  {
    title: '歌单列表',
    href: '/playlists',
    icon: ListMusic,
  },
  {
    title: '钢琴窗',
    href: '/piano-roll',
    icon: Piano,
    disabled: true,
  },
  {
    title: '我的作品',
    href: '/my-works',
    icon: Archive,
    disabled: true,
  },
  {
    title: '乐谱',
    href: '/sheet-music',
    icon: Music4,
    disabled: true,
  },
]
