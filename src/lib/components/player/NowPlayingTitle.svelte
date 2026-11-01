<!-- 播放页左对齐的歌名、歌手、专辑：歌名桌面 Headline-sm、手机 Title（DESIGN.md Typography）；只放试听时跟着“试听”徽标（开始放才知道，徽标淡入）。
  换歌时跟着换碟横着飘（SongSwap）。歌手名、专辑名能点（#84），进 Tab 顺序：点了播放页收起、换到那一页，返回回到打开播放页之前的页面（CreditName 交给浮层栈）。
  手机上这两行行高 32px、链接上下各垫 6px，点按区域 32px。链接的焦点环离字 2px：两行各用 4px 内边距让出这一圈（截断会裁掉它），外边距抵掉，位置不变。 -->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import { songTitle } from '#lib/api/library.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { fade } from '../shared/motion'
  import { langOf } from '../shared/text'
  import CreditLine from '../songs/CreditLine.svelte'
  import CreditName from '../songs/CreditName.svelte'
  import SongBadge from '../songs/SongBadge.svelte'
  import SongSwap from './SongSwap.svelte'
  import type { Turn } from './view'

  const { song, turn, phone = false }: { song: Song, turn: Turn | null, phone?: boolean } = $props()
  const view = getAppView()
</script>

<SongSwap {song} {turn} place='page'>
  {#snippet children(shown)}
    <div class='min-w-0 flex items-center gap-2'>
      <h2 class={[
        'truncate text-neutral-900 font-600',
        phone ? 'text-title' : 'text-headline-sm',
      ]} lang={langOf(shown.name)}>{songTitle(shown)}</h2>
      {#if view.state.player.trial}<span class='flex flex-none' transition:fade><SongBadge kind='trial' /></span>{/if}
    </div>
    <CreditLine
      artists={shown.artists}
      linked
      tabbable
      padded={phone}
      class={['-mx-1 -mb-1 -mt-0.5 block truncate p-1 text-body text-neutral-700', phone && 'leading-8']}
    />
    {#if shown.album.name}
      <p class={['-m-1 truncate p-1 text-label text-neutral-600 font-400', phone && 'leading-8']} lang={langOf(shown.album.name)}>
        <CreditName kind='album' target={shown.album} linked tabbable padded={phone} />
      </p>
    {/if}
  {/snippet}
</SongSwap>
