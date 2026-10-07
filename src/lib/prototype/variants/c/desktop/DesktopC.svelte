<!-- PROTOTYPE（变体 C）：桌面骨架。72px 的薄荷顶带横贯全宽，正中是搜索框；左边 72px 白色图标栏；底部通栏播放条。 -->
<script lang='ts'>
  import type { Component } from 'svelte'
  import { ArrowDownToLine, CalendarHeart, Flower, Library, Settings } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { me } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import BottomBar from './BottomBar.svelte'
  import LibraryD from './LibraryD.svelte'
  import PlayerD from './PlayerD.svelte'
  import PlaylistD from './PlaylistD.svelte'
  import SearchField from './SearchField.svelte'

  interface RailItem {
    key: string
    label: string
    icon: Component<any>
    active: boolean
    go: () => void
  }

  const onList = $derived(nav.screen === 'playlist' || (nav.screen === 'player'))
  const rail = $derived<RailItem[]>([
    {
      key: 'library',
      label: '曲库',
      icon: Library,
      active: nav.screen === 'library' || (onList && nav.playlistId !== 'daily' && nav.playlistId !== 'downloads'),
      go: () => {
        nav.query = ''
        nav.goLibrary()
      },
    },
    {
      key: 'daily',
      label: '每日推荐',
      icon: CalendarHeart,
      active: onList && nav.playlistId === 'daily',
      go: () => {
        nav.query = ''
        nav.openPlaylist('daily')
      },
    },
    {
      key: 'downloads',
      label: '已下载',
      icon: ArrowDownToLine,
      active: onList && nav.playlistId === 'downloads',
      go: () => {
        nav.query = ''
        nav.openPlaylist('downloads')
      },
    },
  ])

  // 切换界面时回到顶部
  let lastKey = ''
  $effect(() => {
    if (nav.screen === 'player')
      return
    const key = `${nav.screen}:${nav.playlistId}:${nav.tab}`
    if (lastKey && key !== lastKey)
      window.scrollTo({ top: 0 })
    lastKey = key
  })
</script>

{#snippet railButton(item: RailItem)}
  <button type='button' class='rail-btn' class:on={item.active} aria-label={item.label} aria-current={item.active ? 'page' : undefined} onclick={item.go}>
    <item.icon size={22} strokeWidth={item.active ? 2.25 : 2} aria-hidden='true' />
    <span class='tip' aria-hidden='true'>{item.label}</span>
  </button>
{/snippet}

<div class='min-h-dvh bg-white'>
  <header class='band'>
    <button type='button' class='logo' aria-label='Campanula，回到曲库' onclick={() => {
      nav.query = ''
      nav.goLibrary('liked')
    }}>
      <Flower size={28} color='#37BE8C' strokeWidth={2} aria-hidden='true' />
      <span class='text-lg text-neutral-900 font-600 tracking-[-0.01em]'>Campanula</span>
    </button>
    <div class='flex justify-center'>
      <SearchField />
    </div>
    <div class='flex items-center justify-end'>
      <button type='button' class='avatar' aria-label='{me.nickname} 的账号'>
        <Cover cover={me.avatar} class='size-9 rounded-full' />
      </button>
    </div>
  </header>

  <nav class='rail' aria-label='主导航'>
    {#each rail as item (item.key)}
      {@render railButton(item)}
    {/each}
    <div class='mt-auto'>
      {@render railButton({ key: 'settings', label: '设置', icon: Settings, active: false, go: () => {} })}
    </div>
  </nav>

  <main class='pb-[104px] pl-[72px] pt-[72px]'>
    {#if nav.screen === 'playlist'}
      <PlaylistD />
    {:else}
      <LibraryD />
    {/if}
  </main>

  <BottomBar />

  {#if nav.screen === 'player'}
    <PlayerD />
  {/if}
</div>

<style>
  .band {
    position: fixed;
    inset-inline: 0;
    top: 0;
    z-index: 45;
    display: grid;
    grid-template-columns: minmax(200px, 1fr) minmax(0, 640px) minmax(200px, 1fr);
    align-items: center;
    gap: 24px;
    height: 72px;
    padding: 0 20px 0 18px;
    background: #e8f8f1;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    justify-self: start;
    height: 44px;
    padding: 0 8px;
    border-radius: 12px;
  }

  .avatar {
    border-radius: 999px;
    padding: 2px;
    box-shadow: 0 0 0 2px #fff;
  }

  .rail {
    position: fixed;
    left: 0;
    top: 72px;
    bottom: 80px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 72px;
    padding: 16px 0 16px;
    background: #fff;
    box-shadow: inset -1px 0 0 #f3f4f6;
  }

  .rail-btn {
    position: relative;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    color: #4b5563;
  }

  .rail-btn.on {
    background: #d1f1e3;
    color: #1a5b43;
  }

  .tip {
    position: absolute;
    left: calc(100% + 10px);
    top: 50%;
    z-index: 70;
    padding: 4px 10px;
    border-radius: 6px;
    background: #1f2937;
    color: #fff;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translate(-4px, -50%);
    transition: opacity 120ms, transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .rail-btn:focus-visible .tip {
    opacity: 1;
    transform: translate(0, -50%);
  }

  @media (hover: hover) and (pointer: fine) {
    .rail-btn:hover .tip {
      opacity: 1;
      transform: translate(0, -50%);
    }

    .rail-btn:not(.on):hover {
      background: #f5fcf9;
      color: #1a5b43;
    }

    .logo:hover {
      background: #d1f1e3;
    }
  }
</style>
