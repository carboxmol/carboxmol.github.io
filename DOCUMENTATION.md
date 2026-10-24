# Carbox — Master Documentation & Project Guide

> **Structural Identification of Anomalous Carboxyl Protonation States, Low-Barrier Hydrogen Bonds, and Microenvironment Dielectric Shielding in High-Resolution Protein Crystal Structures**  
> **Authors:** Carbox Architecture Team¹* & Carbox Platform²  
> ¹*Institute of Molecular Biology, Ministry of Science and Education of the Republic of Azerbaijan, Baku; Western Caspian University*  
> ²*MRC Laboratory of Molecular Biology, Cambridge, United Kingdom*  
> \**Corresponding author: [team@carbox.org](mailto:team@carbox.org)*

---

## 1. Executive Summary & Ecosystem Architecture

The **Carbox** research platform provides an integrated suite for high-resolution macromolecular crystallography:

1. **`Carbox` (`carbox/`)** — High-Throughput Scientific Computational Biology Library & Screening Pipeline:
   - Automated screening and identification of anomalous carboxyl–carboxyl contacts ($d \le 3.20\,\text{Å}$) and Low-Barrier Hydrogen Bonds (LBHB, $d \le 2.55\,\text{Å}$).
   - Water dielectric screening, metal coordination false-positive filtering, and pKa shift estimation.
   - Crystallographic external restraint generation and explicit protonation state modelling.
   - Standalone, fully importable Python library (`import carbox`) and command-line utility (`carbox`).

2. **`CarboxMol` (`carboxmol/` & `webapp/`)** — Universal 3D Macromolecular Crystallography Workbench:
   - **Multi-OS Distribution**: Packaged and downloadable for every operating system (macOS, Linux, Windows, Docker).
   - **Web Studio**: Instant, zero-install browser-based 3D structure studio (`studio.html`) and analytical dashboard.
   - **Command-Line Interface**: Terminal-callable via `carboxmol` (e.g., `carboxmol`, `carboxmol 4LGN`, `carboxmol studio`, `carboxmol validate`, `carboxmol refine`).
   - Native `.CXL` (Carbox Crystallographic Language) macro automation and real-space refinement engine.
   - Automated multi-chain sequence ribbon, real-time electron density streaming, and binding pocket telemetry.

3. **`wiki/` LLM Knowledge Base** — 34-page Obsidian vault for persistent scientific documentation.

---

## 2. Scientific Foundation

### Distance Classification (O···O)

| Category | Distance | Water Distance | Scientific Interpretation |
|----------|----------|----------------|---------------------------|
| **Normal** | $d > 3.20\,\text{Å}$ | — | Deprotonated ($\text{COO}^-$), electrostatic repulsion |
| **Short H-Bond** | $2.55 < d \le 3.20\,\text{Å}$ | $d_{\text{water}} > 3.0\,\text{Å}$ | Buried protonated carboxyl |
| **Ultra-Short LBHB** | $d \le 2.55\,\text{Å}$ | $d_{\text{water}} > 3.0\,\text{Å}$ | Low-Barrier Hydrogen Bond, shared-proton character |
| **Solvent-Exposed** | $d \le 3.20\,\text{Å}$ | $d_{\text{water}} \le 3.0\,\text{Å}$ | Possibly protonated, solvated microenvironment |

### Screening Criteria

- **Resolution:** $R_{\text{cryst}} \le 2.0\,\text{Å}$ (X-ray diffraction only)
- **Full Occupancy:** $\text{occ} \ge 1.0$ (eliminates partial disorder)
- **Metal Screening:** Automatic elimination of false-positives from Zn, Mg, Ca, Fe, Cu coordination spheres

---

## 3. Benchmark Survey (2,500 PDB Structures)

