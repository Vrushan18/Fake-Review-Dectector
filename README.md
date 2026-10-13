# Fake Review Detection System using Fine-Tuned RoBERTa-Base

An end-to-end Machine Learning and Natural Language Processing project for detecting computer-generated (CG) and deceptive fake reviews on e-commerce platforms in real time.

## 🌟 Highlights
- **Model:** Fine-Tuned **RoBERTa-Base** (12 Transformer Encoders, 144 Attention Heads, 125M parameters).
- **Backend:** High-performance **FastAPI** REST microservice (`/predict`, `/batch_predict`, `/health`).
- **Client:** Google Chrome Extension (**Manifest V3**) with real-time DOM scraping and badge injection for Amazon, Flipkart, and e-commerce websites.
- **Explainability:** 8-step neural inference walkthrough with gradient saliency attribution to highlight exactly which tokens triggered the verdict.

---

## 📁 Repository Structure
```
NLP PRJ/
├── colab_roberta_fine_tune.py                      # Google Colab fine-tuning script with 8-step explainability
├── Fine_Tuned_RoBERTa_Fake_Reviews.ipynb           # Interactive Jupyter / Colab Notebook
├── roberta_api.py                                  # Production FastAPI REST microservice
├── nlp_pipeline_visualizer.py                      # Pipeline evaluation & verification tool
├── fake_reviews_dataset.csv                        # Benchmark 40,432 Fake Review Dataset (OR vs CG)
│
├── fake-review-detector/                           # Manifest V3 Chrome Extension
│   ├── manifest.json                               # Extension manifest configuration
│   ├── background.js                               # Service worker handling batch API communication
│   ├── content.js                                  # DOM scraper & in-page badge injection
│   ├── content-styles.css                          # Real-time review badge overlay styles
│   ├── popup.html / popup.js / popup-styles.css    # Interactive extension popup UI
│   └── test-page.html                              # Offline test page for live extension testing
│
├── IEEE_Conference_Paper_RoBERTa_Official_Format.docx  # Full IEEE 2-column formatted research paper
├── How_The_RoBERTa_Model_Works.docx                # Deep technical document on RoBERTa architecture
├── Viva_Examination_Questions_And_Answers.docx     # Comprehensive Q&A defense guide for examiners
│
└── fig_*.png                                       # High-resolution (300 DPI) architecture & flowcharts:
    ├── fig_roberta_model_detailed_architecture.png # Neural layer architecture diagram
    ├── fig_roberta_model_tensor_flowchart.png      # Tensor forward-pass flowchart
    ├── fig_detailed_system_architecture.png        # 4-Tier full system architecture
    ├── fig_detailed_project_flowchart.png          # End-to-end execution flowchart
    ├── fig_roberta_confusion_matrix.png            # Model confusion matrix
    ├── fig_model_comparison_roberta.png            # Baseline comparison chart
    └── fig_extension_live_page_badges.png          # Chrome extension UI visualization
```

---

## 🚀 Quick Start

### 1. Run the FastAPI Backend
```bash
pip install torch transformers fastapi uvicorn pydantic
python roberta_api.py
```
Open interactive Swagger documentation at: `http://127.0.0.1:8000/docs`

### 2. Load the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `fake-review-detector` folder.
4. Open `fake-review-detector/test-page.html` or any Amazon/Flipkart product page to see real-time verification badges!

### 3. Fine-Tune in Google Colab
Open `Fine_Tuned_RoBERTa_Fake_Reviews.ipynb` or run `colab_roberta_fine_tune.py` in Google Colab with GPU acceleration (T4/V100).
