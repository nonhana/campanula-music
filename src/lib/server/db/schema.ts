import { relations, sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// ==================== 基础表定义 ====================

// 歌单表
export const playlists = sqliteTable('playlists', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  cover: text('cover').notNull(),
  musicCount: integer('music_count').notNull(),
  sourceId: text('source_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// 歌手表
export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  sourceId: text('source_id').notNull(),
}, t => [
  index('idx_artists_name').on(t.name),
])

// 专辑表
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  cover: text('cover').notNull(),
  sourceId: text('source_id').notNull(),
}, t => [
  index('idx_albums_name').on(t.name),
])

// 歌曲表
export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  alias: text('alias'),
  duration: integer('duration').notNull(),
  sourceId: text('source_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  cover: text('cover').notNull(),
  albumId: integer('album_id').notNull(),
}, t => [
  index('idx_songs_name').on(t.name),
  index('idx_songs_alias').on(t.alias),
  index('idx_songs_album_id').on(t.albumId),
  index('idx_songs_created_at').on(t.createdAt),
])

// 歌词表
export const lyrics = sqliteTable('lyrics', {
  id: integer('id').primaryKey(),
  lyrics: text('lyrics').notNull(),
  translation: text('translation'),
  songId: integer('song_id').notNull(),
})

// ==================== 关联表定义 ====================

// 歌单歌曲关联表（多对多）
export const songsToPlaylists = sqliteTable('song_to_playlist', {
  songId: integer('song_id').references(() => songs.id).notNull(),
  playlistId: integer('playlist_id').references(() => playlists.id).notNull(),
}, t => [
  primaryKey({ columns: [t.songId, t.playlistId] }),
])

// 歌曲艺术家关联表（多对多）
export const songsToArtists = sqliteTable('song_to_artist', {
  songId: integer('song_id').references(() => songs.id).notNull(),
  artistId: integer('artist_id').references(() => artists.id).notNull(),
}, t => [
  primaryKey({ columns: [t.songId, t.artistId] }),
])

// ==================== 关系定义 ====================

// 歌单相关的关联信息
export const playlistsRelations = relations(playlists, ({ many }) => ({
  songs: many(songsToPlaylists),
}))

// 艺术家相关的关联信息
export const artistsRelations = relations(artists, ({ many }) => ({
  songs: many(songsToArtists),
}))

// 专辑相关的关联信息
export const albumsRelations = relations(albums, ({ many }) => ({
  songs: many(songs),
}))

// 歌词表的关联信息
export const lyricsRelations = relations(lyrics, ({ one }) => ({
  song: one(songs, { fields: [lyrics.songId], references: [songs.id] }),
}))

// 歌曲相关的关联信息
export const songsRelations = relations(songs, ({ one, many }) => ({
  artists: many(songsToArtists),
  playlists: many(songsToPlaylists),
  album: one(albums, { fields: [songs.albumId], references: [albums.id] }),
  lyric: one(lyrics, { fields: [songs.id], references: [lyrics.songId] }),
}))

// 歌单歌曲关联表的关联信息
export const songsToPlaylistsRelations = relations(songsToPlaylists, ({ one }) => ({
  song: one(songs, { fields: [songsToPlaylists.songId], references: [songs.id] }),
  playlist: one(playlists, { fields: [songsToPlaylists.playlistId], references: [playlists.id] }),
}))

// 歌曲艺术家关联表的关联信息
export const songsToArtistsRelations = relations(songsToArtists, ({ one }) => ({
  song: one(songs, { fields: [songsToArtists.songId], references: [songs.id] }),
  artist: one(artists, { fields: [songsToArtists.artistId], references: [artists.id] }),
}))
