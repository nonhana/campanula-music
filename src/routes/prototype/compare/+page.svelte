<!-- PROTOTYPE：截图对照页。把三个变体在手机和桌面宽度下的截图并排放，方便站长一次看完；每张图都能点开实时页面。 -->
<script lang='ts'>
  const variants = [
    {
      key: 'A',
      name: '分区首页',
      thesis: '桌面一打开是整个曲库的分区总览（我喜欢的音乐、歌单、专辑、歌手），是现在首页的进化；手机保留 Auxio 式顶部标签。',
      move: '晨光行：正在播放的那一行被淡薄荷色慢慢铺满，像晨光爬过桌面。',
      parts: '薄荷晨光底色 + 白色面板 · 实心/浅色胶囊按钮 · 平直细进度线 · 手机右下角“随机播放”悬浮按钮',
    },
    {
      key: 'B',
      name: '歌词舞台',
      thesis: '正在听的歌是重心，歌词是舞台：曲库是左侧一列安静的分类；播放页被封面自己的颜色照亮，整屏是逐字歌词。',
      move: '逐字晨光：唱到的字从浅灰变深，播放页、手机迷你播放条、桌面底栏里都能看到。',
      parts: '白色框架 + 封面染色的播放页 · 描边胶囊按钮 · 波浪进度条 · 无悬浮按钮',
    },
    {
      key: 'C',
      name: '搜索脊梁',
      thesis: '“点一首或者搜一首”：搜索框是每个界面的脊梁，曲库在本机，所以边打字边出结果；进了歌单就只在这张歌单里搜。',
      move: '即时点亮：打字的同时，结果里匹配的字被薄荷色点亮，命中数实时变化。',
      parts: '薄荷色顶栏带 + 白色内容区 · 8px 圆角按钮 · 可排序的密集表格 · 无悬浮按钮',
    },
  ]

  const screens = [
    { key: 'library', label: '曲库首屏', query: '' },
    { key: 'playlist', label: '歌单页 · 4815 首', query: '&screen=playlist' },
    { key: 'player', label: '播放页 · 歌词', query: '&screen=player' },
    { key: 'queue', label: '播放页 · 播放队列', query: '&screen=player&panel=queue' },
  ]

  const extras: Record<string, { key: string, label: string, query: string }[]> = {
    C: [
      { key: 'search', label: '即时搜索 · “ミク”', query: '&q=ミク' },
      { key: 'scoped', label: '歌单内搜索 · “春”', query: '&screen=playlist&q=春' },
    ],
  }

  function live(v: string, query: string) {
    return `/prototype?variant=${v}${query}&t=51.3`
  }
</script>

<main class='page'>
  <header class='head'>
    <h1>Campanula 视觉原型 · 第一轮</h1>
    <p>三个变体用同一套设计系统（颜色、字体、圆角、阴影），区别在界面的组织方式。每张图左边是桌面 1440 宽，右边是手机 390 宽；点图片打开实时页面，可以直接点着玩。</p>
    <p class='links'>
      <a href='/prototype?variant=A'>实时原型</a>
      <a href='/prototype/fonts'>字体检查</a>
    </p>
  </header>

  {#each variants as v (v.key)}
    <section class='variant' id={v.key}>
      <div class='intro'>
        <h2><span class='key'>{v.key}</span>{v.name}</h2>
        <p>{v.thesis}</p>
        <p><strong>标志性细节</strong>{v.move}</p>
        <p class='parts'>{v.parts}</p>
      </div>

      {#each [...screens, ...(extras[v.key] ?? [])] as s (s.key)}
        <figure>
          <figcaption>{s.label}</figcaption>
          <div class='pair'>
            <a class='desk' href={live(v.key, s.query)} target='_blank' rel='noopener'>
              <img src='/prototype/shots/{v.key}/desktop-{s.key}.png' alt='变体 {v.key} 桌面 · {s.label}' loading='lazy' />
            </a>
            <a class='phone' href={live(v.key, s.query)} target='_blank' rel='noopener'>
              <img src='/prototype/shots/{v.key}/mobile-{s.key}.png' alt='变体 {v.key} 手机 · {s.label}' loading='lazy' />
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
    max-width: 70ch;
    color: #4b5563;
    line-height: 1.7;
  }

  .links {
    display: flex;
    gap: 16px;
  }

  .links a {
    color: #206f52;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .variant {
    margin-top: 72px;
  }

  .intro {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 16px 0 12px;
    background: #f5fcf9;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 600;
  }

  .key {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: 10px;
    background: #1a5b43;
    color: #fff;
    font-size: 18px;
  }

  .intro p {
    margin-top: 6px;
    max-width: 90ch;
    color: #374151;
    line-height: 1.7;
  }

  .intro strong {
    margin-right: 8px;
    font-weight: 600;
    color: #111827;
  }

  .parts {
    font-size: 14px;
    color: #4b5563 !important;
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
