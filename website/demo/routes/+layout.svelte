<script lang="ts">
  import '@fontsource-variable/noto-sans';
  import '@fontsource-variable/noto-sans-sc';
  import '@fontsource-variable/noto-sans-jp';
  import '@fontsource-variable/noto-sans-tc';

  import { onMount } from 'svelte';

  import { createApp } from '#lib/app/app.ts';
  import { createLocalDatabase } from '#lib/app/local.ts';
  import {
    setAppView,
    viewOf,
  } from '#lib/components/shared/app-context.svelte.ts';

  import { demoBrowser } from '../browser.ts';
  import DemoFrame from '../DemoFrame.svelte';
  import { prepareSample } from '../sample.ts';

  import '@unocss/reset/tailwind.css';
  import 'uno.css';

  const { children } = $props();
  const namespace = `campanula-website-demo-v1:${parent === window ? 'standalone' : 'embedded'}`;
  const db = createLocalDatabase(indexedDB, namespace);
  const app = createApp(demoBrowser(namespace), db);
  const view = viewOf(app);
  setAppView({
    app,
    get state() {
      return view.state;
    },
    demo: true,
  });
  onMount(() => {
    document.getElementById('demo-fallback')!.hidden = true;
  });
  let failed = $state(false);
  void prepareSample(db)
    .then(() => app.open())
    .catch(() => {
      failed = true;
    });
</script>

{#if failed}
  <main class="grid place-content-center gap-4 p-6 text-body min-h-dvh">
    <h1 class="text-title-sm">示例播放器没能打开</h1>
    <p>可以先看实际界面的截图，或照指南部署自己的播放器。</p>
    <img
      src="/media/player-desktop.webp"
      alt="Campanula 播放页"
      class="max-w-full"
    />
    <!-- eslint-disable svelte/no-navigation-without-resolve -- 这是静态官网的阅读入口，不属于 demo 路由 -->
    <a href="/guide/" target="_top">部署 Campanula</a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </main>
{:else if view.state.session.status === 'signedIn'}
  <DemoFrame>{@render children()}</DemoFrame>
{:else}
  <p class="p-6 text-body" role="status">正在打开本地示例…</p>
{/if}
