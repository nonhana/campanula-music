<!--
  PROTOTYPE：歌单编辑。由 nav.edit 打开：
    new    新建歌单（名称、隐私）
    info   编辑歌单信息（封面、名称、简介、标签：只能从网易云固定标签里选，最多 3 个）
    public 隐私歌单改为公开（网易云不支持改回隐私，要写清楚）
    delete 删除自建歌单 / 取消收藏别人的歌单
  桌面是居中弹窗，手机是底部弹层。原型里保存只关闭弹层，不改数据。
-->
<script lang='ts'>
  import { MAX_PLAYLIST_TAGS, playlistTagGroups } from '$lib/prototype/catalog'
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount, langOf, playlistById } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { Check, ImageUp, Lock, X } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'

  interface Props {
    phone: boolean
  }

  const { phone }: Props = $props()

  const NAME_MAX = 40
  const DESC_MAX = 1000

  const mode = $derived(nav.edit)
  const pl = $derived(playlistById(nav.playlistId))
  /** 我喜欢的音乐不能改名、不能删；只有自建歌单能编辑，收藏的歌单只能取消收藏 */
  const allowed = $derived.by(() => {
    if (mode === 'new')
      return true
    if (!pl || pl.kind === 'liked')
      return false
    if (mode === 'delete')
      return true
    if (mode === 'public')
      return pl.kind === 'own' && Boolean(pl.isPrivate)
    return pl.kind === 'own'
  })

  // 表单：打开弹层时按当前歌单填好（弹层每次打开都会重新创建）
  const start = nav.edit === 'new' ? undefined : playlistById(nav.playlistId)
  let name = $state(start?.name ?? '')
  let description = $state(start?.description ?? '')
  let tags = $state<string[]>([...(start?.tags ?? [])])
  let isPrivate = $state(false)

  const nameOk = $derived(name.trim().length > 0 && name.length <= NAME_MAX)
  const full = $derived(tags.length >= MAX_PLAYLIST_TAGS)

  function toggleTag(t: string) {
    if (tags.includes(t))
      tags = tags.filter(x => x !== t)
    else if (!full)
      tags = [...tags, t]
  }

  function close() {
    nav.closeEdit()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  function focusFirst(node: HTMLElement) {
    queueMicrotask(() => node.querySelector<HTMLElement>('[data-autofocus], input, textarea, button')?.focus({ preventScroll: true }))
  }

  const titles = { new: '新建歌单', info: '编辑歌单信息', public: '改为公开歌单', delete: '删除歌单' } as const
  const title = $derived(mode === 'delete' && pl?.kind === 'collected' ? '取消收藏' : mode ? titles[mode] : '')
  const isForm = $derived(mode === 'new' || mode === 'info')
</script>

<svelte:window {onkeydown} />

{#snippet nameField()}
  <label class='block'>
    <span class='flex items-baseline justify-between text-[13px] font-500 text-neutral-700'>
      歌单名称
      <span class={['font-400 tnum', name.length > NAME_MAX ? 'text-error-700' : 'text-neutral-500']}>{name.length}/{NAME_MAX}</span>
    </span>
    <input
      bind:value={name}
      data-autofocus
      class='field mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500'
      placeholder='给歌单起个名字'
      maxlength={NAME_MAX + 10}
      lang={langOf(name)}
    />
  </label>
{/snippet}

{#snippet tagPicker()}
  <div>
    <p class='flex items-baseline justify-between text-[13px] font-500 text-neutral-700'>
      标签
      <span class='font-400 text-neutral-500 tnum'>已选 {tags.length}/{MAX_PLAYLIST_TAGS}{full ? ' · 已到上限' : ''}</span>
    </p>
    {#if tags.length}
      <div class='mt-2 flex flex-wrap gap-2'>
        {#each tags as t (t)}
          <button class='chip-on inline-flex h-8 items-center gap-1 rounded-full bg-primary-200 pl-3 pr-1.5 text-[13px] font-500 text-primary-950' aria-label='移除标签 {t}' onclick={() => toggleTag(t)}>
            {t}<X size={14} aria-hidden='true' />
          </button>
        {/each}
      </div>
    {/if}
    <div class={['mt-3 flex flex-col gap-3 overflow-y-auto rounded-xl bg-neutral-50 p-3', phone ? '' : 'max-h-[188px]']}>
      {#each playlistTagGroups as g (g.group)}
        <div class='grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2'>
          <span class='pt-1.5 text-[12px] text-neutral-500'>{g.group}</span>
          <div class='flex flex-wrap gap-1.5'>
            {#each g.tags as t (t)}
              {@const on = tags.includes(t)}
              <button
                role='checkbox'
                aria-checked={on}
                disabled={!on && full}
                class={['tag h-7 rounded-full px-2.5 text-[12.5px] font-500 disabled:(cursor-not-allowed opacity-40)', on ? 'bg-primary-200 text-primary-950' : 'border border-neutral-200 bg-white text-neutral-700']}
                onclick={() => toggleTag(t)}
              >{t}</button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <p class='mt-2 text-[12px] text-neutral-500'>标签只能从网易云提供的列表里选，最多 {MAX_PLAYLIST_TAGS} 个。</p>
  </div>
{/snippet}

{#snippet formBody()}
  {#if mode === 'new'}
    <div class='flex flex-col gap-5'>
      {@render nameField()}
      <label class='flex cursor-pointer items-start gap-3'>
        <input type='checkbox' bind:checked={isPrivate} class='peer sr-only' />
        <span class='box mt-0.5 grid size-5 flex-none place-items-center rounded-md border border-neutral-300 bg-white text-white peer-checked:(border-primary-900 bg-primary-900)'>
          {#if isPrivate}<Check size={14} strokeWidth={3} aria-hidden='true' />{/if}
        </span>
        <span>
          <span class='flex items-center gap-1.5 text-[14px] font-500 text-neutral-900'><Lock size={14} aria-hidden='true' />设为隐私歌单</span>
          <span class='mt-0.5 block text-[13px] leading-5 text-neutral-600'>只有你自己能看到。以后可以改为公开，但公开后不能再改回隐私。</span>
        </span>
      </label>
    </div>
  {:else if pl}
    <div class={phone ? 'flex flex-col gap-5' : 'grid grid-cols-[152px_minmax(0,1fr)] gap-6'}>
      <div class={phone ? 'flex items-center gap-4' : ''}>
        <Cover cover={pl.cover} class={phone ? 'size-24 flex-none rounded-xl shadow-ambient' : 'w-full rounded-xl shadow-ambient'} />
        <div class={phone ? 'min-w-0' : 'mt-3'}>
          <button class='btn-line inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-[13px] font-500 text-neutral-800'>
            <ImageUp size={15} aria-hidden='true' />更换封面
          </button>
          <p class='mt-1.5 text-[12px] leading-[18px] text-neutral-500'>选一张图片，裁成正方形。</p>
        </div>
      </div>
      <div class='flex min-w-0 flex-col gap-5'>
        {@render nameField()}
        <label class='block'>
          <span class='flex items-baseline justify-between text-[13px] font-500 text-neutral-700'>
            简介
            <span class='font-400 text-neutral-500 tnum'>{formatCount(description.length)}/{formatCount(DESC_MAX)}</span>
          </span>
          <textarea
            bind:value={description}
            rows={phone ? 3 : 2}
            maxlength={DESC_MAX}
            class='field mt-1.5 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[14px] leading-[22px] text-neutral-900 outline-none placeholder:text-neutral-500'
            placeholder='写几句介绍这张歌单（可以不写）'
          ></textarea>
        </label>
        {@render tagPicker()}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet confirmBody()}
  {#if pl && mode === 'public'}
    <p class='text-[14px] leading-[22px] text-neutral-700'>
      公开后，你的网易云主页和搜索里都能看到<span class='font-500 text-neutral-900' lang={langOf(pl.name)}>「{pl.name}」</span>。
    </p>
    <p class='mt-3 rounded-xl bg-warning-50 px-3.5 py-2.5 text-[13px] leading-5 text-warning-900'>网易云不支持把公开歌单改回隐私，这一步不能撤销。</p>
  {:else if pl && mode === 'delete' && pl.kind === 'collected'}
    <p class='text-[14px] leading-[22px] text-neutral-700'>
      <span class='font-500 text-neutral-900' lang={langOf(pl.name)}>「{pl.name}」</span>会从你的曲库里移除。以后还能在搜索里找到它，重新收藏。
    </p>
  {:else if pl && mode === 'delete'}
    <p class='text-[14px] leading-[22px] text-neutral-700'>
      <span class='font-500 text-neutral-900' lang={langOf(pl.name)}>「{pl.name}」</span>里的 {formatCount(pl.count)} 首歌会随歌单一起移除；歌曲本身、你的红心和已下载的歌都不受影响。
    </p>
    <p class='mt-3 text-[13px] leading-5 text-neutral-600'>删除后不能恢复。</p>
  {/if}
{/snippet}

{#snippet confirmButton()}
  {#if mode === 'public'}
    <button class='solid h-11 rounded-full bg-primary-900 px-5 text-[15px] font-500 text-white' data-autofocus onclick={close}>改为公开</button>
  {:else if pl?.kind === 'collected'}
    <button class='solid h-11 rounded-full bg-primary-900 px-5 text-[15px] font-500 text-white' onclick={close}>取消收藏</button>
  {:else}
    <button class='solid h-11 rounded-full bg-error-700 px-5 text-[15px] font-500 text-white' onclick={close}>删除歌单</button>
  {/if}
{/snippet}

{#if mode && allowed}
  <div class='fixed inset-0 z-[80]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={close} transition:fade={{ duration: 180 }}></button>

    {#if phone}
      <!-- 手机：底部弹层。表单类是接近全屏的弹层，顶栏放 取消 / 标题 / 保存 -->
      <div
        class={['absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-white shadow-float', isForm ? 'max-h-[calc(100dvh-24px)]' : '']}
        role='dialog'
        aria-modal='true'
        aria-labelledby='pl-edit-title'
        {@attach focusFirst}
        transition:fly={{ y: 480, duration: 320, opacity: 1, easing: t => 1 - (1 - t) ** 4 }}
      >
        <div class='mx-auto mt-2 h-1 w-9 flex-none rounded-full bg-neutral-300' aria-hidden='true'></div>
        {#if isForm}
          <div class='flex h-14 flex-none items-center gap-2 px-2'>
            <button class='h-11 rounded-full px-3 text-[15px] text-neutral-700 active:bg-neutral-100' onclick={close}>取消</button>
            <h2 id='pl-edit-title' class='flex-1 text-center text-[16px] font-600 text-neutral-900'>{title}</h2>
            <button class='h-11 rounded-full px-3 text-[15px] font-600 text-primary-900 disabled:text-neutral-400' disabled={!nameOk} onclick={close}>{mode === 'new' ? '创建' : '保存'}</button>
          </div>
          <div class='min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2'>
            {@render formBody()}
          </div>
        {:else}
          <div class='px-6 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4'>
            <h2 id='pl-edit-title' class='text-[18px] leading-7 font-600 text-neutral-900'>{title}</h2>
            <div class='mt-2'>{@render confirmBody()}</div>
            <div class='mt-6 grid gap-2'>
              {@render confirmButton()}
              <button class='h-11 rounded-full border border-neutral-200 bg-white text-[15px] font-500 text-neutral-800 active:bg-neutral-50' onclick={close}>{mode === 'delete' ? '先不了' : '取消'}</button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- 桌面：居中弹窗 -->
      <div class='pointer-events-none absolute inset-0 grid place-items-center p-6'>
        <div
          class={['pointer-events-auto flex max-h-[calc(100dvh-48px)] w-full flex-col rounded-2xl bg-white shadow-float', mode === 'info' ? 'max-w-[680px]' : mode === 'new' ? 'max-w-[480px]' : 'max-w-[440px]']}
          role='dialog'
          aria-modal='true'
          aria-labelledby='pl-edit-title'
          {@attach focusFirst}
          transition:fly={{ y: 8, duration: 200, easing: t => 1 - (1 - t) ** 3 }}
        >
          <div class='flex flex-none items-center gap-3 px-6 pb-2 pt-5'>
            <h2 id='pl-edit-title' class='flex-1 text-[18px] leading-7 font-600 text-neutral-900'>{title}</h2>
            <button class='ghost grid size-9 place-items-center rounded-full text-neutral-600' aria-label='关闭' onclick={close}>
              <X size={18} aria-hidden='true' />
            </button>
          </div>
          <div class='min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-2'>
            {#if isForm}{@render formBody()}{:else}{@render confirmBody()}{/if}
          </div>
          <div class='flex flex-none items-center justify-end gap-2 px-6 pb-5 pt-4'>
            <button class='btn-line h-11 rounded-full border border-neutral-200 bg-white px-5 text-[15px] font-500 text-neutral-800' onclick={close}>{mode === 'delete' ? '先不了' : '取消'}</button>
            {#if isForm}
              <button class='solid h-11 rounded-full bg-primary-900 px-6 text-[15px] font-500 text-white disabled:(cursor-not-allowed bg-neutral-200 text-neutral-500)' disabled={!nameOk} onclick={close}>{mode === 'new' ? '创建' : '保存'}</button>
            {:else}
              {@render confirmButton()}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .field:focus {
    border-color: #59cfa3;
    box-shadow: 0 0 0 3px #e8f8f1;
  }

  .box {
    transition: background-color 120ms ease-out, border-color 120ms ease-out;
  }

  :global(.peer:focus-visible) + .box {
    outline: 2px solid #2b976f;
    outline-offset: 2px;
  }

  .solid:active,
  .chip-on:active,
  .tag:not(:disabled):active {
    transform: scale(0.98);
  }

  @media (hover: hover) and (pointer: fine) {
    .ghost:hover,
    .tag:not(:disabled):not([aria-checked='true']):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .btn-line:hover {
      background: #f9fafb;
    }

    .solid:not(:disabled):hover {
      filter: brightness(0.92);
    }
  }
</style>
