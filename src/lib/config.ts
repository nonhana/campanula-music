import { Archive, Home, ListMusic, Music, Music4, Piano } from 'lucide-svelte'

export const siteTitle = 'Campanula'
export const siteDescription = 'Built with the SvelteKit Static Blog Starter'
export const siteURL = 'example.com'
export const siteLink = 'https://github.com/josh-collinsworth/sveltekit-blog-starter'
export const siteAuthor = 'non_hana'

export const postsPerPage = 10

interface NavItem {
  title: string
  href: string
  icon: any
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
  },
  {
    title: '我的作品',
    href: '/my-works',
    icon: Archive,
  },
  {
    title: '乐谱',
    href: '/sheet-music',
    icon: Music4,
  },
]
