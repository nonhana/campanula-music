/**
 * 所有写接口统一回它（#68）：done 是做好了（重复操作也算）；missing 是歌单在网易云里已经不在了；
 * unconfirmed 是整张歌单排序时网易云回 -1，几千首位置都变的排序其实已经生效，要重读一次确认。
 */
export interface WriteResponse {
  kind: 'done' | 'missing' | 'unconfirmed'
}
