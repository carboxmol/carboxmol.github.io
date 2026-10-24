# CarboxMol and Carbox — Release Notes (v0.4.5)

**Release Date:** September 21, 2026  
**Authors:** Carbox & CarboxMol Engineering Group  
**Affiliations:** Institute of Molecular Biology and Biotechnologies, Baku; MRC Laboratory of Molecular Biology, Cambridge, UK  
**Repository:** <https://github.com/carbox/carbox>  
**Downloads Hub:** <https://carbox.vercel.app/downloads.html>  

> 🚀 **Official v0.4.5 Release Notes:** For the standalone v0.4.5 release notes with full change manifest, SHA-256 checksums, and direct package links, see [RELEASE_NOTES_v0.4.5.md](RELEASE_NOTES_v0.4.5.md).

---

## 1. Overview and Architecture

Version 0.4.5 delivers a decoupled architecture separating the analytical data-mining framework (**Carbox**) from the interactive crystallographic modeling and visualization environment (**CarboxMol**). Both packages adhere to established crystallographic software design patterns implemented in modern macromolecular crystallographic suites.

* **CarboxMol (`carboxmol`)**: Standalone macromolecular crystallography workbench, native PyQt6 desktop application, WebGL renderer, `.cxl` macro interpreter, tri-color electron density map engine ($2F_o-F_c$, $\pm F_o-F_c$), and analytical geometry toolkit.
* **Carbox (`carbox`)**: High-throughput analysis engine for screening anomalous carboxyl-carboxyl interactions, estimating $pK_a$ shifts and dielectric shielding, detecting metal coordination artifacts, and exporting geometry restraints for refinement.
* **Distribution Hub (`downloads.html`)**: Standalone multi-platform distribution center providing pre-packaged source archives, cross-platform installation instructions, and synchronous trilingual interface localization (English, Azerbaijani, Hebrew).

---

## 2. Core Modules and Scientific Functionality

### 2.1. Crystallographic Core (`carboxmol.core`)

* **Atomic and Residue Data Structures (`structure.py`)**: Formal object models for `Atom`, `Residue`, `Structure`, and `ResidueSpec` handling Cartesian coordinates, isotropic temperature factors ($B$-factors), occupancies, and alternate conformations.
* **Analytical Geometry (`geometry.py`)**: Pure-Python implementations for coordinate transformations, Kabsch structural superposition, root-mean-square deviation (RMSD), moments of inertia tensor calculation, bounding box derivation, and vector-based bond angle and dihedral calculations.
* **Selection Algebra (`selection.py`)**: Query evaluator supporting standard selection syntax:
  * Chain identification: `chain A`
  * Residue numbering and ranges: `resi 25 to 50`, `resi 25-50`
  * Residue naming: `resn ASP,GLU`
  * Atom naming and elements: `name OD1,OD2`, `element O`
  * Chemical groups: `carboxyl`, `backbone`, `sidechain`
  * Temperature factor thresholds: `b_factor < 30.0`
  * Specific residue designators: `ASP:A:25`, `A:25`, `ASP25`
* **Conformational Analysis (`ramachandran.py`)**: Backbone torsion angle calculations ($\phi, \psi$) with validation against favored, allowed, and outlier conformational regions.

### 2.2. Modeling and Energetics (`carboxmol.modeling`)

* **Protonation Modeler (`protonation.py`)**: Placement of shared protons in low-barrier hydrogen bonds (LBHBs, $d_{O\cdots O} \le 2.55\text{ \AA}$) and standard protonated states (neutral aspartate `ASH`, neutral glutamate `GLH`).
* **Sidechain Rotamer Distributions (`rotamers.py`)**: Dunbrack backbone-dependent rotamer evaluation for aspartate and glutamate sidechains, computing $\chi_1$ and $\chi_2$ dihedral angles.
* **Hydrogen Bond Graph Networks (`hbond_network.py`)**: Graph-based path detection for catalytic dyads ($\text{Asp-Asp}$, $\text{Glu-Glu}$, $\text{Asp-Glu}$) and catalytic triads ($\text{Asp/Glu} \rightarrow \text{His} \rightarrow \text{Ser/Cys/Thr}$).
* **Metal Coordination Validation (`metal.py`)**: Detection and spatial validation of divalent and monovalent metal ions ($\text{Mg}^{2+}, \text{Ca}^{2+}, \text{Zn}^{2+}, \text{Mn}^{2+}, \text{Fe}^{2+/3+}, \text{Na}^+, \text{K}^+$) coordinating carboxylate oxygens, distinguishing true hydrogen-bonded pairs from metal-bridged arrangements.

### 2.3. Electron Density Analysis (`carboxmol.density`)

* **CCP4 / MRC Map Parser (`map_parser.py`)**: Binary map header decoder extracting unit cell parameters, space group symmetry, sampling intervals, and voxel matrices.
* **Local Density Carving (`carving.py`)**: Atom-centric and pocket-centric density carving algorithms ($3.5\text{ \AA} - 4.5\text{ \AA}$ sphere), isolating local electron density around target residues.
* **Difference Density Evaluation (`difference_peaks.py`)**: Residual difference peak search in $F_o-F_c$ maps, identifying crystallographic model errors and unmodeled proton positions.
* **Density Profile Sampling (`profiler.py`)**: Linear 1D electron density sampling along the inter-oxygen vector.

### 2.4. Crystallographic Macro System (`carboxmol.macro`)

