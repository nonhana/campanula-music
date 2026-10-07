<!--
  PROTOTYPE：底部提示条（白纸、浮起阴影、深色字；出错时左边一个出错红图标）。
  手机在迷你播放条 / 批量操作条上面，桌面在底部通栏上面。文案平实：发生了什么、能怎么办。
-->
<script lang='ts'>
  import { CircleAlert } from '@lucide/svelte'
  import { fly } from 'svelte/transition'
  import { layout } from '../layout.svelte'
  import { dismissToast, toasts } from '../store.svelte'
</script>

<div
  class='pointer-events-none fixed inset-x-0 z-[75] flex flex-col items-center gap-2 px-3'
  style:bottom={layout.phone ? 'calc(84px + env(safe-area-inset-bottom))' : '96px'}
  role='status'
  aria-live='polite'
  bind:offsetHeight={toasts.height}
>
  {#each toasts.list as t (t.id)}
    <div
      class='pointer-events-auto flex min-h-12 w-full max-w-[420px] items-center gap-3 rounded-2xl bg-white py-2 pl-4 pr-2 shadow-float'
      transition:fly={{ y: 12, duration: 220, easing: x => 1 - (1 - x) ** 3 }}
    >
      {#if t.tone === 'error'}
        <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
      {/if}
      <p class='min-w-0 flex-1 py-1 text-[14px] leading-5 text-neutral-900'>{t.text}</p>
      {#if t.action}
        <button
          class='act h-9 flex-none rounded-full px-3.5 text-[14px] font-600 text-primary-900'
          onclick={() => {
            t.action?.run()
            dismissToast(t.id)
          }}
        >{t.action.label}</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .act:active {
    background: #e8f8f1;
  }

  @media (hover: hover) and (pointer: fine) {
    .act:hover {
      background: #e8f8f1;
    }
  }
</style>
