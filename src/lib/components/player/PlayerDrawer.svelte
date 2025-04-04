<script lang='ts'>
  import type { MenuItemInfo } from '$lib/types'
  import Menu from '$lib/components/hana/Menu.svelte'
  import MenuItem from '$lib/components/hana/MenuItem.svelte'
  import { selectedMenu, setSelectedMenu, setShowDetail, showDetail } from '$lib/stores/nowPlayingStore'
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

  // 移动端触摸事件处理
  const onTouchMove = (e: TouchEvent) => {
    if (!dragging || !e.touches[0])
      return

    // 防止页面滚动
    e.preventDefault()

    const deltaY = e.touches[0].clientY - startY
    const dvh = (deltaY / window.innerHeight) * 100
    top = initialTop + dvh
    if (top < 0)
      top = 0
    if (top > 100)
      top = 100
  }

  const handleTouchEnd = () => {
    dragging = false
    window.removeEventListener('touchmove', onTouchMove as EventListener)
    window.removeEventListener('touchend', handleTouchEnd as EventListener)

    if (top < 50) {
      openDrawer()
    }
    else {
      closeDrawer()
    }
  }

  const onTouchStart = (e: TouchEvent) => {
    if (!e.touches[0])
      return

    startY = e.touches[0].clientY
    initialTop = top
    dragging = true

    window.addEventListener('touchmove', onTouchMove as EventListener, { passive: false } as AddEventListenerOptions)
    window.addEventListener('touchend', handleTouchEnd as EventListener)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging)
      return
    const deltaY = e.clientY - startY
    const dvh = (deltaY / window.innerHeight) * 100
    top = initialTop + dvh
    if (top < 0)
      top = 0
    if (top > 100)
      top = 100
  }

  const onPointerUp = () => {
    dragging = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    if (top < 50) {
      openDrawer()
    }
    else {
      closeDrawer()
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    startY = e.clientY
    initialTop = top
    dragging = true
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const toggleShowDrawer = () => {
    if (dragging)
      return
    if (showDrawer) {
      closeDrawer()
    }
    else {
      openDrawer()
    }
  }

  const menuComponents = {
    lyrics: Lyrics,
    playlist: Playlist,
  } as const

  type menuKeys = keyof typeof menuComponents

  // Menu 配置项
  const playerMenus: MenuItemInfo[] = [{
    key: 'lyrics',
    title: '歌词',
  }, {
    key: 'playlist',
    title: '播放列表',
  }]

  const ActivatedComponent = $derived(menuComponents[$selectedMenu])
</script>

{#if showDrawer || dragging}
  <div
    class={[
      'z-30 fixed left-0 w-full h-full bg-neutral-200/40 backdrop-blur-lg flex gap-20 justify-center items-center',
      !dragging && 'transition-all duration-300',
    ]}
    style={`top: ${top}dvh;`}
  >
    <button
      aria-label='drawer dragger'
      class='absolute top-5 m-auto h-2 w-10 cursor-grab rounded-full bg-neutral active:cursor-grabbing'
      onclick={toggleShowDrawer}
      onpointerdown={onPointerDown}
      ontouchstart={onTouchStart}
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
{/if}
