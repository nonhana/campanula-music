<!--
  设计系统页（只在开发时打开）：颜色、阴影、圆角、字号阶梯、基础组件的各种状态，
  以及按当前宽度套上的那一种骨架（窄于 768px 是手机骨架，768px 及以上是桌面骨架）。
-->
<script lang='ts'>
  import { ArrowUpDown, CircleArrowDown, CirclePlus, Ellipsis, ListMusic, ListPlus, ListX, Menu, Play, SkipForward, Trash2 } from '@lucide/svelte'
  import Brand from '#lib/components/boot/Brand.svelte'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import DesktopShell from '#lib/components/shell/DesktopShell.svelte'
  import PhoneShell from '#lib/components/shell/PhoneShell.svelte'
  import Button from '#lib/components/ui/Button.svelte'
  import FilterChip from '#lib/components/ui/FilterChip.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import SearchField from '#lib/components/ui/SearchField.svelte'
  import Segmented from '#lib/components/ui/Segmented.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'
  import Tag from '#lib/components/ui/Tag.svelte'
  import TextButton from '#lib/components/ui/TextButton.svelte'
  import TextField from '#lib/components/ui/TextField.svelte'
  import ToolButton from '#lib/components/ui/ToolButton.svelte'
  import { DESIGN_PAGE_MARKER } from '#lib/dev/design-marker.js'
  import { colors } from '../../../uno.palette'

  /** 色板只在 uno.palette.ts 写一份（uno.config.ts 的 theme 也用它）：这里按工具类名读十六进制值（纸白 paper 是 white） */
  const palette = colors as Record<string, string | Record<string, string>>
  function colorHex(utility: string): string {
    const direct = palette[utility]
    if (typeof direct === 'string')
      return direct
    const at = utility.lastIndexOf('-')
    const scale = palette[utility.slice(0, at)]
    return typeof scale === 'string'
      ? scale
      : scale[utility.slice(at + 1)]
  }

  // 颜色名照 DESIGN.md，类名照 uno.config.ts 的色阶
  const colorGroups = [
    {
      title: '薄荷：选中、进度、正在播放、焦点',
      colors: [
        {
          name: '晨光底',
          token: 'morning-ground',
          swatch: 'bg-primary-50',
          utility: 'primary-50',
        },
        {
          name: '薄荷雾',
          token: 'mint-mist',
          swatch: 'bg-primary-100',
          utility: 'primary-100',
        },
        {
          name: '薄荷玻璃',
          token: 'mint-glass',
          swatch: 'bg-primary-200',
          utility: 'primary-200',
        },
        {
          name: '薄荷线',
          token: 'mint-line',
          swatch: 'bg-primary-300',
          utility: 'primary-300',
        },
        {
          name: '薄荷',
          token: 'mint',
          swatch: 'bg-primary-400',
          utility: 'primary-400',
        },
        {
          name: '新芽绿',
          token: 'mint-sprout',
          swatch: 'bg-primary-600',
          utility: 'primary-600',
        },
        {
          name: '叶绿',
          token: 'mint-leaf',
          swatch: 'bg-primary-700',
          utility: 'primary-700',
        },
        {
          name: '茎绿',
          token: 'mint-stem',
          swatch: 'bg-primary-800',
          utility: 'primary-800',
        },
        {
          name: '深薄荷',
          token: 'deep-mint',
          swatch: 'bg-primary-900',
          utility: 'primary-900',
        },
        {
          name: '森林墨',
          token: 'forest-ink',
          swatch: 'bg-primary-950',
          utility: 'primary-950',
        },
      ],
    },
    {
      title: '蜜桃：这台设备、下载；珊瑚：红心',
      colors: [
        {
          name: '蜜桃雾',
          token: 'peach-mist',
          swatch: 'bg-secondary-50',
          utility: 'secondary-50',
        },
        {
          name: '蜜桃浅',
          token: 'peach-wash',
          swatch: 'bg-secondary-100',
          utility: 'secondary-100',
        },
        {
          name: '蜜桃光',
          token: 'peach-glow',
          swatch: 'bg-secondary-200',
          utility: 'secondary-200',
        },
        {
          name: '蜜桃枝',
          token: 'peach-ember',
          swatch: 'bg-secondary-800',
          utility: 'secondary-800',
        },
        {
          name: '蜜桃木',
          token: 'peach-bark',
          swatch: 'bg-secondary-900',
          utility: 'secondary-900',
        },
        {
          name: '珊瑚心',
          token: 'coral-heart',
          swatch: 'bg-accent-600',
          utility: 'accent-600',
        },
      ],
    },
    {
      title: '中性色和状态',
      colors: [
        {
          name: '纸白',
          token: 'paper',
          swatch: 'bg-white',
          utility: 'white',
        },
        {
          name: '墨',
          token: 'ink',
          swatch: 'bg-neutral-900',
          utility: 'neutral-900',
        },
        {
          name: '石墨深',
          token: 'graphite-deep',
          swatch: 'bg-neutral-800',
          utility: 'neutral-800',
        },
        {
          name: '石墨重',
          token: 'graphite-strong',
          swatch: 'bg-neutral-700',
          utility: 'neutral-700',
        },
        {
          name: '石墨',
          token: 'graphite',
          swatch: 'bg-neutral-600',
          utility: 'neutral-600',
        },
        {
          name: '石墨淡',
          token: 'graphite-soft',
          swatch: 'bg-neutral-500',
          utility: 'neutral-500',
        },
        {
          name: '发丝线',
          token: 'hairline',
          swatch: 'bg-neutral-200',
          utility: 'neutral-200',
        },
        {
          name: '淡发丝',
          token: 'hairline-faint',
          swatch: 'bg-neutral-100',
          utility: 'neutral-100',
        },
        {
          name: '试听底',
          token: 'trial-wash',
          swatch: 'bg-warning-50',
          utility: 'warning-50',
        },
        {
          name: '试听字',
          token: 'trial-ink',
          swatch: 'bg-warning-900',
          utility: 'warning-900',
        },
        {
          name: '出错底',
          token: 'error-wash',
          swatch: 'bg-error-50',
          utility: 'error-50',
        },
        {
          name: '出错红',
          token: 'error-ink',
          swatch: 'bg-error-700',
          utility: 'error-700',
        },
      ],
    },
  ]

  const typeScale = [
    {
      name: 'headline',
      size: '28 / 36',
      weight: 600,
      use: '桌面的页面标题（歌单、专辑、歌手、已下载、搜索结果）',
      cls: 'text-headline font-600',
      sample: '我喜欢的音乐',
      lang: undefined,
    },
    {
      name: 'headline-sm',
      size: '24 / 32',
      weight: 600,
      use: '手机的页面标题、桌面播放页的歌名',
      cls: 'text-headline-sm font-600',
      sample: '歌に形はないけれど',
      lang: 'ja',
    },
    {
      name: 'title',
      size: '20 / 28',
      weight: 600,
      use: '首页的区块标题；手机播放页的歌名',
      cls: 'text-title font-600',
      sample: '歌单',
      lang: undefined,
    },
    {
      name: 'title-sm',
      size: '17 / 24',
      weight: '500 / 600',
      use: '弹窗标题、手机区块标题、播放队列标题、空状态标题、logo 字样',
      cls: 'text-title-sm font-600',
      sample: '清空全部下载？',
      lang: undefined,
    },
    {
      name: 'body',
      size: '15 / 22',
      weight: '400 / 500',
      use: '手机上的歌名、正文、说明；输入框',
      cls: 'text-body font-500',
      sample: '二人の絆 (U.N.オーエンは彼女なのか?)',
      lang: 'ja',
    },
    {
      name: 'label',
      size: '14 / 20',
      weight: '400 / 500',
      use: '桌面的歌名、按钮、导航、chip',
      cls: 'text-label font-500',
      sample: '說好不哭 (with 五月天阿信)',
      lang: 'zh-TW',
    },
    {
      name: 'caption',
      size: '13 / 20',
      weight: '400 / 500',
      use: '歌手、首数、时长、元信息、表头、提示',
      cls: 'text-caption font-400',
      sample: 'シャイニーカラーズ · 4,815 首 · 4:26',
      lang: 'ja',
    },
    {
      name: 'micro',
      size: '11 / 18',
      weight: 500,
      use: '试听、无版权、未下载这类徽标',
      cls: 'text-micro font-500',
      sample: '试听 无版权 未下载',
      lang: undefined,
    },
  ] as const

  const radii = [
    { name: 'sm 6px', use: '徽标', cls: 'rounded-sm' },
    { name: 'md 8px', use: '行内小封面', cls: 'rounded-md' },
    { name: 'lg 12px', use: '歌曲行、网格封面、表单输入框', cls: 'rounded-lg' },
    { name: 'xl 16px', use: '白色面板、迷你播放条、弹窗', cls: 'rounded-xl' },
    { name: 'sheet 24px', use: '底部弹层顶边', cls: 'rounded-t-sheet' },
    { name: 'full', use: '按钮、搜索框、chip', cls: 'rounded-full' },
  ]

  const filters = [
    { key: 'standard', label: '标准' },
    { key: 'higher', label: '较高' },
    { key: 'exhigh', label: '极高' },
  ] as const
  type FilterKey = typeof filters[number]['key']
  let filter = $state<FilterKey>('standard')
  let query = $state('ロウワー')
  let playlistName = $state('Campanula 测试 · 可删除')
  let phoneNumber = $state('1380013')
  let railExpanded = $state(false)
