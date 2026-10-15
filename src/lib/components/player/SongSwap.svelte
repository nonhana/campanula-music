<!--
  换歌时歌名、歌手、专辑跟着换碟横着飘（DESIGN.md Cover Wheel、Player Bars）：比封面晚 80ms，旧的往转走的那边飘出，
  新的从另一边飘进来（飘出开始 60ms 后，飘入飘出按“状态”的时长）；turn 是 fade 时原地交叉淡化，null 时直接换上。
  连着快换几首时，还没开始飘进来的那首直接拿掉，不露一下中间那首的歌名。
  place：page 是播放页（飘出 12px、飘入 16px），bar 是播放条（飘入飘出的默认距离）。
  新旧叠在同一个网格格子里，换的这一会儿高度按高的那个算，不跳
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { Snippet } from 'svelte'
  import type { TransitionConfig } from 'svelte/transition'
  import type { TransitionOptions } from '../motion'
  import type { Place, Turn } from './view'
  import { fade, float } from '../motion'
  import { DURATIONS, FLOAT_IN_DELAY, WHEEL } from '../motion-tokens'

  interface Props {
    song: Song
    turn: Turn | null
    place: Place
    children: Snippet<[Song]>
  }

  const { song, turn, place, children }: Props = $props()

  /** 等着飘进来（还在 delay 里）的那一块：introstart 时才露面 */
  const waiting = new WeakSet<Element>()

  function enter(node: Element, _params: undefined, options: TransitionOptions): TransitionConfig {
    if (turn === null)
      return {}
    if (turn === 'fade')
      return fade(node, { duration: DURATIONS.state }, options)
    waiting.add(node)
    return float(node, { toward: turn, distance: place === 'page' ? WHEEL.textIn : undefined, delay: WHEEL.textDelay + FLOAT_IN_DELAY }, options)
  }

  // 飘出的那一块 Svelte 会标成 inert：读屏只读到新的歌名
  function leave(node: Element, _params: undefined, options: TransitionOptions): TransitionConfig {
    if (turn === null || waiting.has(node))
      return {}
    if (turn === 'fade')
      return fade(node, { duration: DURATIONS['state-out'] }, options)
    return float(node, { toward: turn, distance: place === 'page' ? WHEEL.textOut : undefined, delay: WHEEL.textDelay }, options)
  }
</script>

<!-- span：播放条上放在按钮里 -->
<span class='swap'>
  {#key song.id}
    <span class='slot' in:enter out:leave onintrostart={event => waiting.delete(event.currentTarget)}>
      {@render children(song)}
    </span>
  {/key}
</span>

<style>
  .swap {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .slot {
    grid-area: 1 / 1;
    min-width: 0;
  }
</style>
