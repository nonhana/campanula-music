<!--
  PROTOTYPE：加入歌单（GLOSSARY：目标只能是自建歌单；选“我喜欢的音乐”等于红心；收藏来的歌单不能编辑，不出现在这里）。
  当前打开的这张歌单排在里面但不能选。手机触屏是底部弹层，鼠标是浮动菜单。
-->
<script lang='ts'>
  import { Heart, Plus } from '@lucide/svelte'
  import Cover from '../Cover.svelte'
  import { formatCount, langOf } from '../data'
  import { addSongsTo, library, toast, tracksOf, ui, view } from '../store.svelte'
  import Layer from '../Layer.svelte'

  const req = $derived(ui.add)
  const targets = $derived([library.liked, ...library.own])

  function close() {
    ui.add = null
  }

  function pick(id: string) {
    const songs = req?.songs ?? []
    close()
    void addSongsTo(id, songs)
  }

  function create() {
    const songs = req?.songs ?? []
    close()
    const pl = library.create(songs)
    toast(`已新建歌单「${pl.name}」，加入 ${songs.length} 首`)
  }
</script>

{#if req}
  {@const sheet = req.sheet}
  <Layer kind={sheet ? 'sheet' : 'popover'} x={req.x} y={req.y} width={300} label='加入歌单' role='menu' onclose={close}>
    <p class={sheet ? 'px-4 pt-1 pb-2 text-[16px] font-600 text-neutral-900' : 'px-3 pt-1.5 pb-1.5 text-[13px] font-500 text-neutral-600'}>
      加入歌单<span class='ml-1.5 font-400 text-neutral-600 tnum'>· {req.songs.length} 首</span>
    </p>
    <button role='menuitem' class={['row flex w-full items-center gap-3 text-left', sheet ? 'h-15 rounded-xl px-4' : 'h-12 rounded-lg px-2']} onclick={create}>
      <span class={['grid flex-none place-items-center rounded-lg bg-primary-100 text-primary-950', sheet ? 'size-11' : 'size-9']}><Plus size={18} aria-hidden='true' /></span>
      <span class={['font-500 text-neutral-900', sheet ? 'text-[15px]' : 'text-[14px]']}>新建歌单</span>
    </button>
    {#each targets as pl (pl.id)}
      {@const current = pl.id === view.pl}
      <button
        role='menuitem'
        class={['row flex w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-45', sheet ? 'h-15 rounded-xl px-4' : 'h-12 rounded-lg px-2']}
        disabled={current}
        onclick={() => pick(pl.id)}
      >
        <span class='relative flex-none'>
          <Cover cover={library.coverOf(pl)} class={['rounded-lg', sheet ? 'size-11' : 'size-9']} />
          {#if pl.kind === 'liked'}
            <span class='absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-white shadow-ambient'>
              <Heart size={11} class='text-accent-600' fill='currentColor' aria-hidden='true' />
            </span>
          {/if}
        </span>
        <span class='min-w-0 flex-1'>
          <span class={['block truncate font-500 text-neutral-900', sheet ? 'text-[15px]' : 'text-[14px]']} lang={langOf(pl.name)}>{pl.name}</span>
          <span class='block truncate text-[12.5px] text-neutral-600 tnum'>
            {#if current}当前歌单{:else if pl.kind === 'liked'}等于红心 · {formatCount(tracksOf(pl.id).local.length)} 首{:else}{formatCount(tracksOf(pl.id).local.length)} 首{/if}
          </span>
        </span>
      </button>
    {/each}
  </Layer>
{/if}

<style>
  .row:not(:disabled):active {
    background: #e8f8f1;
  }

  .row:focus-visible {
    background: #e8f8f1;
    outline: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .row:not(:disabled):hover {
      background: #f5fcf9;
    }
  }
</style>
