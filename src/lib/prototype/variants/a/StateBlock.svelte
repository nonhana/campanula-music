<!--
  PROTOTYPE：空状态和出错状态。图标放在一枚淡色圆里，标题一句话说清发生了什么，正文说能怎么办，最多一个主要动作。
  加载中不用它，用 SkeletonRows（骨架行），避免整块转圈。
-->
<script lang='ts'>
  import type { Component, Snippet } from 'svelte'
  import { CircleAlert } from '@lucide/svelte'

  interface Props {
    kind: 'empty' | 'error'
    title: string
    /** 正文；需要在文字里画图标（比如“更多”菜单）时传 snippet */
    body?: string | Snippet
    /** 空状态用的图标（Lucide 组件）；出错固定用感叹号 */
    icon?: Component<{ size?: number, class?: string, 'aria-hidden'?: 'true' }>
    actionLabel?: string
    onaction?: () => void
    /** 紧凑：放在列表里、弹层里 */
    compact?: boolean
  }

  const { kind, title, body = '', icon, actionLabel, onaction, compact = false }: Props = $props()
  const Icon = $derived(kind === 'error' ? CircleAlert : icon)
</script>

<div class={['flex flex-col items-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16']} role={kind === 'error' ? 'alert' : 'status'}>
  {#if Icon}
    <span class={['grid size-14 place-items-center rounded-full', kind === 'error' ? 'bg-error-50 text-error-700' : 'bg-primary-100 text-primary-900']}>
      <Icon size={24} aria-hidden='true' />
    </span>
  {/if}
  <p class='mt-4 text-[16px] leading-6 font-600 text-neutral-900' style:text-wrap='balance'>{title}</p>
  {#if body}
    <p class='mt-1.5 max-w-[34ch] text-[14px] leading-[22px] text-neutral-600' style:text-wrap='balance'>
      {#if typeof body === 'function'}{@render body()}{:else}{body}{/if}
    </p>
  {/if}
  {#if actionLabel && onaction}
    <button class='action mt-5 h-10 rounded-full bg-primary-900 px-5 text-[14px] font-500 text-white' onclick={onaction}>
      {actionLabel}
    </button>
  {/if}
</div>

<style>
  .action:active {
    transform: scale(0.98);
  }

  @media (hover: hover) and (pointer: fine) {
    .action:hover {
      filter: brightness(0.92);
    }
  }
</style>
