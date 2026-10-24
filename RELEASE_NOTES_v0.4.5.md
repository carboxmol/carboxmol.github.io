# Carbox & CarboxMol — Official Release Notes (v0.4.5)

**Release Version:** `v0.4.5`  
**Release Tag:** [`v0.4.5`](https://github.com/carbox/carbox/releases/tag/v0.4.5)  
**Release Date:** September 21, 2026  
**Authors:** Suleiman M Hajizadeh<sup>1,2*</sup>, Garib N Murshudov<sup>3</sup>  
**Affiliations:**  
- <sup>1</sup> *Institute of Molecular Biology, Ministry of Science and Education of the Republic of Azerbaijan, Baku AZ1073, Azerbaijan*  
- <sup>2</sup> *Western Caspian University, Baku AZ1001, Azerbaijan*  
- <sup>3</sup> *MRC Laboratory of Molecular Biology, Francis Crick Avenue, Cambridge CB2 0QH, United Kingdom*  
**Corresponding Author:** [team@carbox.org](mailto:team@carbox.org)  
**License:** [Mozilla Public License 2.0 (MPL-2.0)](file:///Users/macbookairm2/Documents/GitHub/Carbox/LICENSE)  
**Repository:** <https://github.com/carbox/carbox>  
**Downloads Hub:** <https://carbox.vercel.app/downloads.html>  

---

## 1. Executive Summary

Release **v0.4.5** marks a major milestone for the Carbox crystallographic platform, delivering full synchronous trilingual localization, Carbox Platform validation criteria integration across 7,230 atomic-resolution structures, an embedded native empirical $pK_a$ calculation engine, upgraded 3D viewport interaction ergonomics, upstream software license regularization, and production release distribution packages.

### Highlights at a Glance
- 🌐 **Full Synchronous Trilingual Localization (EN / AZ / HE):** 100% dictionary key parity across English, Azerbaijani, and Hebrew with bi-directional (`dir="rtl"`) layout and live cross-tab storage synchronization.
- 🔬 **Carbox Platform Validation & Full Tier 1 Dataset:** Integration of full-PDB Tier 1 validation across 7,230 atomic-resolution structures ($d_{\text{res}} \le 2.0\text{ \AA}$, $\text{occ} = 1.0$), auditing 929 carboxyl pairs and filtering out crystallographic artifacts.
- ⚡ **Empirical pKa Engine & pH Titration Curves:** Automated empirical $pK_a$ shift predictions and interactive pH titration curves ($0.0 \le \text{pH} \le 14.0$).
- 🎨 **Enhanced 3D Viewport Experience:** Dynamic contrast and depth fog focused on clicked atoms with ambient shadow attenuation, and 3-axis rotation pivot locked to target atom.
- 📜 **Upstream License Regularization:** Strict MPL-2.0 compliance, dual authorship attribution, standardized `CITATION.cff`, and exhaustive third-party notices.
- 📦 **Optimized Distribution Archives:** Decoupled runtime caches from distribution archives, producing a streamlined 2.7 MB `carbox` pipeline package alongside the comprehensive 479 MB `CarboxMol` universal workbench.

---

## 2. Official Release Packages & Checksums

All official v0.4.5 release distribution archives are available for direct download. Each archive has been cryptographically signed with SHA-256 checksums:

| Package | Version | File Name | Size | SHA-256 Checksum | Target Platform |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CarboxMol** | `0.4.5` | [`CarboxMol-0.4.5-Universal.tar.gz`](https://github.com/carbox/carbox/releases/download/v0.4.5/CarboxMol-0.4.5-Universal.tar.gz) | 479 MB | `ae5c30416b6be146cfd5ad621452cd6b202669db7e06933f4636d7dc4b101912` | macOS / Linux / Docker |
| **CarboxMol** | `0.4.5` | [`CarboxMol-0.4.5-Universal.zip`](https://github.com/carbox/carbox/releases/download/v0.4.5/CarboxMol-0.4.5-Universal.zip) | 494 MB | `ead2981490aff0f53091aa768aabca70a70b8397e7e94c8026d5f2a30d6b1fcd` | Windows / Universal |
| **Carbox** | `0.4.5` | [`carbox-0.4.5.tar.gz`](https://github.com/carbox/carbox/releases/download/v0.4.5/carbox-0.4.5.tar.gz) | 2.7 MB | `de5a9b1d9c444ef54463c3959ac48c49e23c586cb58eed9d7d187fcc4a20bb04` | Source tarball (Any OS) |
| **Carbox** | `0.4.5` | [`carbox-0.4.5.zip`](https://github.com/carbox/carbox/releases/download/v0.4.5/carbox-0.4.5.zip) | 3.3 MB | `f0a96c4e5a8b22c876c6654d726e5b3af1cce9eea20d067ed0c18b0cfecfa32c` | Source zip (Any OS) |

> 📁 **Local Distribution Paths:** Archives are stored locally in both `releases/`, `public/releases/`, `webapp/releases/`, and `dist/`.

---

## 3. What's New in v0.4.5

### 3.1. Synchronous Trilingual Localization (EN / AZ / HE)
- **100% Translation Parity:**
  - Analytics Dashboard (`dashboard.html` / `index.html`): 111 keys translated across EN, AZ, and HE.
  - 3D Molecular Studio (`studio.html` / `studio.js`): 199 keys translated across EN, AZ, and HE.
  - Downloads Portal (`downloads.html`): 6 exhaustive multi-lingual tables and instructions.
  - System Pages (`404.html`, `maintenance.html`): Full trilingual switcher with reactive navigation cards.
- **Bidirectional Hebrew Support:**
  - Dynamic `dir="rtl"` layout toggling for Hebrew (`he`).
  - Google Heebo font family integration with tailored line heights and letter spacing.
- **Cross-Tab Synchronous Updates:**
  - Seamless `localStorage` synchronization (`carbox_lang` and `carbox_doc_lang`) with active `window.addEventListener('storage', ...)` listeners. Changing the language in any view instantly updates all open tabs without reloading.

### 3.2. Carbox Platform Validation Standards & Full-PDB Tier 1 Data
- **High-Resolution Screening:**
  - Automated screening across 7,230 PDB crystal structures with resolution $d_{\text{res}} \le 2.0\text{ \AA}$ and full atomic occupancy ($\text{occ} = 1.0$).
  - Full audit of 929 anomalous carboxyl-carboxyl contacts.
- **Carbox Stereochemical & Density Criteria:**
  - Rigorous filtering of low-barrier hydrogen bond (LBHB) candidates ($d_{O\cdots O} \le 2.55\text{ \AA}$) based on local difference electron density ($F_o-F_c$), $B$-factor ratios, and coordination environment.
  - Rejection of false-positive metal artifacts (e.g. unmodeled $\text{Mg}^{2+}$, $\text{Ca}^{2+}$, $\text{Zn}^{2+}$, $\text{Na}^+$).
  - Integration of Tier 1 Golden Benchmarks into both the web dashboard and CLI pipeline.

### 3.3. Empirical pKa Prediction & pH Titration
- Built-in native implementation of the clean-room empirical $pK_a$ estimation framework in Carbox.
- Accurate prediction of perturbed $pK_a$ values for buried aspartate and glutamate pairs.
- Interactive visualization of Henderson-Hasselbalch protonation fractions over the physiological range $0.0 \le \text{pH} \le 14.0$.

### 3.4. 3D Viewport Interaction & Visual Experience
- **Atom-Locked 3-Axis Pivot:** Clicking on any atom centers and locks the 3D rotation pivot directly to that coordinate, eliminating camera drift during close inspection.
- **Contrast & Depth Fog:** Focal atom activation with adjustable contrast and depth fog sliders (default high, 100%) to isolate active site geometry from distant background atoms.
- **Dual-Color Highlighting:** Amber (`#f59e0b`) and rose (`#f43f5e`) highlighting for donor-acceptor dyads with live distance and angle readouts.

### 3.5. Upstream License Regularization & Academic Citations
- Regularized all upstream components under the Mozilla Public License 2.0 (MPL-2.0).
- Explicit authorship attribution: **Suleiman M Hajizadeh** and **Garib N Murshudov**.
- Standardized citation metadata in `CITATION.cff` and `carboxmol/CITATION.cff` (release date: September 21, 2026).
- Complete credit documentation in `CREDITS.md` and third-party license catalog in `THIRD_PARTY_LICENSES.md`.

### 3.6. Clean Release Architecture
- Segregated runtime download caches (`data/cif_cache` and `density_cache`) from core distribution packages.
- Streamlined `carbox-0.4.5` archive down to **2.7 MB**.
- Standardized release script `scripts/build_releases.py` with multi-target hardlinking for storage conservation.

---

## 4. Installation & Verification

### Quick Installation via pip
```bash
# Install directly from GitHub
pip install git+https://github.com/carbox/carbox.git

# Verify versions
carbox --version      # Returns: carbox 0.4.5
carboxmol --version   # Returns: CarboxMol 0.4.5
```

### Running Test Suite
```bash
pytest tests/ -v
# Output: 141 passed in 6.25s (100% PASS)
```

### Running Local Servers
```bash
# Start unified webapp and API server
python3 server.py --port 8080

# Access in browser:
# Dashboard: http://localhost:8080/dashboard.html
# 3D Studio: http://localhost:8080/studio.html
# Downloads: http://localhost:8080/downloads.html
# Documentation: http://localhost:8080/docs.html
```

---

## 5. Verification & Quality Assurance Summary

| Metric | Result | Status |
| :--- | :--- | :--- |
| **Unit Tests** | 141 passed / 141 total | ✅ 100% PASS |
| **JavaScript Syntax** | `studio.js`, `app.js`, `structures.js` | ✅ Clean (0 errors) |
| **Webapp / Public Parity** | `diff -rq webapp public` | ✅ 0 drift |
| **Documentation Sync** | `docs/index.html`, `webapp/docs.html`, `public/docs.html` | ✅ Compiled & Synchronized |
| **Archive Integrity** | All 4 release archives created & verified | ✅ Verified (SHA-256 matched) |
