<!--
  手机迷你播放条（64px，DESIGN.md Player Bars）：封面、歌名、歌手，44px 圆形播放键、下一首，底边一条很细的进度线。
  轻点封面和歌名那一块打开播放页，按住往上拖也能拉开。放在 PhoneShell 的 bar 里
-->
<script lang='ts'>
  import { SkipForward } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import Cover from '../library/Cover.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, langOf } from '../library/view'
  import IconButton from '../ui/IconButton.svelte'
  import PlayButton from './PlayButton.svelte'
  import { grabToOpenPlayerPage } from './player-page.svelte'
  import ProgressLine from './ProgressLine.svelte'
  import { currentSong } from './view'

  const view = getAppView()
  const player = $derived(view.state.player)
  const song = $derived(currentSong(player))
  const grabSong = grabToOpenPlayerPage()
</script>

<div class='h-full flex items-center gap-1 pl-2 pr-1.5'>
  {#if song}
    <button type='button' class='h-full min-w-0 flex flex-1 touch-none items-center gap-3 rounded-lg text-left active:bg-neutral-50' aria-label='打开播放页：{song.name}' {...grabSong}>
      <Cover url={song.album.coverUrl} size={44} class='rounded-md' />
      <span class='min-w-0'>
        <span class='min-w-0 flex items-center gap-1.5'>
          <span class='truncate text-label text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
          {#if player.trial}<SongBadge availability='trial' />{/if}
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </span>
    </button>
  {/if}
  <PlayButton />
  <IconButton icon={SkipForward} filled label='下一首' onclick={() => view.app.next()} />
</div>
<ProgressLine />
