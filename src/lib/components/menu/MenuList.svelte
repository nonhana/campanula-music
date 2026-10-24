<!--
  菜单壳里画行和管键盘的那一块：浮动菜单、底部弹层、头像菜单共用（#73）。
  收的是条目数据（menu.ts），自己按菜单形态画行、管 ↑/↓、Home/End 和打开时的焦点；
  Tab 和 Esc 的处理留给外壳（浮层栈或头像菜单自己），因为它们要关的东西不一样。
  条目还没拿到（歌单列表还在同步）时画几行骨架，读屏读 loading 给的名字。
-->
<script lang='ts'>
  import { Heart } from '@lucide/svelte'
  import type { Attachment } from 'svelte/attachments'

  import Cover from '../ui/Cover.svelte'
  import type { MenuItem, MenuTone } from './menu'

  type Layout = 'menu' | 'sheet' | 'popover'

  interface Props {
    /** null：还没拿到（画骨架） */
    items: readonly MenuItem[] | null
    layout: Layout
    /** 骨架的读屏名字；只有 items 为 null 时用 */
    loading?: string
    /** 打开时焦点落在第一项还是最后一项；不给就不抢焦点 */
    focus?: 'first' | 'last' | null
    id?: string
    label?: string
    inert?: boolean
    onChoose?: (item: MenuItem) => void
    onTab?: (event: KeyboardEvent) => void
    onEscape?: () => void
  }

  const {
    items,
    layout,
    loading,
    focus = null,
    id,
    label,
    inert = false,
    onChoose = item => item.run(),
    onTab,
    onEscape,
  }: Props = $props()

  /** 还没拿到条目时画几行骨架 */
  const SKELETON_ROWS = 3

  let node = $state<HTMLElement>()

  const enabled = (): HTMLElement[] => [
    ...(node?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
  ]

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      onTab?.(event)
      return
    }
    if (event.key === 'Escape') {
      if (onEscape) {
        event.preventDefault()
        onEscape()
      }
      return
    }
    const list = enabled()
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown'
        ? 1
        : -1
      list[(at + step + list.length) % list.length]?.focus()
    }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home'
        ? list[0]
        : list.at(-1))?.focus()
    }
  }

  /** 打开时焦点落在第一项（或最后一项，头像菜单用 ↑ 打开时）；一项都不能选就落在菜单上，Esc 照样能关 */
  const focusInitial: Attachment<HTMLElement> = (element) => {
    if (!focus)
      return
    queueMicrotask(() => {
      const list = enabled()
      ;((focus === 'last'
        ? list.at(-1)
        : list[0]) ?? element).focus({ preventScroll: true })
    })
  }

  const media = (item: MenuItem) => item.leading?.kind === 'cover' || item.leading?.kind === 'tile'

  const rowClass = (item: MenuItem): string[] => {
    // 焦点环：只让头像菜单（popover）走全局的 2px 茎绿环；浮动菜单、底部弹层是整行按钮，按基线和 DESIGN 的行例外
    // 用 outline-none + 薄荷底，不画环。
    const base = [
      'w-full flex items-center text-left',
      layout === 'popover'
        ? ''
        : 'outline-none',
      'focus-visible:bg-primary-100',
    ].join(' ')
    const tone = item.tone === 'destructive'
      ? 'text-error-700'
      : ''
    if (layout === 'sheet') {
      return [
        base,
        'disabled:opacity-45 enabled:active:bg-primary-100',
        media(item)
          ? 'h-15 rounded-xl gap-3 px-4 text-body'
          : 'h-13 rounded-lg gap-4 px-4 text-body',
        tone,
      ]
    }
    if (layout === 'popover') {
      return [base, 'h-10 gap-3 rounded-lg px-2 text-label text-neutral-800 mouse:hover:bg-primary-100', tone]
    }
    return [
      base,
      'transition-colors duration-feedback disabled:(cursor-not-allowed opacity-45) mouse:enabled:hover:bg-primary-50',
      media(item)
        ? 'h-12 rounded-lg gap-3 px-2 text-label'
        : 'h-9 rounded-lg gap-3 px-3 text-label',
      tone || 'text-neutral-900',
    ]
  }

  const iconClass = (tone: MenuTone | undefined): string => {
    switch (tone) {
      case 'hearted': return 'text-accent-600'
      case 'download': return 'text-secondary-800'
      case 'destructive': return 'text-error-700'
      default: return 'text-neutral-600'
    }
  }

  const iconSize = () => (layout === 'sheet'
    ? 20
    : 18)
  const coverSize = () => (layout === 'sheet'
    ? 44
    : 36)
