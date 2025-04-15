<script lang='ts'>
  import type { HTMLAttributes } from 'svelte/elements'
  import { Music } from 'lucide-svelte'
  import { onMount } from 'svelte'

  type Props = {
    wrapper?: HTMLElement | null
    src: string
    alt: string
  } & HTMLAttributes<HTMLDivElement>

  let {
    wrapper = $bindable(null),
    src,
    alt,
    class: customClasses = '',
    ...rest
  }: Props = $props()

  let loaded = $state(false)
  let isVisible = $state(false)
  let imgElement = $state<HTMLElement | null>(null)
  let loadError = $state(false)
  let observer: IntersectionObserver

  const currentSrc = $derived(isVisible ? src : '')

  function onImageLoad() {
    loaded = true
  }

  function onImageError() {
    loadError = true
    loaded = true
  }

  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        isVisible = true
        observer.disconnect()
      }
    }, {
      rootMargin: '200px',
      threshold: 0.01,
    })

    if (imgElement) {
      observer.observe(imgElement)
    }

    return () => {
      observer?.disconnect()
    }
  })
</script>

<div bind:this={wrapper} class={['aspect-square relative overflow-hidden', customClasses]} {...rest}>
  {#if !isVisible}
    <div class='size-full animate-pulse rounded-md bg-gray-200' bind:this={imgElement}></div>
  {:else if !currentSrc || loadError}
    <div class='size-full flex items-center justify-center bg-white/60 text-neutral'>
      <Music class='size-1/3' />
    </div>
  {:else}
    <img
      src={currentSrc}
      alt={alt}
      class={['size-full transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0']}
      onload={onImageLoad}
      onerror={onImageError}
      bind:this={imgElement}
    />

    {#if !loaded}
      <div class='absolute inset-0 flex items-center justify-center bg-gray-200'>
        <div class='h-10 w-10 animate-spin border-4 border-primary border-t-transparent rounded-full'></div>
      </div>
    {/if}
  {/if}
</div>
