<script lang="ts">
  import type { PlayerNotice as Notice } from '#lib/app/player.js';

  import NoticeCard from '../notice/NoticeCard.svelte';
  import { getAppView } from '../shared/app-context.svelte';
  import { noticeText } from './view';

  const {
    playerNotice,
    phone,
    edge,
    moved,
    onclose = () => view.app.dismissPlayerNotice(),
  }: {
    playerNotice: Notice;
    phone: boolean;
    edge: 'top' | 'bottom';
    moved: boolean;
    onclose?: () => void;
  } = $props();
  const view = getAppView();
</script>

<NoticeCard
  tone="error"
  text={noticeText(playerNotice)}
  {phone}
  {edge}
  {moved}
  name="player-notice"
  {onclose}
/>
