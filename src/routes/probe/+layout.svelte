<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import '$lib/probe/install.svelte'

  const { children }: { children: Snippet } = $props()

  let phase = $state<'loading' | 'locked' | 'ready'>('loading')
  let passcode = $state('')
  let passError = $state('')

  const links = [
    { route: '/probe', label: '安装' },
    { route: '/probe/play', label: '后台播放' },
    { route: '/probe/download', label: '后台下载' },
    { route: '/probe/photo', label: '照片' },
    { route: '/probe/select', label: '返回手势' },
  ] as const

  async function check() {
    try {
      const response = await fetch('/api/session')
      phase = response.status === 401 ? 'locked' : 'ready'
    }
    catch {
      // 断网时也让探针页能打开（只是取不到播放和下载地址）
      phase = 'ready'
    }
  }

  async function submitPass(event: SubmitEvent) {
    event.preventDefault()
    passError = ''
    const response = await fetch('/api/pass', { method: 'POST', body: JSON.stringify({ passcode }) })
    passcode = ''
    if (!response.ok) {
      passError = '口令不对'
      return
    }
    await check()
  }

  onMount(() => {
    check()
    // Service Worker 记了一笔（后台下载的进展），叫页面上的记录列表刷新
    const relay = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'probe-log')
        window.dispatchEvent(new CustomEvent('probe-log'))
    }
    navigator.serviceWorker?.addEventListener('message', relay)
    return () => navigator.serviceWorker?.removeEventListener('message', relay)
  })
</script>

<div class='probe'>
  <nav>
    {#each links as link (link.route)}
      <a href={resolve(link.route)} aria-current={page.url.pathname === link.route ? 'page' : undefined}>{link.label}</a>
    {/each}
  </nav>

  {#if phase === 'loading'}
    <p>加载中…</p>
  {:else if phase === 'locked'}
    <form onsubmit={submitPass}>
      <label>访问口令 <input type='password' bind:value={passcode} autocomplete='current-password' /></label>
      <button type='submit'>进入</button>
      {#if passError}<p class='error'>{passError}</p>{/if}
    </form>
  {:else}
    {@render children()}
  {/if}
</div>

<style>
  .probe {
    max-width: 720px;
    min-height: 100dvh;
    padding: 0 16px calc(24px + env(safe-area-inset-bottom));
    margin: 0 auto;
    font: 15px/1.6 system-ui, sans-serif;
    color: #111827;
    background: #f5fcf9;
  }
  :global(body) {
    margin: 0;
    background: #f5fcf9;
  }
  nav {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    gap: 4px;
    padding: calc(8px + env(safe-area-inset-top)) 0 8px;
    overflow-x: auto;
    background: #f5fcf9;
    border-bottom: 1px solid #b9ead5;
  }
  nav a {
    flex: none;
    padding: 8px 12px;
    color: #1a5b43;
    text-decoration: none;
    border-radius: 999px;
  }
  nav a[aria-current='page'] {
    color: #fff;
    background: #206f52;
  }
  .probe :global(button),
  .probe :global(select),
  .probe :global(input) {
    min-height: 44px;
    font: inherit;
  }
  .probe :global(button) {
    padding: 0 14px;
    color: #1a5b43;
    background: #d1f1e3;
    border: 1px solid #b9ead5;
    border-radius: 999px;
  }
  .probe :global(button:disabled) {
    color: #6b7280;
    background: #e5e7eb;
  }
  .probe :global(:focus-visible) {
    outline: 2px solid #206f52;
    outline-offset: 2px;
  }
  .probe :global(section) {
    padding: 12px 0;
    border-bottom: 1px solid #d1f1e3;
  }
  .probe :global(h1) {
    margin: 16px 0 4px;
    font-size: 20px;
  }
  .probe :global(.error) {
    color: #b00020;
  }
</style>
