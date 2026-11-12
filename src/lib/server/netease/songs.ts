import type { SongDetailBody } from 'hana-music-api';

import type { Availability, Credit, Song } from '#lib/api/library.js';

type NeteaseSong = Pick<
  SongDetailBody['songs'][number],
  | 'id'
  | 'name'
  | 'ar'
  | 'al'
  | 'dt'
  | 'h'
  | 'no'
  | 'cd'
  | 'alia'
  | 'tns'
  | 'publishTime'
>;
type NeteaseArtist = NonNullable<NeteaseSong['ar']>[number];
type Privilege = Pick<SongDetailBody['privileges'][number], 'st' | 'pl'>;

const availabilityOf = (
  privilege: Privilege | null | undefined,
): Availability => {
  const { st, pl } = privilege ?? {};
  if (st != null && st < 0) return 'noCopyright';
  return pl == null || pl > 0 ? 'full' : 'trial';
};

export const creditOf = (artist: NeteaseArtist | null | undefined): Credit => ({
  id: artist?.id ?? null,
  name: artist?.name ?? null,
});

export const songOf = (
  song: NeteaseSong,
  privilege: Privilege | null | undefined,
): Song => ({
  id: song.id,
  name: song.name ?? null,
  artists: (song.ar ?? []).map(creditOf),
  album: {
    id: song.al?.id ?? null,
    name: song.al?.name ?? null,
    coverUrl: song.al?.picUrl ?? null,
  },
  duration: song.dt ?? null,
  downloadSize: song.h?.size ?? null,
  availability: availabilityOf(privilege),
  trackNumber: song.no ?? null,
  disc: song.cd ?? null,
  aliases: [...(song.alia ?? [])],
  translations: [...(song.tns ?? [])],
  publishedAt: song.publishTime ?? null,
});

export const songWithPrivilegeOf = (
  song: NeteaseSong & {
    readonly privilege?: Privilege | null;
  },
): Song => songOf(song, song.privilege);
