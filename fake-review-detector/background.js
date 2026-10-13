// ============================================================================
// background.js — Service Worker (Manifest V3)
// ============================================================================
// Responsibilities:
//   1. Listen for messages from the content script containing review data.
//   2. Run each review through a heuristic scoring function.
//   3. Return the trust verdict (with reasons) back to the content script.
//
// SWAPPING TO A REAL BACKEND:
//   Replace the body of `analyzeReview()` with a fetch() call to your API.
//   The function signature and return shape stay the same, so nothing else
//   needs to change.
// ============================================================================

// ---------------------------------------------------------------------------
// RoBERTa-Base Contextual Transformer Inference Client
// ---------------------------------------------------------------------------
const ROBERTA_SERVER_URL = "http://127.0.0.1:5000/predict";

/**
 * Query the local RoBERTa Transformer PyTorch inference server.
 * Connects directly to the fine-tuned roberta-base model (93.10% accuracy).
 */
async function queryRobertaServer(text) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800); // 800ms network timeout
    const res = await fetch(ROBERTA_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review: text }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return data; // { is_fake: boolean, fake_prob: number, real_prob: number }
    }
  } catch (e) {
    // Offline handling
  }
  return null;
}

/**
 * Analyze a single review using Fine-Tuned RoBERTa Transformer Architecture.
 *
 * @param {string} author  – The reviewer's display name.
 * @param {number} rating  – Star rating (1-5).
 * @param {string} text    – Full review body text.
 * @returns {Promise<{trustScore: number, isFake: boolean, reasons: string[]}>}
 */
