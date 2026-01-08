export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params.id;

  if (!id) {
    return new Response("Missing post id", { status: 400 });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  // 👉 Pas dit aan naar jouw echte tabel/kolommen
  const res = await fetch(
    `${supabaseUrl}/rest/v1/posts?id=eq.${id}&select=title,description,og_image`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!res.ok) {
    return new Response("Post not found", { status: 404 });
  }

  const data = await res.json();
  const post = data[0];

  const title = post?.title ?? "Ozvion";
  const description = post?.description ?? "Bekijk deze post op Ozvion.";
  const image =
    post?.og_image ?? "https://ozvion.app/og-default.png";

  const url = new URL(request.url).toString();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>

<!-- Open Graph -->
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${url}" />
<meta property="og:type" content="article" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${image}" />

<meta http-equiv="refresh" content="0; url=ozvion://post/${id}" />
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>

<a href="ozvion://post/${id}">Open in app</a><br/>
<a href="https://ozvion.app">Open Ozvion website</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
