<script lang='ts'>
  import { afterNavigate } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'

  afterNavigate(({ from, type }) => {
    logPage('select', '到了入口页', { from: from?.url.pathname ?? null, type, historyLength: history.length })
  })
</script>

<h1>返回手势先退出多选、再离开页面</h1>

<section>
  <p>做法：点下面的“打开歌单”，在歌单页按下面几种方式进入多选，然后用<strong>系统返回手势</strong>（从屏幕边缘往里划）：第一次应该只退出多选、还留在歌单页；第二次才回到这里。每种方式在浏览器标签页和装好的 App 里各试一次，录屏。</p>
  <ol>
    <li><strong>刚打开就长按</strong>：打开歌单后什么都不点，直接长按一行进入多选（页面还没被点过，Chrome 可能把这条历史当成“没有用户操作”而跳过）。</li>
    <li><strong>先点过再长按</strong>：先点一下页面上随便哪里，再长按一行。</li>
    <li><strong>点“多选”按钮</strong>。</li>
    <li>把“退出多选的方式”换成 <strong>CloseWatcher</strong>，再按 1–3 试一遍。</li>
  </ol>
</section>

<section>
  <a class='open' href={resolve('/probe/select/list')}>打开歌单</a>
</section>

<LogView topic='select' />

<style>
  .open {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    color: #fff;
    text-decoration: none;
    background: #206f52;
    border-radius: 999px;
  }
</style>
