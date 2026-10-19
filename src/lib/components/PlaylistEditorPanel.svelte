<!--
  歌单编辑里面的内容（外壳是 PlaylistEditor：桌面居中弹窗、手机底部弹层；原型 PlaylistEditor）。每次打开都重新建，表单按打开时的歌单填好。
  - 新建：名称（最多 40 个宽度，汉字算 2，写满会说明）、设为隐私歌单。按“创建”等网易云建好（按钮写“正在新建…”）才关上，
    没建成就留在这里说明原因，填好的不丢；从加入歌单里新建的，建好接着把那首歌加进去（App 的 createPlaylist）。
  - 编辑歌单信息：封面（右下角的相机键，点整张封面也能选图，打开换封面的裁剪页，#34）、名称、简介（最多 1,000 个字）、标签（TagPicker，打开时取网易云的标签库）。
    按“保存”交给 App（先改本地、立即生效，没成会自己改回并在提示条里说明）马上关上；名称不合规时不能保存。
  - 改为公开：说清楚公开后谁看得到、改了就改不回隐私，确认键是主按钮。
  - 删除：说清楚歌曲和红心不受影响、删了不能恢复，确认键是出错红（DESIGN.md Buttons · Destructive）。
    在这张歌单的页面上删的，先回到曲库再删（不留在已经删掉的歌单页上）。
  改公开、删除都改不回来：焦点先落在取消上，误按回车不会直接做。
  手机上表单是接近全屏的弹层，顶上一行是 取消 / 标题 / 创建（保存）；确认是贴着底边的弹层，按钮竖着排。桌面是标题、关闭键、内容、右下角的按钮。
  grip：手机上标题也能按住往下拖收起（外壳给的拖动来源）
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import type { ChangeFailure } from '#lib/app/library.js'
  import type { EditorRequest } from './playlist-edit.svelte'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Camera, Lock, X } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import { nameProblem, nameWidth, PLAYLIST_DESCRIPTION_LENGTH, PLAYLIST_NAME_WIDTH } from '#lib/api/library.js'
  import { getAppView } from './app-context.svelte'
  import { coverEditor } from './cover-edit.svelte'
  import Cover from './library/Cover.svelte'
  import { changeFailureText, editProblemText } from './library/notice'
  import TagPicker from './library/TagPicker.svelte'
  import { formatCount, langOf } from './library/view'
  import { unfold } from './motion'
  import { playlistEditor } from './playlist-edit.svelte'
  import Button from './ui/Button.svelte'
  import IconButton from './ui/IconButton.svelte'
  import Scrollbar from './ui/Scrollbar.svelte'
  import TextField from './ui/TextField.svelte'

  interface Props {
    request: EditorRequest
    /** 在手机的底部弹层里 */
    sheet: boolean
    /** 手机上标题按住往下拖收起 */
    grip?: Attachment<HTMLElement>
  }

  const { request, sheet, grip }: Props = $props()
  const view = getAppView()
  const library = $derived(view.state.library)
  /** 要编辑的这张自建歌单（新建时是 null） */
  const playlist = $derived(request.mode === 'new' ? null : library?.playlists?.find(item => item.id === request.playlistId) ?? null)

  const TITLES = { new: '新建歌单', info: '编辑歌单信息', public: '改为公开歌单', delete: '删除歌单' } as const
  const FORM_ID = 'playlist-editor-form'
  const form = $derived(request.mode === 'new' || request.mode === 'info')

  // 表单按打开时的歌单填好；之后同步改了这张歌单也不动听众正在填的
  const start = untrack(() => playlist)
  let name = $state(start?.name ?? '')
  let description = $state(start?.description ?? '')
  let tags = $state([...start?.tags ?? []])
  let isPrivate = $state(false)
  /** 上一次没建成的原因 */
  let failure = $state<ChangeFailure | null>(null)
  /** 换封面的入口：封面本身和下面的文字都是这一个按钮；隐藏的文件选择框由它打开 */
  let coverButton = $state<HTMLButtonElement>()
  let coverInput = $state<HTMLInputElement>()

  const problem = $derived(nameProblem(name.trim()))
  const nameError = $derived(problem === 'nameTooLong' ? editProblemText(problem) : undefined)
  /** 改过的简介超过了上限（网易云收更长的，原来就超长、没改的照样能保存别的） */
  const descriptionTooLong = $derived(description.trim() !== (start?.description?.trim() ?? '') && description.trim().length > PLAYLIST_DESCRIPTION_LENGTH)
  /** 不能按“创建 / 保存”：名称、简介不合规，或者正在等网易云建好 */
  const blocked = $derived(problem !== null || descriptionTooLong || playlistEditor.busy)
  const songCount = $derived(playlist ? library?.songsOf(playlist.id)?.total ?? playlist.trackCount : 0)

  // 编辑信息时取网易云的标签库（这次登录取到过就不再取）
  $effect(() => {
    if (request.mode === 'info')
      void view.app.openPlaylistTags()
  })

  // 编辑着的歌单不在曲库里了（在别处删掉、同步发现它没了）：关上
  $effect(() => {
    if (request.mode !== 'new' && library?.playlists && !playlist)
      untrack(() => playlistEditor.close())
  })

  /** 等网易云建好才关上；这时关不掉（playlistEditor.busy），没建成就在这里说明原因，填好的不丢 */
  async function create() {
    if (request.mode !== 'new' || blocked)
      return
    playlistEditor.busy = true
    failure = null
    const outcome = await view.app.createPlaylist({ name, private: isPrivate }, request.songs)
    playlistEditor.busy = false
    if (outcome && !outcome.ok)
      failure = outcome.failure
    else if (playlistEditor.request === request)
      playlistEditor.close()
  }

  function save() {
    if (!playlist || blocked)
      return
    void view.app.editPlaylist(playlist.id, { name, description, tags })
    playlistEditor.close()
  }

  /** 换封面：先选图，选到了才打开裁剪页（取消选择就什么都不做） */
  function chooseCover(): void {
    coverInput?.click()
  }

  function onCoverPicked(event: Event): void {
    const element = event.currentTarget as HTMLInputElement
    const file = element.files?.[0]
    element.value = ''
    if (!file || !playlist)
      return
    coverEditor.open({ playlistId: playlist.id, from: coverButton ?? null })
    void view.app.prepareCover(playlist.id, file)
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (request.mode === 'new')
      void create()
    else
      save()
  }

  function publish() {
    if (!playlist)
      return
    void view.app.publishPlaylist(playlist.id)
    playlistEditor.close()
  }

  /** 在这张歌单的页面上删：先回到曲库（换掉这一页的浏览记录），再删，不留在已经删掉的歌单页上 */
  async function remove() {
    if (!playlist)
      return
    const { id } = playlist
    if (page.url.pathname === resolve('/playlists/[id]', { id: String(id) }))
      await playlistEditor.leaveToLibrary()
    else
      playlistEditor.close()
    void view.app.deletePlaylist(id)
  }
