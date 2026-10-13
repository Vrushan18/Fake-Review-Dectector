// ============================================================================
// content.js — Content Script (injected into e-commerce pages)
// ============================================================================
// Responsibilities:
//   1. Detect review elements on ANY e-commerce page.
//   2. Extract author name, star rating, and review text.
//   3. Send extracted data to the background service worker for analysis.
//   4. Inject visual trust badges next to each review based on the verdict.
//
// MULTI-SITE SUPPORT:
//   The script uses a three-tier strategy to find reviews on any website:
//     Tier 1 — Site-specific CSS selectors (Amazon, Flipkart, eBay, etc.)
//     Tier 2 — Generic CSS selectors (common review class names)
//     Tier 3 — Universal DOM walker (finds star ratings + text blocks)
// ============================================================================

// ---------------------------------------------------------------------------
// Site-specific selector profiles
// ---------------------------------------------------------------------------

/**
 * Each profile maps logical review parts to CSS selectors.
 * Add new profiles here to support more sites — the core logic stays the same.
 *
 * Supported sites: Amazon, Flipkart, eBay, Walmart, AliExpress, Etsy,
 *                  Best Buy, Target, Myntra, + generic fallback for ANY site.
 */
const SITE_PROFILES = {

  // ── Amazon (.com, .in, .co.uk, .de, etc.) ──────────────────────────
  amazon: {
    reviewContainer: [
      '[data-hook="review"]',
      '[data-hook="mobley-review-content"]',
      '.review', '.a-section.review',
      '[id^="customer_review-"]',
      '[data-cel-widget^="cm_cr-review_list-"]',
    ].join(", "),
    authorName: ".a-profile-name",
    starRating: [
      '[data-hook="review-star-rating"]',
      '[data-hook="cmps-review-star-rating"]',
      "i.a-icon-star", ".a-icon-alt",
    ].join(", "),
    reviewText: [
      '[data-hook="review-body"] span',
      '[data-hook="review-body"]',
      ".review-text-content span",
      ".review-text span",
    ].join(", "),
  },

  // ── Flipkart ───────────────────────────────────────────────────────
  flipkart: {
    reviewContainer: "[data-testid='review-container'], .review-card, [class*='_27M-vq'], div[class*='review']",
    authorName: "[class*='_2sc7ZR'], [class*='_2V5EHH'], p[class*='author'], [data-testid='reviewer-name']",
    starRating: "[class*='_3LWZlK'], [class*='_1BLPMq'], div[class*='star'], [data-testid='star-rating']",
    reviewText: "[class*='t-ZTKy'], [class*='_6K-7Co'], div[class*='review-text'], [data-testid='review-text']",
  },

  // ── eBay ───────────────────────────────────────────────────────────
  ebay: {
    reviewContainer: ".review-item, .ebay-review-section .review-item-content, [data-review-id]",
    authorName: ".review-item-author span, .review-item-author, [data-testid='review-author']",
    starRating: ".review-item-stars, .star-rating, [data-testid='review-rating']",
    reviewText: ".review-item-content p, .review-item-content .review-content, [data-testid='review-text']",
  },

  // ── Walmart ────────────────────────────────────────────────────────
  walmart: {
    reviewContainer: "[data-testid='review-card'], .review-card, [class*='ReviewCard'], .customer-review",
    authorName: "[data-testid='review-author'], .review-author, [class*='review-footer'] span, .reviewer-name",
    starRating: "[data-testid='review-rating'], .review-rating, .stars-container, [class*='StarRating']",
    reviewText: "[data-testid='review-text'], .review-text, [class*='ReviewText'], .review-body",
  },

  // ── AliExpress ─────────────────────────────────────────────────────
  aliexpress: {
    reviewContainer: ".feedback-item, [class*='review-item'], [class*='ReviewItem'], .buyer-review",
    authorName: ".user-name, [class*='reviewer-name'], .buyer-name, [class*='UserName']",
    starRating: ".star-view, [class*='star-rating'], [class*='StarRate'], .buyer-review-stars",
    reviewText: ".buyer-feedback span, [class*='review-content'], [class*='ReviewContent'], .buyer-review-text",
  },

  // ── Etsy ───────────────────────────────────────────────────────────
  etsy: {
    reviewContainer: "[data-review-id], .review-card, .wt-grid__item-xs-12[data-region='review']",
    authorName: "[data-review-attribution] p, .shop2-review-attribution span, .review-attribution",
    starRating: "[data-rating], .stars-svg, [aria-label*='star'], .review-rating",
    reviewText: "[data-review-text], .review-card p, .wt-text-body-01",
  },

  // ── Best Buy ───────────────────────────────────────────────────────
  bestbuy: {
    reviewContainer: ".review-item, [data-testid='review'], .ugc-review-body, .c-review",
    authorName: ".review-item-author, .ugc-author, .reviewer-name, [data-testid='review-author']",
    starRating: ".c-stars, .review-rating, [data-testid='review-rating'], [class*='StarRating']",
    reviewText: ".review-item-body, .ugc-review-body p, [data-testid='review-body'], .pre-white-space",
  },

  // ── Target ─────────────────────────────────────────────────────────
  target: {
    reviewContainer: "[data-test='review-card'], .review-card, [data-test='reviewCard']",
    authorName: "[data-test='review-card--authorName'], .review-author",
    starRating: "[data-test='review-card--rating'], .RatingStars, [class*='StarRating']",
    reviewText: "[data-test='review-card--text'], .review-card-text",
  },

  // ── Myntra ─────────────────────────────────────────────────────────
  myntra: {
    reviewContainer: "[class*='user-review'], .user-review-main, [class*='reviewCard']",
    authorName: "[class*='user-review-name'], [class*='userName'], .reviewer-name",
    starRating: "[class*='user-review-rating'], [class*='stars'], .review-rating",
    reviewText: "[class*='user-review-body'], [class*='reviewContent'], .review-body",
  },

  // ── Generic fallback — broad selectors for any review-style page ──
  generic: {
    reviewContainer: [
      // Common class names used across many sites
      ".review", ".review-card", ".review-item", ".review-container",
      ".user-review", ".customer-review", ".product-review",
      // Data attributes
      "[data-review]", "[data-review-id]", "[data-testid*='review']",
      // Structural patterns
      "[itemtype='http://schema.org/Review']",
      "[itemprop='review']",
    ].join(", "),
    authorName: [
      ".review-author", ".author-name", ".reviewer-name",
      ".review-user", "[data-author]", "[itemprop='author']",
      "[data-testid*='author']", "[class*='reviewer']",
      "[class*='author-name']", "[class*='user-name']",
    ].join(", "),
    starRating: [
      ".star-rating", ".review-rating", ".rating",
      "[data-rating]", ".stars", "[itemprop='ratingValue']",
      "[aria-label*='star']", "[class*='StarRating']",
      "[data-testid*='rating']", "[class*='stars']",
    ].join(", "),
    reviewText: [
      ".review-text", ".review-body", ".review-content",
      ".comment-text", "[data-review-text]", "[itemprop='reviewBody']",
      "[data-testid*='review-text']", "[class*='review-text']",
      "[class*='review-body']", "[class*='ReviewContent']",
    ].join(", "),
  },
};

