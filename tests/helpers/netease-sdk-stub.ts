/**
 * 测试辅助：网易云 SDK 替身
 *
 * 在测试中替换 hana-music-api SDK，使用录制的真实返回数据。
 * 录制数据来自 tests/fixtures/netease/，已脱敏。
 */

export interface NeteaseSDKStub {
  login_qr_key: () => Promise<any>
  login_qr_create: (params: any) => Promise<any>
  login_qr_check: (params: any) => Promise<any>
  login_cellphone: (params: any) => Promise<any>
  login_status: () => Promise<any>
  logout: () => Promise<any>
}

/**
 * 创建测试用的网易云 SDK 替身
 *
 * @param fixtures - 录制数据映射表，key 是接口名，value 是返回数据
 */
export function createNeteaseSDKStub(fixtures: Record<string, any>): NeteaseSDKStub {
  return {
    login_qr_key: async () => fixtures.login_qr_key || { code: 200, data: { unikey: 'test-key' } },
    login_qr_create: async (_params: any) => fixtures.login_qr_create || { code: 200, data: { qrurl: 'https://example.com/qr' } },
    login_qr_check: async (_params: any) => fixtures.login_qr_check || { code: 800, message: '二维码过期' },
    login_cellphone: async (_params: any) => fixtures.login_cellphone || { code: 200 },
    login_status: async () => fixtures.login_status || { data: { profile: null } },
    logout: async () => fixtures.logout || { code: 200 },
  }
}
