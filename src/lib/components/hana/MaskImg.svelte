<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    maskClass?: string
    imgClass?: string
    slot?: Snippet
    src: string | null
    alt: string
  }

  const { class: wrapperClass, maskClass, imgClass, slot, src, alt }: Props = $props()
</script>

<div class={['relative', wrapperClass]}>
  <div class={['absolute inset-0 size-full hidden justify-center items-center text-white bg-black/50', maskClass]}>
    {@render slot?.()}
  </div>
  <img {src} {alt} class={imgClass} />
</div>
