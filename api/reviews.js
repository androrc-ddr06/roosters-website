// Vercel serverless function: returns the business's Google rating, total review
// count, and up to 5 reviews from the Google Places API (New). The home page uses
// this to render live reviews, falling back to the static testimonials in the HTML
// if this endpoint is unconfigured or unavailable.
//
// Required environment variables (never committed — the repo is public):
//   PLACES_API_KEY  — a Google Maps Platform API key restricted to the "Places API (New)"
//   PLACE_ID        — the business's Google Place ID (find it with Google's Place ID Finder)
//
// Google's Places API terms allow caching the rating and review count; review text
// should be refreshed regularly rather than stored long-term — so we cache at the
// CDN for one hour and serve stale-while-revalidate, never persisting to a database.

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.PLACES_API_KEY;
  const placeId = process.env.PLACE_ID;

  // Not configured yet — tell the client so it keeps the static testimonials.
  if (!apiKey || !placeId) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ configured: false, reviews: [] });
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const r = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews',
      },
    });

    if (!r.ok) {
      console.error('Places API error:', r.status, await r.text().catch(() => ''));
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(200).json({ configured: true, error: true, reviews: [] });
    }

    const data = await r.json();
    const reviews = Array.isArray(data.reviews)
      ? data.reviews
          .map((rev) => ({
            author: (rev.authorAttribution && rev.authorAttribution.displayName) || 'Google user',
            photo: (rev.authorAttribution && rev.authorAttribution.photoUri) || '',
            profileUrl: (rev.authorAttribution && rev.authorAttribution.uri) || '',
            rating: rev.rating || 5,
            text: (rev.text && rev.text.text) || (rev.originalText && rev.originalText.text) || '',
            when: rev.relativePublishTimeDescription || '',
          }))
          .filter((rev) => rev.text)
      : [];

    // Cache at the CDN for an hour; serve stale up to a day while revalidating in the background.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      configured: true,
      rating: data.rating || null,
      total: data.userRatingCount || 0,
      url: data.googleMapsUri || '',
      reviews,
    });
  } catch (err) {
    console.error('Reviews fetch failed:', err);
    return res.status(200).json({ configured: true, error: true, reviews: [] });
  }
};
