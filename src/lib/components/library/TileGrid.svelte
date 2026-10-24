<!--
  格子网格（#75）：曲库、搜索、歌手页的专辑、两个歌单分区共用这一份加载 / 失败 / 空 / 条目的状态机。
  按种类和排法（网格、架子、搜索综合里歌单那一排）给格宽和列数，骨架和内容用同一套排法；骨架淡出、内容依次飘入。
  调用方只画每一格（tile 插槽）；空状态、失败说明和重试也由这里画，调用方给文案。
-->
<script lang='ts' generics='T extends { id: number }'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { TileGridLayout, TileKind } from './tile-grid'
  import { fadeAway, reveal, stagger } from '../shared/motion'
  import StateBlock from '../ui/StateBlock.svelte'
  import Shelf from './Shelf.svelte'
  import { tileCellClass, tileGridLook, tileListClass } from './tile-grid'
  import TileBone from './TileBone.svelte'

  interface Props {
    kind: TileKind
    layout: TileGridLayout
    phone?: boolean
    /** null：还在加载；空数组：一张都没有 */
    items: readonly T[] | null
    label: string
    loadingLabel: string
    /** 搜索结果放在白色面板里：桌面上留 12px 内边距 */
    inset?: boolean
    failure?: { title: string, body?: string, retry: () => void } | null
    /** 空列表的 StateBlock；列表为空但调用方自己藏起来（搜索综合、有"显示更多"时）可以不传 */
    empty?: { icon?: LucideIcon, title: string }
    /** 骨架名字下面的第二行；要和 tile 画的一致（库里的歌手没有，搜索里的歌手有） */
    detail?: boolean
    /** 后来加进来的从第几项开始依次飘入（搜索“显示更多”） */
    staggerFrom?: number
    tile: Snippet<[T, number]>
  }

  const { kind, layout, phone = false, items, label, loadingLabel, inset = false, failure = null, empty, detail = true, staggerFrom = 0, tile }: Props = $props()
  const look = $derived(tileGridLook(kind, layout, phone))
  const listClass = $derived(tileListClass(look, layout, phone, inset))
  const cellClass = (index: number) => tileCellClass(look, layout, index)
</script>

{#if items === null && failure}
  <div in:reveal>
    <StateBlock kind='error' title={failure.title} body={failure.body} action={{ label: '重试', run: failure.retry }} />
  </div>
{:else if items === null}
  <div class={listClass} role='status' aria-busy='true' aria-label={loadingLabel} out:fadeAway>
    {#each { length: look.bones }, i (i)}
      <TileBone class={cellClass(i)} round={look.round} {detail} {phone} />
    {/each}
  </div>
{:else if items.length === 0}
  {#if empty}<div in:reveal><StateBlock kind='empty' icon={empty.icon} title={empty.title} /></div>{/if}
{:else}
  <div in:reveal>
    {#if layout === 'shelf'}
      <Shelf {label} {phone} class={look.list}>
        {#each items as item, i (item.id)}
          <li class={cellClass(i)} in:stagger={{ order: i - staggerFrom }}>
            {@render tile(item, i)}
          </li>
        {/each}
      </Shelf>
    {:else}
      <ul class={listClass} aria-label={label} data-reveal-group>
        {#each items as item, i (item.id)}
          <li class={cellClass(i)} in:stagger={{ order: i - staggerFrom }}>
            {@render tile(item, i)}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
