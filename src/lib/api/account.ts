/** 当前登录的网易云账号：界面上显示的头像和昵称；曲库副本按 id 区分 */
export interface Account {
  /** 网易云的 uid */
  id: number
  nickname: string
  /** 网易云的原图地址；显示时按尺寸取缩略图 */
  avatarUrl: string
}

/**
 * GET /api/account 的返回：没有登录 Cookie 时是 null，不调网易云。
 * 有登录 Cookie 时问网易云，凭据已经失效就回“需要登录”（ErrorBody）
 */
export interface AccountResponse {
  account: Account | null
}
