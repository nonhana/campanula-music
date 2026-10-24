import type { Playlist, PlaylistEditProblem } from '#lib/api/library.js'
import { PLAYLIST_DESCRIPTION_LENGTH, PLAYLIST_NAME_WIDTH, PLAYLIST_TAGS_MAX, TRACKS_PER_CHANGE } from '#lib/api/library.js'
import type { Change } from '#lib/app/changes.js'
import type { ChangeFailure } from '#lib/app/library.js'
import type { OperationNotice } from '#lib/app/notice.js'

import { downloadFailureText } from '../downloads/view'
import { playlistName } from '../playlist/playlist-text'
import { failureText } from '../shared/failure'
import { formatCount } from '../shared/text'

// 提示条（OperationNotice.svelte，改曲库和下载共用）说什么（#30、#33、#38）：都是一句话、不带句末句号（DESIGN.md 文案）。
// 歌名用《》，歌单、专辑、歌手名用「」，我喜欢的音乐直接写。

const playlistInText = (playlist: Playlist): string => playlist.kind === 'liked'
  ? playlistName(playlist)
  : `「${playlist.name}」`

/** 没改成的是哪件事（“没能红心《歌名》：”） */
const attempted = (change: Change): string => {
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
    case 'playlistOrder':
      return '没能保存自建歌单的顺序：'
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

/** 名称、简介、标签哪里不合规：写上限，不带句号 */
export const editProblemText = (problem: PlaylistEditProblem): string => {
  switch (problem) {
    case 'nameEmpty':
      return '名称不能为空'
    case 'nameTooLong':
      return `最多 ${PLAYLIST_NAME_WIDTH / 2} 个汉字或 ${PLAYLIST_NAME_WIDTH} 个字母`
    case 'descriptionTooLong':
      return `最多 ${formatCount(PLAYLIST_DESCRIPTION_LENGTH)} 字`
    case 'tooManyTags':
      return `标签最多选 ${PLAYLIST_TAGS_MAX} 个`
    case 'tooManySongs':
      return `一次最多 ${formatCount(TRACKS_PER_CHANGE)} 首`
    default: {
      const unhandled: never = problem
      throw new Error(`不认识的问题：${JSON.stringify(unhandled)}`)
    }
  }
}

/** 为什么没改成：一个原因短语，不带下一步、不带句号（同 failureText） */
export const changeFailureText = (failure: ChangeFailure): string => {
  switch (failure.kind) {
    case 'checkTokenUnavailable':
      return '网易云的安全组件没加载出来，可能被拦截插件挡住了'
    case 'invalid':
      return editProblemText(failure.problem)
    default:
      return failureText(failure)
  }
}

const missingAction = (change: Extract<Change, { kind: 'add' | 'addMany' | 'remove' | 'order' | 'collectPlaylist' }>): string => {
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

export const operationNoticeText = (notice: OperationNotice): string => {
  switch (notice.kind) {
    case 'notChanged':
      return attempted(notice.change) + changeFailureText(notice.failure)
    case 'playlistMissing':
      return `${playlistInText(notice.change.playlist)}已经不在了，${missingAction(notice.change)}`
    case 'added': {
      const count = notice.change.kind === 'addMany'
        ? notice.change.songs.length
        : 1
      return count > 1
        ? `已加入${playlistInText(notice.change.playlist)} ${formatCount(count)} 首`
        : `已加入${playlistInText(notice.change.playlist)}`
    }
    case 'alreadyAdded':
      return `这些歌都已经在${playlistInText(notice.playlist)}里了`
    case 'removed':
      return `已从${playlistInText(notice.playlist)}移除 ${formatCount(notice.count)} 首`
    case 'removeFailed':
      return `没能从${playlistInText(notice.playlist)}移除 ${formatCount(notice.count)} 首：${changeFailureText(notice.failure)}`
    case 'orderFailed': {
      // 没有原因（网易云回 -1、重读也不是新顺序）时只说没保存成，旁边有“重试”
      const unsaved = `没能保存${playlistInText(notice.playlist)}的顺序`
      return notice.failure
        ? `${unsaved}：${changeFailureText(notice.failure)}`
        : unsaved
    }
    case 'playlistOrderFailed':
      return `没能保存自建歌单的顺序：${changeFailureText(notice.failure)}`
    case 'recovered':
      return '上次关闭前的修改没保存成功，已恢复原样'
    case 'downloadFailed':
      return `没能下载《${notice.song.name}》：${downloadFailureText(notice.failure)}`
    default: {
      const unhandled: never = notice
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`)
    }
  }
}
