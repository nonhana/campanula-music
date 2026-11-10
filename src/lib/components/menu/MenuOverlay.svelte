<script lang="ts" generics="R extends MenuRequest">
  import type { Attachment } from 'svelte/attachments';

  import type { MenuRequest } from '../overlay/overlay-requests';
  import type { OverlayLayer } from '../overlay/overlay-stack';
  import { createDrawer } from '../player/drawer.svelte';
  import { pop } from '../shared/motion';
  import Cover from '../ui/Cover.svelte';
  import Scrollbar from '../ui/Scrollbar.svelte';
  import type { MenuHeader, MenuItem } from './menu';
  import MenuList from './MenuList.svelte';

  interface Props {
    layer: OverlayLayer<R, HTMLElement>;
    label: (request: R) => string;
    width: string;
    items: (request: R) => readonly MenuItem[] | null;
    header?: (request: R, sheet: boolean) => MenuHeader | null;
    loadingLabel?: string;
  }

  const { layer, label, width, items, header, loadingLabel }: Props = $props();

  const MARGIN = 8;
  const FLOATING_PADDING = 12;
  const FLOATING_CAPTION = 32;
  const SEPARATOR = 9;
  const SHEET_BASE = 41;
  const SHEET_MEDIA_HEADER = 64;
  const SHEET_TEXT_HEADER = 52;
  const SHEET_TEXT_TITLE = 36;
  const FLOATING_ICON_ROW = 36;
  const FLOATING_MEDIA_ROW = 48;
  const SHEET_ICON_ROW = 52;
  const SHEET_MEDIA_ROW = 60;
  const LOADING_ROWS = 3;

  const request = $derived(layer.request);
  const floating = $derived(request?.anchor ? request : null);
  const sheetRequest = $derived(request && !request.anchor ? request : null);
  const sheetOpen = $derived(sheetRequest !== null);
  let sheetShown = $state<R | null>(null);
  let menu = $state<HTMLElement>();
  const drawer = createDrawer(() =>
    sheetShown ? estimate(sheetShown, true) : 0,
  );
  const gripSheet = drawer.grip({
    from: 'open',
    commit: () => layer.close(),
    tap: () => layer.close(),
  });

  $effect.pre(() => {
    if (sheetRequest) sheetShown = sheetRequest;
  });

  $effect(() => drawer.settle(sheetOpen));

  $effect(() => {
    if (!floating) return;
    const shown = floating;
    const dismiss = () => {
      if (layer.request === shown) void layer.close(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && !shown.from?.contains(target)) dismiss();
    };
    // 固定定位：只有锚点自己挪了才算被带走，旁边滚动区和菜单内滚动不算；没记到锚点就任何滚动都关
    const from = shown.from;
    const anchorAt = from?.getBoundingClientRect();
    const shifted = (now: DOMRect | undefined) =>
      !anchorAt ||
      !now ||
      Math.abs(now.left - anchorAt.left) > 0.5 ||
      Math.abs(now.top - anchorAt.top) > 0.5;
    const onScroll = (event: Event) => {
      if (
        !menu?.contains(event.target as Node) &&
        shifted(from?.getBoundingClientRect())
      )
        dismiss();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', dismiss);
    };
  });

  const mediaRow = (item: MenuItem) =>
    item.leading?.kind === 'cover' || item.leading?.kind === 'tile';

  // 还没画出来时按行和头部估高度（px）：决定往上还是往下飘、抽屉第一帧
  const estimate = (shown: R, sheet: boolean): number => {
    const list = items(shown);
    const rows = list
      ? list.reduce(
          (total, item) =>
            total +
            (sheet
              ? mediaRow(item)
                ? SHEET_MEDIA_ROW
                : SHEET_ICON_ROW
              : mediaRow(item)
                ? FLOATING_MEDIA_ROW
                : FLOATING_ICON_ROW) +
            (item.separated ? SEPARATOR : 0),
          0,
        )
      : LOADING_ROWS * (sheet ? SHEET_MEDIA_ROW : FLOATING_MEDIA_ROW);
    return sheet
      ? SHEET_BASE + headerHeight(header?.(shown, true), true) + rows
      : FLOATING_PADDING + headerHeight(header?.(shown, false), false) + rows;
  };

  const headerHeight = (
    head: MenuHeader | null | undefined,
    sheet: boolean,
  ): number => {
    if (!head) return 0;
    if (!sheet) return FLOATING_CAPTION;
    if (head.kind === 'media') return SHEET_MEDIA_HEADER;
    return head.subtitle ? SHEET_TEXT_HEADER : SHEET_TEXT_TITLE;
  };

  const choose = (item: MenuItem): void => {
    item.run();
    if (item.closeOnChoose !== false) void layer.close();
  };

  const fitsBelow = (shown: R): boolean =>
    shown.anchor!.y + estimate(shown, false) <= window.innerHeight - MARGIN;

  const place: Attachment<HTMLElement> = (node) => {
    const anchor = floating!.anchor!;
    const below = anchor.y + node.offsetHeight <= window.innerHeight - MARGIN;
    const left = Math.min(
      Math.max(MARGIN, anchor.end ? anchor.x - node.offsetWidth : anchor.x),
      window.innerWidth - node.offsetWidth - MARGIN,
    );
    node.style.left = `${left}px`;
    node.style.top = `${
      below ? anchor.y : Math.max(MARGIN, anchor.top - node.offsetHeight)
    }px`;
    node.style.transformOrigin = `${anchor.end ? 'right' : 'left'} ${below ? 'top' : 'bottom'}`;
  };

  const closeOnTab = (event: KeyboardEvent) => {
    event.preventDefault();
    void layer.close();
  };
