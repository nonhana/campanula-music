// 定义网站基本信息
export const siteMetadata = {
  title: 'Campanula Music',
  description: '可自部署的个人第三方网易云播放器：我的歌单、搜索、播放与歌词，全部实时取自你的网易云账号',
  siteUrl: 'https://campanulamusic.xyz',
  siteName: 'Campanula',
  themeColor: '#4f46e5',
  locale: 'zh-CN',
  author: 'Campanula',
}

// 定义每个页面的元数据
export const pageMetadata = {
  home: {
    title: `我的歌单 | ${siteMetadata.title}`,
    description: '我的歌单与「我喜欢的音乐」入口：实时取自你的网易云账号',
    keywords: '歌单,音乐,网易云,Campanula',
  },
  favorites: {
    title: `我喜欢的音乐 | ${siteMetadata.title}`,
    description: '你红心过的每一首歌，都收藏在这里。',
    keywords: '红心,喜欢的音乐,网易云,Campanula',
  },
  search: {
    title: `搜索 | ${siteMetadata.title}`,
    description: '搜索歌曲、歌单与歌手。',
    keywords: '音乐搜索,歌手,歌单,Campanula',
  },
  playlistDetail: {
    title: `歌单详情 | ${siteMetadata.title}`,
    description: '一个歌单的全部歌曲，实时来自网易云。',
    keywords: '歌单详情,网易云,Campanula',
  },
  settings: {
    title: `设置 | ${siteMetadata.title}`,
    description: '切换皮肤与音质档位。',
    keywords: '设置,皮肤,音质,Campanula',
  },
}

export interface SeoMetadata {
  title: string
  description: string
  canonical?: string
  keywords?: string
}

export function generateSeoMetadata(
  page: keyof typeof pageMetadata,
  customData?: Partial<SeoMetadata>,
): SeoMetadata {
  const pageData = pageMetadata[page]

  const metadata: SeoMetadata = {
    title: customData?.title || pageData.title,
    description: customData?.description || pageData.description,
    keywords: customData?.keywords || pageData.keywords,
    canonical: customData?.canonical,
  }

  return metadata
}
