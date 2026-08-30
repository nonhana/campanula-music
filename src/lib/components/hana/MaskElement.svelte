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
    class={['z-1 absolute inset-0 size-full flex justify-center items-center text-white bg-app-mask/50 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100', maskClass]}
    {onclick}
  >
    {@render slot?.()}
  </button>
  {@render root?.()}
</div>
