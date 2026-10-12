<!-- 曲库首页：手机是我喜欢的音乐列表；桌面是同步提示和我喜欢的音乐的三行歌曲格（“查看全部”进完整列表） -->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { getAppView } from '$lib/components/app-context.svelte'
  import { desktopLayout } from '$lib/components/layout'
  import Cover from '$lib/components/library/Cover.svelte'
  import LikedStates from '$lib/components/library/LikedStates.svelte'
  import PhoneLiked from '$lib/components/library/PhoneLiked.svelte'
  import SyncNotice from '$lib/components/library/SyncNotice.svelte'
  import { artistLine, formatCount, langOf, likedView, syncNotice } from '$lib/components/library/view'
  import IconButton from '$lib/components/ui/IconButton.svelte'
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const liked = $derived(library && likedView(library))
  const hasNotice = $derived(library !== null && syncNotice(library) !== null)
  const strip = $derived(liked?.kind === 'songs' ? liked.songs.slice(0, 36) : [])

  let stripEl = $state<HTMLElement>()
  let atStart = $state(true)
  let atEnd = $state(false)

  function measureStrip() {
    if (!stripEl)
      return
    atStart = stripEl.scrollLeft < 4
    atEnd = stripEl.scrollLeft + stripEl.clientWidth > stripEl.scrollWidth - 4
  }

  // 歌格出现、歌变多、窗口变宽时，翻页键能不能按要跟着变
  $effect(() => {
    void strip.length
    measureStrip()
    window.addEventListener('resize', measureStrip)
    return () => window.removeEventListener('resize', measureStrip)
  })

  function turn(dir: 1 | -1) {
    stripEl?.scrollBy({ left: dir * stripEl.clientWidth, behavior: 'smooth' })
  }
</script>

<svelte:head><title>我喜欢的音乐 · Campanula</title></svelte:head>

{#if library && liked}
  {#if desktopLayout.current}
    <h1 class='sr-only'>曲库</h1>
    <SyncNotice {library} />
    <section class={hasNotice ? 'mt-10' : undefined} aria-labelledby='liked-heading'>
      <div class='mb-4 flex items-center gap-3'>
        <h2 id='liked-heading' class='text-title text-neutral-900 font-600'>我喜欢的音乐</h2>
        {#if liked.kind === 'songs'}
          <span class='text-caption text-neutral-500 tabular-nums'>{formatCount(liked.total)} 首</span>
        {:else if liked.kind === 'empty'}
          <span class='text-caption text-neutral-500 tabular-nums'>0 首</span>
        {/if}
        <div class='ml-auto flex items-center gap-2'>
          {#if liked.kind === 'songs'}
            <IconButton icon={ChevronLeft} label='上一页' disabled={atStart} onclick={() => turn(-1)} />
            <IconButton icon={ChevronRight} label='下一页' disabled={atEnd} onclick={() => turn(1)} />
          {/if}
          <a href={resolve('/liked')} class='ml-1 h-9 inline-flex items-center rounded-full px-4 text-label text-primary-900 font-500 transition-colors duration-150 mouse:hover:(bg-primary-100 text-primary-950)'>查看全部</a>
        </div>
      </div>

      <div class='min-w-0 rounded-xl bg-white p-2 shadow-ambient'>
        {#if liked.kind === 'songs'}
          <!-- 能横向滚动的容器 Chrome 会放进 Tab 顺序：给它名字，键盘焦点在上面时 ←/→ 也能翻 -->
          <div
            bind:this={stripEl}
            class='strip'
            role='list'
            aria-label='我喜欢的音乐的前 {strip.length} 首'
            style:--fade-l={atStart ? '0px' : '32px'}
            style:--fade-r={atEnd ? '0px' : '48px'}
            onscroll={measureStrip}
          >
            {#each strip as song (song.id)}
              <div role='listitem' class='cell grid grid-cols-[48px_minmax(0,1fr)] h-[60px] items-center gap-3 rounded-lg pl-1.5 pr-2 mouse:hover:bg-neutral-50'>
                <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
                <span class='min-w-0'>
                  <span class='block truncate text-label text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
                  <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
                </span>
              </div>
            {/each}
          </div>
        {:else}
          <LikedStates {liked} rows={3} />
        {/if}
      </div>
    </section>
  {:else}
    <h1 class='sr-only'>我喜欢的音乐</h1>
    <PhoneLiked {library} />
  {/if}
{/if}

<style>
  .strip {
    display: grid;
    grid-template-rows: repeat(3, 60px);
    grid-auto-flow: column;
    grid-auto-columns: calc((100% - 24px) / 3.25);
    column-gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    /* 露出的半列淡进面板里，读作“还有更多”，不是被截断 */
    mask-image: linear-gradient(90deg, transparent 0, #000 var(--fade-l), #000 calc(100% - var(--fade-r)), transparent 100%);
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .cell {
    scroll-snap-align: start;
  }
</style>