| Protonation Verdict | Count | Percentage |
|---------------------|-------|------------|
| **Total Clean Candidates** ($d \le 3.20\,\text{Å}$) | **929** | **100.0%** |
| — Buried LBHB | 543 | 58.5% |
| — Buried Short H-Bond | 307 | 33.0% |
| — Solvent-Exposed | 79 | 8.5% |

**Pair type distribution:** Asp–Glu 53.5% > Asp–Asp 35.2% > Glu–Glu 11.3%

---

## 4. Complete Repository File Map

```text
Carbox/
├── DOCUMENTATION.md           # This master guide
├── README.md                  # Repository landing page & quickstart
├── CHANGELOG.md               # Semantic version history
├── LICENSE                    # MPL 2.0
├── pyproject.toml             # Packaging config
├── vercel.json                # Vercel static deployment routing
├── Dockerfile / docker-compose.yml  # Container deployment
├── package.json               # Node.js assets
│
├── carbox/                # Python Analysis Pipeline
│   ├── analysis/
│   │   ├── analyze.py         # Single-pass O(N) O···O distance screening
│   │   └── ligands.py         # HETATM ligand carboxylate screening
│   ├── density/
│   │   └── map_analyzer.py    # Carbox electron density sampling, Gaussian density profiles
│   ├── refine/
│   │   ├── runner.py          # Crystallographic refinement orchestration
│   │   └── refinement_engine.py  # Carbox Refinement Engine (MX/SPA/hydrogen/omit-map)
│   ├── validation/
│   │   └── metal_coordination.py  # Metal false-positive elimination
│   ├── cli/
│   │   └── cli.py             # survey, analyze, plot, pdblist, guidelines, ligands
│   ├── data/
│   │   └── constants.py       # MAX_OO=3.20Å, LBHB=2.55Å, BURIAL=3.00Å
│   ├── pdb/
│   │   └── fetch.py           # RCSB PDB Search API v2 + mmCIF downloader
│   ├── service/
│   │   ├── api.py             # analyze_pdb(), to_dataframe(), to_json(), to_restraints()
│   │   └── ai_assistant.py    # EuropePMC literature search + AI synthesis
│   ├── plots/
│   │   └── plot.py            # Matplotlib/Seaborn PNG 300 DPI + PDF
│   ├── cif/
│   │   └── parser.py          # High-speed CIF parser
│   ├── load/
│   │   └── loader.py          # Local dataset & CIF loader
│   ├── correspondence/
│   │   └── matcher.py         # Residue index matcher
│   └── integrations/
│       └── exporters.py       # CarboxMol bridge: CXL macros, HTML reports, restraints
│
├── carboxmol/                 # Universal 3D Molecular Workbench (Desktop / Web / CLI)
│   ├── src/bundles/           # 100+ plugin bundles (atomic, graphics, map, hbonds ...)
│   ├── analysis/              # Structure analysis APIs
│   ├── restraints/            # ExternalRestraints, ProtonationRestraints
│   ├── scripting/             # CXL scripting engine, MacroGenerator, HTMLReportGenerator
│   ├── io/                    # CXLIO session file I/O
│   ├── session/               # Session state management
│   ├── geometry/              # Kabsch, Ramachandran, rotamers
│   ├── density/               # Electron density map reading
│   ├── metal/                 # Metal coordination geometry
│   └── deprecated/            # Legacy refinement scripts (reference)
│
├── tests/                     # 87 unit tests across 14 test files
│   ├── test_carboxmol_engine.py
│   ├── test_carboxmol_geometry_suite.py
│   ├── test_carboxmol_ideal_refinement.py
│   ├── test_carboxmol_io_suite.py
│   ├── test_carboxmol_macro.py
│   ├── test_carboxmol_metal_suite.py
│   ├── test_carboxmol_pli_suite.py
│   ├── test_carboxmol_restraints_refine.py
│   ├── test_carboxmol_scripting_bridge.py
│   ├── test_core.py
│   ├── test_cxl_and_metal.py
│   ├── test_gemmi_density.py
│   ├── test_ligand_interactions.py
│   └── test_refinement_engine.py
│
├── webapp/                    # Interactive Web Dashboard
│   ├── studio.html / studio.js / studio.css   # 3D Microenvironment Studio
│   ├── dashboard.html / app.js / styles.css   # Analytics & search dashboard
│   ├── data.json / data.js                    # 6,759-record Tier 1 dataset payload
│   ├── structures.js                          # Pre-cached mmCIF coordinates
│   └── libs/                                  # WebGL engines, Chart.js
│
├── paper/                     # LaTeX manuscript sources
│   ├── Carbox_Article.tex
│   ├── Pipeline_Documentation.tex
│   └── WebApp_Architecture.tex
│
├── data/                      # Data files
│   ├── pka_shift_anomalies.csv
│   └── density_cache/         # Cached electron density maps (2Fo-Fc, Fo-Fc)
│
├── tutorials/                 # User tutorials
│   ├── tutorial.md
│   └── tutorial.rst
│
└── wiki/                      # LLM Knowledge Base (34 interlinked Obsidian notes)
    ├── SCHEMA.md
    ├── index.md
    ├── log.md
    ├── raw/data/carbox_929records.csv
    └── pages/
        ├── concepts/ (6 pages)
        ├── entities/ (20 pages)
        ├── sources/  (3 pages)
        └── topics/   (3 pages)
```

