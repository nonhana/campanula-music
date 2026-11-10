<script lang="ts">
  import { Check, CircleAlert, X } from '@lucide/svelte';

  import { toast } from '../shared/motion';

  type Tone = 'success' | 'error';

  const {
    tone,
    text,
    phone,
    edge,
    moved,
    name,
    action,
    onclose,
  }: {
    tone: Tone;
    text: string;
    phone: boolean;
    edge: 'top' | 'bottom';
    moved: boolean;
    name: string;
    action?: { label: string; run: () => void };
    onclose: () => void;
  } = $props();
</script>

<div
  class={[
    'notice pointer-events-auto flex min-h-11 items-center gap-2.5 rounded-xl bg-white pl-3.5 pr-1 shadow-float',
    phone ? 'w-full' : 'w-max max-w-[min(480px,calc(100vw-48px))]',
  ]}
  role={tone === 'error' ? 'alert' : 'status'}
  style="--notice-name: {name}"
  transition:toast|global={{ edge, moved }}
>
  <span
    class={[
      'size-4 grid flex-none place-items-center',
      tone === 'error' ? 'text-error-700' : 'text-primary-800',
    ]}
    aria-hidden="true"
  >
    {#if tone === 'error'}
      <CircleAlert size={16} />
    {:else}
      <Check size={16} />
    {/if}
  </span>
  <p
    class={[
      'min-w-0 flex-1 break-words py-3 text-balance text-label font-500',
      tone === 'error' ? 'text-error-700' : 'text-neutral-900',
    ]}
  >
    {text}
  </p>
  {#if action}
    <button
      type="button"
      class={[
        'h-11 flex-none whitespace-nowrap rounded-full px-3 text-label font-600 transition-[background-color,color,transform] duration-feedback press',
        tone === 'error'
          ? 'text-error-700 active:bg-error-100 mouse:hover:(bg-error-50 text-error-900)'
          : 'text-primary-900 active:bg-primary-100 mouse:hover:(bg-primary-50 text-primary-950)',
      ]}
      onclick={() => action.run()}>{action.label}</button
    >
  {/if}
  <button
    type="button"
    class="grid size-11 flex-none press place-items-center rounded-full text-neutral-500 transition-[background-color,color,transform] duration-feedback md:size-10 mouse:hover:(bg-neutral-100 text-neutral-800)"
    aria-label="关闭提示"
    onclick={onclose}
  >
    <X size={16} aria-hidden="true" />
  </button>
</div>

<style>
  /* 正在淡出的那块（inert）不要名字：同名会让浏览器跳过这次换页的过渡 */
  .notice:not([inert]) {
    view-transition-name: var(--notice-name);
    view-transition-class: still;
  }
</style>
