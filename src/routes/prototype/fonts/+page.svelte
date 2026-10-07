<!--
  PROTOTYPE：字体检查页。回答简报里的两个问题：
  ① 只加载 300/400 却用粗体 → 伪粗体；② 假名、英文、繁中混排时，字体回退造成的不均匀间距。
  三栏对比：旧方案（Google Fonts，300/400，SC→TC→JP 回退）/ 新方案不标 lang / 新方案按文字标 lang。
-->
<script lang='ts'>
  import { langOf } from '$lib/prototype/data'

  const samples = [
    { text: 'シャイニーカラーズ', note: 'Auxio 截图里出现空隙的歌手名' },
    { text: '歌に形はないけれど', note: 'Auxio 截图里出现空隙的歌名' },
    { text: '二人の絆 (U.N.オーエンは彼女なのか?)', note: '假名 + 英文 + 半角括号' },
    { text: 'コピー·ミー（复制我）', note: '假名 + 简体 + 全角括号' },
    { text: 'とびだせ！わんだぴょい (feat. 天馬司&鳳えむ&草薙寧々&神代類&鏡音リン)', note: '超长标题' },
    { text: '风居住的街道（Piano ver）(翻自 磯村由紀子)', note: '简体 + 英文 + 日文人名' },
    { text: '正 在 退 出 人 類 遊 戲 ▁ ▂ ▃', note: '繁体 + 方块字符' },
    { text: '說好不哭 (with 五月天阿信)', note: '繁体 + 英文' },
    { text: '直角に骨を描く海の次', note: '中日字形差异：直 角 骨 海 次' },
  ]

  const weightSample = '黄昏ホログラム · 我喜欢的音乐'

  const columns = [
    { key: 'old', title: '旧方案', desc: 'Google Fonts，只有 300/400，按 Noto Sans → SC → TC → JP 回退' },
    { key: 'plain', title: '新方案 · 不标 lang', desc: '自托管 Noto 可变字体（100–900），整页 zh-CN' },
    { key: 'lang', title: '新方案 · 按文字标 lang', desc: '含假名的文字标 ja，繁体标 zh-TW，其余跟随 zh-CN' },
  ] as const

  type ColumnKey = typeof columns[number]['key']

  function langFor(col: ColumnKey, text: string) {
    return col === 'lang' ? langOf(text) : undefined
  }

  /** 逐字测量假名的字宽，字宽不一致就是不均匀空隙的来源 */
  function kanaWidths(node: HTMLElement) {
    const textNode = node.firstChild
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE)
      return
    const text = textNode.textContent ?? ''
    const range = document.createRange()
    const widths: number[] = []
    let offset = 0
    for (const ch of text) {
      const len = ch.length
      if (/[\u3040-\u30FF]/.test(ch)) {
        range.setStart(textNode, offset)
        range.setEnd(textNode, offset + len)
        widths.push(range.getBoundingClientRect().width)
      }
      offset += len
    }
    const out = node.parentElement?.querySelector('[data-kana]')
    if (!out)
      return
    if (widths.length === 0) {
      out.textContent = '无假名'
      return
    }
    const min = Math.min(...widths)
    const max = Math.max(...widths)
    // 字偶距（kerning）会带来 1px 以内的差异，属正常；超过 0.1em 才算肉眼可见的空隙
    const em = Number.parseFloat(getComputedStyle(node).fontSize)
    const even = max - min < em * 0.1
    out.textContent = `假名字宽 ${min.toFixed(1)}–${max.toFixed(1)}px${even ? ' · 一致' : ' · 不均匀'}`
    out.setAttribute('data-even', String(even))
  }

  function measure(node: HTMLElement) {
    const run = () => kanaWidths(node)
    document.fonts.ready.then(run)
    const id = setTimeout(run, 1500)
    return () => clearTimeout(id)
  }
</script>

<svelte:head>
  <link
    rel='stylesheet'
    href='https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400&family=Noto+Sans+SC:wght@300;400&family=Noto+Sans+TC:wght@300;400&family=Noto+Sans+JP:wght@300;400&display=swap'
  />
</svelte:head>

<main class='page'>
  <header>
    <h1>字体检查</h1>
    <p>用真实曲名对比三种字体方案。每格下方是逐字测得的假名宽度：相差不到 0.1em（字偶距的正常范围）就算一致，说明没有因字体回退造成的不均匀空隙。</p>
  </header>

  <section class='grid'>
    {#each columns as col (col.key)}
      <div class={['col', col.key]}>
        <h2>{col.title}</h2>
        <p class='desc'>{col.desc}</p>

        {#each samples as s (s.text)}
          <div class='sample'>
            <p class='text' lang={langFor(col.key, s.text)} {@attach measure}>{s.text}</p>
            <p class='meta'><span>{s.note}</span><span data-kana></span></p>
          </div>
        {/each}

        <div class='weights'>
          {#each [400, 500, 600] as w (w)}
            <p lang={langFor(col.key, weightSample)} style:font-weight={w}>
              <span class='w'>{w}</span>{weightSample}
            </p>
          {/each}
          <p class='meta'>
            {col.key === 'old' ? '500/600 没有加载，浏览器用伪粗体模拟' : '500/600 是真实字重'}
          </p>
        </div>
      </div>
    {/each}
  </section>
</main>

<style>
  .page {
    max-width: 1320px;
    margin: 0 auto;
    padding: 40px 24px 96px;
    background: #f5fcf9;
    min-height: 100dvh;
  }

  header h1 {
    font-size: 28px;
    font-weight: 600;
  }

  header p {
    margin-top: 8px;
    max-width: 62ch;
    color: #4b5563;
    line-height: 1.7;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 32px;
  }

  @media (max-width: 767px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .col {
    padding: 20px;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .col.old {
    font-family: 'Noto Sans', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', sans-serif;
    font-synthesis: weight style;
  }

  .col.old h2,
  .col.old .desc,
  .col.old .meta {
    font-family: var(--font-sans);
    font-synthesis: none;
  }

  h2 {
    font-size: 17px;
    font-weight: 600;
  }

  .desc {
    margin-top: 4px;
    font-size: 13px;
    color: #4b5563;
  }

  .sample {
    padding: 14px 0;
    border-bottom: 1px solid #eef2f0;
  }

  .text {
    font-size: 17px;
    line-height: 1.5;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
  }

  .meta :global([data-even='true']) {
    color: #206f52;
  }

  .meta :global([data-even='false']) {
    color: #d32f2f;
  }

  .weights {
    padding-top: 14px;
  }

  .weights p:not(.meta) {
    font-size: 17px;
    line-height: 1.8;
  }

  .w {
    display: inline-block;
    width: 3em;
    color: #6b7280;
    font-size: 12px;
    font-family: var(--font-sans);
    font-weight: 400;
  }
</style>
