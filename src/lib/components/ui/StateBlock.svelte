<!--
  空状态和出错状态：图标放在一枚淡色圆里，标题说清发生了什么，最多一个主要动作。只有标题时不留空的正文段落。
  加载中不用它：列表用形状一致的骨架行（DESIGN.md Do's）。
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import { CircleAlert, RotateCw } from '@lucide/svelte'

  import Button from './Button.svelte'

  interface Props {
    kind: 'empty' | 'error'
    title: string
    /** 标题说不清时才写一句 */
    body?: string
    icon?: LucideIcon
    action?: { label: string, run: () => void }
  }

  const { kind, title, body, icon, action }: Props = $props()
  const Icon = $derived(kind === 'error'
    ? CircleAlert
    : icon)
</script>

<div class='flex flex-col items-center px-6 py-16 text-center' role={kind === 'error'
  ? 'alert'
  : 'status'}>
  {#if Icon}
    <span class={[
      'grid size-14 place-items-center rounded-full',
      kind === 'error'
        ? 'bg-error-50 text-error-700'
        : 'bg-primary-100 text-primary-950',
    ]}>
      <Icon size={24} aria-hidden='true' />
    </span>
  {/if}
  <p class='[text-wrap:balance] mt-4 text-title-sm text-neutral-900 font-600'>{title}</p>
  {#if body}
    <p class='[text-wrap:balance] mt-1.5 max-w-[34ch] text-label text-neutral-600 font-400 leading-[22px]'>{body}</p>
  {/if}
  {#if action}
    <Button variant='primary' icon={kind === 'error'
      ? RotateCw
      : undefined} class='mt-5' onclick={action.run}>{action.label}</Button>
  {/if}
</div>
