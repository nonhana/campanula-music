// 定义网站基本信息
export const siteMetadata = {
  title: 'Campanula Music',
  description: '在线音乐分享、创作与探索平台',
  siteUrl: 'https://campanula.netlify.app',
  siteName: 'Campanula Music',
  themeColor: '#4f46e5',
  locale: 'zh-CN',
  author: 'Campanula',
  socialImage: '/images/og-image.jpg',
}

// 定义每个页面的元数据
export const pageMetadata = {
  home: {
    title: `首页 | ${siteMetadata.title}`,
    description: '探索和发现音乐的新世界，在Campanula Music欣赏、创作和分享你的音乐',
    keywords: '音乐,在线音乐,音乐播放器,Campanula',
    imageUrl: '/images/home-og.jpg',
  },
  myWorks: {
    title: `我的创作 | ${siteMetadata.title}`,
    description: '管理和展示你的原创音乐作品，分享你的创作灵感',
    keywords: '原创音乐,音乐创作,作曲,Campanula',
    imageUrl: '/images/my-works-og.jpg',
  },
  playlists: {
    title: `歌单 | ${siteMetadata.title}`,
    description: '浏览和创建个性化歌单，发现精选推荐音乐',
    keywords: '音乐歌单,推荐歌单,个性化歌单,Campanula',
    imageUrl: '/images/playlists-og.jpg',
  },
  pianoRoll: {
    title: `钢琴窗 | ${siteMetadata.title}`,
    description: '使用直观的钢琴窗界面创作和编辑MIDI音乐',
    keywords: '钢琴窗,MIDI编辑器,音乐制作,FL Studio,Campanula',
    imageUrl: '/images/piano-roll-og.jpg',
  },
  sheetMusic: {
    title: `乐谱 | ${siteMetadata.title}`,
    description: '浏览、下载和学习各种乐器的乐谱',
    keywords: '乐谱,钢琴谱,吉他谱,音乐学习,Campanula',
    imageUrl: '/images/sheet-music-og.jpg',
  },
  searchResult: {
    title: `搜索结果 | ${siteMetadata.title}`,
    description: '查找你喜爱的音乐、歌手和专辑',
    keywords: '音乐搜索,歌手,专辑,Campanula',
    imageUrl: '/images/search-og.jpg',
  },
}

// 生成完整的SEO元数据
export interface SeoMetadata {
  title: string
  description: string
  canonical?: string
  keywords?: string
  openGraph?: {
    title: string
    description: string
    url?: string
    type?: string
    images?: Array<{ url: string, alt?: string, width?: number, height?: number }>
    siteName?: string
  }
  twitter?: {
    card?: string
    site?: string
    title?: string
    description?: string
    image?: string
    imageAlt?: string
  }
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
    openGraph: {
      title: customData?.openGraph?.title || pageData.title,
      description: customData?.openGraph?.description || pageData.description,
      url: customData?.openGraph?.url || `${siteMetadata.siteUrl}/${page === 'home' ? '' : page}`,
      type: customData?.openGraph?.type || 'website',
      siteName: siteMetadata.siteName,
      images: customData?.openGraph?.images || [
        {
          url: pageData.imageUrl,
          alt: pageData.title,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: customData?.twitter?.card || 'summary_large_image',
      site: customData?.twitter?.site || '@campanula',
      title: customData?.twitter?.title || pageData.title,
      description: customData?.twitter?.description || pageData.description,
      image: customData?.twitter?.image || pageData.imageUrl,
      imageAlt: customData?.twitter?.imageAlt || pageData.title,
    },
  }

  return metadata
}
