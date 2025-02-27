<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    children?: Snippet
  }

  const { children }: Props = $props()
</script>

<div>
  这是一个播放列表
  {@render children?.()}
</div>
