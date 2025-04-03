<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import type { LayoutData } from './$types'
  import { page } from '$app/state'
  import PlaylistItem from '$lib/components/common/PlaylistItem.svelte'
  import Drawer from '$lib/components/hana/Drawer.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { setPlaylists } from '$lib/stores'
  import { ChevronLeft, ListMusic } from 'lucide-svelte'
  import { onMount } from 'svelte'

  interface Props {
    data: LayoutData
    children: Snippet
  }

  const { data, children }: Props = $props()

  setPlaylists(data.playlists)

  let drawerOpen = $state(false)

  let buttonPosition = $state(50)
  let isDragging = $state(false)
  let startY = $state(0)
  let startPosition = $state(0)

  function handleTouchStart(event: TouchEvent) {
    isDragging = true
    startY = event.touches[0].clientY
    startPosition = buttonPosition
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isDragging)
      return

    const currentY = event.touches[0].clientY
    const deltaY = currentY - startY

    const windowHeight = window.innerHeight
    const newPositionPercent = startPosition + (deltaY / windowHeight * 100)

    buttonPosition = Math.max(10, Math.min(80, newPositionPercent))

    if (Math.abs(deltaY) > 5) {
      event.preventDefault()
    }
  }

  function handleTouchEnd() {
    isDragging = false
  }

  function handleClick() {
    drawerOpen = true
  }

  const nonPassiveTouchEvents: Action = (node: HTMLElement) => {
    const clickHandler = handleClick
    const touchStartHandler = handleTouchStart
    const touchMoveHandler = handleTouchMove
    const touchEndHandler = handleTouchEnd

    node.addEventListener('click', clickHandler)
    node.addEventListener('touchstart', touchStartHandler, { passive: false })
    node.addEventListener('touchmove', touchMoveHandler, { passive: false })
    node.addEventListener('touchend', touchEndHandler)

    return {
      destroy() {
        node.removeEventListener('click', clickHandler)
        node.removeEventListener('touchstart', touchStartHandler)
        node.removeEventListener('touchmove', touchMoveHandler)
        node.removeEventListener('touchend', touchEndHandler)
      },
    }
  }

  onMount(() => {
    return () => {
      isDragging = false
    }
  })
</script>

<div class='relative h-[calc(100dvh-9rem)] flex justify-between gap-12 py-5 md:flex-row-reverse'>
  {@render children()}
  <div class='h-full w-fit hidden md:block'>
    <ScrollContainer contentClass='flex flex-col gap-5 mx-2'>
      {#each data.playlists as playlist}
        <PlaylistItem
          playlist={playlist}
          type='playlist'
          imgClass='w-48'
          activated={Number(page.params.id) === playlist.id}
        />
      {/each}
    </ScrollContainer>
  </div>
  <Drawer bind:visible={drawerOpen} title='歌单列表'>
    {#snippet icon()}<ListMusic />{/snippet}
    <div class='mx-2 flex flex-col gap-5'>
      {#each data.playlists as playlist}
        <PlaylistItem playlist={playlist} type='playlist' imgClass='w-48' />
      {/each}
    </div>
  </Drawer>
  <button
    class='fixed right-0 h-20 w-5 rounded-l-xl bg-primary-200 text-neutral md:hidden'
    style='top: {buttonPosition}%; transform: translateY(-50%);'
    use:nonPassiveTouchEvents
  >
    <ChevronLeft class='h-5 w-5' />
  </button>
</div>
