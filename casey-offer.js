export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="Cozy Castle - Dog-Friendly Professional Package">
  <meta property="og:description" content="Exclusive offer for February lease at 550 W Surf St">
  <meta property="og:image" content="https://chicagofurnishedcondos.com/logo.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://chicagofurnishedcondos.com/casey-offer">
  <title>Cozy Castle - Dog-Friendly Professional Package</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 2rem; line-height: 1.6; color: #111; background: #fff; }
    @media (prefers-color-scheme: dark) { body { color: #eaeaea; background: #111; } .btn { background: #fff; color: #111; } }
    main { max-width: 720px; margin: 0 auto; }
    h1 { margin: 0 0 0.25rem 0; font-size: clamp(1.4rem, 3vw, 2rem); }
    p { margin: 0.25rem 0 1rem; }
    .cta { margin-top: 1rem; display: flex; gap: 12px; flex-wrap: wrap; }
    .btn { display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 0.7rem 1rem; border-radius: 10px; font-weight: 600; }
    .btn:hover { opacity: 0.9; }
    footer { margin-top: 2rem; opacity: 0.75; font-size: 0.9rem; }
  </style>
  <!-- [Head enhanced: og:type, twitter:card, canonical] -->
  <!-- [CSS kept minimal and valid] -->
  </head>
<body>
  <main>
    <h1>Cozy Castle - Dog-Friendly Professional Package</h1>
    <p>Exclusive offer for February lease at 550 W Surf St.</p>

    <!-- CTA: SMS links corrected to sms:?&body=... with URL-encoded content -->
    <div class="cta">
      <a href="sms:?&body=Monday%20afternoon%20works%20for%20me!" class="btn">📅 Monday Afternoon</a>
      <a href="sms:?&body=Wednesday%20morning%20works%20for%20me!" class="btn">📅 Wednesday Morning</a>
    </div>

    <!-- [HTML body content can be extended here as needed] -->

    <footer>
      <small>Questions? Reply via SMS or email your host.</small>
    </footer>
  </main>
</body>
</html>`;

    const headers = new Headers({
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=3600"
    });

    // Cache at the edge for repeated requests
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let res = await cache.match(cacheKey);
    if (!res) {
      res = new Response(html, { headers });
      ctx && ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    return res;
  }
};
