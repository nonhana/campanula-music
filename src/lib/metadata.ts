// 定义网站基本信息
export const siteMetadata = {
  title: 'Campanula Music',
  description: '在线音乐分享、创作与探索平台',
  siteUrl: 'https://campanula.netlify.app',
  siteName: 'Campanula Music',
  themeColor: '#4f46e5',
  locale: 'zh-CN',
  author: 'Campanula',
}

// 定义每个页面的元数据
export const pageMetadata = {
  home: {
    title: `首页 | ${siteMetadata.title}`,
    description: '探索和发现音乐的新世界，在Campanula Music欣赏、创作和分享你的音乐',
    keywords: '音乐,在线音乐,音乐播放器,Campanula',
  },
  myWorks: {
    title: `我的创作 | ${siteMetadata.title}`,
    description: '管理和展示你的原创音乐作品，分享你的创作灵感',
    keywords: '原创音乐,音乐创作,作曲,Campanula',
  },
  playlists: {
    title: `歌单 | ${siteMetadata.title}`,
    description: '浏览和创建个性化歌单，发现精选推荐音乐',
    keywords: '音乐歌单,推荐歌单,个性化歌单,Campanula',
  },
  pianoRoll: {
    title: `钢琴窗 | ${siteMetadata.title}`,
    description: '使用直观的钢琴窗界面创作和编辑MIDI音乐',
    keywords: '钢琴窗,MIDI编辑器,音乐制作,FL Studio,Campanula',
  },
  sheetMusic: {
    title: `乐谱 | ${siteMetadata.title}`,
    description: '浏览、下载和学习各种乐器的乐谱',
    keywords: '乐谱,钢琴谱,吉他谱,音乐学习,Campanula',
  },
  searchResult: {
    title: `搜索结果 | ${siteMetadata.title}`,
    description: '查找你喜爱的音乐、歌手和专辑',
    keywords: '音乐搜索,歌手,专辑,Campanula',
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
