import type { Playlist, PlaylistEditProblem } from '#lib/api/library.js'
import type { Change } from '#lib/app/changes.js'
import type { ChangeFailure, LibraryNotice } from '#lib/app/library.js'
import { PLAYLIST_DESCRIPTION_LENGTH, PLAYLIST_NAME_WIDTH, PLAYLIST_TAGS_MAX } from '#lib/api/library.js'
import { failureText } from '../failure'
import { formatCount, playlistName } from './view'

// 改曲库的提示（LibraryNotice.svelte）说什么（#30、#33）：没改成时说哪件事没成、为什么；歌单不在了说清楚、正在重新同步；
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
    case 'addMany':
      return `没能把 ${formatCount(change.songs.length)} 首歌加入${playlistInText(change.playlist)}：`
    case 'remove':
      return `没能从${playlistInText(change.playlist)}移除 ${formatCount(change.songIds.length)} 首歌：`
    case 'order':
      return `没能保存${playlistInText(change.playlist)}的顺序：`
    case 'collectAlbum':
      return `没能${change.collected ? '' : '取消'}收藏专辑「${change.album.name}」：`
    case 'collectArtist':
      return `没能${change.collected ? '' : '取消'}收藏歌手「${change.artist.name}」：`
    case 'collectPlaylist':
      return `没能${change.collected ? '' : '取消'}收藏歌单「${change.playlist.name}」：`
    case 'rename':
      return `没能把「${change.playlist.name}」改名为「${change.name}」：`
    case 'describe':
      return `没能修改「${change.playlist.name}」的简介：`
    case 'tag':
      return `没能修改「${change.playlist.name}」的标签：`
    case 'publish':
      return `没能把「${change.playlist.name}」改为公开：`
    case 'delete':
      return `没能删除歌单「${change.playlist.name}」：`
    default: {
      const unhandled: never = change
      throw new Error(`不认识的修改：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 名称、简介、标签哪里不合规、能怎么改 */
export function editProblemText(problem: PlaylistEditProblem): string {
  switch (problem) {
    case 'nameEmpty':
      return '歌单名称不能是空的。'
    case 'nameTooLong':
      return `歌单名称太长了：最多 ${PLAYLIST_NAME_WIDTH / 2} 个汉字或 ${PLAYLIST_NAME_WIDTH} 个英文字母。`
    case 'descriptionTooLong':
      return `简介最多 ${PLAYLIST_DESCRIPTION_LENGTH} 个字。`
    case 'tooManyTags':
      return `标签最多选 ${PLAYLIST_TAGS_MAX} 个。`
    case 'tooManySongs':
      return '一次最多改 9,000 首歌，少选一些再试。'
    default: {
      const unhandled: never = problem
      throw new Error(`不认识的问题：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 为什么没改成、能怎么办 */
export function changeFailureText(failure: ChangeFailure): string {
  switch (failure.kind) {
    case 'checkTokenUnavailable':
      return '收藏歌单要先加载网易云的安全组件，没加载出来（可能被浏览器的拦截插件挡住了），稍后再试。'
    case 'invalid':
      return editProblemText(failure.problem)
    default:
      return failureText(failure)
  }
}

/** 歌单不在了时，没成的是哪件事 */
function missingAction(change: Extract<Change, { kind: 'add' | 'addMany' | 'remove' | 'order' | 'collectPlaylist' }>): string {
  switch (change.kind) {
    case 'add':
    case 'addMany':
      return '没能加入'
    case 'remove':
      return '没能移除'
    case 'order':
      return '没能保存顺序'
    case 'collectPlaylist':
      return change.collected ? '没能收藏' : '没能取消收藏'
    default: {
      const unhandled: never = change
      throw new Error(`不认识的修改：${JSON.stringify(unhandled)}`)
    }
  }
}

export function libraryNoticeText(notice: LibraryNotice): string {
  switch (notice.kind) {
    case 'notChanged':
      return attempted(notice.change) + changeFailureText(notice.failure)
    case 'playlistMissing':
      return `${playlistInText(notice.change.playlist)}已经不在了（可能在网易云音乐里删掉了），${missingAction(notice.change)}。正在重新同步曲库。`
    case 'added': {
      const count = notice.change.kind === 'addMany' ? notice.change.songs.length : 1
      return count > 1 ? `已加入${playlistInText(notice.change.playlist)} ${formatCount(count)} 首` : `已加入${playlistInText(notice.change.playlist)}`
    }
    case 'alreadyAdded':
      return `这些歌都已经在${playlistInText(notice.playlist)}里了`
    case 'removed':
      return `已从${playlistInText(notice.playlist)}移除 ${formatCount(notice.count)} 首`
    case 'removeFailed':
      return `没能从${playlistInText(notice.playlist)}移除 ${formatCount(notice.count)} 首${notice.restored ? '，已经放回原位' : ''}：${changeFailureText(notice.failure)}`
    case 'orderFailed':
      return `没能保存${playlistInText(notice.playlist)}的顺序${notice.restored ? '，已经恢复原来的顺序' : ''}：${changeFailureText(notice.failure)}`
    case 'recovered':
      return '上次关闭前的修改没保存成功，已恢复原样。'
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}
