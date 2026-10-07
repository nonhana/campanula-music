<!--
  PROTOTYPE：dnd-kit 要求每一行在自己的组件里调用 createSortable（官方文档：写在 {#each} 里会每次重排都新建实例）。
  传感器在这里传（见 kitSensors.ts 的说明：只传给 DragDropProvider 不生效）。
-->
<script lang='ts'>
  import type { Song } from '../data'
  import { createSortable } from '@dnd-kit/svelte/sortable'
  import { activateRow, openMenu } from '../interact'
  import DesktopRow from '../rows/DesktopRow.svelte'
  import PhoneRow from '../rows/PhoneRow.svelte'
  import { settings } from '../settings.svelte'
  import { player, selection } from '../store.svelte'
  import { kitSensors } from './kitSensors'

  interface Props {
    song: Song
    index: number
    list: Song[]
    phone: boolean
    disabled: boolean
    showGrip: boolean
    gripAt: 'none' | 'lead' | 'end'
  }

  const { song, index, list, phone, disabled, showGrip, gripAt }: Props = $props()

  const sortable = createSortable({
    get id() {
      return song.id
    },
    get index() {
      return index
    },
    get disabled() {
      return disabled
    },
    get sensors() {
      return kitSensors(settings.longPress)
    },
    transition: { duration: 170, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', idle: false },
  })
</script>

{#if phone}
  <PhoneRow
    {song}
    now={player.current === song.id}
    selecting={selection.mode}
    selected={selection.has(song.id)}
    grip={showGrip}
    ghost={sortable.isDragging}
    attachRoot={sortable.attach}
    attachGrip={showGrip ? sortable.attachHandle : undefined}
    onactivate={e => activateRow(e, song, list)}
    onmore={e => openMenu(e, song)}
    onmenu={e => openMenu(e, song)}
  />
{:else}
  <DesktopRow
    {song}
    n={index + 1}
    now={player.current === song.id}
    selecting={selection.mode}
    selected={selection.has(song.id)}
    {gripAt}
    ghost={sortable.isDragging}
    attachRoot={sortable.attach}
    attachGrip={showGrip ? sortable.attachHandle : undefined}
    onactivate={e => activateRow(e, song, list)}
    onmore={e => openMenu(e, song)}
    onmenu={e => openMenu(e, song)}
  />
{/if}