/**
 * Universal CSS selectors used by the DOM-walker fallback.
 * These detect star ratings and text blocks on ANY website regardless
 * of its specific class naming conventions.
 */
const UNIVERSAL_SELECTORS = {
  // Anything that looks like a star rating
  stars: [
    "[class*='star']", "[class*='Star']", "[class*='rating']", "[class*='Rating']",
    "[aria-label*='star']", "[aria-label*='rating']",
    "[data-rating]", "[data-star]", "[itemprop='ratingValue']",
    "i.a-icon-star", ".a-icon-alt",
    "svg[class*='star']", "svg[class*='Star']",
  ].join(", "),

  // Anything that looks like review text
  text: [
    "[class*='review-text']", "[class*='review-body']", "[class*='review-content']",
    "[class*='ReviewText']", "[class*='ReviewBody']", "[class*='ReviewContent']",
    "[class*='feedback']", "[class*='comment-text']",
    "[itemprop='reviewBody']", "[data-review-text]",
    "[data-testid*='review-text']", "[data-testid*='review-body']",
  ].join(", "),

  // Anything that looks like a reviewer name / profile
  author: [
    "[class*='profile-name']", "[class*='author']", "[class*='Author']",
    "[class*='reviewer']", "[class*='Reviewer']", "[class*='user-name']",
    "[class*='UserName']", "[class*='userName']",
    "[itemprop='author']", "[data-author]",
    "[data-testid*='author']", ".a-profile-name",
  ].join(", "),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Choose the best selector profile for the current page.
 * Falls back to the generic profile for unrecognized sites.
 */
function getActiveProfile() {
  const host = window.location.hostname.toLowerCase();

  if (host.includes("amazon"))      return SITE_PROFILES.amazon;
  if (host.includes("flipkart"))    return SITE_PROFILES.flipkart;
  if (host.includes("ebay"))        return SITE_PROFILES.ebay;
  if (host.includes("walmart"))     return SITE_PROFILES.walmart;
  if (host.includes("aliexpress"))  return SITE_PROFILES.aliexpress;
  if (host.includes("etsy"))        return SITE_PROFILES.etsy;
  if (host.includes("bestbuy"))     return SITE_PROFILES.bestbuy;
  if (host.includes("target.com"))  return SITE_PROFILES.target;
  if (host.includes("myntra"))      return SITE_PROFILES.myntra;

  // Fallback — broad generic selectors work on many sites
  return SITE_PROFILES.generic;
}

/**
 * Extract the numeric star rating from an element.
 * Handles Amazon's "X.0 out of 5 stars" aria-text pattern and plain text.
 */
function parseStarRating(el) {
  if (!el) return null;

  // Amazon stores rating in the inner <span> text like "4.0 out of 5 stars"
  const text = el.textContent || el.getAttribute("aria-label") || "";
  const match = text.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/** Generate a short unique ID for each review element. */
let _idCounter = 0;
function nextReviewId() {
  return `frd-review-${++_idCounter}`;
}

// ---------------------------------------------------------------------------
// Core: extract reviews from the DOM
// ---------------------------------------------------------------------------

/**
 * Scan the page and return an array of review objects.
 * Each object also stores a reference to its DOM node so we can inject
 * badges later.
 *
 * Uses a three-tier strategy to work on ANY e-commerce site:
 *   Tier 1 — Site-specific CSS selectors (Amazon, Flipkart, eBay, etc.)
 *   Tier 2 — Generic CSS selectors (common review class names)
 *   Tier 3 — Universal DOM walker (finds star ratings + text blocks on any site)
 */
function extractReviews() {
  const profile = getActiveProfile();
  let containers = [...document.querySelectorAll(profile.reviewContainer)];
  let detectionMethod = "site-specific selectors";

  console.log(`[FRD Content] Site: ${window.location.hostname}`);
  console.log(`[FRD Content] Matched ${containers.length} container(s) via ${detectionMethod}.`);

  // ── Tier 2: Try generic selectors if site-specific found nothing ───
  if (containers.length === 0 && profile !== SITE_PROFILES.generic) {
    const genericProfile = SITE_PROFILES.generic;
    containers = [...document.querySelectorAll(genericProfile.reviewContainer)];
    detectionMethod = "generic selectors";
    console.log(`[FRD Content] Trying generic selectors → ${containers.length} container(s).`);
  }

  // ── Tier 3: Universal DOM walker — works on ANY website ────────────
  if (containers.length === 0) {
    console.log("[FRD Content] No containers via selectors. Activating universal DOM walker…");
    containers = discoverReviewContainers();
    detectionMethod = "universal DOM walker";
    console.log(`[FRD Content] DOM walker discovered ${containers.length} container(s).`);
  }

  const reviews = [];
  const seen = new Set(); // avoid nested duplicates

  containers.forEach((container, idx) => {
    // Skip reviews we've already processed
    if (container.dataset.frdProcessed === "true") return;

    // Skip if a badge was already injected inside this container
    if (container.querySelector('.frd-badge-wrapper')) return;

    // Skip if a parent was already matched (avoids double-counting nested elements)
    if ([...seen].some((prev) => prev.contains(container) || container.contains(prev))) return;

    // Try site-specific selectors first, then universal fallbacks
    const authorEl = container.querySelector(profile.authorName) ||
                     container.querySelector(UNIVERSAL_SELECTORS.author);
    const ratingEl = container.querySelector(profile.starRating) ||
                     container.querySelector(UNIVERSAL_SELECTORS.stars);
    const textEl   = container.querySelector(profile.reviewText) ||
                     container.querySelector(UNIVERSAL_SELECTORS.text) ||
                     findLongestParagraph(container); // last resort: longest <p>

    const author = authorEl?.textContent?.trim() || "Unknown";
    const rating = parseStarRating(ratingEl);
    const text = textEl?.textContent?.trim() || "";

    // Debug: log what was found inside each container
    console.log(`[FRD Content] Container #${idx}: author="${author}", rating=${rating}, textLen=${text.length}`);

    // Ignore reviews with no meaningful text (too short to analyze)
    if (text.length < 10) {
      console.log(`[FRD Content] Container #${idx} skipped (text too short).`);
      return;
    }

    const id = nextReviewId();
    container.dataset.frdId = id;
    container.dataset.frdProcessed = "true";
    seen.add(container);

    reviews.push({ id, author, rating, text, _authorEl: authorEl || textEl, _container: container });
  });

  return reviews;
}

/**
 * Last-resort text finder: returns the longest <p> or <span> or <div>
 * inside a container that has substantial text (likely the review body).
 */
function findLongestParagraph(container) {
  let best = null;
  let maxLen = 0;
  container.querySelectorAll("p, span, div").forEach((el) => {
    // Only consider leaf-ish elements (not wrappers with many children)
    if (el.children.length > 3) return;
    const len = (el.textContent?.trim() || "").length;
    if (len > maxLen && len > 30) {
      maxLen = len;
      best = el;
    }
  });
  return best;
}

/**
 * Universal DOM walker — finds review containers on ANY website by
 * looking for elements that contain BOTH a star rating and substantial text.
 *
 * Strategy:
 *   1. Find all star-rating elements on the page.
 *   2. For each, walk UP the DOM tree (max 8 levels).
 *   3. At each ancestor, check if it also contains substantial text (>50 chars).
 *   4. If yes → it's likely a review container.
 *
 * This works regardless of class names, data attributes, or site structure.
 */
function discoverReviewContainers() {
  // Strategy A: Start from star-rating elements
  const starAnchors = document.querySelectorAll(UNIVERSAL_SELECTORS.stars);
  // Strategy B: Start from author/profile-name elements
  const authorAnchors = document.querySelectorAll(UNIVERSAL_SELECTORS.author);

  // Combine both sets of anchor elements
  const allAnchors = new Set([...starAnchors, ...authorAnchors]);
  const containers = [];
  const foundAncestors = new Set(); // dedup

  allAnchors.forEach((anchor) => {
    // Walk up (max 8 levels) to find the review wrapper
    let el = anchor;
    for (let i = 0; i < 8; i++) {
      el = el.parentElement;
      if (!el || el === document.body || el === document.documentElement) break;

      // Skip if we already found this ancestor
      if (foundAncestors.has(el)) break;

      // A review container should have substantial text content
      const textContent = el.textContent?.trim() || "";
      if (textContent.length < 50) continue;

      // Check: does this ancestor contain both a rating indicator AND text?
      const hasStars = el.querySelector(UNIVERSAL_SELECTORS.stars);
      const hasReviewText = el.querySelector(UNIVERSAL_SELECTORS.text) || findLongestParagraph(el);

      // Also accept if it has a star rating and enough raw text
      if (hasStars && (hasReviewText || textContent.length > 100)) {
        // Avoid matching huge page sections — review containers are usually modest
        const rect = el.getBoundingClientRect();
        const isReasonableSize = rect.height < window.innerHeight * 1.5;

        if (isReasonableSize) {
          containers.push(el);
          foundAncestors.add(el);

          const tag = el.tagName.toLowerCase();
          const cls = (el.className || "").toString().split(" ").slice(0, 2).join(".");
          console.log(`[FRD Content] Walker: found container → <${tag}.${cls}> (${textContent.length} chars)`);
          break;
        }
      }
    }
  });

  return containers;
}

// ---------------------------------------------------------------------------
// Core: inject trust badges with reason tooltips into the DOM
// ---------------------------------------------------------------------------

/**
 * Create and insert a badge element next to the author's name.
 * Clicking the badge toggles a tooltip showing the analysis reasons.
 *
 * @param {HTMLElement} anchorEl      – The element to attach the badge after.
 * @param {number}      score         – Trust score (1-100).
 * @param {boolean}     isFake        – Whether the review is flagged suspicious.
 * @param {boolean}     hasAi         – Whether AI was detected.
 * @param {number}      aiPercentage  – The calculated percentage of AI generated text.
 * @param {string[]}    reasons       – Array of human-readable reason strings.
 */
function injectBadge(anchorEl, score, isFake, hasAi, aiPercentage, reasons = [], container = null) {
  const target = anchorEl || container?.querySelector('[class*="star"], [data-hook*="star"]') || container?.firstElementChild;
  if (!target) return;

  // Don't duplicate badges on the same element or within its immediate parent
  if (target.dataset.frdBadged === "true") return;
  if (target.parentElement?.querySelector(".frd-badge") || container?.querySelector(".frd-badge")) return;
  
  target.dataset.frdBadged = "true";

  // ── Badge wrapper (contains pill + tooltip) ──
  const wrapper = document.createElement("span");
  wrapper.className = "frd-badge-wrapper";
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  wrapper.style.marginLeft = "8px";

  // ── Pill badge ──
  const badge = document.createElement("span");
  
  let badgeClass = "frd-badge--verified";
  let badgeText = `✓ Verified (${score})`;
  let tooltipHeader = "✓ Trusted Review";
  
  if (hasAi) {
    if (isFake) {
      badgeClass = "frd-badge--ai-fake"; // highly AI and suspicious
      badgeText = `🤖 ${aiPercentage}% AI (Suspicious)`;
      tooltipHeader = "🤖 High AI Content (Suspicious)";
    } else {
      badgeClass = "frd-badge--ai-assisted"; // partly AI but passes human threshold
      badgeText = `🤖 ${aiPercentage}% AI (Assisted)`;
      tooltipHeader = "🤖 AI-Assisted Review (Genuine)";
    }
  } else if (isFake) {
    badgeClass = "frd-badge--suspicious";
    badgeText = `⚠ Suspicious (${score})`;
    tooltipHeader = "⚠ Suspicious Review";
  }

  badge.className = `frd-badge ${badgeClass}`;
  badge.textContent = badgeText;
  badge.style.cursor = "pointer";

  // ── Tooltip with reasons ──
  const tooltip = document.createElement("div");
  tooltip.className = "frd-tooltip";
  tooltip.innerHTML = `
    <div class="frd-tooltip__header">
      <strong>${tooltipHeader}</strong>
      <span class="frd-tooltip__score">Score: ${score}/100</span>
    </div>
    <ul class="frd-tooltip__reasons">
      ${reasons.map((r) => `<li>${r}</li>`).join("")}
    </ul>
  `;
  tooltip.style.display = "none"; // hidden by default

  // Toggle tooltip on click
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = tooltip.style.display === "block";
    // Close all other open tooltips first
    document.querySelectorAll(".frd-tooltip").forEach((t) => (t.style.display = "none"));
    tooltip.style.display = isVisible ? "none" : "block";
  });

  // Close tooltip when clicking elsewhere
  document.addEventListener("click", () => {
    tooltip.style.display = "none";
  });

  wrapper.appendChild(badge);
  wrapper.appendChild(tooltip);

  // Insert right after the target element
  target.insertAdjacentElement("afterend", wrapper);
}

