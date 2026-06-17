/*
 * GA4 lead-event tracking — Roosters Rolling BBQ
 * ------------------------------------------------
 * Sends a Google Analytics event each time a visitor takes a lead action the
 * standard gtag.js tag can't see on its own: tapping Call, tapping Email, or
 * engaging the chat widget. Loaded on every page via:
 *   <script src="/assets/analytics-events.js" defer></script>
 *
 * The GA4 Measurement ID is NOT here — it lives in the gtag snippet in each
 * page's <head>. This file only fires events through the gtag() already loaded.
 *
 * TO COUNT THESE AS LEADS: in GA4 → Admin → Events, toggle "Mark as key event"
 * for:  click_to_call, click_to_email, chat_engaged
 * (high_intent_view is a supporting signal — a Menu/Packages visit — not a lead.)
 */
(function () {
  const track = (name, params) => {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  };

  // 1) Call & email taps — delegated so every tel:/mailto: link is covered,
  //    including ones added later, without touching the markup.
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const label = (link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    track(href.startsWith('tel:') ? 'click_to_call' : 'click_to_email', {
      link_text: label,
      link_url: href,
    });
  }, true);

  // 2) Chat-widget engagement. The LeadConnector widget renders in a
  //    cross-origin iframe, so we can't read clicks inside it. Instead we use
  //    the standard trick: when the user clicks into the chat, the window loses
  //    focus and the focused element becomes that iframe. Count once per visit.
  let chatCounted = false;
  window.addEventListener('blur', () => {
    if (chatCounted) return;
    const el = document.activeElement;
    if (el && el.tagName === 'IFRAME' && /leadconnector/i.test(el.src || '')) {
      chatCounted = true;
      track('chat_engaged', { provider: 'leadconnector' });
    }
  });

  // 3) High-intent page views — Menu / Packages signal a visitor close to
  //    inquiring. Helps us see how many shoppers reach these vs. convert.
  const path = (location.pathname || '').toLowerCase();
  if (path.includes('menu')) track('high_intent_view', { page_type: 'menu' });
  else if (path.includes('packages')) track('high_intent_view', { page_type: 'packages' });
})();
