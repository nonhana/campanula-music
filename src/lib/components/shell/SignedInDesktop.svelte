<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { RouteId } from '$app/types';
  import type { LucideIcon } from '@lucide/svelte';
  import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    CircleArrowDown,
    House,
    Menu,
    Settings,
  } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  import type { Account } from '#lib/api/account.ts';

  import Brand from '../boot/Brand.svelte';
  import DesktopSearchBox from '../search/DesktopSearchBox.svelte';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import IconButton from '../ui/IconButton.svelte';
  import AccountMenu from './AccountMenu.svelte';
  import DesktopShell from './DesktopShell.svelte';
  import { backPage, forwardPage, pageHistory } from './page-history.ts';

  const { account, children }: { account: Account; children: Snippet } =
    $props();
  const view = getAppView();
  const route = $derived(page.route.id);
  const inLibrary = $derived(
    route === '/' ||
      route === '/playlists' ||
      route === '/albums' ||
      route === '/artists' ||
      route === '/playlists/[id=neteaseId]' ||
      route === '/albums/[id=neteaseId]' ||
      route === '/artists/[id=neteaseId]',
  );

  let railExpanded = $state(false);
  const keys = /Mac|iPhone|iPad/.test(navigator.platform)
    ? {
        back: '⌘ [',
        forward: '⌘ ]',
        backAria: 'Meta+[',
        forwardAria: 'Meta+]',
      }
    : {
        back: 'Alt ←',
        forward: 'Alt →',
        backAria: 'Alt+ArrowLeft',
        forwardAria: 'Alt+ArrowRight',
      };

  const railItem = (id: RouteId, label: string, current = route === id) => ({
    class: [
      'h-12 w-full flex items-center gap-3 rounded-lg px-3 text-left transition-colors duration-feedback',
      current
        ? 'bg-primary-200 text-primary-950'
        : 'text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)',
    ],
    'aria-current': current ? ('page' as const) : undefined,
    'aria-label': railExpanded ? undefined : label,
    title: railExpanded ? undefined : label,
  });
</script>

{#snippet railContent(label: string, Icon: LucideIcon)}
  <Icon size={22} class="flex-none" aria-hidden="true" />
  <span
    class={[
      'whitespace-nowrap text-label font-500 transition-opacity',
      railExpanded
        ? 'duration-rail-label delay-[var(--delay-rail-label)]'
        : 'opacity-0 duration-state-out ease-in-soft',
    ]}>{label}</span
  >
{/snippet}

<DesktopShell {railExpanded} offline={!view.state.online}>
  {#snippet header()}
    <div
      class="grid grid-cols-[1fr_minmax(0,560px)_1fr] flex-1 items-center gap-3"
    >
      <div class="flex items-center gap-3">
        <IconButton
          icon={Menu}
          label={railExpanded ? '收起导航' : '展开导航'}
          aria-expanded={railExpanded}
          onclick={() => (railExpanded = !railExpanded)}
        />
        <a
          href={resolve('/')}
          class="rounded-lg"
          aria-label="Campanula · 回到曲库"><Brand /></a
        >
        <div class="flex">
          <IconButton
            icon={ChevronLeft}
            label="返回"
            title="返回（{keys.back}）"
            aria-keyshortcuts={keys.backAria}
            disabled={route === '/' && !pageHistory.canBack}
            onclick={backPage}
          />
          <IconButton
            icon={ChevronRight}
            label="前进"
            title="前进（{keys.forward}）"
            aria-keyshortcuts={keys.forwardAria}
            disabled={!pageHistory.canForward}
            onclick={forwardPage}
          />
        </div>
      </div>
      <DesktopSearchBox />
      <div class="mr-2 justify-self-end">
        <AccountMenu {account} />
      </div>
    </div>
  {/snippet}
  {#snippet rail()}
    <a href={resolve('/')} {...railItem('/', '曲库', inLibrary)}
      >{@render railContent('曲库', House)}</a
    >
    <a href={resolve('/daily')} {...railItem('/daily', '每日推荐')}
      >{@render railContent('每日推荐', CalendarDays)}</a
    >
    <a href={resolve('/downloads')} {...railItem('/downloads', '已下载')}
      >{@render railContent('已下载', CircleArrowDown)}</a
    >
  {/snippet}
  {#snippet railEnd()}
    <a href={resolve('/settings')} {...railItem('/settings', '设置')}
      >{@render railContent('设置', Settings)}</a
    >
  {/snippet}
  {@render children()}
</DesktopShell>
