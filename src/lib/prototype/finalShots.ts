// PROTOTYPE：选定方案（A）的截图清单。截图脚本和 /prototype/final 页面共用这一份。
// 每一项都会在桌面（1440×900）和手机（390×844）各截一张；地址都在 variant=A 上，另加 t=51.3&still=1&shot=1。

export interface Shot {
  key: string
  label: string
  /** 追加在 /prototype?variant=A 后面的参数 */
  query: string
  /** 整页截图（默认只截第一屏） */
  full?: boolean
}

export interface ShotGroup {
  id: string
  title: string
  note?: string
  shots: Shot[]
}

export const shotGroups: ShotGroup[] = [
  {
    id: 'library',
    title: '1 · 曲库首屏',
    note: '四个分类、每日推荐入口、搜索入口、首次同步进度。桌面是分区总览，手机是 Auxio 式文字标签。',
    shots: [
      { key: 'library', label: '曲库首屏', query: '', full: true },
      { key: 'library-playlists', label: '歌单', query: '&tab=playlists' },
      { key: 'library-albums', label: '专辑', query: '&tab=albums' },
      { key: 'library-artists', label: '歌手', query: '&tab=artists' },
    ],
  },
  {
    id: 'player',
    title: '2 · 播放页',
    note: '封面颜色染底，波浪进度条；逐字歌词、逐行歌词、纯音乐、暂无歌词；播放队列。',
    shots: [
      { key: 'player-yrc', label: '逐字歌词（唱到一半的字）', query: '&screen=player&lyr=1' },
      { key: 'player-cover', label: '封面视图（手机）', query: '&screen=player' },
      { key: 'player-lrc', label: '只有逐行歌词', query: '&screen=player&track=s49&t=55&lyr=1' },
      { key: 'player-inst', label: '纯音乐', query: '&screen=player&track=s16&t=30&lyr=1' },
      { key: 'player-none', label: '暂无歌词', query: '&screen=player&track=s41&t=30&lyr=1' },
      { key: 'player-queue', label: '播放队列', query: '&screen=player&panel=queue' },
    ],
  },
  {
    id: 'playlist',
    title: '3 · 歌单页',
    note: '4,815 首的我喜欢的音乐；歌单内搜索在本地即时出结果；已下载、下载中、试听、无版权等标记。',
    shots: [
      { key: 'playlist', label: '我喜欢的音乐 · 4,815 首', query: '&screen=playlist' },
      { key: 'playlist-search', label: '歌单内搜索“春”', query: '&screen=playlist&q=春' },
      { key: 'playlist-own', label: '自建歌单（隐私）', query: '&screen=playlist&pl=pl-darkness' },
      { key: 'playlist-collected', label: '收藏的歌单', query: '&screen=playlist&pl=c-piano' },
    ],
  },
  {
    id: 'search',
    title: '4 · 搜索',
    note: '搜索历史（只存本机）、边输入边给建议、单曲 / 歌单 / 歌手 / 专辑四类结果。',
    shots: [
      { key: 'search-history', label: '搜索历史', query: '&screen=search' },
      { key: 'search-suggest', label: '输入建议', query: '&screen=search&q=ミク' },
      { key: 'search-songs', label: '单曲', query: '&screen=search&q=ミク&stab=songs' },
      { key: 'search-playlists', label: '歌单', query: '&screen=search&q=ミク&stab=playlists' },
      { key: 'search-artists', label: '歌手', query: '&screen=search&q=ミク&stab=artists' },
      { key: 'search-albums', label: '专辑', query: '&screen=search&q=ミク&stab=albums' },
      { key: 'search-empty', label: '没有结果', query: '&screen=search&q=zzzz&stab=songs' },
    ],
  },
  {
    id: 'artist-album',
    title: '5 · 歌手页 · 专辑页',
    note: '歌手页：热门歌曲 + 专辑；专辑页：曲目 + 简介。',
    shots: [
      { key: 'artist', label: '歌手 · 初音ミク', query: '&screen=artist&id=ar-miku' },
      { key: 'artist-vbs', label: '歌手 · Vivid BAD SQUAD', query: '&screen=artist&id=ar-vbs' },
      { key: 'album', label: '专辑 · 9 首 + 简介', query: '&screen=album&id=al-vbs2' },
    ],
  },
  {
    id: 'welcome',
    title: '6 · 未登录',
    note: '介绍 + 能直接用的登录表单（手机默认短信，桌面默认扫码，都能切换）+“已下载”入口。',
    shots: [
      { key: 'welcome', label: '介绍 + 默认登录方式', query: '&auth=out' },
      { key: 'welcome-sms', label: '短信验证码', query: '&auth=out&login=sms' },
      { key: 'welcome-qr', label: '扫码', query: '&auth=out&login=qr' },
      { key: 'welcome-scanned', label: '已扫码，等待确认', query: '&auth=out&login=qr&demo=loading' },
      { key: 'welcome-expired', label: '二维码已过期', query: '&auth=out&login=qr&demo=error' },
    ],
  },
  {
    id: 'downloads',
    title: '7 · 已下载',
    note: '一个长列表加搜索；未登录时只有播放、加入播放队列、删除。',
    shots: [
      { key: 'downloads', label: '已下载（登录后）', query: '&screen=downloads' },
      { key: 'downloads-out', label: '已下载（未登录）', query: '&auth=out&screen=downloads' },
      { key: 'downloads-empty', label: '还没有下载', query: '&screen=downloads&demo=empty' },
    ],
  },
  {
    id: 'bar',
    title: '8 · 迷你播放条 · 底部播放条',
    note: '手机：封面、歌名、歌手、播放/暂停、下一首，底边一条细进度线。桌面：左控制键 + 时间，中间歌曲，右边模式、音量、队列。',
    shots: [
      { key: 'bar', label: '播放中', query: '&tab=albums' },
      { key: 'bar-paused', label: '暂停', query: '&tab=albums&paused=1' },
    ],
  },
  {
    id: 'daily',
    title: '9 · 每日推荐',
    shots: [
      { key: 'daily', label: '每日推荐', query: '&screen=daily' },
    ],
  },
  {
    id: 'states',
    title: '10 · 各种状态',
    note: '加载中、空、出错、离线、同步中；无版权置灰、试听、下载中 / 完成 / 失败 在曲库首屏和歌单页里都能看到。',
    shots: [
      { key: 'state-loading', label: '加载中（曲库）', query: '&demo=loading' },
      { key: 'state-empty', label: '空（我喜欢的音乐）', query: '&demo=empty' },
      { key: 'state-error', label: '出错（同步失败）', query: '&demo=error' },
      { key: 'state-pl-loading', label: '加载中（歌单）', query: '&screen=playlist&demo=loading' },
      { key: 'state-pl-empty', label: '空歌单', query: '&screen=playlist&pl=pl-umi&demo=empty' },
      { key: 'state-pl-nomatch', label: '歌单内搜不到', query: '&screen=playlist&q=zzzz' },
      { key: 'state-offline', label: '离线（曲库）', query: '&net=off' },
      { key: 'state-offline-downloads', label: '离线（已下载）', query: '&net=off&screen=downloads' },
      { key: 'state-offline-search', label: '离线（搜索）', query: '&net=off&screen=search&q=ミク&stab=songs' },
      { key: 'state-daily-loading', label: '加载中（每日推荐）', query: '&screen=daily&demo=loading' },
    ],
  },
  {
    id: 'edit',
    title: '11 · 歌单编辑',
    note: '新建、名称 / 简介 / 标签（只能从网易云固定标签里选，最多 3 个）、封面、隐私改公开、删除确认。',
    shots: [
      { key: 'edit-new', label: '新建歌单', query: '&edit=new' },
      { key: 'edit-info', label: '编辑歌单信息', query: '&screen=playlist&pl=pl-miku&edit=info' },
      { key: 'edit-public', label: '隐私改公开', query: '&screen=playlist&pl=pl-darkness&edit=public' },
      { key: 'edit-delete', label: '删除自建歌单', query: '&screen=playlist&pl=pl-umi&edit=delete' },
      { key: 'edit-uncollect', label: '取消收藏', query: '&screen=playlist&pl=c-piano&edit=delete' },
    ],
  },
]