</script>

<svelte:head>
  <title>设计系统 · Campanula</title>
</svelte:head>

{#snippet region(label: string, cls = '')}
  <span class={['grid place-items-center border border-primary-300 rounded-lg border-dashed text-caption text-neutral-600', cls]}>{label}</span>
{/snippet}

{#snippet section(title: string, note: string)}
  <h2 class='text-title text-neutral-900 font-600'>{title}</h2>
  <p class='mt-1 text-caption text-neutral-600'>{note}</p>
{/snippet}

{#snippet content()}
  <div data-design-page={DESIGN_PAGE_MARKER} class='flex flex-col gap-10 px-4 pt-4 md:px-0'>
    <section>
      <h1 class='text-headline text-neutral-900 font-600'>设计系统</h1>
      <p class='mt-2 max-w-[60ch] text-body text-neutral-600'>
        DESIGN.md 落在 uno.config.ts 里的样子。这一页只在开发时能打开。现在是{desktopLayout.current ? '桌面' : '手机'}骨架，把窗口拉到 768px {desktopLayout.current ? '以下' : '以上'}看另一种。
      </p>
    </section>

    <section>
      {@render section('颜色', '粉彩色上只放深色字；白字只放在深薄荷、森林墨、出错红上。')}
      {#each colorGroups as group (group.title)}
        <h3 class='mt-5 text-label text-neutral-700 font-500'>{group.title}</h3>
        <ul class='grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] mt-2 gap-3'>
          {#each group.colors as color (color.token)}
            <li class='overflow-hidden rounded-lg bg-white shadow-ambient'>
              <span class={['block h-14 border-b border-neutral-100', color.swatch]}></span>
              <span class='block px-3 py-2'>
                <span class='block text-label text-neutral-900 font-500'>{color.name}</span>
                <span class='block text-caption text-neutral-600'>{color.token}</span>
                <span class='block text-caption text-neutral-500 tabular-nums'>{color.utility} · {colorHex(color.utility)}</span>
              </span>
            </li>
          {/each}
        </ul>
      {/each}
    </section>

    <section>
      {@render section('阴影和圆角', '静止的面板只用环境光；浮起只给浮在内容上、可以关掉的层。')}
      <div class='grid grid-cols-2 mt-4 max-w-[560px] gap-4'>
        <div class='h-24 flex flex-col justify-end rounded-xl bg-white p-4 shadow-ambient'>
          <span class='text-label text-neutral-900 font-500'>环境光 shadow-ambient</span>
          <span class='text-caption text-neutral-600'>面板、网格封面、搜索框</span>
        </div>
        <div class='h-24 flex flex-col justify-end rounded-xl bg-white p-4 shadow-float'>
          <span class='text-label text-neutral-900 font-500'>浮起 shadow-float</span>
          <span class='text-caption text-neutral-600'>菜单、弹层、弹窗、播放条</span>
        </div>
      </div>
      <ul class='grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] mt-4 gap-3'>
        {#each radii as radius (radius.name)}
          <li class='flex flex-col gap-2'>
            <span class={['h-14 bg-primary-200', radius.cls]}></span>
            <span class='text-label text-neutral-900 font-500'>{radius.name}</span>
            <span class='text-caption text-neutral-600'>{radius.use}</span>
          </li>
        {/each}
      </ul>
    </section>

    <section>
      {@render section('字号阶梯', '只用 400 / 500 / 600 三个字体文件里真实存在的字重。歌名按文字标 lang：含假名的标 ja，繁体标 zh-TW。')}
      <ul class='mt-4 flex flex-col rounded-xl bg-white px-4 shadow-ambient'>
        {#each typeScale as step (step.name)}
          <li class='grid grid-cols-1 gap-1 border-b border-neutral-100 py-4 md:grid-cols-[160px_minmax(0,1fr)] md:gap-6 last:border-b-0'>
            <span class='flex flex-col'>
              <span class='text-label text-neutral-900 font-500'>{step.name}</span>
              <span class='text-caption text-neutral-600 tabular-nums'>{step.size} px · {step.weight}</span>
            </span>
            <span class='min-w-0 flex flex-col gap-1'>
              <span class={['min-w-0 text-neutral-900', step.cls]} lang={step.lang}>{step.sample}</span>
              <span class='text-caption text-neutral-600'>{step.use}</span>
            </span>
          </li>
        {/each}
      </ul>
      <div class='mt-4 flex flex-col gap-1 rounded-xl bg-white p-4 text-title-sm shadow-ambient'>
        <span class='font-400' lang='ja'>400 · 黄昏ホログラム · 我喜欢的音乐</span>
        <span class='font-500' lang='ja'>500 · 黄昏ホログラム · 我喜欢的音乐</span>
        <span class='font-600' lang='ja'>600 · 黄昏ホログラム · 我喜欢的音乐</span>
      </div>
    </section>

    <section>
      {@render section('按钮', '胶囊看得见的都是 40px 高，点击范围 44px；按下时缩到 98%；按 Tab 看焦点环。')}
      <div class='mt-4 flex flex-wrap items-center gap-3'>
        <Button variant='primary' icon={Play}>播放全部</Button>
        <Button variant='download' icon={CircleArrowDown}>下载</Button>
        <Button variant='outline'>收藏</Button>
        <Button variant='destructive' icon={Trash2}>删除</Button>
        <IconButton icon={Ellipsis} label='更多操作' />
        <IconButton icon={SkipForward} label='下一首' />
      </div>
      <div class='mt-3 flex flex-wrap items-center gap-3'>
        <Button variant='primary' icon={Play} disabled>播放全部</Button>
        <Button variant='download' icon={CircleArrowDown} disabled>下载</Button>
        <Button variant='outline' disabled>收藏</Button>
        <Button variant='destructive' disabled>删除</Button>
        <IconButton icon={Ellipsis} label='更多操作' disabled />
      </div>
      <p class='mt-2 text-caption text-neutral-600'>第二行是禁用：实心按钮变成发丝线灰底、石墨淡字，其他按钮降到 50%。</p>
      <div class='mt-4 flex flex-wrap items-center gap-2'>
        <Button variant='primary' icon={Play}>播放全部</Button>
        <ToolButton icon={ListPlus} label='添加歌曲' />
        <ToolButton icon={CirclePlus} label='收藏' />
        <ToolButton icon={ArrowUpDown} label='排序' />
        <TextButton strong desktop={{ variant: 'primary' }}>完成</TextButton>
        <TextButton tone='neutral' desktop={{ variant: 'outline', icon: ListX }}>清空</TextButton>
      </div>
      <p class='mt-2 text-caption text-neutral-600'>四档（窄于 768px 时看手机的样子）：主操作是实心胶囊；和标题、数量排在一行的次级操作只留图标（ToolButton）；图标说不清、点错有代价的是文字按钮（TextButton），桌面上它们都是胶囊；选项用下面的 chip 和分段条。</p>
    </section>

    <section>
      {@render section('标签、筛选和分段条', '歌单标签只是显示；筛选 chip 选中时是薄荷玻璃底；分段条换选中时滑块横着滑过去。')}
      <div class='mt-4 flex flex-wrap items-center gap-2'>
        <Tag>日语</Tag>
        <Tag>电子</Tag>
        <Tag>ACG</Tag>
      </div>
      <div class='mt-3 flex flex-wrap items-center gap-2' role='group' aria-label='筛选示例'>
        {#each filters as option (option.key)}
          <FilterChip selected={filter === option.key} onclick={() => (filter = option.key)}>{option.label}</FilterChip>
        {/each}
      </div>
      <Segmented options={filters} value={filter} onchange={(key: FilterKey) => (filter = key)} role='radio' id='design-segmented' label='分段条示例' class='mt-3 h-10 max-w-[400px]' />
    </section>

    <section class='max-w-[560px]'>
      {@render section('输入框', '搜索框是胶囊形；表单输入框 12px 圆角。获得焦点时边框变茎绿，外面一圈薄荷雾光环。')}
      <SearchField bind:value={query} label='搜索歌曲、歌单、歌手、专辑' class='mt-4' lang='ja' />
      <TextField id='design-name' bind:value={playlistName} label='歌单名称' class='mt-4' />
      <TextField id='design-phone' bind:value={phoneNumber} label='手机号' inputmode='numeric' error='手机号是 11 位数字，以 1 开头' class='mt-4' />
      <TextField id='design-disabled' value='离线时不能改' label='简介' disabled class='mt-4' />
    </section>

    <section>
      {@render section('空和出错', '图标、一句话说清发生了什么，最多一个主要动作。标题说清了就不写正文；出错时正文只写原因，下一步交给按钮。')}
      <div class='grid grid-cols-1 mt-4 gap-4 lg:grid-cols-2'>
        <div class='rounded-xl bg-white shadow-ambient'>
          <StateBlock kind='empty' icon={ListMusic} title='这张歌单还没有歌' />
        </div>
        <div class='rounded-xl bg-white shadow-ambient'>
          <StateBlock kind='error' title='这张歌单没能加载' body='网络已断开' action={{
            label: '重试',
            run: () => {},
          }} />
        </div>
      </div>
      <div class='mt-4 flex flex-wrap gap-3'>
        <Button variant='primary' busy>加入歌单</Button>
        <Button variant='outline' busy>显示更多</Button>
      </div>
    </section>
  </div>
{/snippet}

{#if desktopLayout.current}
  <DesktopShell {railExpanded}>
    {#snippet header()}
      <IconButton icon={Menu} label={railExpanded ? '收起导航' : '展开导航'} aria-expanded={railExpanded} onclick={() => (railExpanded = !railExpanded)} />
      <Brand />
      {@render region('顶栏 64px：返回、正中的搜索框、头像', 'ml-4 h-11 flex-1')}
    {/snippet}
    {#snippet rail()}
      {@render region(railExpanded ? '侧栏 220px' : '侧栏 72px', 'flex-1 [writing-mode:vertical-rl]')}
    {/snippet}
    {#snippet preview()}
      {@render region('底部通栏 80px', 'h-full')}
    {/snippet}
    {@render content()}
  </DesktopShell>
{:else}
  <PhoneShell>
    {#snippet header()}
      <Brand />
      {@render region('搜索、每日推荐', 'ml-auto h-10 px-3')}
    {/snippet}
    {#snippet tabs()}
      {@render region('文字标签：我喜欢 / 歌单 / 专辑 / 歌手', 'mx-4 mb-2 h-11')}
    {/snippet}
    {#snippet preview()}
      {@render region('迷你播放条 64px', 'h-full')}
    {/snippet}
    {@render content()}
  </PhoneShell>
{/if}
