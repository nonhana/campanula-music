<!-- PROTOTYPE：选定方案（A）的截图归档，按简报的 11 类界面分组。每张图都能点开实时页面。 -->
<script lang='ts'>
  import { shotGroups } from '$lib/prototype/finalShots'

  function live(query: string) {
    return `/prototype?variant=A${query}&t=51.3`
  }
</script>

<main class='page'>
  <header class='head'>
    <h1>Campanula 视觉原型 · 选定方案</h1>
    <p>第一轮选了 A（分区首页），并从 B 拿来波浪进度条、胶囊按钮和封面染底。下面按简报的 11 类界面归档，每组左边是桌面 1440 宽，右边是手机 390 宽；点图片打开实时页面。</p>
    <p class='note'>封面图是从旧站和 Auxio 的截图里裁出来的，有些原图只有 60–150 像素，放大显示时会发虚；正式实现用网易云原图，不会这样。</p>
    <nav class='toc' aria-label='目录'>
      {#each shotGroups as g (g.id)}
        <a href='#{g.id}'>{g.title}</a>
      {/each}
      <a href='/prototype/compare'>第一轮三个变体</a>
      <a href='/prototype/fonts'>字体检查</a>
    </nav>
  </header>

  {#each shotGroups as g (g.id)}
    <section class='group' id={g.id}>
      <div class='intro'>
        <h2>{g.title}</h2>
        {#if g.note}<p>{g.note}</p>{/if}
      </div>
      {#each g.shots as s (s.key)}
        <figure>
          <figcaption>{s.label}</figcaption>
          <div class='pair'>
            <a class='desk' href={live(s.query)} target='_blank' rel='noopener'>
              <img src='/prototype/shots/final/{s.key}-desktop.png' alt='桌面 · {s.label}' loading='lazy' />
            </a>
            <a class='phone' href={live(s.query)} target='_blank' rel='noopener'>
              <img src='/prototype/shots/final/{s.key}-mobile.png' alt='手机 · {s.label}' loading='lazy' />
            </a>
          </div>
        </figure>
      {/each}
    </section>
  {/each}
</main>

<style>
  .page {
    max-width: 1680px;
    margin: 0 auto;
    padding: 40px 32px 120px;
    background: #f5fcf9;
    min-height: 100dvh;
  }

  .head h1 {
    font-size: 30px;
    font-weight: 600;
  }

  .head p {
    margin-top: 10px;
    max-width: 72ch;
    color: #4b5563;
    line-height: 1.7;
  }

  .head .note {
    font-size: 14px;
    color: #6b7280;
  }

  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 16px;
    font-size: 14px;
  }

  .toc a {
    color: #206f52;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .group {
    margin-top: 64px;
  }

  .intro {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 14px 0 10px;
    background: #f5fcf9;
  }

  h2 {
    font-size: 24px;
    font-weight: 600;
  }

  .intro p {
    margin-top: 6px;
    max-width: 90ch;
    color: #374151;
    line-height: 1.7;
  }

  figure {
    margin-top: 28px;
  }

  figcaption {
    margin-bottom: 10px;
    font-size: 15px;
    font-weight: 500;
  }

  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
    gap: 20px;
    align-items: start;
  }

  .pair a {
    display: block;
    overflow: hidden;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .pair img {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
