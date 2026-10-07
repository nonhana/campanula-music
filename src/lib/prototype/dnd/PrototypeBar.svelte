<!--
  PROTOTYPE：原型切换栏（照 prototype 技能的 UI.md）：‹ 方案 › 切换 ?variant=；拖动页还能切 ?engine=（实现）；右边打开原型面板。
  只在开发模式显示；←/→ 键也能切方案（输入框、裁剪框这类自己用方向键的地方不拦截）。拖动中自动藏起来，免得挡住下边缘的自动滚动区。
  弹层、菜单开着时缩成右上角的一个面板按钮：不挡弹层底部的按钮，又能在中途改原型面板里的设置（比如先让上传失败，再改成成功点重试）。
-->
<script lang='ts'>
  import type { Engine, Variant } from './store.svelte'
  import { ChevronLeft, ChevronRight, SlidersHorizontal } from '@lucide/svelte'
  import { layout } from './layout.svelte'
  import { setParams } from './nav'
  import { coverVariantNames, dragStats, engineNames, overlayOpen, selection, toasts, ui, variantNames, view } from './store.svelte'

  const keys: Variant[] = ['A', 'B', 'C']
  const engines: Engine[] = ['pointer', 'action', 'kit']
  const names = $derived(view.route === 'cover' ? coverVariantNames : variantNames)
  const compact = $derived(overlayOpen())
  /** 有提示条时往上让：提示条和切换栏都贴在底部播放条上面，叠在一起就点不到提示条里的“撤销”“调整” */
  const lift = $derived(toasts.height ? toasts.height + 8 : 0)

  function go(delta: number) {
    const i = keys.indexOf(view.variant)
    const next = keys[(i + delta + keys.length) % keys.length]
    selection.exit()
    setParams({ variant: next })
  }

  function setEngine(e: Engine) {
    selection.exit()
    setParams({ engine: e === 'pointer' ? null : e })
  }

  function onkeydown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (e.defaultPrevented || compact || t?.closest('input, textarea, select, [contenteditable]'))
      return
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey)
      return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    }
  }
</script>

<svelte:window {onkeydown} />

{#if import.meta.env.DEV && !view.shot}
  {#if compact}
    <div class='proto-bar is-compact' role='toolbar' aria-label='原型切换'>
      <button type='button' class={['pb-btn', ui.panel && 'is-on']} aria-label='原型面板' aria-expanded={ui.panel} onclick={() => (ui.panel = !ui.panel)}>
        <SlidersHorizontal size={16} />
      </button>
    </div>
  {:else}
    <div
      class={['proto-bar', dragStats.active && 'is-away']}
      style:bottom={layout.phone ? `calc(env(safe-area-inset-bottom) + ${84 + lift}px)` : `${96 + lift}px`}
      role='toolbar'
      aria-label='原型切换'
    >
      <button type='button' class='pb-btn' aria-label='上一个方案' onclick={() => go(-1)}><ChevronLeft size={18} /></button>
      <span class='pb-label'>{view.variant} · {names[view.variant]}</span>
      <button type='button' class='pb-btn' aria-label='下一个方案' onclick={() => go(1)}><ChevronRight size={18} /></button>
      {#if view.route === 'dnd'}
        <span class='pb-sep' aria-hidden='true'></span>
        <div class='pb-seg' role='radiogroup' aria-label='实现'>
          {#each engines as e (e)}
            <button type='button' role='radio' aria-checked={view.engine === e} class={['pb-opt', view.engine === e && 'is-on']} onclick={() => setEngine(e)}>
              {e === 'pointer' ? engineNames[e] : e === 'action' ? 'action' : 'kit'}
            </button>
          {/each}
        </div>
      {/if}
      <span class='pb-sep' aria-hidden='true'></span>
      <button type='button' class={['pb-btn', ui.panel && 'is-on']} aria-label='原型面板' aria-expanded={ui.panel} onclick={() => (ui.panel = !ui.panel)}>
        <SlidersHorizontal size={16} />
      </button>
    </div>
  {/if}
{/if}

<style>
  .proto-bar {
    position: fixed;
    left: 50%;
    z-index: 9990;
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: calc(100vw - 16px);
    padding: 4px;
    transform: translateX(-50%);
    border-radius: 9999px;
    background: #0a0f1a;
    color: #fff;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
    user-select: none;
    transition: opacity 160ms ease-out, translate 160ms ease-out, bottom 200ms ease-out;
  }

  .proto-bar.is-away {
    opacity: 0;
    translate: 0 12px;
    pointer-events: none;
  }

  .proto-bar.is-compact {
    top: calc(env(safe-area-inset-top) + 8px);
    right: 8px;
    left: auto;
    transform: none;
  }

  .pb-label {
    padding: 0 6px;
    white-space: nowrap;
  }

  .pb-btn {
    display: grid;
    width: 32px;
    height: 32px;
    flex: none;
    place-items: center;
    border-radius: 9999px;
    color: #fff;
  }

  .pb-btn:hover,
  .pb-btn.is-on {
    background: rgb(255 255 255 / 0.16);
  }

  .pb-sep {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: rgb(255 255 255 / 0.2);
  }

  .pb-seg {
    display: flex;
    gap: 2px;
  }

  .pb-opt {
    height: 28px;
    padding: 0 8px;
    border-radius: 9999px;
    color: rgb(255 255 255 / 0.7);
    white-space: nowrap;
  }

  .pb-opt.is-on {
    background: #a8e6cf;
    color: #0a0f1a;
  }

  .pb-btn:focus-visible,
  .pb-opt:focus-visible {
    outline: 2px solid #a8e6cf;
    outline-offset: 1px;
  }
</style>
