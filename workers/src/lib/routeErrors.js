import { trackError, captureRequestContext } from './analytics.js';
import { translateError } from './errorMessages.js';
import { createLogger } from './logger.js';
import { initSentry, captureSentryRequest } from './sentry.js';

function getRequestId(request, fallback = 'route') {
  return request?._reqId || request?.headers?.get?.('X-Request-ID') || fallback;
}

function addRequestIdHeaders(response, requestId) {
  const headers = new Headers(response.headers);
  if (requestId) headers.set('X-Request-ID', requestId);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function buildPayload({ error, fallbackMessage, hint, requestId, ok = false }) {
  const payload = {
    ok,
    error: fallbackMessage || error,
  };

  if (hint) payload.hint = hint;
  if (requestId) payload.requestId = requestId;

  return payload;
}

export function formatRequestIdSuffix(requestId) {
  return requestId ? ` Reference: ${requestId}.` : '';
}

export async function reportHandledRouteError({
  request,
  env,
  error,
  source,
  fallbackMessage,
  status = 500,
  hint,
  extra = {},
  ok = false,
  responseFactory,
}) {
  const requestId = getRequestId(request, source || 'route');
  const path = request?.url ? new URL(request.url).pathname : null;
  const method = request?.method || null;
  const logger = request?._log || createLogger(requestId);
  const translated = translateError(error);
  const safeHint = hint === undefined ? translated.hint : hint;

  logger.error('handled_route_error', {
    source,
    path,
    method,
    requestId,
    error: error?.message || String(error),
    errorClass: error?.constructor?.name || 'Error',
    retryable: status >= 500,
    ...extra,
  });

  const reportPromise = Promise.allSettled([
    trackError(env, error, {
      endpoint: path,
      userId: request?._user?.sub,
      severity: status >= 500 ? 'high' : 'medium',
      requestContext: captureRequestContext(request),
      source,
      handled: true,
      requestId,
      properties: extra,
    }),
    initSentry(env).captureException(error, {
      request: captureSentryRequest(request),
      user: request?._user,
      tags: {
        path,
        method,
        reqId: requestId,
        source,
        handled: 'true',
      },
      extra,
    }),
  ]);

  if (request?._ctx?.waitUntil) {
    request._ctx.waitUntil(reportPromise);
  } else {
    await reportPromise;
  }

  const response = responseFactory
    ? responseFactory({
        status,
        requestId,
        translated,
        fallbackMessage,
        hint: safeHint,
        ok,
      })
    : Response.json(
        buildPayload({
          error: translated.message,
          fallbackMessage,
          hint: safeHint,
          requestId,
          ok,
        }),
        { status }
      );

  return addRequestIdHeaders(response, requestId);
}