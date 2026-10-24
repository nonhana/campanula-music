import type { PlaylistPageFailure } from '#lib/app/library.js'

// 我喜欢的音乐整块失败时，标题和重试走哪条命令（#72）。按来源分，不按 retry：
// 库内后台同步失败的 retry 仍是 open（和歌单页的列表一致），但“我喜欢的音乐”整块错误一直用 retrySync

/** 我喜欢的音乐整块失败：说“没能同步”还是“没能加载”，重试调 retrySync 还是 openPlaylist */
export interface LikedFailure {
  title: '我喜欢的音乐没能同步' | '我喜欢的音乐没能加载'
  retry: 'sync' | 'open'
}

export const likedFailure = (failure: PlaylistPageFailure): LikedFailure => failure.source === 'sync'
  ? { title: '我喜欢的音乐没能同步', retry: 'sync' }
  : { title: '我喜欢的音乐没能加载', retry: 'open' }
