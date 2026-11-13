export const CHECK_TOKENS_HEADER = 'x-campanula-check-tokens';
export const RENEWAL_REQUIRED_HEADER = 'x-campanula-renewal-required';
export const RENEWAL_ATTEMPTED_HEADER = 'x-campanula-renewal-attempted';

export const CHECK_TOKEN = /^[\x21-\x7E]{1,1024}$/;

export interface CheckTokens {
  requests: string[];
}
