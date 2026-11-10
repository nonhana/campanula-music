import type { PlaylistPageFailure } from '#lib/app/library.js';

export interface LikedFailure {
  title: '我喜欢的音乐没能同步' | '我喜欢的音乐没能加载';
  retry: 'sync' | 'open';
}

export const likedFailure = (failure: PlaylistPageFailure): LikedFailure =>
  failure.source === 'sync'
    ? { title: '我喜欢的音乐没能同步', retry: 'sync' }
    : { title: '我喜欢的音乐没能加载', retry: 'open' };
