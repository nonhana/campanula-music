<!--
  一条提示的样子（改曲库、下载、播放共用）：薄荷玻璃或浅红底的浅色小卡片，深色字。
  成功、出错、播放缓冲只在左边白色圆片里的图标上分；动作是白色小胶囊，关闭是深色的 ✕。
  这样压在纸白、晨光底或封面上都分得开，不靠阴影单独撑存在感。位置和换位置的交叉淡化在 NoticeStack。
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
    'notice pointer-events-auto flex items-center gap-3 rounded-xl py-2 pl-2.5 pr-2 shadow-float',
    tone === 'error'
      ? 'bg-error-100'
      : 'bg-primary-200',
    phone
      ? 'w-full'
      : 'w-max max-w-[min(560px,calc(100vw-48px))]',
  ]}
  role={tone === 'error'
    ? 'alert'
    : 'status'}
  style='--notice-name: {name}'
  transition:toast|global={{ edge, moved }}
>
  <span
    class={[
      'size-8 grid flex-none place-items-center rounded-full bg-white',
      tone === 'error'
        ? 'text-error-700'
        : 'text-primary-900',
    ]}
    aria-hidden='true'
  >
    {#if tone === 'progress'}
      <LoaderCircle size={18} class='animate-spin' />
    {:else if tone === 'error'}
      <CircleAlert size={18} />
    {:else}
      <Check size={18} />
    {/if}
  </span>
  <p
    class={[
      'min-w-0 flex-1 break-words text-balance text-label font-500',
      tone === 'error'
        ? 'text-error-900'
        : 'text-primary-950',
    ]}
  >{text}</p>
  {#if action}
    <button
      type='button'
      class={[
        'pill-hit press h-10 flex-none rounded-full bg-white px-3.5 text-label font-600 transition-[background-color,color,transform] duration-feedback',
        tone === 'error'
          ? 'text-error-900 focus-visible:outline-error-900 mouse:hover:bg-error-50'
          : 'text-primary-950 focus-visible:outline-primary-950 mouse:hover:bg-primary-300',
      ]}
      onclick={() => action.run()}
    >{action.label}</button>
  {/if}
  <button
    type='button'
    class={[
      'size-11 md:size-10 grid flex-none place-items-center rounded-full transition-[background-color,color,transform] duration-feedback press',
      tone === 'error'
        ? 'text-error-900/70 focus-visible:outline-error-900 mouse:hover:(bg-white/70 text-error-900)'
        : 'text-primary-950/70 focus-visible:outline-primary-950 mouse:hover:(bg-white/70 text-primary-950)',
    ]}
    aria-label='关闭提示'
    onclick={onclose}
  >
    <X size={18} aria-hidden='true' />
  </button>
</div>

<style>
  /* 换页时原地不动。正在淡出的那块（Svelte 标成 inert）不要名字：两块同名时浏览器会跳过这次换页的过渡 */
  .notice:not([inert]) {
    view-transition-name: var(--notice-name);
    view-transition-class: still;
  }
</style>
