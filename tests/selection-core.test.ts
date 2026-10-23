import type { Song } from '#lib/api/library.js'
import type { Checked } from '#lib/components/library/selection-core.js'
import { describe, expect, it } from 'vitest'
import { allOn, capabilitiesOf, extend, NONE, picked, selectAll, toggle } from '#lib/components/library/selection-core.js'

// 多选规则的纯核心（#66）：勾选、Shift 连选、全选可见、搜索时勾选的仍是整张歌单里的歌、
// 能做什么按歌单种类给出。不碰页面、不碰 Svelte，只断言听众看得到的结果：勾了哪些歌、
// 全选按钮亮不亮、加入歌单会带上哪几首、工具条上有哪些操作。

function songsFrom(ids: readonly number[]): Song[] {
  return ids.map((id, index) => ({
    id,
    name: `测试歌曲 ${index + 1}`,
    artists: [{ id: 0, name: '测试歌手' }],
    album: { id: 0, name: '测试专辑', coverUrl: 'https://p1.music.126.net/placeholder/cover.jpg' },
    duration: 180_000,
    availability: 'full',
  }))
}

/** 勾了哪些歌：按编号排好，和界面上看到的一致 */
function selected(state: Checked): number[] {
  return [...state.ids].sort((a, b) => a - b)
}

describe('勾选规则', () => {
  it('点一下勾上，再点一下取消', () => {
    const selectedOnce = toggle(NONE, 20)
    expect(selected(selectedOnce)).toEqual([20])

    expect(selected(toggle(selectedOnce, 20))).toEqual([])
  })

  it('shift 连选：正向、反向都包含两头，已经勾着的其他歌不动', () => {
    const forward = extend(toggle(NONE, 20), [10, 20, 30, 40, 50], 40)
    expect(selected(forward)).toEqual([20, 30, 40])

    // 锚点还是第一次点的 20：再 shift 点 30 只补上 30，不会从 40 重新连
    expect(selected(extend(forward, [10, 20, 30, 40, 50], 30))).toEqual([20, 30, 40])

    const backward = extend(toggle(NONE, 50), [10, 20, 30, 40, 50], 30)
    expect(selected(backward)).toEqual([30, 40, 50])

    const keepsOthers = extend(toggle(toggle(NONE, 10), 20), [10, 20, 30], 30)
    expect(selected(keepsOthers)).toEqual([10, 20, 30])
  })

  it('shift 连选的锚点不在现在显示的列表里（搜索换过）：只勾这一首，锚点改为这一首', () => {
    const first = toggle(NONE, 10)
    const anchored = extend(first, [10, 20], 20)
    const fallback = extend(anchored, [30, 40], 40)
    expect(selected(fallback)).toEqual([10, 20, 40])

    // 锚点已经改成 40：这次 shift 从 40 连到 30，中间的 35 也会勾上。
    // 如果锚点还停在不可见的 10，只会退化为点选 30。
    expect(selected(extend(fallback, [30, 35, 40], 30))).toEqual([10, 20, 30, 35, 40])
  })

  it('全选只选显示着的歌，搜索前勾的还在；都选中时全不选清掉全部；列表空时不算全选', () => {
    const before = toggle(NONE, 10)
    const all = selectAll(before, [20, 30])
    expect(selected(all)).toEqual([10, 20, 30])
    expect(allOn(all, [20, 30])).toBe(true)

    expect(selected(selectAll(all, [20, 30]))).toEqual([])
    expect(allOn(NONE, [])).toBe(false)
    expect(allOn(before, [])).toBe(false)
  })

  it('搜索时勾选的仍是整张歌单里的歌：加入歌单按整张歌单的先后，不只是搜到的那几首', () => {
    const playlist = songsFrom([10, 20, 30, 40])
    const searchResult = [40, 20]
    const state = selectAll(NONE, searchResult)
    expect(selected(state)).toEqual([20, 40])
    expect(picked(playlist, state.ids).map(song => song.id)).toEqual([20, 40])
    expect(picked(playlist, state.ids).map(song => song.name)).toEqual(['测试歌曲 2', '测试歌曲 4'])
  })
})

describe('歌单种类决定能做什么', () => {
  it('自建歌单能移除和排序；我喜欢的音乐只能排序；收藏的和不在曲库里的都不能', () => {
    expect(capabilitiesOf('own')).toEqual({ remove: true, sort: true })
    expect(capabilitiesOf('liked')).toEqual({ remove: false, sort: true })
    expect(capabilitiesOf('collected')).toEqual({ remove: false, sort: false })
    expect(capabilitiesOf(null)).toEqual({ remove: false, sort: false })
  })
})