</script>

{#if floating}
  {@const head = header?.(floating, false)}
  <div
    bind:this={menu}
    class={['fixed z-60 rounded-xl bg-white p-1.5 shadow-float', width]}
    inert={layer.inert || !request}
    {@attach place}
    transition:pop={{
      below: floating ? fitsBelow(floating) : true,
    }}
  >
    {#if head}
      <p
        class="px-2 pb-1.5 pt-1 text-caption text-neutral-600 font-500"
        aria-hidden="true"
      >
        {head.title}{#if head.kind === 'text' && head.note}<span
            class="tabular-nums"
          >
            · {head.note}</span
          >{/if}
      </p>
    {/if}
    <div
      class="max-h-[min(360px,calc(100dvh-96px))] overflow-y-auto overscroll-contain"
    >
      <Scrollbar />
      <MenuList
        items={items(floating)}
        layout="menu"
        focus="first"
        label={label(floating)}
        loading={loadingLabel}
        onChoose={choose}
        onTab={closeOnTab}
      />
    </div>
  </div>
{/if}

{#if sheetShown && (sheetOpen || drawer.visible)}
  {@const shown = sheetShown}
  {@const head = header?.(shown, true)}
  <button
    type="button"
    class="fixed inset-0 z-60 bg-neutral-900/30"
    style:opacity={1 - drawer.position}
    aria-label="关闭菜单"
    tabindex="-1"
    onclick={() => layer.close()}
  ></button>
  <div
    class="fixed inset-x-0 z-61 rounded-t-sheet bg-white px-2 pt-1 shadow-float"
    {@attach drawer.panel}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label={label(shown)}
    inert={!sheetOpen || layer.inert}
  >
    <div class="touch-none" {@attach gripSheet}>
      <div class="grid h-6 place-items-center" aria-hidden="true">
        <span class="h-1 w-9 rounded-full bg-neutral-300"></span>
      </div>
      {#if head?.kind === 'media'}
        <div class="flex items-center gap-3 px-4 pb-3 pt-1">
          <Cover url={head.coverUrl} size={48} class="rounded-md" />
          <div class="min-w-0">
            <p
              class="truncate text-body text-neutral-900 font-500"
              lang={head.titleLang}
            >
              {head.title}
            </p>
            {#if head.subtitle}<p
                class="truncate text-caption text-neutral-600"
                lang={head.subtitleLang}
              >
                {head.subtitle}
              </p>{/if}
          </div>
        </div>
      {:else if head?.kind === 'text'}
        <div class="px-4 pb-3 pt-1">
          <p class="text-title-sm text-neutral-900 font-600">
            {head.title}{#if head.note}<span
                class="ml-1.5 text-body text-neutral-600 font-400 tabular-nums"
                >· {head.note}</span
              >{/if}
          </p>
          {#if head.subtitle}<p
              class="truncate text-caption text-neutral-600"
              lang={head.subtitleLang}
            >
              {head.subtitle}
            </p>{/if}
        </div>
      {/if}
    </div>
    <div class="mx-4 mb-1 h-px bg-neutral-100" aria-hidden="true"></div>
    <div class="pb-3">
      <div class="max-h-[60dvh] overflow-y-auto overscroll-contain">
        <Scrollbar />
        <MenuList
          items={items(shown)}
          layout="sheet"
          focus="first"
          label={label(shown)}
          loading={loadingLabel}
          onChoose={choose}
          onTab={closeOnTab}
        />
      </div>
    </div>
  </div>
{/if}