async function analyzeReview(author, rating, text) {
  const reasons = [];  // Accumulates red-flag reasons
  let penalty = 0;     // Total penalty points (0 = perfectly clean)
  let aiSignals = 0;   // Counts how many AI-specific checks triggered

  // 1. Core Model Evaluation: Fine-Tuned RoBERTa Transformer
  const robertaResult = await queryRobertaServer(text);

  if (robertaResult) {
    const fakePercent = Math.round(robertaResult.fake_prob * 100);
    const realPercent = Math.round(robertaResult.real_prob * 100);
    if (robertaResult.is_fake) {
      const robertaPen = Math.min(65, Math.round(robertaResult.fake_prob * 60));
      penalty += robertaPen;
      reasons.push(`⚡ RoBERTa Transformer: Flagged as Synthetic (${fakePercent}% Fake Prob, -${robertaPen} pts)`);
    } else {
      reasons.push(`⚡ RoBERTa Transformer: Verified Human Authentic (${realPercent}% Real Prob)`);
    }
  } else {
    // Transformer local server notice
    reasons.push("⚡ RoBERTa Model: Waiting for local inference server (http://127.0.0.1:5000)");
  }

  const words = text.split(/\s+/);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const lowerText = text.toLowerCase();

  // =================================================================
  //  SECTION A: General Fake Review Checks (1–10)
  // =================================================================

  // ── Check 1: Review length ──────────────────────────────────────
  if (wordCount < 15) {
    penalty += 20;
    reasons.push("Very short review — lacks detail");
  } else if (wordCount < 30) {
    penalty += 8;
    reasons.push("Relatively short review");
  }

  // ── Check 2: Excessive CAPS ─────────────────────────────────────
  const capsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  const capsRatio = capsWords.length / wordCount;
  if (capsRatio > 0.4) {
    penalty += 25;
    reasons.push("Excessive ALL CAPS text detected");
  } else if (capsRatio > 0.2) {
    penalty += 10;
    reasons.push("Significant use of ALL CAPS");
  }

  // ── Check 3: Excessive exclamation marks ────────────────────────
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 5) {
    penalty += 20;
    reasons.push(`Excessive exclamation marks (${exclamationCount} found)`);
  } else if (exclamationCount > 3) {
    penalty += 8;
    reasons.push("Multiple exclamation marks");
  }

  // ── Check 4: Repetitive / generic superlatives ──────────────────
  const genericPhrases = [
    "best ever", "best product", "must buy", "highly recommended",
    "amazing product", "wonderful product", "perfect product",
    "five stars", "5 stars", "love it", "no regrets",
    "buy now", "don't think twice", "without thinking",
    "everyone should buy", "best purchase", "incredible product",
    "fantastic product", "outstanding product", "superb product",
  ];
  const matchedGeneric = genericPhrases.filter((p) => lowerText.includes(p));
  if (matchedGeneric.length >= 3) {
    penalty += 25;
    reasons.push(`Multiple generic superlatives ("${matchedGeneric.slice(0, 3).join('", "')}")`);
  } else if (matchedGeneric.length >= 1) {
    penalty += 8;
    reasons.push(`Generic praise phrase ("${matchedGeneric[0]}")`);
  }

  // ── Check 5: Repetitive words ───────────────────────────────────
  const wordFreq = {};
  words.forEach((w) => {
    const key = w.toLowerCase().replace(/[^a-z]/g, "");
    if (key.length > 3) wordFreq[key] = (wordFreq[key] || 0) + 1;
  });
  const repeated = Object.entries(wordFreq).filter(([, count]) => count > 3);
  if (repeated.length > 2) {
    penalty += 15;
    reasons.push("High word repetition detected");
  }

  // ── Check 6: Incentivized review language ───────────────────────
  const incentivePatterns = [
    "received free", "free in exchange", "complimentary copy",
    "provided for review", "sent me this", "gifted this",
    "in exchange for", "honest review", "unbiased review",
    "discount code", "discounted price", "coupon",
  ];
  const matchedIncentive = incentivePatterns.filter((p) => lowerText.includes(p));
  if (matchedIncentive.length > 0) {
    penalty += 15;
    reasons.push(`Possible incentivized review ("${matchedIncentive[0]}")`);
  }

  // ── Check 7: Rating vs. content mismatch ────────────────────────
  if (rating !== null) {
    if (rating === 5 && wordCount < 20) {
      penalty += 12;
      reasons.push("5-star rating with minimal explanation");
    }
    if (rating === 1 && wordCount < 20) {
      penalty += 12;
      reasons.push("1-star rating with minimal explanation");
    }
  }

  // ── Check 8: Lack of specifics ──────────────────────────────────
  const hasSpecifics = /\d+\s*(hour|day|week|month|year|mm|cm|inch|gb|mb|kg|lb|gram|watt|mah)/i.test(text);
  const hasComparison = /(compared to|better than|worse than|similar to|unlike|versus)/i.test(text);
  if (!hasSpecifics && !hasComparison && wordCount > 20) {
    penalty += 8;
    reasons.push("No specific details, measurements, or comparisons");
  }

  // ── Check 9: Emoji spam ─────────────────────────────────────────
  const emojiCount = (text.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 5) {
    penalty += 10;
    reasons.push(`Excessive emoji usage (${emojiCount} emojis)`);
  }

  // ── Check 10: Choppy sentences ──────────────────────────────────
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : wordCount;
  if (avgWordsPerSentence < 5 && sentenceCount > 3) {
    penalty += 10;
    reasons.push("Many very short, choppy sentences");
  }

  // =================================================================
  //  SECTION B: AI-Generated Review Detection (Token Density)
  // =================================================================
  // Instead of a flat penalty, we calculate how much of the text
  // consists of AI "tokens" (phrases, patterns) relative to total length.

  let aiTokens = 0;

  // ── Check 11: Em dash (—) overuse ───────────────────────────────
  const emDashCount = (text.match(/[—–]/g) || []).length;
  if (emDashCount > 0) {
    aiTokens += emDashCount * 8;
    reasons.push(`🤖 Em dash usage (${emDashCount}x) adds to AI probability`);
  }

  // ── Check 12: Formulaic AI opening patterns ─────────────────────
  const aiOpenings = [
    "i recently purchased", "i recently bought", "i recently ordered",
    "i just purchased", "i just bought", "i just ordered",
    "i ordered this", "i bought this product", "i purchased this product",
    "i received this product", "i got this product",
    "i'm really happy with", "i am really happy with",
    "i'm quite satisfied", "i am quite satisfied",
    "i'm really impressed", "i am really impressed",
  ];
  const hasAiOpening = aiOpenings.some((p) => {
    const idx = lowerText.indexOf(p);
    return idx !== -1 && idx < 30;
  });
  if (hasAiOpening) {
    aiTokens += 15;
    reasons.push("🤖 Formulaic AI-style opening detected");
  }

  // ── Check 13: Formulaic AI closing patterns ─────────────────────
  const aiClosings = [
    "i would definitely recommend", "i'd definitely recommend",
    "i highly recommend", "would definitely recommend",
    "i would recommend this to anyone", "recommend this to anyone",
    "looking forward to buying more", "looking forward to purchasing",
    "looking forward to more products", "highly recommend this",
    "a must-have for anyone", "must-have for anyone",
    "anyone looking for", "for anyone looking for",
    "great value for money", "value for money",
    "worth every penny", "bang for the buck",
    "a worthwhile purchase", "a reliable purchase",
    "a great addition to", "a versatile addition",
    "overall, i'm very", "overall, i am very",
    "overall, this is a", "overall, i would",
    "overall, a ", "overall a "
  ];
  const matchedClosings = aiClosings.filter((p) => lowerText.includes(p));
  if (matchedClosings.length > 0) {
    aiTokens += matchedClosings.length * 15;
    reasons.push(`🤖 Formulaic AI closing ("${matchedClosings[0]}")`);
  }

  // ── Check 14: Participial "making it" chains ────────────────────
  const makingItCount = (lowerText.match(/,?\s*making it\s/g) || []).length;
  if (makingItCount > 0) {
    aiTokens += makingItCount * 10;
    reasons.push(`🤖 AI participial chains ("making it...")`);
  }

  // ── Check 15: AI connector/transition words ─────────────────────
  const aiConnectors = [
    "moreover", "furthermore", "additionally", "consequently",
    "nevertheless", "in addition to this", "it is worth noting",
    "needless to say", "it goes without saying",
    "that being said", "with that said", "having said that",
    "not only", "but also", "as well as being",
  ];
  const matchedConnectors = aiConnectors.filter((c) => lowerText.includes(c));
  if (matchedConnectors.length > 0) {
    aiTokens += matchedConnectors.length * 8;
    reasons.push(`🤖 Formal AI transition words`);
  }

  // ── Check 16: AI vocabulary fingerprint ─────────────────────────
  const aiVocab = [
    "versatile", "elevate", "elevates", "seamless", "seamlessly",
    "effortlessly", "curated", "aesthetics", "aesthetic appeal",
    "complements", "exudes", "exquisite", "impeccable",
    "top-notch", "unparalleled", "meticulous", "meticulously",
    "testament to", "speaks volumes", "game-changer", "game changer",
    "budget-friendly", "wardrobe addition", "wardrobe staple",
    "overall experience", "overall, this is", "overall, i would",
    "true to size", "true to expectations", "elegance", "classy",
    "breathable yet", "stylish yet", "simple yet", "lightweight yet",
    "sleek yet", "casual yet", "minimal yet", "affordable yet",
  ];
  const matchedAiVocab = aiVocab.filter((v) => lowerText.includes(v));
  if (matchedAiVocab.length > 0) {
    aiTokens += matchedAiVocab.length * 5;
    reasons.push(`🤖 AI-favored vocabulary (${matchedAiVocab.length} words)`);
  }

  // ── Check 17: Suspiciously comprehensive coverage ───────────────
  const aspectKeywords = {
    quality:       /\b(quality|material|fabric|build|sturdy|durable|soft)\b/i,
    fit:           /\b(fit|fits|fitting|size|sizing|comfortable|comfort)\b/i,
    delivery:      /\b(delivery|delivered|shipping|arrived|dispatch)\b/i,
    packaging:     /\b(packaging|packaged|packed|box|wrapping|neat)\b/i,
    value:         /\b(value|price|worth|money|affordable|budget)\b/i,
    recommendation:/\b(recommend|suggestion|suggest|anyone looking|must.have)\b/i,
    appearance:    /\b(look|looks|appearance|design|color|colour|style|stylish|trendy)\b/i,
  };
  const coveredAspects = Object.entries(aspectKeywords).filter(([, rx]) => rx.test(text));
  if (coveredAspects.length >= 5) {
    aiTokens += 20;
    reasons.push(`🤖 Suspiciously comprehensive aspect coverage`);
  }

  // ── Check 18: Hedging / balanced phrasing ───────────────────────
  const hedgePatterns = [
    /not too \w+[,;—–] not too \w+/i,
    /not too \w+ and not too \w+/i,
    /\w+ yet \w+/i,
    /\w+ but not \w+/i,
    /\w+ without being \w+/i,
    /\w+ without sacrificing \w+/i,
    /\w+ while still \w+/i,
    /neither too \w+ nor too \w+/i,
    /just the right amount/i,
    /strikes a\s*(good|great|perfect|nice)?\s*balance/i,
  ];
  const matchedHedges = hedgePatterns.filter((rx) => rx.test(text));
  if (matchedHedges.length > 0) {
    aiTokens += matchedHedges.length * 10;
    reasons.push("🤖 AI-style balanced hedging");
  }

  // =================================================================
  //  SECTION C: AI Percentage Math
  // =================================================================

  // Calculate percentage of review that is AI structure
  // Divide AI tokens by word count (assume minimum 30 words to prevent crazy spikes on short text)
  let rawAiPercentage = (aiTokens / Math.max(wordCount, 30)) * 100;
  
  // Scale it slightly so heavy hits reliably hit 100%
  let aiPercentage = Math.min(100, Math.round(rawAiPercentage * 1.2));
  
  // Round to nearest 5% for a cleaner UI output
  aiPercentage = Math.round(aiPercentage / 5) * 5;

  const hasAi = aiPercentage >= 25;

  // Apply a proportionally scaled penalty based on the AI percentage.
  // 100% AI = 60 penalty points (forces Trust Score < 55)
  // 30% AI = 18 penalty points (allows genuine review to pass if rest is clean)
  if (hasAi) {
    const aiPenalty = Math.round(aiPercentage * 0.6);
    penalty += aiPenalty;
    reasons.push(`🧠 Evaluated as ${aiPercentage}% AI-generated (-${aiPenalty} pts)`);
  }

  // =================================================================
  //  FINAL SCORE
  // =================================================================

  // Start at 100, subtract penalties, clamp to 1-100
  const trustScore = Math.max(1, Math.min(100, 100 - penalty));
  const isFake = trustScore < 55;

  // If the review is clean, say so
  if (reasons.length === 0) {
    reasons.push("No red flags detected — review appears genuine");
  }

  return { trustScore, isFake, hasAi, aiPercentage, reasons };
}

