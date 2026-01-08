export async function onRequest(context) {
  const { request, params } = context;

  const id = params.id; // dit is <id> uit /p/<id>
  const url = new URL(request.url);

  // Als iemand per ongeluk /p opent zonder id
  if (!id) {
    return new Response("Missing post id", { status: 400 });
  }

  // Tijdelijke demo-data (we koppelen Supabase in stap 2.6)
  const title = `Ozvion Post ${id}`;
  const description = "Open this post in Ozvion.";
  const image = "https://ozvion.app/og-default.png"; // later vervangen

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url.toString()}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 40px;">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>

  <p style="margin-top: 24px;">
    <a href="ozvion://p/${encodeURIComponent(id)}" style="display:inline-block;padding:12px 16px;border:1px solid #ccc;border-radius:10px;text-decoration:none;">
      Open in app
    </a>
  </p>

  <p style="margin-top: 12px;">
    <a href="https://ozvion.app" style="color:#555;">Open Ozvion website</a>
  </p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
      // basis caching (mag later scherper)
      "cache-control": "public, max-age=60",
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
