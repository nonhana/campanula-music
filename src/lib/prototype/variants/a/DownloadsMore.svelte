<!--
  PROTOTYPE：已下载页的 ••• ——桌面是贴着按钮的小浮层，手机是底部弹层；里面只有“清空全部下载”，
  点了先弹确认框（这一步删掉的是整台设备上的下载，值得打断一下）。
-->
<script lang='ts'>
  import { downloadedSongs, storage } from '$lib/prototype/catalog'
  import { formatCount } from '$lib/prototype/data'
  import { Ellipsis, Trash2 } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'
  import { ui } from './state.svelte'

  interface Props {
    phone: boolean
    /** 还剩几首（用来写确认框） */
    count: number
    disabled?: boolean
  }

  const { phone, count, disabled = false }: Props = $props()

  let open = $state(false)
  let confirming = $state(false)
  let trigger = $state<HTMLButtonElement>()
  let dialog = $state<HTMLDialogElement>()

  $effect(() => {
    if (confirming && dialog && !dialog.open)
      dialog.showModal()
  })

  function close() {
    open = false
    trigger?.focus({ preventScroll: true })
  }

  function askClear() {
    open = false
    confirming = true
  }

  function clearAll() {
    for (const s of downloadedSongs)
      ui.removed.add(s.id)
    dialog?.close()
  }

  function focusFirst(node: HTMLElement) {
    queueMicrotask(() => node.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }))
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      close()
    }
  }
</script>

<span class='relative inline-flex'>
  <button
    bind:this={trigger}
    class={phone
      ? 'grid size-11 place-items-center rounded-full text-neutral-700 active:bg-primary-100 disabled:opacity-35'
      : 'ghost grid size-10 place-items-center rounded-full text-neutral-700 disabled:opacity-35'}
    aria-label='更多已下载操作'
    aria-haspopup='menu'
    aria-expanded={open}
    {disabled}
    onclick={() => (open = !open)}
  >
    <Ellipsis size={phone ? 20 : 18} aria-hidden='true' />
  </button>

  {#if open && !phone}
    <div class='fixed inset-0 z-[60]' role='presentation' onclick={close}></div>
    <div
      class='absolute left-0 top-full z-[61] mt-1.5 w-[220px] rounded-xl bg-white p-1.5 shadow-float'
      role='menu'
      tabindex='-1'
      aria-label='已下载操作'
      {onkeydown}
      {@attach focusFirst}
      transition:fly={{ y: -4, duration: 160, easing: t => 1 - (1 - t) ** 3 }}
    >
      <button role='menuitem' class='menu-item flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-error-700 focus-visible:(bg-primary-100 outline-none)' onclick={askClear}>
        <Trash2 size={18} aria-hidden='true' />清空全部下载
      </button>
    </div>
  {/if}
</span>

{#if open && phone}
  <div class='fixed inset-0 z-[70]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/30' aria-label='关闭菜单' tabindex='-1' onclick={close} transition:fade={{ duration: 180 }}></button>
    <div
      class='absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-2 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-float'
      role='menu'
      tabindex='-1'
      aria-label='已下载操作'
      {onkeydown}
      {@attach focusFirst}
      transition:fly={{ y: 200, duration: 320, opacity: 1, easing: t => 1 - (1 - t) ** 4 }}
    >
      <div class='mx-auto mb-2 h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></div>
      <p class='px-4 pb-2 pt-1 text-[13px] text-neutral-600 tnum'>已下载 · {formatCount(count)} 首 · 已用 {storage.used}</p>
      <button role='menuitem' class='flex h-13 w-full items-center gap-4 rounded-xl px-4 text-left text-[15px] text-error-700 active:bg-error-50 focus-visible:bg-primary-100' onclick={askClear}>
        <Trash2 size={18} aria-hidden='true' />清空全部下载
      </button>
    </div>
  </div>
{/if}

{#if confirming}
  <dialog
    bind:this={dialog}
    class='confirm m-auto w-[400px] max-w-[calc(100vw-32px)] rounded-2xl border-0 bg-white p-6 shadow-float'
    aria-labelledby='clear-title'
    aria-describedby='clear-body'
    onclose={() => {
      confirming = false
      trigger?.focus({ preventScroll: true })
    }}
  >
    <h2 id='clear-title' class='text-[18px] leading-7 font-600 text-neutral-900'>清空全部下载？</h2>
    <p id='clear-body' class='mt-2 text-[14px] leading-[22px] text-neutral-600'>
      这台设备上的 <span class='tnum'>{formatCount(count)}</span> 首歌会全部删除，释放 <span class='tnum'>{storage.used}</span> 空间。曲库和红心不受影响，以后可以重新下载。
    </p>
    <div class='mt-6 flex justify-end gap-2'>
      <button class='cancel h-10 rounded-full border border-neutral-200 bg-white px-5 text-[14px] font-500 text-neutral-900' onclick={() => dialog?.close()}>取消</button>
      <button class='danger h-10 rounded-full bg-error-700 px-5 text-[14px] font-500 text-white' onclick={clearAll}>清空全部下载</button>
    </div>
  </dialog>
{/if}

<style>
  .confirm::backdrop {
    background: rgb(17 24 39 / 0.3);
  }

  .confirm[open] {
    animation: rise 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confirm[open] {
      animation: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .ghost:not(:disabled):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .menu-item:hover {
      background: #fbe9e7;
    }

    .cancel:hover {
      background: #f9fafb;
    }

    .danger:hover {
      background: #c62828;
    }
  }
</style>
