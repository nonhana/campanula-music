import type { Playlist } from '#lib/api/library.js'
import type { Change } from '#lib/app/changes.js'
import type { ChangeFailure, LibraryNotice } from '#lib/app/library.js'
import { failureText } from '../failure'
import { playlistName } from './view'

// 改曲库的提示（LibraryNotice.svelte）说什么（#30）：没改成时说哪件事没成、为什么；歌单不在了说清楚、正在重新同步；
// 加入歌单成功说加进了哪里。歌名用《》，歌单、专辑、歌手名用「」，我喜欢的音乐直接写

/** 句子里的一张歌单：我喜欢的音乐直接写，别的加「」 */
function playlistInText(playlist: Playlist): string {
  return playlist.kind === 'liked' ? playlistName(playlist) : `「${playlist.name}」`
}

/** 没改成的是哪件事（“没能红心《歌名》：”） */
function attempted(change: Change): string {
  switch (change.kind) {
    case 'heart':
      return `没能${change.hearted ? '' : '取消'}红心《${change.song.name}》：`
    case 'add':
      return `没能加入${playlistInText(change.playlist)}：`
    case 'collectAlbum':
      return `没能${change.collected ? '' : '取消'}收藏专辑「${change.album.name}」：`
    case 'collectArtist':
      return `没能${change.collected ? '' : '取消'}收藏歌手「${change.artist.name}」：`
    case 'collectPlaylist':
      return `没能${change.collected ? '' : '取消'}收藏歌单「${change.playlist.name}」：`
    default: {
      const unhandled: never = change
      throw new Error(`不认识的修改：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 为什么没改成、能怎么办 */
function reasonOf(failure: ChangeFailure): string {
  return failure.kind === 'checkTokenUnavailable'
    ? '收藏歌单要先加载网易云的安全组件，没加载出来（可能被浏览器的拦截插件挡住了），稍后再试。'
    : failureText(failure)
}

export function libraryNoticeText(notice: LibraryNotice): string {
  switch (notice.kind) {
    case 'notChanged':
      return attempted(notice.change) + reasonOf(notice.failure)
    case 'playlistMissing': {
      const failed = notice.change.kind === 'add' ? '没能加入' : notice.change.collected ? '没能收藏' : '没能取消收藏'
      return `${playlistInText(notice.change.playlist)}已经不在了（可能在网易云音乐里删掉了），${failed}。正在重新同步曲库。`
    }
    case 'added':
      return `已加入${playlistInText(notice.change.playlist)}`
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}
