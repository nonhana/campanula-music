<!--
  一条提示的样子（改曲库、下载、播放共用）：一张轻的纸片，白底、一排字、浮起阴影。
  成功、出错、播放缓冲只在一个 16px 的图标上分色；动作是没有底色的文字，关闭是石墨淡的 ✕。
  纸片不再填薄荷或红：这张牌只在底下停几秒，不该和封面、面板抢眼；压在纸白、晨光底或播放页的封面雾上，
  靠浮起阴影分得开。位置和换位置的交叉淡化在 NoticeStack。
-->
<script lang='ts'>
  import { Check, CircleAlert, LoaderCircle, X } from '@lucide/svelte'

  import { toast } from '../shared/motion'

  type Tone = 'success' | 'error' | 'progress'

  const { tone, text, phone, edge, moved, name, action, onclose }: {
    tone: Tone
    text: string
    phone: boolean
    edge: 'top' | 'bottom'
    moved: boolean
    /** 换页时原地不动的名字：操作提示按 id，播放提示固定一个 */
    name: string
    /** 一条提示最多一个动作（撤销、重试、继续下载） */
    action?: { label: string, run: () => void }
    onclose: () => void
  } = $props()
</script>

<div
  class={[
    'notice pointer-events-auto flex min-h-11 items-center gap-2.5 rounded-xl bg-white pl-3.5 pr-1 shadow-float',
    phone
      ? 'w-full'
      : 'w-max max-w-[min(480px,calc(100vw-48px))]',
  ]}
  role={tone === 'error'
    ? 'alert'
    : 'status'}
  style='--notice-name: {name}'
  transition:toast|global={{ edge, moved }}
>
  <span
    class={[
      'size-4 grid flex-none place-items-center',
      tone === 'error'
        ? 'text-error-700'
        : tone === 'progress'
        ? 'text-neutral-500'
        : 'text-primary-800',
    ]}
    aria-hidden='true'
  >
    {#if tone === 'progress'}
      <LoaderCircle size={16} class='animate-spin' />
    {:else if tone === 'error'}
      <CircleAlert size={16} />
    {:else}
      <Check size={16} />
    {/if}
  </span>
  <p
    class={[
      'min-w-0 flex-1 break-words py-3 text-balance text-label font-500',
      tone === 'error'
        ? 'text-error-700'
        : 'text-neutral-900',
    ]}
  >{text}</p>
  {#if action}
    <button
      type='button'
      class={[
        'h-11 flex-none whitespace-nowrap rounded-full px-3 text-label font-600 transition-[background-color,color,transform] duration-feedback press',
        tone === 'error'
          ? 'text-error-700 active:bg-error-100 mouse:hover:(bg-error-50 text-error-900)'
          : 'text-primary-900 active:bg-primary-100 mouse:hover:(bg-primary-50 text-primary-950)',
      ]}
      onclick={() => action.run()}
    >{action.label}</button>
  {/if}
  <button
    type='button'
    class='grid size-11 flex-none press place-items-center rounded-full text-neutral-500 transition-[background-color,color,transform] duration-feedback md:size-10 mouse:hover:(bg-neutral-100 text-neutral-800)'
    aria-label='关闭提示'
    onclick={onclose}
  >
    <X size={16} aria-hidden='true' />
  </button>
</div>

<style>
  /* 换页时原地不动。正在淡出的那块（Svelte 标成 inert）不要名字：两块同名时浏览器会跳过这次换页的过渡 */
  .notice:not([inert]) {
    view-transition-name: var(--notice-name);
    view-transition-class: still;
  }
</style>
