<!--
  选歌单标签（#33）：只能从网易云的标签库选（按语种、风格、场景、情感、主题分组），最多 3 个（验证关卡②）。选中的排在上面，点一下去掉；
  标题旁“n/3”，选满后其余变灰；“最多 3 个”只写进读屏说明。标签库在取是骨架，没取到写原因、能重试，已选的照样能去掉。
  桌面上标签库最高 188px、自己滚，手机上跟着弹层滚。
-->
<script lang='ts'>
  import { X } from '@lucide/svelte'

  import type { PlaylistTagGroup } from '#lib/api/library.js'
  import { PLAYLIST_TAGS_MAX } from '#lib/api/library.js'
  import type { PageState } from '#lib/app/library.js'

  import { failureText } from '../shared/failure'
  import Button from '../ui/Button.svelte'
  import FilterChip from '../ui/FilterChip.svelte'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    tags: string[]
    library: PageState<PlaylistTagGroup[]> | null
    phone: boolean
    onretry: () => void
  }

  let { tags = $bindable(), library, phone, onretry }: Props = $props()
  const full = $derived(tags.length >= PLAYLIST_TAGS_MAX)
  /** 和标签库差不多的样子 */
  const BONES = [5, 6, 7]

  const toggle = (tag: string) => {
    if (tags.includes(tag))
      tags = tags.filter(each => each !== tag)
    else if (!full)
      tags = [...tags, tag]
  }
</script>

<div role='group' aria-labelledby='tag-picker-label' aria-describedby='tag-picker-rule'>
  <p class='flex items-baseline justify-between gap-3'>
    <span id='tag-picker-label' class='text-caption text-neutral-700 font-500'>标签</span>
    <span class='text-caption text-neutral-600 tabular-nums' role='status'><span class='sr-only'>已选 </span>{tags.length}/{PLAYLIST_TAGS_MAX}</span>
  </p>
  {#if tags.length > 0}
    <ul class='mt-2 flex flex-wrap gap-2' aria-label='选了的标签'>
      {#each tags as tag (tag)}
        <li>
          <button
            type='button'
            class='h-8 inline-flex press items-center gap-1 rounded-full bg-primary-200 pl-3 pr-2 text-caption text-primary-950 font-500 transition-[background-color,transform] duration-feedback mouse:hover:bg-primary-300'
            aria-label='去掉标签“{tag}”'
            onclick={() => toggle(tag)}
          >{tag}<X size={14} aria-hidden='true' /></button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class={['relative mt-3 rounded-xl bg-neutral-50', !phone && 'max-h-[188px] overflow-y-auto overscroll-contain']}>
    {#if !phone}<Scrollbar />{/if}
    <div class='flex flex-col gap-3 p-3'>
      {#if library?.status === 'shown'}
        {#each library.content as group (group.name)}
          <div class='grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2' role='group' aria-label={group.name}>
            <span class='pt-2 text-caption text-neutral-600' aria-hidden='true'>{group.name}</span>
            <div class='flex flex-wrap gap-1.5'>
              {#each group.tags as tag (tag)}
                {@const on = tags.includes(tag)}
                <FilterChip selected={on} disabled={!on && full} onclick={() => toggle(tag)}>{tag}</FilterChip>
              {/each}
            </div>
          </div>
        {/each}
      {:else if library?.status === 'failed'}
        <div class='flex flex-col items-start gap-3' role='alert'>
          <p class='text-caption text-neutral-700'>标签没加载出来：{failureText(library.failure)}</p>
          <Button variant='outline' onclick={onretry}>重试</Button>
        </div>
      {:else}
        <div class='flex flex-col gap-3' role='status' aria-busy='true' aria-label='正在取标签库'>
          {#each BONES as count, row (row)}
            <div class='grid grid-cols-[40px_minmax(0,1fr)] items-center gap-2'>
              <span class='bone h-3 w-8 rounded-full'></span>
              <span class='flex flex-wrap gap-1.5'>
                {#each { length: count }, i (i)}
                  <span class='bone h-9 w-14 rounded-full'></span>
                {/each}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <p id='tag-picker-rule' class='sr-only'>最多 {PLAYLIST_TAGS_MAX} 个</p>
</div>
