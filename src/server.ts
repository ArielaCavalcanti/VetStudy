import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// h3 may turn uncaught SSR errors into a generic 500 response without preserving
// their original stack. Recover the captured error for server-side diagnostics.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    if (payload.unhandled !== true || payload.message !== "HTTPError") return response;
  } catch {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`TanStack Start SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// TanStack Start's native fetch entry is wrapped with our error-page handler.
// createServerEntry preserves the framework's request-context typing for Workers.
export default createServerEntry({
  async fetch(request, opts) {
    try {
      const response = await handler.fetch(request, opts);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
});
