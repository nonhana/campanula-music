<!-- PROTOTYPE：按网址参数 engine 换拖动的实现；三种实现用同一套歌曲行、同一份数据。 -->
<script lang='ts'>
  import type { Song } from './data'
  import ActionList from './engines/ActionList.svelte'
  import KitList from './engines/KitList.svelte'
  import PointerList from './engines/PointerList.svelte'
  import { view } from './store.svelte'

  interface Props {
    list: Song[]
    plId: string
    sortable: boolean
    phone: boolean
  }

  const { list, plId, sortable, phone }: Props = $props()
</script>

{#key `${view.engine}-${view.dragVariant}-${phone}`}
  {#if view.engine === 'action'}
    <ActionList {list} {plId} {sortable} {phone} variant={view.dragVariant} />
  {:else if view.engine === 'kit'}
    <KitList {list} {plId} {sortable} {phone} variant={view.dragVariant} />
  {:else}
    <PointerList {list} {plId} {sortable} {phone} variant={view.dragVariant} />
  {/if}
{/key}
