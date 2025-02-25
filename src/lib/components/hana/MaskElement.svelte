<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    maskClass?: string
    onclick?: (e: MouseEvent) => void
    slot?: Snippet
    root?: Snippet
  }

  const { class: wrapperClass, maskClass, slot, root, onclick }: Props = $props()
</script>

<div class={['relative', wrapperClass]}>
  <button
    class={['absolute inset-0 size-full hidden justify-center items-center text-white bg-black/50', maskClass]}
    {onclick}
  >
    {@render slot?.()}
  </button>
  {@render root?.()}
</div>
