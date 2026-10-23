/**
 * 写操作（POST）的结果，所有写接口统一回它（#68）：
 * - done：做好了（已经在歌单里、已经收藏过这类重复操作也算）；
 * - missing：这张歌单在网易云里已经不在了（被删掉了）；
 * - unconfirmed：整张歌单排序时网易云回 -1“请求异常，请稍后重试”，几千首位置都变的排序其实已经生效，要重读一次确认。
 */
export interface WriteResponse {
  kind: 'done' | 'missing' | 'unconfirmed'
}
