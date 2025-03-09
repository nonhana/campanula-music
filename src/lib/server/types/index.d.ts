import type { album, artist, lyrics, playlist, playlistSong, song, songArtists } from '$lib/server/db/schema'

export type Playlist = typeof playlist.$inferSelect

export type Song = typeof song.$inferSelect

export type Artist = typeof artist.$inferSelect

export type Album = typeof album.$inferSelect

export type Lyrics = typeof lyrics.$inferSelect

export type PlaylistSong = typeof playlistSong.$inferSelect

export type SongArtists = typeof songArtists.$inferSelect
