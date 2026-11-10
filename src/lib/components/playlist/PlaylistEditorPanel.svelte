<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Camera, Lock } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';

  import {
    nameProblem,
    nameWidth,
    PLAYLIST_DESCRIPTION_LENGTH,
    PLAYLIST_NAME_WIDTH,
    playlistName,
    songTitle,
  } from '#lib/api/library.js';
  import type { ChangeFailure } from '#lib/app/library.js';

  import TagPicker from '../library/TagPicker.svelte';
  import { changeFailureText, editProblemText } from '../notice/text';
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte';
  import DialogBody from '../overlay/DialogBody.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { EditorRequest } from '../overlay/overlay-requests';
  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout } from '../shared/layout';
  import { unfold } from '../shared/motion';
  import { formatCount, formatSongCount, langOf } from '../shared/text';
  import Button from '../ui/Button.svelte';
  import Cover from '../ui/Cover.svelte';
  import TextButton from '../ui/TextButton.svelte';
  import TextField from '../ui/TextField.svelte';

  const { coverEditor, playlistEditor } = getOverlays();

  interface Props {
    request: EditorRequest;
    sheet: boolean;
    heading: Snippet<[classes: string]>;
  }

  const { request, sheet, heading }: Props = $props();
  const view = getAppView();
  const library = $derived(view.state.library);
  const playlist = $derived(
    request.mode === 'new'
      ? null
      : (library?.playlists?.find((item) => item.id === request.playlistId) ??
          null),
  );

  const FORM_ID = 'playlist-editor-form';
  const form = $derived(request.mode === 'new' || request.mode === 'info');

  const start = untrack(() => playlist);
  let name = $state(start?.name ?? '');
  let description = $state(start?.description ?? '');
  let tags = $state([...(start?.tags ?? [])]);
  let isPrivate = $state(false);
  let failure = $state<ChangeFailure | null>(null);
  let coverButton = $state<HTMLButtonElement>();
  let coverInput = $state<HTMLInputElement>();

  const problem = $derived(nameProblem(name.trim()));
  const nameError = $derived(
    problem === 'nameTooLong' ? editProblemText(problem) : undefined,
  );
  const descriptionTooLong = $derived(
    description.trim() !== (start?.description?.trim() ?? '') &&
      description.trim().length > PLAYLIST_DESCRIPTION_LENGTH,
  );
  const blocked = $derived(problem !== null || descriptionTooLong);
  const songCount = $derived(
    library && playlist ? library.songCountOf(playlist.id) : 0,
  );

  $effect(() => {
    if (request.mode === 'info') void view.app.openPlaylistTags();
  });

  $effect(() => {
    if (request.mode !== 'new' && library?.playlists && !playlist)
      untrack(() => playlistEditor.invalidate());
  });

  const create = async () => {
    if (request.mode !== 'new' || blocked || playlistEditor.busy) return;
    playlistEditor.setBusy(true);
    failure = null;
    const outcome = await view.app.createPlaylist(
      { name, private: isPrivate },
      request.songs,
    );
    playlistEditor.setBusy(false);
    if (outcome && !outcome.ok) failure = outcome.failure;
    else if (playlistEditor.request === request) playlistEditor.close();
  };

  const save = () => {
    if (!playlist || blocked) return;
    void view.app.editPlaylist(playlist.id, { name, description, tags });
    playlistEditor.close();
  };

  const chooseCover = (): void => {
    coverInput?.click();
  };

  const onCoverPicked = (event: Event): void => {
    const element = event.currentTarget as HTMLInputElement;
    const file = element.files?.[0];
    element.value = '';
    if (!file || !playlist) return;
    coverEditor.open({ playlistId: playlist.id, from: coverButton ?? null });
    void view.app.prepareCover(playlist.id, file);
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (request.mode === 'new') void create();
    else save();
  };

  const publish = () => {
    if (!playlist) return;
    void view.app.publishPlaylist(playlist.id);
    playlistEditor.close();
  };

  const remove = async () => {
    if (!playlist) return;
    const { id } = playlist;
    const result =
      page.url.pathname === resolve('/playlists/[id=neteaseId]', { id })
        ? await playlistEditor.leaveTo(
            desktopLayout.current ? resolve('/') : resolve('/playlists'),
          )
        : await playlistEditor.close();
    if (result === 'committed') void view.app.deletePlaylist(id);
  };
