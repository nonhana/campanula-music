<script lang='ts'>
  import type { LogEntry, Topic } from './log'
  import { onMount } from 'svelte'
  import { clearLog, listLog } from './log'

  const { topic }: { topic: Topic } = $props()

  let entries = $state<LogEntry[]>([])

  async function refresh() {
    entries = (await listLog(topic)).reverse()
  }

  async function clear() {
    await clearLog(topic)
    await refresh()
  }

  function time(at: number): string {
    const date = new Date(at)
    return `${date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString('zh-CN', { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`
  }

  onMount(() => {
    refresh()
    window.addEventListener('probe-log', refresh)
    return () => window.removeEventListener('probe-log', refresh)
  })
</script>

<section class='log'>
  <header>
    <h2>记录（{entries.length} 条，存在本机，关掉 App 也在）</h2>
    <button type='button' onclick={refresh}>刷新</button>
    <button type='button' onclick={clear}>清空</button>
  </header>
  {#if entries.length === 0}
    <p class='muted'>还没有记录。</p>
  {:else}
    <ol>
      {#each entries as entry (entry.seq)}
        <li class={entry.source}>
          <div><time>{time(entry.at)}</time> · <strong>{entry.kind}</strong></div>
          <div class='muted'>{entry.source === 'sw' ? 'Service Worker' : '页面'} · {entry.where}</div>
          {#if entry.detail !== undefined}<code>{JSON.stringify(entry.detail)}</code>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .log header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .log h2 {
    flex: 1 1 100%;
    margin: 0;
    font-size: 15px;
  }
  ol {
    padding: 0;
    margin: 8px 0 0;
    list-style: none;
  }
  li {
    padding: 6px 8px;
    margin: 4px 0;
    font-size: 13px;
    border-left: 3px solid #b9ead5;
  }
  li.sw {
    border-left-color: #e6601f;
  }
  code {
    display: block;
    font-size: 12px;
    word-break: break-all;
    white-space: pre-wrap;
  }
  .muted {
    color: #4b5563;
  }
</style>
