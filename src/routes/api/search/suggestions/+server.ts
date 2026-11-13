import { endpoints } from '#lib/api/endpoints.js';
import { fetchSuggestions } from '#lib/server/netease/search.js';
import { readKeywords } from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

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