</script>

{#snippet nameField()}
  <TextField
    id="playlist-editor-name"
    label="歌单名称"
    bind:value={name}
    aside="{nameWidth(name.trim())}/{PLAYLIST_NAME_WIDTH}"
    error={nameError}
    autocomplete="off"
    enterkeyhint="done"
    lang={langOf(name)}
    data-autofocus
  />
{/snippet}

{#snippet formBody()}
  <form id={FORM_ID} class="flex flex-col gap-5" onsubmit={submit} novalidate>
    {#if request.mode === 'new'}
      {@render nameField()}
      <label class="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          bind:checked={isPrivate}
          class="mt-0.5 size-5 flex-none accent-primary-800"
        />
        <span>
          <span
            class="flex items-center gap-1.5 text-label text-neutral-900 font-500"
            ><Lock size={14} aria-hidden="true" />设为隐私歌单</span
          >
          <span class="mt-0.5 block text-caption text-neutral-600"
            >只有你能看到；公开后不能改回隐私</span
          >
        </span>
      </label>
      {#if request.songs.length === 1}
        <p class="text-caption text-neutral-600">
          建好后加入<span lang={langOf(request.songs[0]!.name)}
            >《{songTitle(request.songs[0]!)}》</span
          >
        </p>
      {:else if request.songs.length > 1}
        <p class="text-caption text-neutral-600">
          建好后加入这 {formatCount(request.songs.length)} 首
        </p>
      {/if}
      {#if failure}
        <div transition:unfold>
          <p
            class="rounded-lg bg-error-50 px-3.5 py-2.5 text-caption text-error-700"
            role="alert"
          >
            没能新建：{changeFailureText(failure)}
          </p>
        </div>
      {/if}
    {:else if playlist}
      <div
        class={sheet
          ? 'flex flex-col gap-5'
          : 'grid grid-cols-[152px_minmax(0,1fr)] gap-6'}
      >
        <div class="flex flex-col items-start">
          <button
            type="button"
            bind:this={coverButton}
            class="group relative block rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-700 focus-visible:ring-offset-white"
            aria-label="更换封面"
            title="更换封面"
            onclick={chooseCover}
          >
            <Cover
              url={playlist.coverUrl}
              size={sheet ? 96 : 152}
              class={[
                'rounded-xl shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95',
                sheet ? 'size-24' : 'size-38',
              ]}
            />
            <span
              class={[
                'absolute grid place-items-center rounded-full bg-white text-primary-900 shadow-chip ring-1 ring-neutral-900/10 transition-colors duration-feedback mouse:group-hover:bg-primary-50',
                sheet
                  ? '-bottom-1 -right-1 size-7'
                  : '-bottom-1.5 -right-1.5 size-8',
              ]}
              aria-hidden="true"
            >
              <Camera size={sheet ? 14 : 16} aria-hidden="true" />
            </span>
          </button>
          <input
            bind:this={coverInput}
            type="file"
            accept="image/*"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            onchange={onCoverPicked}
          />
        </div>
        <div class="min-w-0 flex flex-col gap-5">
          {@render nameField()}
          <div class="flex flex-col">
            <div class="flex items-baseline justify-between gap-3">
              <label
                for="playlist-editor-description"
                class="text-caption text-neutral-700 font-500">简介</label
              >
              <span
                class={[
                  'text-caption tabular-nums',
                  descriptionTooLong ? 'text-error-700' : 'text-neutral-600',
                ]}
                >{formatCount(description.length)}/{formatCount(
                  PLAYLIST_DESCRIPTION_LENGTH,
                )}</span
              >
            </div>
            <textarea
              id="playlist-editor-description"
              bind:value={description}
              rows={sheet ? 3 : 2}
              maxlength={PLAYLIST_DESCRIPTION_LENGTH}
              lang={langOf(description)}
              class="mt-1.5 w-full resize-none border border-neutral-200 rounded-lg bg-white px-3.5 py-2.5 text-body text-neutral-900 outline-none transition-[border-color,box-shadow] duration-feedback focus:(border-primary-800 shadow-field-focus)"
            ></textarea>
            {#if descriptionTooLong}
              <div transition:unfold>
                <p class="pt-1.5 text-caption text-error-700">
                  {editProblemText('descriptionTooLong')}
                </p>
              </div>
            {/if}
          </div>
          <TagPicker
            bind:tags
            library={library?.playlistTags ?? null}
            phone={sheet}
            onretry={() => void view.app.openPlaylistTags()}
          />
        </div>
      </div>
    {/if}
  </form>
{/snippet}

{#snippet submitLabel()}
  {request.mode === 'new' ? '创建' : '保存'}
{/snippet}

{#if !form}
  <ConfirmPanel
    {sheet}
    cancelLabel={request.mode === 'delete' ? '先不了' : '取消'}
    oncancel={() => playlistEditor.close()}
  >
    {#snippet body()}
      {#if playlist && request.mode === 'public'}
        <p class="text-body text-neutral-700">
          公开后，你的网易云主页和搜索里都能看到<span
            class="text-neutral-900 font-500"
            lang={langOf(playlist.name)}>「{playlistName(playlist)}」</span
          >
        </p>
        <p
          class="mt-3 rounded-lg bg-warning-50 px-3.5 py-2.5 text-caption text-warning-900"
        >
          公开后不能改回隐私
        </p>
      {:else if playlist && request.mode === 'delete'}
        {@const count = formatSongCount(songCount)}
        <p class="text-body text-neutral-700">
          <span class="text-neutral-900 font-500" lang={langOf(playlist.name)}
            >「{playlistName(playlist)}」</span
          >里的{count === null ? '' : ` ${count}`}歌随歌单移除，红心不受影响。
        </p>
        <p class="mt-3 text-caption text-neutral-600">删除后不能恢复。</p>
      {/if}
    {/snippet}
    {#snippet confirm()}
      {#if request.mode === 'public'}
        <Button variant="primary" onclick={publish}>改为公开</Button>
      {:else}
        <Button variant="destructive" onclick={() => void remove()}
          >删除歌单</Button
        >
      {/if}
    {/snippet}
  </ConfirmPanel>
{:else}
  {#if sheet}
    <div class="h-14 flex flex-none items-center gap-2 px-2">
      <TextButton
        tone="neutral"
        size="body"
        disabled={playlistEditor.busy}
        onclick={() => playlistEditor.close()}>取消</TextButton
      >
      {@render heading(
        'min-w-0 flex-1 truncate text-center text-title-sm text-neutral-900 font-600',
      )}
      <TextButton
        strong
        size="body"
        type="submit"
        form={FORM_ID}
        busy={playlistEditor.busy}
        disabled={blocked}>{@render submitLabel()}</TextButton
      >
    </div>
  {/if}
  <DialogBody
    {sheet}
    body={formBody}
    actions={sheet ? undefined : formActions}
  />
{/if}

{#snippet formActions()}
  <Button
    variant="outline"
    disabled={playlistEditor.busy}
    onclick={() => playlistEditor.close()}>取消</Button
  >
  <Button
    variant="primary"
    type="submit"
    form={FORM_ID}
    busy={playlistEditor.busy}
    disabled={blocked}>{@render submitLabel()}</Button
  >
{/snippet}
