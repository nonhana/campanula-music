/** 当前登录的网易云账号；曲库副本按 id 区分 */
export interface Account {
  id: number
  nickname: string
  avatarUrl: string
}

/** 没有登录 Cookie 时是 null，不调网易云；凭据失效回需要登录（ErrorBody） */
export interface AccountResponse {
  account: Account | null
}
