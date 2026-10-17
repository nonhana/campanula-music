import type { Suggestion } from '#lib/api/search.js'
import type { SearchFailure } from '#lib/app/search.js'
import { failureText } from '../failure'

// 搜索在界面上怎么写：建议是哪一类、哪一段和搜索框里一样，没搜成时怎么说

/** 建议是哪一类 */
export const SUGGESTION_KINDS: Record<Suggestion['kind'], string> = { song: '单曲', artist: '歌手', album: '专辑' }

/** 名字里和搜索框里的字一样的那一段（不分大小写）：[前面, 一样的, 后面]；网易云按拼音、简繁这类找到的没有一样的，整段在前面 */
export function matchedParts(name: string, typed: string): [string, string, string] {
  const at = typed ? name.toLowerCase().indexOf(typed.toLowerCase()) : -1
  if (at < 0)
    return [name, '', '']
  return [name.slice(0, at), name.slice(at, at + typed.length), name.slice(at + typed.length)]
}

/** 单曲结果没拉到时怎么说：断网时说明搜索要联网，别的说明原因 */
export function searchFailure(failure: SearchFailure): { title: string, body: string } {
  if (failure.kind === 'offline')
    return { title: '搜索要联网', body: '网络已断开。搜索要问网易云，连上网络后再试。' }
  return { title: '这次没搜成', body: failureText(failure) }
}
