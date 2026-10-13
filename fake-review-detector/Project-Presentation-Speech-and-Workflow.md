# Fake Review Detector: Presentation & Workflow Document

---

## Part 1: Presentation Speech Script
*Use this script as your guide when explaining or demoing the project to your professor. The bracketed text provides cues for what to show on screen.*

**Introduction:**
"Good morning/afternoon, Professor. Today I will be presenting my project: a real-time Fake Review Detector Chrome Extension. 

The core problem this project solves is the massive influx of fake reviews on e-commerce platforms. While traditional spam has always been an issue, the rise of Large Language Models like ChatGPT has completely changed the landscape. Spam farms can now generate thousands of grammatically perfect, highly detailed fake reviews in seconds. It has become incredibly difficult for everyday consumers to distinguish real experiences from bot-generated text.

**The Solution:**
To solve this, I built a lightweight, privacy-focused Chrome Extension that operates entirely on-device. Instead of relying on a slow external server, the extension uses a sophisticated 18-point heuristic engine written in JavaScript to analyze reviews instantly as the user scrolls.

*[Cue: Open a product page on Amazon or Myntra and turn on the extension]*

**How it Works (The Demo):**
As you can see here on the page, the extension intercepts the reviews and injects a subtle badge directly into the website's interface. 

What makes this project unique is how it categorizes anomalies. It doesn’t just label things as 'Fake'. It calculates a Trust Score from 1 to 100 based on linguistic red flags.

*[Cue: Hover over a 'Suspicious' or 'AI Generated' badge to show the tooltip]*

If we hover over a flagged review, the extension provides explainable AI. It lists the exact reasons it penalized the score—whether that's an overuse of ALL CAPS, repetitive characters, or a lack of specific product details.

**The AI-Detection Engine:**
The most advanced part of this project is the AI Detection Engine. I noticed that LLMs have very specific 'fingerprints' when writing product reviews. They overuse em-dashes, they use formulaic openings like *'I recently purchased this'*, and they use distinct vocabulary like *'versatile'* and *'elegance'*. They also love balanced hedging, like *'not too tight, but not too loose'*. 

My engine detects these tokens. But more importantly, it uses a **Token-Density Algorithm**. It calculates the exact percentage of the review that consists of AI phrasing. 

*[Cue: Open the extension popup to show the neumorphic dashboard]*

Because of this token-density math, the extension can bifurcate—or separate—reviews into different categories. If a review is 100% AI, it gets a massive penalty, is marked as Suspicious, and gets a dark purple badge. But if a genuine user just used Grammarly or ChatGPT to lightly polish their grammar, it might score as 30% AI. The extension recognizes this, doesn't destroy the Trust Score, and instead flags it safely as 'AI Assisted'. 

Overall, this project successfully combines DOM manipulation, service workers, and heuristic natural language processing into a tool that directly protects consumers."

---

## Part 2: Technical Workflow (How it Works Under the Hood)
*You can use this section for your written report, or to answer technical questions from your professor.*

The extension relies on a modern Manifest V3 architecture, utilizing three core interconnected components: a Content Script, a Background Service Worker, and a Popup Dashboard.

### Step 1: DOM Extraction & Universal Discovery (`content.js`)
When the user loads a webpage, the extension needs to find the reviews. Because every e-commerce site is coded differently, the extension uses a **Three-Tier Extraction Strategy**:
1. **Site-Specific Profiles:** It checks the URL. If it's Amazon, Myntra, Flipkart, etc., it uses highly optimized CSS selectors specifically mapped to that site's DOM structure.
2. **Generic Selectors:** If the site isn't explicitly supported, it looks for common web-development class names (e.g., `.review-text`, `.author-name`).
3. **Universal DOM Walker:** As a final fallback, it scans the entire page for anything resembling a 'star rating'. It then mathematically traverses up the DOM tree to find the nearest text block and author name. 
*Result:* The extension can extract reviews from virtually any e-commerce site on the internet without needing a custom API.

### Step 2: Asynchronous Message Passing
Because complex text analysis can freeze the user's browser if done on the main webpage, the Content Script packages the extracted reviews and sends them securely via `chrome.runtime.sendMessage` to the Background Script.

### Step 3: The 18-Point Heuristic Engine (`background.js`)
The Background Service Worker acts as the 'brain' of the extension. It runs the text through 18 distinct algorithmic checks across two main sections:

*   **Section A: Traditional Spam Detection**
    *   Checks for ALL CAPS shouting, excessive punctuation (???), repeated characters (looooove), emoji spam, and extreme ratings (1-star or 5-star) that lack any text explanation.
*   **Section B: AI-Generation Token Density**
    *   The engine looks for LLM fingerprints: formulaic closings (*"overall, I would highly recommend"*), participial chains (*"making it perfect for..."*), and AI vocabulary (*exudes, impeccable, testament to*).
    *   Every time it finds a fingerprint, it adds "AI Tokens". It then divides the total tokens by the word count to calculate an exact **AI Percentage**.
*   **Scoring:** Every triggered heuristic subtracts points from a base score of 100. If the final Trust Score falls below 55, it is flagged as Fake/Suspicious.

### Step 4: UI Injection & State Management
Once the background engine finishes scoring, it returns the payload to the webpage.
*   **Webpage Badging:** The content script locates the exact HTML element of the author and safely injects a custom-styled pill badge (`✓ Verified`, `⚠ Suspicious`, `🤖 100% AI`). It adds an anti-duplication lock (`dataset.frdBadged`) to ensure React/SPA dynamic loading doesn't cause duplicate badges.
*   **Neumorphic Dashboard (`popup.js`):** The data is simultaneously saved to `chrome.storage.local`. The user's popup dashboard listens for these storage changes in real-time (`chrome.storage.onChanged`) and instantly updates its neumorphic UI counters and flagged review lists without needing a page refresh.
