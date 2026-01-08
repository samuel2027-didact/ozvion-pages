export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params.id;

  if (!id) {
    return new Response("Missing post id", { status: 400 });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  // 1) Hard check: env vars aanwezig?
  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      `Missing env vars. SUPABASE_URL=${!!supabaseUrl}, SUPABASE_ANON_KEY=${!!supabaseKey}`,
      { status: 500 }
    );
  }

  // 2) Query: gebruik jouw echte tabelkolommen
  const apiUrl =
    `${supabaseUrl}/rest/v1/posts` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=title,body`;

  const res = await fetch(apiUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  // 3) Als Supabase faalt: laat de echte fout zien (essentieel debug)
  if (!res.ok) {
    const errText = await res.text();
    return new Response(
      `Supabase error: ${res.status}\n\n${errText}\n\nURL:\n${apiUrl}`,
      { status: 500 }
    );
  }

  const data = await res.json();
  const post = data?.[0];

  // 4) Bestaat post niet?
  if (!post) {
    return new Response("Post not found in DB", { status: 404 });
  }

  const title = post.title ?? "Ozvion";
  const description = post.body ?? "Bekijk deze post op Ozvion.";
  const image = "https://ozvion.app/og-default.png";
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

</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>

<a href="ozvion://post/${encodeURIComponent(id)}">Open in app</a><br/>
<a href="https://ozvion.app">Open Ozvion website</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store", // voor debug: geen cache
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
