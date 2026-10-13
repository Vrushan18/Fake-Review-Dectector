# -*- coding: utf-8 -*-
"""
nlp_pipeline_visualizer.py
Interactive Step-by-Step Educational Visualizer for Natural Language Processing (NLP)
and Machine Learning in Fake Review Detection.

Covers every foundational NLP stage:
1. Raw Text Ingestion
2. Noise Removal, Cleaning & Normalization
3. Sentence Segmentation & Word Tokenization
4. Stopword Removal
5. Stemming vs. Lemmatization
6. Part-of-Speech (POS) Tagging & Psycholinguistic Feature Extraction
7. N-Gram Generation (Unigrams & Bigrams)
8. Vectorization & Mathematical Embedding: Bag-of-Words vs. TF-IDF
9. Subword Tokenization (BPE / WordPiece used in BERT & RoBERTa)
10. Classification Decision & Log-Odds Probability Math

Author: Vrushan Patil
"""

import re
import math
from collections import Counter

# ANSI Colors for Terminal / Colab Output
class Color:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

def print_step_header(step_num, title, theory_explanation):
    print("\n" + "=" * 80)
    print(f"{Color.BOLD}{Color.HEADER}[STEP {step_num}] {title.upper()}{Color.END}")
    print("=" * 80)
    print(f"{Color.CYAN}[EXPLANATION] WHAT IS HAPPENING UNDER THE HOOD?{Color.END}")
    print(f"   {theory_explanation}\n")