* **CXL Standard Specification**: Human-readable, reproducible macro language for scripting crystallographic workflows in CarboxMol:

  ```text
  load_structure 4LGN --source=pdbe --type=cif
  set_view_preset crystallographic_native
  density_map 2fofc --sigma=1.0 --scope=pocket
  density_map fofc_positive --sigma=3.0 --scope=pocket
  density_map fofc_negative --sigma=-3.0 --scope=pocket
  select_pair site_1 --res1=ASP:A:25 --res2=GLU:A:49
  model_protonation_state --state=ash --target=ASP:A:25
  measure_distance ASP:A:25:OD1 GLU:A:49:OE1
  ```

* Direct syntax validation (`validate_cxl_script`), JSON serialization, and batch execution support.

### 2.5. Native Desktop GUI (`carboxmol.gui`)

* Native desktop interface constructed using PyQt6.
* Embedded WebGL rendering canvas with hardware-accelerated 3D graphics.
* Standard menu hierarchy (`File`, `View`, `Density`, `Modeling`, `Macro`, `Help`) with hotkey bindings.
* Integrated dockable `.CXL` command shell for real-time directive input.

---

## 3. High-Throughput Survey Pipeline (`carbox`)

* **Structure Ingestion**: Automated retrieval and parsing of mmCIF and PDB files from RCSB PDB, PDBe, and AlphaFold DB.
* **Distance Scanning**: High-precision filtering of inter-oxygen distances ($d_{O\cdots O} \le 3.60\text{ \AA}$) across carboxylate sidechains.
* **Dielectric and Water Burial Assessment**: Solvent-accessible surface area and proximity to crystallographic water molecules ($d_w$), categorizing pairs into buried low-dielectric ($\varepsilon \approx 2-4$) or solvent-exposed environments.
* **Refinement Integration (`carbox.refine`)**: Automated generation of `MODRES` directives and `EXTERNAL DISTANCE` restraints for Carbox refinement workflows (with native REFMAC5 and Servalcat compatibility).
* **Ligand Interaction Screening (`carbox.analysis.ligands`)**: Evaluation of small-molecule ligands (HETATM) interacting with protein carboxyl groups.
* **AI Research Assistant (`carbox.service.ai_assistant`)**: Structured literature queries integrating EuropePMC, PubMed, and arXiv APIs for contextual biochemical bibliography retrieval.

---

## 4. Web Application and Visualization (`webapp/`)

* **CarboxMol Studio (`studio.html`, `studio.js`)**: Interactive 3D WebGL protein workbench with dual-color pair highlighting (amber `#f59e0b` and rose `#f43f5e`), 3D distance and angle measurements, and real-time density map contouring.
* **Carbox Portal (`app.html`, `app.js`)**: Research analytics dashboard with tabular inspection, filtering, and cross-dataset charting.
* **Multi-Threaded Server (`server.py`)**: `socketserver.ThreadingTCPServer` implementation with transparent URL routing, CORS management, and stream proxying for binary map files.

---

## 5. Verification and Quality Assurance

The test suite contains 141 automated test cases covering core data models, geometry, selection algebra, electron density profiling, macro parsing, and refinement integration:

```bash
pytest tests/ -v
node --check webapp/studio.js webapp/structures.js webapp/app.js
python3 scripts/build_releases.py
```

All 141 tests pass with 100% success rate across Python 3.9 through 3.14.

---

## 6. Distribution Packages & Checksums

| Package | Version | Tarball Archive (.tar.gz) | Zip Archive (.zip) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **CarboxMol** | `0.4.5` | [`CarboxMol-0.4.5-Universal.tar.gz`](https://github.com/carbox/carbox/releases/download/v0.4.5/CarboxMol-0.4.5-Universal.tar.gz) *(479 MB)*<br>`SHA-256: ae5c30416b6be146cfd5ad621452cd6b202669db7e06933f4636d7dc4b101912` | [`CarboxMol-0.4.5-Universal.zip`](https://github.com/carbox/carbox/releases/download/v0.4.5/CarboxMol-0.4.5-Universal.zip) *(494 MB)*<br>`SHA-256: ead2981490aff0f53091aa768aabca70a70b8397e7e94c8026d5f2a30d6b1fcd` | 3D Workbench, PyQt6 Desktop Application, Crystallography Engine, `.cxl` Suite |
| **Carbox** | `0.4.5` | [`carbox-0.4.5.tar.gz`](https://github.com/carbox/carbox/releases/download/v0.4.5/carbox-0.4.5.tar.gz) *(2.7 MB)*<br>`SHA-256: de5a9b1d9c444ef54463c3959ac48c49e23c586cb58eed9d7d187fcc4a20bb04` | [`carbox-0.4.5.zip`](https://github.com/carbox/carbox/releases/download/v0.4.5/carbox-0.4.5.zip) *(3.3 MB)*<br>`SHA-256: f0a96c4e5a8b22c876c6654d726e5b3af1cce9eea20d067ed0c18b0cfecfa32c` | High-Throughput Survey Pipeline and Benchmark Dataset |

Distribution archives are located in `releases/`, `dist/`, and `public/releases/`, and can be downloaded from the [Downloads Hub](https://carbox.vercel.app/downloads.html). For standalone release documentation, refer to [RELEASE_NOTES_v0.4.5.md](RELEASE_NOTES_v0.4.5.md).
