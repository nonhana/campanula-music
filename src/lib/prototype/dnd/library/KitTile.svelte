<!-- PROTOTYPE：dnd-kit 的曲库格子：每张自建歌单在自己的组件里 createSortable，传感器也在这里传（见 engines/kitSensors.ts）。 -->
<script lang='ts'>
  import type { Playlist } from '../data'
  import { createSortable } from '@dnd-kit/svelte/sortable'
  import { kitSensors } from '../engines/kitSensors'
  import { settings } from '../settings.svelte'
  import PlaylistTile from './PlaylistTile.svelte'

  interface Props {
    pl: Playlist
    index: number
    layout: 'grid' | 'list'
    phone: boolean
    grip: boolean
    disabled: boolean
    onopen: () => void
  }

  const { pl, index, layout, phone, grip, disabled, onopen }: Props = $props()

  const sortable = createSortable({
    get id() {
      return pl.id
    },
    get index() {
      return index
    },
    get disabled() {
      return disabled
    },
    group: 'own',
    // 接了把手以后，dnd-kit 只在把手上监听按下，所以方案 B / C 自然只能从把手拖
    get sensors() {
      return kitSensors(settings.longPress)
    },
    transition: { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', idle: false },
  })
</script>

<PlaylistTile {pl} {layout} {phone} {grip} ghost={sortable.isDragging} attachRoot={sortable.attach} attachGrip={grip ? sortable.attachHandle : undefined} {onopen} />
