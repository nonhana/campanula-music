<!-- PROTOTYPE：封面图。圆角、尺寸由调用方用 class 决定；cover 可以是素材名，也可以是 blob: 地址（新上传的封面）。 -->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { coverSrc } from './data'

  interface Props {
    cover: string
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