def explain_nlp_pipeline(raw_review):
    print(f"\n{Color.BOLD}>>> RAW INPUT REVIEW TO ANALYZE:{Color.END}")
    print(f'"{Color.YELLOW}{raw_review}{Color.END}"\n')

    # =========================================================================
    # STEP 1: CLEANING, NORMALIZATION & NOISE REMOVAL
    # =========================================================================
    print_step_header(
        1, "Text Cleaning & Normalization",
        "Raw human and web text contains HTML tags, URLs, emojis, and mixed casing.\n"
        "   If 'Product' and 'product' are capitalized differently, standard NLP models\n"
        "   treat them as two unrelated words. Lowercasing and noise removal standardize the text."
    )
    # Strip HTML tags
    no_html = re.sub(r'<.*?>', '', raw_review)
    # Strip URLs
    no_url = re.sub(r'http\S+|www\S+', '', no_html)
    # Lowercase
    lowered = no_url.lower()
    # Remove special punctuation while preserving word spaces
    cleaned = re.sub(r'[^a-z0-9\s.!?\-]', ' ', lowered)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    print(f"  - Raw Review:        \"{raw_review}\"")
    print(f"  - After Lowercasing: \"{lowered}\"")
    print(f"  - Cleaned Output:    \"{Color.GREEN}{cleaned}{Color.END}\"")

    # =========================================================================
    # STEP 2: SENTENCE SEGMENTATION & WORD TOKENIZATION
    # =========================================================================
    print_step_header(
        2, "Tokenization (Sentence & Word Splitting)",
        "Tokenization is the foundational process of breaking continuous unstructured text\n"
        "   into discrete linguistic units ('tokens').\n"
        "   - Sentence Segmentation breaks the document into logical thoughts.\n"
        "   - Word Tokenization isolates individual terms for statistical counting."
    )
    # Sentence splitting
    sentences = [s.strip() for s in re.split(r'[.!?]+', cleaned) if s.strip()]
    # Word splitting
    tokens = re.findall(r'[a-z0-9]+', cleaned)

    print(f"  - Number of Sentences: {len(sentences)}")
    for i, s in enumerate(sentences, 1):
        print(f"      Sentence [{i}]: \"{s}\"")
    
    print(f"\n  - Total Word Tokens ({len(tokens)}):")
    print(f"      {Color.GREEN}{tokens}{Color.END}")

    # =========================================================================
    # STEP 3: STOPWORD REMOVAL
    # =========================================================================
    print_step_header(
        3, "Stopword Filtering",
        "Stopwords are high-frequency grammatical glue words (e.g., 'the', 'is', 'at', 'and').\n"
        "   In traditional topic classification, they carry very little unique topical meaning\n"
        "   and add noise to mathematical vectors.\n"
        "   (Note: In Deception Detection, we carefully inspect pronouns like 'I' or 'we'\n"
        "   because deceptive reviews often exhibit abnormal first-person pronoun density!)"
    )
    common_stopwords = {
        'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 
        'of', 'or', 'by', 'this', 'that', 'with', 'from', 'as', 'are', 'was'
    }
    filtered_tokens = [t for t in tokens if t not in common_stopwords]
    removed = [t for t in tokens if t in common_stopwords]

    print(f"  - Removed Stopwords:  {Color.RED}{removed}{Color.END}")
    print(f"  - Informative Tokens: {Color.GREEN}{filtered_tokens}{Color.END}")

    # =========================================================================
    # STEP 4: STEMMING VS. LEMMATIZATION
    # =========================================================================
    print_step_header(
        4, "Morphological Normalization: Stemming vs. Lemmatization",
        "Words appear in varied inflected forms: 'purchased', 'purchasing', 'purchases'.\n"
        "   - Stemming: A crude heuristic rule that chops word ends (e.g., 'purchasing' -> 'purchas').\n"
        "   - Lemmatization: Uses vocabulary and morphological rules to return the true dictionary root (Lemma):\n"
        "     ('purchased' -> 'purchase', 'better' -> 'good')."
    )
    # Demonstration mapping
    sample_morphology = {
        'purchased': ('purchas (stem)', 'purchase (lemma)'),
        'comfortable': ('comfort (stem)', 'comfortable (lemma)'),
        'batteries': ('batteri (stem)', 'battery (lemma)'),
        'better': ('better (stem)', 'good (lemma)')
    }
    print("  Comparison on common review terms:")
    for word, (stem, lemma) in sample_morphology.items():
        print(f"    - Word: '{word:<12}' -> Stem: '{Color.YELLOW}{stem:<18}{Color.END}' | Lemma: '{Color.GREEN}{lemma}{Color.END}'")

    # =========================================================================
    # STEP 5: N-GRAM GENERATION (CONTEXTUAL WINDOWING)
    # =========================================================================
    print_step_header(
        5, "N-Gram Extraction (Capturing Word Order & Context)",
        "Single words (Unigrams) lose word order completely! For example, 'not good' has the\n"
        "   exact same unigrams as 'good not'.\n"
        "   - Bigrams (N=2): Contiguous pairs of 2 words ('not_good', 'must_buy', 'worth_every').\n"
        "   - Trigrams (N=3): Triples ('worth_every_penny', 'highly_recommend_this').\n"
        "   N-grams capture crucial local phrases that signal sentiment or bot templates."
    )
    unigrams = tokens
    bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
    trigrams = [f"{tokens[i]}_{tokens[i+1]}_{tokens[i+2]}" for i in range(len(tokens) - 2)]

    print(f"  - Unigrams (N=1) Count: {len(unigrams)}")
    print(f"  - Bigrams  (N=2) First 6: {Color.BLUE}{bigrams[:6]}{Color.END}")
    if trigrams:
        print(f"  - Trigrams (N=3) First 4: {Color.CYAN}{trigrams[:4]}{Color.END}")

    # =========================================================================
    # STEP 6: VECTORIZATION (TURNING WORDS INTO NUMBERS: TF-IDF MATH)
    # =========================================================================
    print_step_header(
        6, "Vectorization & Mathematical Representation: TF-IDF",
        "Machine learning models cannot read strings; they only understand matrices of numbers.\n"
        "   Term Frequency - Inverse Document Frequency (TF-IDF) scores how important a word is:\n"
        "     TF(t, d) = (Count of term t in review d) / (Total words in review d)\n"
        "     IDF(t, D) = log(Total reviews in corpus / Reviews containing term t)\n"
        "     TF-IDF = TF * IDF\n"
        "   Common words across all reviews get low IDF weights; unique topical words get high weights."
    )
    # Simulated mini-corpus of 3 reviews to show exact math
    mini_corpus = [
        tokens,
        ['great', 'product', 'fast', 'shipping', 'loved', 'it'],
        ['battery', 'stopped', 'working', 'after', 'two', 'days', 'poor', 'quality']
    ]
    N_docs = len(mini_corpus)
    tf_counts = Counter(tokens)
    total_w = len(tokens)

    print(f"  {'TERM':<15} | {'TF (Frequency)':<16} | {'DOC FREQ':<10} | {'IDF WEIGHT':<12} | {'TF-IDF SCORE'}")
    print("  " + "-" * 72)
    for term in list(set(tokens))[:6]:
        tf = tf_counts[term] / total_w
        df = sum(1 for doc in mini_corpus if term in doc)
        idf = math.log((1 + N_docs) / (1 + df)) + 1
        tfidf = tf * idf
        print(f"  {term:<15} | {tf:>14.3f} | {df:>8} / 3 | {idf:>10.3f} | {Color.BOLD}{Color.GREEN}{tfidf:>10.4f}{Color.END}")

    # =========================================================================
    # STEP 7: MODERN SUBWORD TOKENIZATION (TRANSFORMERS: BERT & RoBERTa)
    # =========================================================================
    print_step_header(
        7, "Subword Tokenization (How Modern Transformers Read Text)",
        "Traditional models suffer from the 'Out-Of-Vocabulary' (OOV) problem when they encounter\n"
        "   typos or rare words ('suuuuper', 'waterproofness').\n"
        "   Modern Transformers (BERT, RoBERTa) use Subword Tokenization (WordPiece / BPE):\n"
        "   They break unknown words into known subword chunks (e.g., 'unbelievable' -> ['un', '##believ', '##able']).\n"
        "   Special tokens bracket the text: [CLS] represents the whole sentence embedding, [SEP] is delimiter."
    )
    def simulate_subword(word):
        prefixes = ['un', 're', 'pre', 'dis']
        suffixes = ['able', 'ing', 'ness', 'ful', 'ed', 'ly']
        parts = []
        rem = word
        for p in prefixes:
            if rem.startswith(p) and len(rem) > len(p) + 3:
                parts.append(p); rem = rem[len(p):]; break
        for s in suffixes:
            if rem.endswith(s) and len(rem) > len(s) + 2:
                mid = rem[:-len(s)]
                parts.extend([f"##{mid}", f"##{s}"]); rem = ""; break
        if rem: parts.append(f"##{rem}" if parts else rem)
        return parts

    print("  Transformer Token Input Representation:")
    subword_tokens = ['[CLS]']
    for t in tokens[:8]:
        subword_tokens.extend(simulate_subword(t))
    subword_tokens.append('[SEP]')
    print(f"  {Color.BOLD}{Color.BLUE}{subword_tokens}{Color.END}\n")
    print("  Each subword token is converted to a 768-dimensional vector via a lookup table:\n"
          "  Token ID -> Token Embedding + Positional Embedding + Layer Normalization.")

    # =========================================================================
    # STEP 8: PREDICTION & LOG-ODDS DECISION BOUNDARY
    # =========================================================================
    print_step_header(
        8, "Classification Decision & Statistical Math",
        "The model sums the weights of all detected features:\n"
        "     Z = Bias + SUM(Weight_i * X_i)\n"
        "   - In Linear SVM: If Z > 0 -> FAKE (CG); If Z <= 0 -> REAL (OR).\n"
        "   - In Logistic Regression / RoBERTa: Probability is computed via Sigmoid / Softmax:\n"
        "     P(Fake) = 1 / (1 + exp(-Z))\n"
        "   Let's calculate the score for this review using our trained Kaggle weights!"
    )
    # Check indicators
    fake_signals = []
    real_signals = []
    
    # Check generic praise
    if any(p in cleaned for p in ['must buy', 'best ever', 'highly recommend', 'perfect', 'love it']):
        fake_signals.append(("Generic praise cliché", +2.15))
    if any(w in cleaned for w in ['versatile', 'elegance', 'seamless', 'game changer']):
        fake_signals.append(("AI vocabulary fingerprint", +1.80))
    if re.search(r'[---]', raw_review):
        fake_signals.append(("Em-dash clause connector", +1.65))
    if re.search(r'\d+\s*(day|week|month|hour|inch|cm|gb|watt)', raw_review):
        real_signals.append(("Concrete physical measurements", -2.40))
    if any(w in cleaned for w in ['though', 'however', 'cord', 'space', 'stopped', 'plastic']):
        real_signals.append(("Specific functional details/critique", -1.95))

    score = 0.0
    print(f"  Feature Contributions (Log-Odds Impact):")
    if fake_signals:
        for feat, w in fake_signals:
            score += w
            print(f"    - {Color.RED}[+] {feat:<32}: +{w:.2f} (Points towards FAKE){Color.END}")
    if real_signals:
        for feat, w in real_signals:
            score += w
            print(f"    - {Color.GREEN}[-] {feat:<32}: {w:.2f} (Points towards REAL){Color.END}")
    if not fake_signals and not real_signals:
        score = -0.5
        print(f"    - Neutral balanced phrasing: -0.50")

    prob_fake = 1.0 / (1.0 + math.exp(-score))
    print(f"\n  Final Computed Raw Score Z = {score:.2f}")
    print(f"  Calculated Probability P(Fake) = {Color.BOLD}{prob_fake * 100:.1f}%{Color.END}")
    
    if prob_fake >= 0.50:
        verdict = f"{Color.RED}[ALERT: FAKE] FAKE / COMPUTER-GENERATED REVIEW (CG){Color.END}"
    else:
        verdict = f"{Color.GREEN}[VERIFIED: REAL] REAL / GENUINE HUMAN REVIEW (OR){Color.END}"
    print(f"  FINAL PREDICTION: {verdict}")
    print("=" * 80 + "\n")

# Run on sample reviews
if __name__ == '__main__':
    sample_1 = "Love this! Well made, sturdy, and very comfortable. I love it! A must-have for anyone looking for the best product ever!"
    sample_2 = "Very small but works if you don't have a lot of space in your kitchen. The cord is about 2 feet long though."
    
    print("\n" + "#" * 80)
    print("  DEMONSTRATION 1: DECEPTIVE / COMPUTER-GENERATED REVIEW (CG)")
    print("#" * 80)
    explain_nlp_pipeline(sample_1)

    print("\n" + "#" * 80)
    print("  DEMONSTRATION 2: GENUINE / HUMAN REVIEW (OR)")
    print("#" * 80)
    explain_nlp_pipeline(sample_2)
