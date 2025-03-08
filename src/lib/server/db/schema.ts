import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 歌单表
export const playlist = sqliteTable('playlist', {
  id: integer('id').primaryKey(),
  name: text('name'),
  description: text('description'),
  cover: text('cover'),
  musicCount: integer('music_count'),
  sourceId: text('source_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// 歌手表
export const artist = sqliteTable('artist', {
  id: integer('id').primaryKey(),
  name: text('name'),
  sourceId: text('source_id'),
})

// 专辑表
export const album = sqliteTable('album', {
  id: integer('id').primaryKey(),
  name: text('name'),
  cover: text('cover'),
  sourceId: text('source_id'),
})

// 歌曲表
export const song = sqliteTable('song', {
  id: integer('id').primaryKey(),
  name: text('name'),
  alias: text('alias'),
  duration: integer('duration'),
  source: text('source'),
  sourceId: text('source_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  artistId: integer('artist_id').references(() => artist.id),
  albumId: integer('album_id').references(() => album.id),
})

// 歌单歌曲关联表
export const playlistSong = sqliteTable('playlist_song', {
  id: integer('id').primaryKey(),
  playlistId: integer('playlist_id').references(() => playlist.id),
  songId: integer('song_id').references(() => song.id),
})

// 歌词表
export const lyrics = sqliteTable('lyrics', {
  id: integer('id').primaryKey(),
  songId: integer('song_id').references(() => song.id),
  lyrics: text('lyrics'),
  translation: text('translation'),
})
