<!--
  PROTOTYPE：桌面骨架（照视觉原型，静态）：64px 顶栏、72px 图标侧栏、内容区、80px 底部通栏。
  只为了让拖动在真实的密度、真实的上下遮挡里试：自动滚动的上边缘从顶栏（和列表的吸顶表头）下面算，下边缘从底部通栏上面算。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { ArrowLeft, CalendarDays, CircleArrowDown, Flower, House, ListMusic, Menu, Pause, Play, Repeat, Search, Settings, SkipBack, SkipForward, Volume2 } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { artistLine, formatDuration, me, songById } from '../data'
  import { player, view } from '../store.svelte'

  interface Props {
    children: Snippet
    onback?: () => void
    onlibrary?: () => void
  }

  const { children, onback, onlibrary }: Props = $props()
  const song = $derived(songById.get(player.current))
</script>

<div class='min-h-dvh bg-primary-50'>
  <header class='fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 bg-primary-50 pl-4 pr-6'>
    <span class='grid size-10 place-items-center rounded-xl text-neutral-700' aria-hidden='true'><Menu size={20} /></span>
    <span class='flex h-10 items-center gap-2 pr-1'>
      <Flower size={28} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
      <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
    </span>
    <button
      class={['ghost ml-2 grid size-10 place-items-center rounded-xl text-neutral-700', !onback && 'invisible']}
      aria-label='返回'
      tabindex={onback ? 0 : -1}
      onclick={onback}
    >
      <ArrowLeft size={20} aria-hidden='true' />
    </button>
    <div class='mx-auto flex h-11 w-full max-w-[520px] items-center gap-2 rounded-full bg-white pl-4 pr-2 text-[14px] text-neutral-500 shadow-ambient'>
      <Search size={17} aria-hidden='true' />搜索歌曲、歌手、专辑
    </div>
    <Cover cover={me.avatar} alt='账号：{me.nickname}' class='size-9 flex-none rounded-full ring-2 ring-white' />
  </header>

  <nav class='fixed bottom-20 left-0 top-16 z-30 flex w-[72px] flex-col px-3 pb-4 pt-2' aria-label='主导航'>
    <button
      class={['rail-item grid h-12 w-full place-items-center rounded-xl', view.screen === 'library' ? 'bg-primary-200 text-primary-950' : 'text-neutral-600']}
      aria-label='曲库'
      aria-current={view.screen === 'library' ? 'page' : undefined}
      onclick={onlibrary}
    >
      <House size={22} aria-hidden='true' />
    </button>
    <span class='mt-1 grid h-12 w-full place-items-center rounded-xl text-neutral-600' aria-hidden='true'><CalendarDays size={22} /></span>
    <span class='mt-1 grid h-12 w-full place-items-center rounded-xl text-neutral-600' aria-hidden='true'><CircleArrowDown size={22} /></span>
    <span class='mt-auto grid h-12 w-full place-items-center rounded-xl text-neutral-600' aria-hidden='true'><Settings size={22} /></span>
  </nav>

  <main class='pb-28 pl-[72px] pt-16'>
    <div class='mx-auto max-w-[1280px] px-8 pt-4'>
      {@render children()}
    </div>
  </main>

  <footer class='fixed inset-x-0 bottom-0 z-30 h-20 bg-white shadow-float'>
    <div class='absolute inset-x-0 top-0 h-[2px] bg-primary-100' aria-hidden='true'>
      <div class='h-full w-[42%] bg-primary-700'></div>
    </div>
    <div class='grid h-full grid-cols-[minmax(0,1fr)_minmax(0,440px)_minmax(0,1fr)] items-center gap-6 px-5'>
      <div class='flex items-center gap-1.5 text-neutral-700'>
        <span class='grid size-10 place-items-center' aria-hidden='true'><SkipBack size={20} fill='currentColor' /></span>
        <button class='grid size-11 place-items-center rounded-full bg-primary-950 text-white' aria-label={player.playing ? '暂停' : '播放'} onclick={() => (player.playing = !player.playing)}>
          {#if player.playing}<Pause size={20} fill='currentColor' aria-hidden='true' />{:else}<Play size={20} fill='currentColor' class='ml-0.5' aria-hidden='true' />{/if}
        </button>
        <span class='grid size-10 place-items-center' aria-hidden='true'><SkipForward size={20} fill='currentColor' /></span>
        {#if song}<span class='ml-2 text-[12.5px] text-neutral-500 tnum'>{formatDuration(song.duration * 0.42)} / {formatDuration(song.duration)}</span>{/if}
      </div>
      {#if song}
        <div class='flex min-w-0 items-center gap-3 p-1.5 pr-4'>
          <Cover cover={song.cover} class='size-12 flex-none rounded-lg' />
          <span class='min-w-0'>
            <span class='block truncate text-[14px] font-500 text-neutral-900' lang={song.lang}>{song.title}</span>
            <span class='block truncate text-[12.5px] text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
          </span>
        </div>
      {/if}
      <div class='flex items-center justify-end gap-1.5 text-neutral-700' aria-hidden='true'>
        <span class='grid size-10 place-items-center'><Repeat size={18} /></span>
        <span class='grid size-10 place-items-center'><Volume2 size={18} /></span>
        <span class='grid size-10 place-items-center'><ListMusic size={18} /></span>
      </div>
    </div>
  </footer>
</div>

<style>
  @media (hover: hover) and (pointer: fine) {
    .ghost:hover,
    .rail-item:not([aria-current]):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
