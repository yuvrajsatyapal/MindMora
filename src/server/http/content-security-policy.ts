/** Workspace document policy, not API authentication or content sanitization. */
export function workspacePolicy(nonce: string, development = false, oauthOrigin?: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "connect-src 'self'", "img-src 'self'", "font-src 'self'",
    "frame-src 'self'", "object-src 'none'", "base-uri 'none'",
    "frame-ancestors 'none'", `form-action 'self'${oauthOrigin ? ` ${new URL(oauthOrigin).origin} https://accounts.google.com` : ""}`,
  ].join("; ");
}
