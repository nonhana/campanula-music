<script lang='ts'>
  import type { HTMLAttributes } from 'svelte/elements'
  import { Music } from '@lucide/svelte'
  import { onMount } from 'svelte'

  interface Props extends HTMLAttributes<HTMLDivElement> {
    wrapper?: HTMLElement | null
    src: string
    alt: string
  }

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

  // src 变化即复位加载两态，避免上一次的加载结果（如 404 错误占位）永久占据展示
  $effect(() => {
    void src
    loaded = false
    loadError = false
  })

  const onImageLoad = () => {
    loaded = true
  }

  const onImageError = () => {
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
    <div class='size-full flex items-center justify-center bg-app-surface/60 text-neutral'>
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
