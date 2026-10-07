<!-- PROTOTYPE：封面图。圆角、尺寸由调用方用 class 决定。 -->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { coverSrc } from './data'

  interface Props {
    cover: string
    /** 封面旁边已有歌名时留空 */
    alt?: string
    class?: ClassValue
    eager?: boolean
  }

  const { cover, alt = '', class: klass = '', eager = false }: Props = $props()
</script>

<img
  src={coverSrc(cover)}
  {alt}
  class={klass}
  loading={eager ? 'eager' : 'lazy'}
  decoding='async'
  draggable='false'
  style='object-fit: cover; aspect-ratio: 1 / 1;'
/>
