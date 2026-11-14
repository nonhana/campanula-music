import { endpoints } from '#lib/api/endpoints.ts';
import { fetchSuggestions } from '#lib/server/netease/search.ts';
import { readKeywords } from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies, request }) => {
  const keywords = readKeywords(url.searchParams.get('keywords'));
  return respondSignedIn(
    endpoints.suggestions,
    { cookies, request },
    (config) => fetchSuggestions(keywords, config),
    { retryRead: true },
  );
};
