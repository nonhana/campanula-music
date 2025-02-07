<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    maskClass?: string
    imgClass?: string
    slot?: Snippet
    src: string | null
    alt: string
    onclick?: (e: MouseEvent) => void
  }

  const { class: wrapperClass, maskClass, imgClass, slot, src, alt, onclick }: Props = $props()
</script>

<div class={['relative', wrapperClass]}>
  <button
    class={['absolute inset-0 size-full hidden justify-center items-center text-white bg-black/50', maskClass]}
    {onclick}
  >
    {@render slot?.()}
  </button>
  <img {src} {alt} class={imgClass} />
</div>