</script>

<div
  bind:this={node}
  {id}
  role='menu'
  tabindex='-1'
  aria-label={label}
  {inert}
  class={layout === 'popover'
    ? ''
    : 'outline-none'}
  {onkeydown}
  {@attach focusInitial}
>
  {#if items === null}
    <div role='status' aria-busy='true' aria-label={loading}>
      {#each { length: SKELETON_ROWS }, i (i)}
        <div class={[
          'flex items-center gap-3',
          layout === 'sheet'
            ? 'h-15 px-4'
            : 'h-12 px-2',
        ]}>
          <span class={[
            'bone flex-none rounded-md',
            layout === 'sheet'
              ? 'size-11'
              : 'size-9',
          ]}></span>
          <span class='flex flex-1 flex-col gap-2'>
            <span class='bone h-3.5 rounded-full' style:width='{[64, 48, 56][i]}%'></span>
            <span class='bone h-3 w-1/4 rounded-full'></span>
          </span>
        </div>
      {/each}
    </div>
  {:else}
    {#each items as item (item.key)}
      {#if item.separated}
        <div class={[
          'my-1 h-px bg-neutral-100',
          layout === 'sheet'
            ? 'mx-4'
            : 'mx-3',
        ]} role='separator'></div>
      {/if}
      <button
        type='button'
        role='menuitem'
        tabindex='-1'
        class={rowClass(item)}
        disabled={item.disabled}
        onclick={() => onChoose(item)}
      >
        {#if item.leading}
          {@const leading = item.leading}
          {#if leading.kind === 'tile'}
            {@const Tile = leading.icon}
            <span class={[
              'grid flex-none place-items-center rounded-md bg-primary-100 text-primary-950',
              layout === 'sheet'
                ? 'size-11'
                : 'size-9',
            ]} aria-hidden='true'>
              <Tile size={18} />
            </span>
          {:else if leading.kind === 'cover'}
            <span class='relative flex flex-none'>
              <Cover url={leading.url} size={coverSize()} class='rounded-md' />
              {#if leading.heart}
                <span class='absolute grid size-5 place-items-center rounded-full bg-white shadow-chip -bottom-1 -right-1' aria-hidden='true'>
                  <Heart size={11} class='text-accent-600' fill='currentColor' />
                </span>
              {/if}
            </span>
          {:else}
            {@const Icon = leading.icon}
            <Icon
              size={iconSize()}
              class={[
                'flex-none',
                iconClass(item.tone),
              ]}
              fill={item.tone === 'hearted'
                ? 'currentColor'
                : 'none'}
              aria-hidden='true'
            />
          {/if}
        {/if}
        {#if item.detail}
          <span class='min-w-0 flex-1'>
            <span class='block truncate text-neutral-900 font-500' lang={item.lang}>{item.label}</span>
            <span class='block truncate text-caption text-neutral-600 tabular-nums'>{item.detail}</span>
          </span>
        {:else}
          <span class={[
            'min-w-0 truncate',
            item.leading?.kind === 'tile'
              ? 'text-neutral-900 font-500'
              : '',
          ]} lang={item.lang}>{item.label}</span>
        {/if}
      </button>
    {/each}
  {/if}
</div>