---

## 5. How to Run

### Install & CLI

```bash
git clone https://github.com/carbox/carbox.git
cd Carbox
pip install -e .

carbox survey --limit 2500 --resolution 2.0 --output results.csv
carbox analyze -p 3X2M
carbox ligands -p 3X2M
carbox plot --input data/pka_shift_anomalies.csv --out-dir figures/ --dpi 300
```

### Web Dashboard

```bash
cd webapp && python3 -m http.server 8050
# Open http://localhost:8050
```

### Tests

```bash
python3 -m pytest -v    # 87 tests, all passing
```

### CarboxMol Universal 3D Molecular Workbench

Carbox is the scientific computational biology library, and CarboxMol is the universal cross-platform 3D macromolecular workbench available for every operating system (macOS, Windows, Linux), runnable in the web browser, and callable via CLI (`carboxmol`).

```bash
# Launch interactive 3D workbench in browser (blank clean state ready for PDB input)
carboxmol

# Launch workbench preloading specific structure
carboxmol 4LGN

# Or run stereochemical validation
carboxmol validate 4LGN
```

---

## 6. Obsidian LLM Wiki Setup

1. Open [Obsidian](https://obsidian.md/) → **"Open folder as vault"**
2. Select **`wiki/`** folder inside `Carbox/`
3. Press **`Cmd+G`** for graph view — see all 34 notes connected by wikilinks

---

## 7. Document Index

| Document | Path | Purpose |
|----------|------|---------|
| **Master Guide** | [DOCUMENTATION.md](file:///Users/macbookairm2/Documents/GitHub/Carbox/DOCUMENTATION.md) | This document |
| **README** | [README.md](file:///Users/macbookairm2/Documents/GitHub/Carbox/README.md) | Quick-start |
| **Tutorial** | [tutorials/tutorial.md](file:///Users/macbookairm2/Documents/GitHub/Carbox/tutorials/tutorial.md) | Step-by-step walkthrough |
| **Wiki Index** | [wiki/index.md](file:///Users/macbookairm2/Documents/GitHub/Carbox/wiki/index.md) | 34-page knowledge base catalog |
| **Obsidian Guide** | [wiki/pages/topics/obsidian-llm-wiki-guide.md](file:///Users/macbookairm2/Documents/GitHub/Carbox/wiki/pages/topics/obsidian-llm-wiki-guide.md) | Obsidian vault & LLM Wiki guide |
| **Changelog** | [CHANGELOG.md](file:///Users/macbookairm2/Documents/GitHub/Carbox/CHANGELOG.md) | Version history |
