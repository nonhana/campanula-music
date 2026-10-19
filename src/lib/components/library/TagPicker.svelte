<!--
  选歌单标签（#33，原型 PlaylistEditor 的标签那一块）：只能从网易云的标签库里选（App 的 openPlaylistTags，按语种、风格、场景、情感、主题分组），
  最多 3 个（验证关卡②）。选了的排在上面，点一下去掉；选满了其余的不能点，标题旁写“已到上限”，下面一行说清楚规矩。
  标签库还在取是几行骨架，没取到说明原因、能重试；已经选了的照样能去掉。标签库里的每个标签是一个 Filter chip（按下了就是选了）。
  桌面上标签库那一块最高 188px、自己滚，手机上跟着弹层一起滚
-->
<script lang='ts'>
  import type { PlaylistTagGroup } from '#lib/api/library.js'
  import type { PageState } from '#lib/app/library.js'
  import { X } from '@lucide/svelte'
  import { PLAYLIST_TAGS_MAX } from '#lib/api/library.js'
  import { failureText } from '../failure'
  import Button from '../ui/Button.svelte'
  import FilterChip from '../ui/FilterChip.svelte'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    /** 选了的标签，照选的先后 */
    tags: string[]
    /** 网易云的标签库：没取过是 null */
    library: PageState<PlaylistTagGroup[]> | null
    phone: boolean
    onretry: () => void
  }

  let { tags = $bindable(), library, phone, onretry }: Props = $props()
  const full = $derived(tags.length >= PLAYLIST_TAGS_MAX)
  /** 骨架几行、每行几个：和标签库差不多的样子 */
  const BONES = [5, 6, 7]

  function toggle(tag: string) {
    if (tags.includes(tag))
      tags = tags.filter(each => each !== tag)
    else if (!full)
      tags = [...tags, tag]
  }
</script>

<div role='group' aria-labelledby='tag-picker-label' aria-describedby='tag-picker-rule'>
  <p class='flex items-baseline justify-between gap-3'>
    <span id='tag-picker-label' class='text-caption text-neutral-700 font-500'>标签</span>
    <span class='text-caption text-neutral-600 tabular-nums' role='status'>已选 {tags.length}/{PLAYLIST_TAGS_MAX}{full ? ' · 已到上限' : ''}</span>
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
            <span class='pt-2.5 text-caption text-neutral-600 md:pt-2' aria-hidden='true'>{group.name}</span>
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
          <p class='text-caption text-neutral-700'>网易云的标签库没取到：{failureText(library.failure)}</p>
          <Button variant='outline' onclick={onretry}>重试</Button>
        </div>
      {:else}
        <div class='flex flex-col gap-3' role='status' aria-busy='true' aria-label='正在取标签库'>
          {#each BONES as count, row (row)}
            <div class='grid grid-cols-[40px_minmax(0,1fr)] items-center gap-2'>
              <span class='bone h-3 w-8 rounded-full'></span>
              <span class='flex flex-wrap gap-1.5'>
                {#each { length: count }, i (i)}
                  <span class='bone h-10 w-14 rounded-full md:h-9'></span>
                {/each}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <p id='tag-picker-rule' class='mt-2 text-caption text-neutral-600'>标签只能从网易云提供的列表里选，最多 {PLAYLIST_TAGS_MAX} 个。</p>
</div>
