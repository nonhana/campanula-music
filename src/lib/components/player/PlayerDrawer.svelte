<script lang='ts'>
  import type { MenuItemInfo } from '$lib/types'
  import Menu from '$lib/components/hana/Menu.svelte'
  import MenuItem from '$lib/components/hana/MenuItem.svelte'
  import { selectedMenu, setSelectedMenu, setShowDetail, showDetail } from '$lib/stores/nowPlayingStore'
  import { onMount } from 'svelte'
  import Detail from './Detail.svelte'
  import Lyrics from './Lyrics.svelte'
  import Playlist from './Playlist.svelte'

  interface Props {
    showDrawer: boolean
    currentProgress: number
    handleInput: (e: Event) => void
    handleChange: (e: Event) => void
    handleChangeSong: (type: 'prev' | 'next') => () => void
  }

  let {
    showDrawer = $bindable(),
    currentProgress,
    handleInput,
    handleChange,
    handleChangeSong,
  }: Props = $props()

  // 抽屉与顶部的距离，单位为 dvh
  let top = $state(100)
  let draggerElement = $state<HTMLButtonElement | null>(null)

  const openDrawer = () => {
    requestAnimationFrame(() => {
      top = 0
    })
  }

  const closeDrawer = () => {
    requestAnimationFrame(() => {
      top = 100
    })
    setTimeout(() => {
      showDrawer = false
    }, 300)
  }

  // 逻辑：
  // 父组件传递 showDrawer 为 true 时，打开抽屉
  // 子组件接管 showDrawer，手动关闭抽屉
  $effect(() => {
    if (showDrawer) {
      openDrawer()
    }
    else {
      setShowDetail(true)
      setSelectedMenu('lyrics')
    }
  })

  let dragging = $state(false)
  let startY = 0
  let initialTop = 0
  let pointerId = -1

  const onPointerDown = (e: PointerEvent) => {
    pointerId = e.pointerId
    dragging = true

    startY = e.clientY
    initialTop = top

    e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId)
      return

    const deltaY = e.clientY - startY
    const dvh = (deltaY / window.innerHeight) * 100

    top = initialTop + dvh

    if (top < 0)
      top = 0
    if (top > 100)
      top = 100

    e.preventDefault()
  }

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId)
      return

    dragging = false

    if (top > 0 && top < 100) {
      top < 50 ? openDrawer() : closeDrawer()
    }
  }

  const toggleShowDrawer = () => {
    if (showDrawer) {
      closeDrawer()
    }
    else {
      openDrawer()
    }
  }

  onMount(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  })

  const menuComponents = {
    lyrics: Lyrics,
    playlist: Playlist,
  } as const

  type menuKeys = keyof typeof menuComponents

  const playerMenus: MenuItemInfo[] = [{
    key: 'lyrics',
    title: '歌词',
  }, {
    key: 'playlist',
    title: '播放列表',
  }]

  const ActivatedComponent = $derived(menuComponents[$selectedMenu])
</script>

<div
  class={[
    'z-30 fixed left-0 w-full h-full bg-neutral-200/40 backdrop-blur-lg flex gap-20 justify-center items-center',
    !dragging && 'transition-all duration-300',
    'overscroll-none',
  ]}
  style={`top: ${top}dvh;`}
>
  <button
    bind:this={draggerElement}
    aria-label='drawer dragger'
    class='absolute top-5 m-auto h-2 w-10 cursor-grab touch-none select-none rounded-full bg-neutral active:cursor-grabbing'
    onclick={toggleShowDrawer}
    onpointerdown={onPointerDown}
  ></button>

  <div class={[
    'h-3/5 w-full px-10 md:h-[40rem] md:w-[27rem] md:px-0 transition-all duration-300',
    $showDetail ? 'block' : 'md:block hidden',
  ]}>
    <Detail
      {currentProgress}
      {handleInput}
      {handleChange}
      {handleChangeSong}
    />
  </div>

  <div
    class={[
      'flex-col gap-10 md:flex w-9/10 md:w-120',
      $showDetail ? 'hidden' : 'flex',
    ]}
  >
    <Menu defaultActive={$selectedMenu} onselect={key => setSelectedMenu(key as menuKeys)}>
      {#each playerMenus as menu}
        <MenuItem {...menu} />
      {/each}
    </Menu>

    <div class='h-[40rem]'>
      <ActivatedComponent />
    </div>
  </div>
</div>