// ---------------------------------------------------------------------------
// Orchestrator: extract → analyze → badge → persist results
// ---------------------------------------------------------------------------

function isExtensionValid() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

/** Tracks cumulative scan results for the popup dashboard */
let scanResults = { total: 0, verified: 0, suspicious: 0, flagged: [] };

async function runScanner() {
  if (!isExtensionValid()) {
    if (typeof observer !== "undefined") observer.disconnect();
    return;
  }

  // Check if the scanner is enabled (defaults to true)
  const isEnabled = await new Promise((resolve) => {
    try {
      if (!isExtensionValid()) return resolve(false);
      chrome.storage.local.get({ scannerEnabled: true }, (res) => {
        if (!isExtensionValid() || chrome.runtime.lastError) return resolve(true);
        resolve(res ? res.scannerEnabled !== false : true);
      });
    } catch (e) {
      resolve(true);
    }
  });

  if (!isEnabled || !isExtensionValid()) {
    console.log("[FRD Content] Scanner is disabled or context changed. Skipping.");
    return;
  }

  console.log("[FRD Content] Scanning page for reviews…");

  const reviews = extractReviews();

  if (reviews.length === 0) {
    console.log("[FRD Content] No new reviews found on this page.");
    return;
  }

  console.log(`[FRD Content] Found ${reviews.length} new review(s). Sending for analysis…`);

  // Build a lookup map so we can match results back to DOM elements
  const domMap = new Map();
  const payload = reviews.map(({ id, author, rating, text, _authorEl, _container }) => {
    domMap.set(id, { authorEl: _authorEl, container: _container });
    return { id, author, rating, text };
  });

  if (!isExtensionValid()) return;

  // Send to background for analysis
  try {
    chrome.runtime.sendMessage(
      { type: "ANALYZE_REVIEWS", payload },
      (response) => {
        if (!isExtensionValid()) return;
        if (chrome.runtime.lastError) {
          console.warn("[FRD Content] Message notice:", chrome.runtime.lastError.message);
          return;
        }

        if (response?.type === "ANALYSIS_RESULTS") {
          response.payload.forEach(({ id, author, trustScore, isFake, hasAi, aiPercentage, reasons }) => {
            const domRefs = domMap.get(id);
            if (!domRefs) return;

            // Inject badge with reasons
            injectBadge(domRefs.authorEl, trustScore, isFake, hasAi, aiPercentage, reasons || [], domRefs.container);

            // Highlight the entire review container
            let containerHighlight = "frd-review--verified";
            if (hasAi) {
              containerHighlight = isFake ? "frd-review--ai-fake" : "frd-review--ai-assisted";
            } else if (isFake) {
              containerHighlight = "frd-review--suspicious";
            }
            
            domRefs.container.classList.add(containerHighlight);

            // Track results for the popup
            scanResults.total++;
            if (isFake || hasAi) {
              scanResults.suspicious++;
              scanResults.flagged.push({ author, trustScore, hasAi, aiPercentage, reasons: reasons || [] });
            } else {
              scanResults.verified++;
            }
          });

          // Persist results so the popup can read them
          if (isExtensionValid()) {
            chrome.storage.local.set({ frdScanResults: scanResults });
          }

          console.log("[FRD Content] Badges injected for all analyzed reviews.");
          console.log(`[FRD Content] Stats — Total: ${scanResults.total}, Verified: ${scanResults.verified}, Suspicious: ${scanResults.suspicious}`);
        } else if (response?.type === "ANALYSIS_ERROR") {
          console.error("[FRD Content] Backend error:", response.error);
        }
      }
    );
  } catch (err) {
    console.debug("[FRD Content] Context invalidated on message send:", err);
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

// Reset scan results for this page
if (isExtensionValid()) {
  try {
    chrome.storage.local.set({ frdScanResults: { total: 0, verified: 0, suspicious: 0, flagged: [] } });
  } catch (e) {}
}

// Run on initial page load
runScanner();

// Re-scan when new content is dynamically loaded (infinite scroll, "Load More")
const observer = new MutationObserver((mutations) => {
  if (!isExtensionValid()) {
    observer.disconnect();
    return;
  }
  // Debounce: only re-scan if meaningful nodes were added
  const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
  if (hasNewNodes) {
    clearTimeout(observer._frdTimer);
    observer._frdTimer = setTimeout(runScanner, 1000);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for manual rescan requests from the popup toggle
window.addEventListener("frd-rescan", () => {
  if (!isExtensionValid()) return;
  console.log("[FRD Content] Manual rescan triggered from popup.");
  runScanner();
});

console.log("[FRD Content] Content script loaded. Watching for reviews.");

