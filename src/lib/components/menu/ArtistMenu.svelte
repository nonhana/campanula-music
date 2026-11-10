<script lang="ts">
  import { UserRound } from '@lucide/svelte';

  import { getOverlays } from '../overlay/overlay-context';
  import type { ArtistMenuRequest } from '../overlay/overlay-requests';
  import { langOf } from '../shared/text';
  import type { MenuHeader, MenuItem } from './menu';
  import MenuOverlay from './MenuOverlay.svelte';

  const { stack, artistMenu } = getOverlays();

  const itemsOf = ({ artists }: ArtistMenuRequest): MenuItem[] =>
    artists.map((artist, i) => ({
      key: `${i}`,
      label: artist.name,
      lang: langOf(artist.name),
      leading: { kind: 'icon', icon: UserRound },
      closeOnChoose: false,
      run: () => void stack.leave(artist.href),
    }));

  const header: MenuHeader = { kind: 'text', title: '查看歌手' };
</script>

<MenuOverlay
  layer={artistMenu}
  label={() => '查看歌手'}
  width="w-62"
  items={itemsOf}
  header={() => header}
/>
