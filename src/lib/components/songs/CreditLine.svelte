<!--
  歌手一行（#84，DESIGN.md Song Row · 歌手名、专辑名）：每位有名字的歌手一个 CreditName，中间的“ / ”不是链接；没名字的不列，一个都没有写“未知歌手”（creditLine 的规矩）。
  歌曲行、首页歌曲格、播放队列里这一行画在点歌按钮外面、只给眼睛看（spoken 为 false：按钮的读屏名字里已经有歌手）；播放条、播放页的链接进 Tab 顺序。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'

  import type { Credit } from '#lib/api/library.js'
  import { creditLine } from '#lib/api/library.js'

  import { langOf } from '../shared/text'
  import CreditName from './CreditName.svelte'

  interface Props {
    artists: readonly Credit[]
    /** 名字能点（桌面、不在多选里）；没登录时 CreditName 自己写纯文字 */
    linked: boolean
    tabbable?: boolean
    /** false：读屏不读这一行 */
    spoken?: boolean
    padded?: boolean
    class?: ClassValue
  }

  const { artists, linked, tabbable = false, spoken = true, padded = false, class: klass }: Props = $props()
  const named = $derived(artists.filter(artist => artist.name !== null))
  const line = $derived(creditLine(artists))
</script>

<span class={klass} lang={langOf(line)} aria-hidden={spoken ? undefined : 'true'}>{#each named as artist, i (i)}{#if i > 0} / {/if}<CreditName kind='artist' target={artist} {linked} {tabbable} {padded} />{:else}{line}{/each}</span>