</script>

{#snippet title(classes: string)}
  <h2 id='playlist-editor-title' class={classes} {@attach grip}>{TITLES[request.mode]}</h2>
{/snippet}

{#snippet nameField()}
  <TextField
    id='playlist-editor-name'
    label='歌单名称'
    bind:value={name}
    aside='{nameWidth(name.trim())}/{PLAYLIST_NAME_WIDTH}'
    error={nameError}
    placeholder='给歌单起个名字'
    autocomplete='off'
    enterkeyhint='done'
    lang={langOf(name)}
    data-autofocus
  />
{/snippet}

{#snippet formBody()}
  <form id={FORM_ID} class='flex flex-col gap-5' onsubmit={submit} novalidate>
    {#if request.mode === 'new'}
      {@render nameField()}
      <label class='flex cursor-pointer items-start gap-3'>
        <input type='checkbox' bind:checked={isPrivate} class='mt-0.5 size-5 flex-none accent-primary-800' />
        <span>
          <span class='flex items-center gap-1.5 text-label text-neutral-900 font-500'><Lock size={14} aria-hidden='true' />设为隐私歌单</span>
          <span class='mt-0.5 block text-caption text-neutral-600'>只有你自己能看到。以后可以改为公开，但公开后不能再改回隐私。</span>
        </span>
      </label>
      {#if request.songs.length === 1}
        <p class='text-caption text-neutral-600'>建好后会把<span lang={langOf(request.songs[0]!.name)}>《{request.songs[0]!.name}》</span>加进去。</p>
      {:else if request.songs.length > 1}
        <p class='text-caption text-neutral-600'>建好后会把选中的 {formatCount(request.songs.length)} 首歌加进去。</p>
      {/if}
      {#if failure}
        <div transition:unfold>
          <p class='rounded-lg bg-error-50 px-3.5 py-2.5 text-caption text-error-700' role='alert'>没能新建：{changeFailureText(failure)}</p>
        </div>
      {/if}
    {:else if playlist}
      <div class={sheet ? 'flex flex-col gap-5' : 'grid grid-cols-[152px_minmax(0,1fr)] gap-6'}>
        <div class='flex flex-col items-start'>
          <button
            type='button'
            bind:this={coverButton}
            class='group relative block rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-700 focus-visible:ring-offset-white'
            aria-label='更换封面'
            title='更换封面'
            onclick={chooseCover}
          >
            <Cover
              url={playlist.coverUrl}
              size={sheet ? 96 : 152}
              class={['rounded-xl shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95', sheet ? 'size-24' : 'size-38']}
            />
            <span
              class={[
                'absolute grid place-items-center rounded-full bg-white text-primary-900 shadow-chip ring-1 ring-neutral-900/10 transition-colors duration-feedback mouse:group-hover:bg-primary-50',
                sheet ? '-bottom-1 -right-1 size-7' : '-bottom-1.5 -right-1.5 size-8',
              ]}
              aria-hidden='true'
            >
              <Camera size={sheet ? 14 : 16} aria-hidden='true' />
            </span>
          </button>
          <input bind:this={coverInput} type='file' accept='image/*' class='sr-only' tabindex='-1' aria-hidden='true' onchange={onCoverPicked} />
        </div>
        <div class='min-w-0 flex flex-col gap-5'>
          {@render nameField()}
          <div class='flex flex-col'>
            <div class='flex items-baseline justify-between gap-3'>
              <label for='playlist-editor-description' class='text-caption text-neutral-700 font-500'>简介</label>
              <span class={['text-caption tabular-nums', descriptionTooLong ? 'text-error-700' : 'text-neutral-600']}>{formatCount(description.length)}/{formatCount(PLAYLIST_DESCRIPTION_LENGTH)}</span>
            </div>
            <textarea
              id='playlist-editor-description'
              bind:value={description}
              rows={sheet ? 3 : 2}
              maxlength={PLAYLIST_DESCRIPTION_LENGTH}
              placeholder='写几句介绍这张歌单（可以不写）'
              lang={langOf(description)}
              class='mt-1.5 w-full resize-none border border-neutral-200 rounded-lg bg-white px-3.5 py-2.5 text-body text-neutral-900 outline-none transition-[border-color,box-shadow] duration-feedback focus:(border-primary-800 shadow-field-focus) placeholder:text-neutral-500'
            ></textarea>
            {#if descriptionTooLong}
              <div transition:unfold>
                <p class='pt-1.5 text-caption text-error-700'>{editProblemText('descriptionTooLong')}</p>
              </div>
            {/if}
          </div>
          <TagPicker bind:tags library={library?.playlistTags ?? null} phone={sheet} onretry={() => void view.app.openPlaylistTags()} />
        </div>
      </div>
    {/if}
  </form>
{/snippet}

{#snippet confirmBody()}
  {#if playlist && request.mode === 'public'}
    <p class='text-body text-neutral-700'>公开后，你的网易云主页和搜索里都能看到<span class='text-neutral-900 font-500' lang={langOf(playlist.name)}>「{playlist.name}」</span>。</p>
    <p class='mt-3 rounded-lg bg-warning-50 px-3.5 py-2.5 text-caption text-warning-900'>网易云不支持把公开歌单改回隐私，这一步不能撤销。</p>
  {:else if playlist && request.mode === 'delete'}
    <p class='text-body text-neutral-700'>
      <span class='text-neutral-900 font-500' lang={langOf(playlist.name)}>「{playlist.name}」</span>里的 {formatCount(songCount)} 首歌会随歌单一起移除；歌曲本身和你的红心都不受影响。
    </p>
    <p class='mt-3 text-caption text-neutral-600'>删除后不能恢复。</p>
  {/if}
{/snippet}

{#snippet confirmButton()}
  {#if request.mode === 'public'}
    <Button variant='primary' onclick={publish}>改为公开</Button>
  {:else}
    <Button variant='destructive' onclick={() => void remove()}>删除歌单</Button>
  {/if}
{/snippet}

{#snippet cancelButton()}
  <Button variant='outline' disabled={playlistEditor.busy} onclick={() => playlistEditor.close()} data-autofocus={form ? undefined : true}>{request.mode === 'delete' ? '先不了' : '取消'}</Button>
{/snippet}

{#snippet submitLabel()}
  {request.mode === 'new' ? (playlistEditor.busy ? '正在新建…' : '创建') : '保存'}
{/snippet}

{#if sheet && form}
  <div class='min-h-0 flex flex-1 flex-col'>
    <div class='h-14 flex flex-none items-center gap-2 px-2'>
      <button type='button' class='h-11 rounded-full px-3 text-body text-neutral-700 active:bg-neutral-100 disabled:opacity-50' disabled={playlistEditor.busy} onclick={() => playlistEditor.close()}>取消</button>
      {@render title('min-w-0 flex-1 touch-none truncate text-center text-title-sm text-neutral-900 font-600')}
      <button type='submit' form={FORM_ID} class='h-11 rounded-full px-3 text-body text-primary-900 font-600 active:bg-primary-100 disabled:text-neutral-500' disabled={blocked}>
        {@render submitLabel()}
      </button>
    </div>
    <div class='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
      <Scrollbar />
      <div class='px-5 pb-6 pt-2'>{@render formBody()}</div>
    </div>
  </div>
{:else if sheet}
  <div class='px-6 pb-4 pt-2'>
    {@render title('touch-none text-title-sm text-neutral-900 font-600')}
    <div class='mt-2'>{@render confirmBody()}</div>
    <div class='grid mt-6 gap-2'>
      {@render confirmButton()}
      {@render cancelButton()}
    </div>
  </div>
{:else}
  <div class='flex flex-none items-center gap-3 pb-2 pl-6 pr-4 pt-5'>
    {@render title('min-w-0 flex-1 text-title-sm text-neutral-900 font-600')}
    <IconButton icon={X} label='关闭' disabled={playlistEditor.busy} onclick={() => playlistEditor.close()} />
  </div>
  <div class='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
    <Scrollbar />
    <div class='px-6 pb-2 pt-2'>{#if form}{@render formBody()}{:else}{@render confirmBody()}{/if}</div>
  </div>
  <div class='flex flex-none items-center justify-end gap-2 px-6 pb-5 pt-4'>
    {@render cancelButton()}
    {#if form}
      <Button variant='primary' type='submit' form={FORM_ID} disabled={blocked}>{@render submitLabel()}</Button>
    {:else}
      {@render confirmButton()}
    {/if}
  </div>
{/if}
