<script lang='ts'>
  import { errorText, logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'
  import { onDestroy } from 'svelte'

  interface Inspected {
    picker: string
    name: string
    type: string
    size: number
    lastModified: string
    format: string
    head: string
    bitmap: string
    preview?: string
  }

  const pickers = [
    { label: 'accept="image/*"', accept: 'image/*', note: '原型和 #34 打算用的写法' },
    { label: 'accept="image/jpeg,image/png,image/webp"', accept: 'image/jpeg,image/png,image/webp', note: '只要浏览器能解的格式' },
    { label: '不限类型', accept: '', note: '一般会打开文件管理器' },
  ]

  let results = $state<Inspected[]>([])
  let busy = $state(false)

  /** 按文件头认格式，不信文件名和 type。 */
  function sniff(bytes: Uint8Array): string {
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)
      return 'JPEG'
    if (ascii(1, 4) === 'PNG')
      return 'PNG'
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
      return 'WebP'
    if (ascii(0, 3) === 'GIF')
      return 'GIF'
    if (ascii(4, 8) === 'ftyp')
      return `ISO BMFF（ftyp ${ascii(8, 12)}${/hei[cx]|hev[cx]|mif1|msf1/.test(ascii(8, 12)) ? '，HEIC/HEIF' : ascii(8, 12) === 'avif' ? '，AVIF' : ''}）`
    return '认不出'
  }

  async function inspect(file: File, picker: string): Promise<Inspected> {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    let bitmap: string
    let preview: string | undefined
    try {
      const decoded = await createImageBitmap(file)
      bitmap = `能解：${decoded.width}×${decoded.height}`
      decoded.close()
      preview = URL.createObjectURL(file)
    }
    catch (error) {
      bitmap = `解不开：${errorText(error)}`
    }
    return {
      picker,
      name: file.name,
      type: file.type || '（空）',
      size: file.size,
      lastModified: new Date(file.lastModified).toLocaleString('zh-CN', { hour12: false }),
      format: sniff(head),
      head: [...head].map(byte => byte.toString(16).padStart(2, '0')).join(' '),
      bitmap,
      preview,
    }
  }

  async function onChange(event: Event, picker: string) {
    const input = event.currentTarget as HTMLInputElement
    const files = [...input.files ?? []]
    input.value = ''
    if (files.length === 0) {
      await logPage('photo', '没选文件', { picker })
      return
    }
    busy = true
    try {
      for (const file of files) {
        const item = await inspect(file, picker)
        results = [item, ...results]
        const { preview: _preview, ...detail } = item
        await logPage('photo', '选了文件', detail)
      }
    }
    finally {
      busy = false
    }
  }

  onDestroy(() => {
    for (const item of results) {
      if (item.preview)
        URL.revokeObjectURL(item.preview)
    }
  })
</script>

<h1>照片选择器交给网页的是什么</h1>

<section>
  <p>做法：先在相册里准备一张 HEIC 照片（相机设置里打开“高效格式 / HEIF”拍一张，或者用电脑推过来的测试图），再用下面三个按钮各选一次这张照片，最好也选一张普通 JPEG 对照。每次选择器打开时截个图。</p>
  <p class='muted'>“格式”按文件头判断；“解码”是 Chrome 能不能把它画出来（#34 裁剪要用）。</p>
</section>

<section>
  {#each pickers as picker (picker.label)}
    <label class='picker'>
      <span><strong>{picker.label}</strong><br /><span class='muted'>{picker.note}</span></span>
      <input type='file' accept={picker.accept || undefined} disabled={busy} onchange={event => onChange(event, picker.label)} />
    </label>
  {/each}
</section>

<section>
  <h2>选到的文件</h2>
  {#if results.length === 0}
    <p class='muted'>还没有。</p>
  {/if}
  {#each results as item, index (index)}
    <div class='file'>
      {#if item.preview}<img src={item.preview} alt='' width='96' height='96' />{/if}
      <dl>
        <dt>选择方式</dt><dd>{item.picker}</dd>
        <dt>文件名</dt><dd>{item.name}</dd>
        <dt>type</dt><dd>{item.type}</dd>
        <dt>大小</dt><dd>{(item.size / 1024).toFixed(0)} KB（{item.size} 字节）</dd>
        <dt>格式</dt><dd><strong>{item.format}</strong></dd>
        <dt>文件头</dt><dd><code>{item.head}</code></dd>
        <dt>解码</dt><dd>{item.bitmap}</dd>
        <dt>修改时间</dt><dd>{item.lastModified}</dd>
      </dl>
    </div>
  {/each}
</section>

<LogView topic='photo' />

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 12px 0;
  }
  .file {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid #d1f1e3;
  }
  .file img {
    object-fit: cover;
    border-radius: 8px;
  }
  dl {
    display: grid;
    grid-column: 2;
    grid-template-columns: max-content 1fr;
    gap: 2px 10px;
    margin: 0;
    font-size: 13px;
  }
  dt {
    color: #4b5563;
  }
  dd {
    margin: 0;
    word-break: break-all;
  }
  code {
    font-size: 12px;
  }
  .muted {
    color: #4b5563;
  }
</style>
