const DEFAULT_API_ORIGIN = 'https://prime-self-api.adrper79.workers.dev';

function getApiOrigin(env) {
  const configured = env?.API_ORIGIN || env?.PROD_API || DEFAULT_API_ORIGIN;
  return configured.replace(/\/$/, '');
}

function copyRequestHeaders(request, apiOrigin) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', new URL(request.url).host);
  headers.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''));
  headers.set('x-proxied-by', 'prime-self-pages');
  return headers;
}

function copyResponseHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return headers;
}

async function proxyToApi(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);
  const apiOrigin = getApiOrigin(env);
  const upstreamUrl = `${apiOrigin}${requestUrl.pathname}${requestUrl.search}`;

  const init = {
    method: request.method,
    headers: copyRequestHeaders(request, apiOrigin),
    redirect: 'manual',
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    duplex: request.method === 'GET' || request.method === 'HEAD' ? undefined : 'half',
  };

  const upstreamResponse = await fetch(upstreamUrl, init);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: copyResponseHeaders(upstreamResponse),
  });
}

export const onRequest = proxyToApi;
