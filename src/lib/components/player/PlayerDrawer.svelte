<script lang='ts'>
  import type { MenuItemInfo } from '$lib/types'
  import Menu from '$lib/components/hana/Menu.svelte'
  import MenuItem from '$lib/components/hana/MenuItem.svelte'
  import Detail from './Detail.svelte'
  import Lyrics from './Lyrics.svelte'

  interface Props {
    showDrawer: boolean
    currentProgress: number
    handleInput: (e: Event) => void
    handleChange: (e: Event) => void
    handlePointerDown: () => void
  }

  let {
    showDrawer = $bindable(),
    currentProgress,
    handleInput,
    handleChange,
    handlePointerDown,
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
  })

  let dragging = $state(false)
  let startY = 0
  let initialTop = 0

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

  // Menu 配置项
  const playerMenus: MenuItemInfo[] = [{
    key: 'lyrics',
    title: '歌词',
  }, {
    key: 'playlist',
    title: '播放列表',
  }]

  let selectedMenu = $state('lyrics')
</script>

{#if showDrawer || dragging}
  <div
    class={[
      'z-30 fixed left-0 w-full h-full bg-neutral-200/40 backdrop-blur flex gap-20 justify-center items-center',
      !dragging && 'transition-all duration-300',
    ]}
    style={`top: ${top}dvh;`}
  >
    <button
      aria-label='drawer dragger'
      class='absolute top-5 m-auto h-2 w-10 cursor-grab rounded-full bg-neutral active:cursor-grabbing'
      onclick={toggleShowDrawer}
      onpointerdown={onPointerDown}
    ></button>
    <Detail
      {currentProgress}
      {handleInput}
      {handleChange}
      {handlePointerDown}
    />
    <div class='flex flex-col gap-10'>
      <Menu defaultActive={selectedMenu} onselect={key => selectedMenu = key}>
        {#each playerMenus as menu}
          <MenuItem {...menu} />
        {/each}
      </Menu>

      <div class='h-[40rem] w-80'>
        {#if selectedMenu === 'lyrics'}
          <Lyrics />
        {:else if selectedMenu === 'playlist'}
          <div>播放列表内容</div>
        {/if}
      </div>
    </div>
  </div>
{/if}