// ---------------------------------------------------------------------------
// Message listener — bridge between content script ↔ analysis engine
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── Handle batch analysis request from content script ──
  if (message.type === "ANALYZE_REVIEWS") {
    const reviews = message.payload; // Array of { id, author, rating, text }

    // Analyze every review concurrently
    Promise.all(
      reviews.map(async (review) => {
        const verdict = await analyzeReview(
          review.author,
          review.rating,
          review.text
        );
        return { id: review.id, author: review.author, ...verdict };
      })
    )
      .then((results) => {
        sendResponse({ type: "ANALYSIS_RESULTS", payload: results });
      })
      .catch((err) => {
        console.error("[FRD Background] Analysis failed:", err);
        sendResponse({ type: "ANALYSIS_ERROR", error: err.message });
      });

    // Return true to indicate we will respond asynchronously
    return true;
  }

  // ── Handle scanner toggle state queries from the popup ──
  if (message.type === "GET_SCANNER_STATE") {
    chrome.storage.local.get({ scannerEnabled: true }, (data) => {
      sendResponse({ enabled: data.scannerEnabled });
    });
    return true;
  }

  if (message.type === "SET_SCANNER_STATE") {
    chrome.storage.local.set({ scannerEnabled: message.enabled }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log("[FRD Background] Service worker loaded.");
