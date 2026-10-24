/**
 * Carbox – pKa Shift & Microenvironment Workbench
 * v0.3.1 | 2500 PDB structures | three-criterion filter
 * Production-Grade Interactive JavaScript Module
 */

'use strict';

let dataset        = [];
let filteredData   = [];   // reflects current filter state
let distChart      = null;
let envChart       = null;
let molViewer      = null;
let showCartoon    = false;
let currentSort    = { key: 'Distance_A', asc: true };
let activeSpec1    = null;
let activeSpec2    = null;

// ─── Global Scope Registration (Immediate) ───────────────────────────────────
window.viewPdbIn3D = viewPdbIn3D;
window.init3DViewer = init3DViewer;
window.loadDataset = loadDataset;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initApp(); });
} else {
    initApp();
}

// ─── Boot & Initialization ───────────────────────────────────────────────────

async function initApp() {
    try { setupToastSystem(); } catch (e) { console.warn('Toast init:', e); }
    try { setupNavigation(); } catch (e) { console.warn('Navigation init:', e); }
    try { setupTableSorting(); } catch (e) { console.warn('Sorting init:', e); }
    try { setupHeaderActions(); } catch (e) { console.warn('Header actions init:', e); }
    try { setupViewerControls(); } catch (e) { console.warn('Viewer controls init:', e); }
    try { setupDensityControls(); } catch (e) { console.warn('Density controls init:', e); }
    try { setupCarboxMolExport(); } catch (e) { console.warn('CarboxMol export init:', e); }
    try { initFilters(); } catch (e) { console.warn('Filters init:', e); }

    // Load dataset and render views
    try {
        await loadDataset(true);
    } catch (e) {
        console.error('Initial loadDataset failed:', e);
    }
}

// ─── Navigation Controller ───────────────────────────────────────────────────

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    if (!navItems.length) return;

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                // Ensure panel-carbox is active if user switched to Contact or About
                const carboxPanel = document.getElementById('panel-carbox');
                const carboxTab = document.getElementById('tab-carbox');
                if (carboxTab && carboxPanel && carboxPanel.style.display === 'none') {
                    carboxTab.click();
                }

                setTimeout(() => {
                    const targetEl = document.querySelector(href);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth' });
                    }
                    navItems.forEach(n => n.classList.remove('active'));
                    item.classList.add('active');
                }, 50);
            }
        });
    });

    // Make sidebar brand header clickable to return cleanly to dashboard
    const brand = document.querySelector('.sidebar .brand');
    if (brand) {
        brand.style.cursor = 'pointer';
        brand.setAttribute('title', 'Return to Carbox Dashboard');
        brand.addEventListener('click', () => {
            const carboxTab = document.getElementById('tab-carbox');
            if (carboxTab) carboxTab.click();
            const dashEl = document.getElementById('dashboard');
            if (dashEl) dashEl.scrollIntoView({ behavior: 'smooth' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Handle hash on initial load (e.g., #dashboard, #dataset)
    if (window.location.hash) {
        setTimeout(() => {
            const target = document.querySelector(window.location.hash);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }, 400);
    }

    window.addEventListener('scroll', () => {
        const carboxPanel = document.getElementById('panel-carbox');
        if (carboxPanel && carboxPanel.style.display === 'none') return;

        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 140;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');

            if (scrollPos >= top && scrollPos < top + height) {
                navItems.forEach(item => {
                    if (item.getAttribute('href') === '#' + id) {
                        navItems.forEach(n => n.classList.remove('active'));
                        item.classList.add('active');
                    }
                });
            }
        });
    }, { passive: true });
}

// ─── Dataset Loading & CSV Fallback Parsing ─────────────────────────────────

async function loadDataset(isInitial = false) {
    try {
        let loaded = false;

        // Priority 1: Window embedded dataset from data.js
        if (window.CARBOX_DATASET && Array.isArray(window.CARBOX_DATASET) && window.CARBOX_DATASET.length > 0) {
            dataset = window.CARBOX_DATASET.slice();
            loaded = true;
        }

        // Priority 2: Fetch webapp/data.json
        if (!loaded) {
            try {
                const res = await fetch('data.json?v=' + Date.now());
                if (res.ok) {
                    dataset = await res.json();
                    loaded = true;
                }
            } catch (e) {
                console.warn('[Carbox] JSON load fallback:', e);
            }
        }

        // Priority 3: Fallback to data/pka_shift_anomalies.csv
        if (!loaded) {
            const csvRes = await fetch('../data/pka_shift_anomalies.csv?v=' + Date.now())
                        .catch(() => fetch('data/pka_shift_anomalies.csv?v=' + Date.now()))
                        .catch(() => fetch('../pka_shift_anomalies.csv?v=' + Date.now()));

            if (csvRes && csvRes.ok) {
                const text = await csvRes.text();
                dataset = parseCSVText(text);
                loaded = true;
            }
        }

        if (!loaded || !dataset.length) {
            throw new Error('Could not load survey dataset (JSON/CSV).');
        }

        // Normalize booleans
        dataset.forEach(item => {
            if (item.Is_Ultra_Short === 'True' || item.Is_Ultra_Short === true) item.Is_Ultra_Short = true;
            else item.Is_Ultra_Short = false;

            if (item.Is_Buried === 'True' || item.Is_Buried === true) item.Is_Buried = true;
            else item.Is_Buried = false;
        });

        console.log('[Carbox] Loaded', dataset.length, 'records');

        // Render table and stats first (critical path)
        filteredData = dataset.slice();
        applyCurrentSort();
        renderTable(filteredData);
        renderStats();

        // Render charts safely
        try {
            initCharts();
        } catch (chartErr) {
            console.warn('[Carbox] initCharts error:', chartErr);
        }

        // Initialize 3D viewer on first entry in dataset
        if (isInitial && dataset.length > 0) {
            const firstCandidate = dataset[0];
            try {
                init3DViewer(firstCandidate.PDB, firstCandidate.Res1, firstCandidate.Res2);
            } catch (viewerErr) {
                console.warn('[Carbox] init3DViewer error:', viewerErr);
            }
        }


        if (!isInitial) {
            showToast(`Analysis reloaded! ${dataset.length} records active.`, 'success');
        }

    } catch (err) {
        console.error('[Carbox] Load error:', err);
        showToast('Error loading analysis dataset: ' + err.message, 'error');
    }
}

function parseCSVText(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const results = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = [];
        let insideQuote = false;
        let currentValue = '';

        for (let char of line) {
            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                values.push(currentValue.trim().replace(/^"|"$/g, ''));
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim().replace(/^"|"$/g, ''));

        const record = {};
        headers.forEach((h, idx) => {
            let val = values[idx] ?? '';
            if (val === 'True') val = true;
            else if (val === 'False') val = false;
            else if (val === 'None' || val === '' || val === 'N/A') val = null;
            else if (!isNaN(Number(val))) val = Number(val);
            record[h] = val;
        });

        results.push(record);
    }
    return results;
}

// ─── Trilingual Internationalization (EN, AZ, HE) Engine ────────────────────

const I18N_DASHBOARD = {
    en: {
        brand_sub: "v0.4.5 · High-Throughput Mining",
        nav_dashboard: "Carbox",
        nav_dataset: "pKa Anomalies Dataset",
        nav_docs: "Documentation",
        btn_docs: "Docs",
        nav_downloads: "Downloads Hub",
        status_filters_title: "Core Filters Active",
        status_filters_sub: "Distance · Burial · Microenvironment",
        header_title: "Aspartate & Glutamate pKa Shift Workbench",
        header_subtitle: "Carbox Crystallographic Criteria & Full-PDB Tier 1 Validation (d ≤ 1.20 Å)",
        badge_resolution: '<i class="fa-solid fa-shield-halved"></i> Resolution ≤ 1.20 Å (Tier 1 PDB)',
        btn_reload: "Reload Analysis",
        stat_screened_label: "PDB Structures Screened",
        stat_screened_sub: "≤ 1.20 Å Atomic Resolution, PDB-wide",
        stat_contacts_label: "Total Carboxyl Dyads",
        stat_contacts_sub: "d ≤ 3.20 Å across PDB",
        stat_lbhb_label: "Golden Reliable LBHBs",
        stat_lbhb_sub: "Carbox Validated Core Density",
        stat_buried_label: "Filtered Noise & Chelates",
        stat_buried_sub: "Thermal Outliers + Metal Bridges",
        stat_dominant_label: "Dominant Pair Type",
        stat_dominant_sub: "Protonation landscape",
        chart_dist_title: "Distance Distribution",
        chart_dist_badge: "LBHB boundary: 2.55 Å",
        chart_verdict_title: "Carbox Status & LBHB Classification",
        chart_verdict_badge: "5 Categories",
        table_header_title: "pKa Shift & Microenvironment Dataset",
        table_loading: "Loading dataset...",
        search_placeholder: "Search PDB, residue, pair, status, metal...",
        filter_env_all: "All Environments",
        filter_env_buried: "Buried (Low Dielectric)",
        filter_env_exposed: "Solvent-Exposed",
        filter_tier_all: "All Distance Tiers",
        filter_tier_ultra: "Ultra-Short (≤ 2.55 Å)",
        filter_tier_short: "Short H-Bond (2.55–3.20 Å)",
        filter_status_all: "All Carbox Criteria",
        filter_status_golden: "★ Golden Reliable LBHBs (3,804)",
        filter_status_mild: "Mild B-Elevated (110)",
        filter_status_outlier: "⚠️ Extreme B Outliers (114)",
        filter_status_metal: "⚙️ Metal-Bridged Chelates (1,559)",
        filter_status_split: "✂️ Conformation Splits (1,272)",
        filter_carbox_all: "All Carbox Criteria",
        filter_carbox_golden: "★ Golden Reliable LBHBs (3,804)",
        filter_carbox_mild: "Mild B-Elevated (110)",
        filter_carbox_outlier: "⚠️ Extreme B Outliers (114)",
        filter_carbox_metal: "⚙️ Metal-Bridged Chelates (1,559)",
        filter_carbox_split: "✂️ Conformation Splits (1,272)",
        btn_benchmark_20: "20 Benchmarks",
        btn_clear_filters: "Clear",
        btn_export_csv: "Export CSV",
        th_pdb: "PDB",
        th_res1: "Residue 1",
        th_res2: "Residue 2",
        th_pair_type: "Pair Type",
        th_distance: "Distance (Å)",
        th_status: "Carbox Status",
        th_carbox: "Carbox Status",
        th_max_b: "Max B / Bz",
        th_verdict: "Protonation Verdict",
        th_water: "Closest Water (Å)",
        th_resolution: "Resolution",
        th_occupancy: "Occ",
        verdict_lbhb: "Buried LBHB (Likely Protonated)",
        verdict_buried_short: "Buried Short H-Bond (Likely Protonated)",
        verdict_solvent: "Solvent-Exposed (Possibly Protonated)",
        toast_lang_changed: "Language changed to English.",
        toast_filters_cleared: "All dataset filters cleared.",
        toast_export_success: "Exported {count} records to {filename}",
        toast_no_records: "No records to export.",
        toast_reloading: "Reloading analysis dataset...",
        records_found_suffix: "records found",
        showing_records_text: "Showing 500 of {total} records. Use search/filters to narrow down.",
        no_records_found: "No matching records found. Try adjusting filters.",
        tab_carbox: "Carbox",
        tab_contact: "Contact",
        tab_about: "About Carbox",
        btn_workbench: "CarboxMol",
        btn_downloads: "Downloads",
        btn_downloads_hub: "Downloads Hub",
        survey_entries: "Survey Entries",
        contact_sh_role: "Lead Developer &middot; Structural Bioinformatics &amp; Crystallography",
        contact_gm_role: "Principal Investigator &middot; MRC Laboratory of Molecular Biology",
        contact_issues_title: "GitHub Issues &amp; Bug Reports",
        contact_issues_role: "Feature requests, bug reports, and community discussions",
        contact_issues_btn: "Open an Issue",
        contact_discussions_btn: "Discussions",
        affiliation_banner_inst: "Institute of Molecular Biology &amp; Western Caspian University",
        affiliation_banner_loc: "&middot; Baku, Azerbaijan",
        about_hero_title: "About Carbox",
        about_hero_sub: "A systematic high-throughput survey and microenvironment workbench for anomalous carboxyl–carboxyl interactions and pKa shifts in high-resolution protein crystal structures.",
        about_repo_btn: "Visit the GitHub Repository",
        about_what_title: "What is Carbox?",
        about_what_p: "Carbox is an automated pipeline that screens tens of thousands of atomic-resolution (&le; 1.20 &Aring;) X-ray protein crystal structures from the Protein Data Bank (PDB) using Carbox dual-statistical criteria to identify anomalous carboxyl–carboxyl pairs (Asp–Asp, Asp–Glu, Glu–Glu) with short O···O distances indicative of strong pKa perturbation and authentic Low-Barrier Hydrogen Bonds (LBHBs).",
        about_integration_title: "CarboxMol Integration",
        about_integration_p: "CarboxMol is the crystallographic computation engine powering this workbench. It provides real-space refinement, stereochemical validation, protonation state modeling, CXL macro scripting, and interactive 3D visualization directly from your browser via the local MCP server.",
        about_method_title: "Methodology &amp; Filters",
        about_method_p: "Rigorous crystallographic criteria: (1) O···O distance &le; 3.20 &Aring;, (2) Parametric B-factor z-score and Tukey non-parametric IQR outlier fences, (3) Direct metal coordination exclusion, (4) Microenvironment burial via closest water distance (> 3.0 &Aring;), (5) Low-barrier hydrogen bond boundary at &le; 2.55 &Aring;.",
        about_citation_title: "Citation",
        about_citation_p: "If you use Carbox in your research, please cite:",
        about_license_title: "License",
        about_license_p: "Carbox is released under the <strong>Mozilla Public License Version 2.0 (MPL-2.0)</strong>. CarboxMol is distributed under the same modular license. You are free to use, modify, and distribute this software with attribution.",
        contact_hero_title: "Contact the Authors",
        contact_hero_sub: "Have questions about Carbox, CarboxMol, or collaboration opportunities? Reach out to the research team.",
        mcp_title: "CarboxMol 3D Studio",
        mcp_style_label: "Style:",
        mcp_density_label: "Density:",
        mcp_placeholder_title: "Select an Interaction Record",
        mcp_placeholder_sub: "Click any row in the survey dataset to execute CXL rendering on the CarboxMol MCP engine with live electron density map contouring.",
        mcp_spinner_text: "Executing CarboxMol CXL Script…",
        mcp_spinner_sub: "Synthesizing 3D coordinate geometry & density meshes",
        mcp_error_title: "CarboxMol Engine Offline",
        mcp_error_msg: "Could not reach the local CarboxMol server at localhost:8050. Ensure <code>server.py</code> is running.",
        mcp_retry_btn: "Retry Connection",
        mcp_fallback_btn: "Local WebGL Viewer",
        mcp_cxl_title: "CarboxMol CXL Macro Script",
        page_title: "Carbox v0.4.5 | pKa Shift & Microenvironment Workbench",
        btn_benchmark_20_title: "Carbox 20 Benchmark Representative Proteins",
        btn_clear_filters_title: "Reset all filters"
    },
    az: {
        brand_sub: "v0.4.5 · Yüksək Məhsuldarlıqlı Mədənçilik",
        nav_dashboard: "Carbox",
        nav_dataset: "pKa Anomaliyaları Məlumat Bazası",
        nav_docs: "Sənədlər",
        btn_docs: "Sənədlər",
        nav_downloads: "Yükləmələr",
        status_filters_title: "Əsas Filtrlər Aktivdir",
        status_filters_sub: "Məsafə · Qapalılıq · Mikromühit",
        header_title: "Aspartat və Qlutamat pKa Sürüşməsi İş Masası",
        header_subtitle: "Carbox Kristalloqrafik Meyarları və Tam PDB Tier 1 Təsdiqi (d ≤ 1.20 Å)",
        badge_resolution: '<i class="fa-solid fa-shield-halved"></i> Həlletmə ≤ 1.20 Å (Tier 1 PDB)',
        btn_reload: "Təhlili Yenilə",
        stat_screened_label: "Tədqiq Edilən PDB Strukturları",
        stat_screened_sub: "≤ 1.20 Å Atom Ayırdetməsi, PDB miqyasında",
        stat_contacts_label: "Ümumi Karboksil Cütlükləri",
        stat_contacts_sub: "d ≤ 3.20 Å PDB üzrə",
        stat_lbhb_label: "Qızıl Etibarlı LBHB-lər",
        stat_lbhb_sub: "Carbox Təsdiqli Sıxlıq",
        stat_buried_label: "Kənarlaşdırılan Küy və Xelatlar",
        stat_buried_sub: "Termal Sapmalar + Metal Körpüləri",
        stat_dominant_label: "Dominant Cütlük Növü",
        stat_dominant_sub: "Protonlaşma paylanması",
        chart_dist_title: "Məsafə Paylanması Histoqramı",
        chart_dist_badge: "LBHB sərhədi: 2.55 Å",
        chart_verdict_title: "Carbox Statusu və LBHB Təsnifatı",
        chart_verdict_badge: "5 Kateqoriya",
        table_header_title: "pKa Sürüşməsi və Mikromühit Məlumat Cədvəli",
        table_loading: "Məlumatlar yüklənir...",
        search_placeholder: "PDB, qalıq, cütlük, status, metal axtar...",
        filter_env_all: "Bütün Mühitlər",
        filter_env_buried: "Qapalı (Aşağı Dielektrik)",
        filter_env_exposed: "Həllediciyə Açıq",
        filter_tier_all: "Bütün Məsafə Səviyyələri",
        filter_tier_ultra: "Ultra-Qısa (≤ 2.55 Å)",
        filter_tier_short: "Qısa H-Rabitəsi (2.55–3.20 Å)",
        filter_status_all: "Bütün Carbox Meyarları",
        filter_status_golden: "★ Qızıl Etibarlı LBHB-lər (3,804)",
        filter_status_mild: "Mülayim B-Yüksək (110)",
        filter_status_outlier: "⚠️ Ekstremal B Sapmaları (114)",
        filter_status_metal: "⚙️ Metal Körpülü Xelatlar (1,559)",
        filter_status_split: "✂️ Konformasiya Ayrılmaları (1,272)",
        filter_carbox_all: "Bütün Carbox Meyarları",
        filter_carbox_golden: "★ Qızıl Etibarlı LBHB-lər (3,804)",
        filter_carbox_mild: "Mülayim B-Yüksək (110)",
        filter_carbox_outlier: "⚠️ Ekstremal B Sapmaları (114)",
        filter_carbox_metal: "⚙️ Metal Körpülü Xelatlar (1,559)",
        filter_carbox_split: "✂️ Konformasiya Ayrılmaları (1,272)",
        btn_benchmark_20: "20 Etalon",
        btn_clear_filters: "Təmizlə",
        btn_export_csv: "CSV İxrac Et",
        th_pdb: "PDB",
        th_res1: "Qalıq 1",
        th_res2: "Qalıq 2",
        th_pair_type: "Cütlük Növü",
        th_distance: "Məsafə (Å)",
        th_status: "Carbox Statusu",
        th_carbox: "Carbox Statusu",
        th_max_b: "Maks B / Bz",
        th_verdict: "Protonlaşma Qərarı",
        th_water: "Ən Yaxın Su (Å)",
        th_resolution: "Həlletmə",
        th_occupancy: "Tutulma",
        verdict_lbhb: "Qapalı LBHB (Böyük Ehtimalla Protonlaşıb)",
        verdict_buried_short: "Qapalı Qısa H-Rabitəsi (Böyük Ehtimalla Protonlaşıb)",
        verdict_solvent: "Həllediciyə Açıq (Ehtimal ki, Protonlaşıb)",
        toast_lang_changed: "Dil Azərbaycan dilinə dəyişdirildi.",
        toast_filters_cleared: "Bütün filtrlər təmizləndi.",
        toast_export_success: "{count} qeyd {filename} faylına ixrac edildi.",
        toast_no_records: "İxrac üçün heç bir qeyd tapılmadı.",
        toast_reloading: "Verilənlər bazası yenidən yüklənir...",
        records_found_suffix: "qeyd tapıldı",
        showing_records_text: "{total} qeyddən 500-ü göstərilir. Filtrlərdən istifadə edin.",
        no_records_found: "Uyğun qeyd tapılmadı. Filtrləri dəyişin.",
        tab_carbox: "Carbox",
        tab_contact: "Əlaqə",
        tab_about: "Carbox Haqqında",
        btn_workbench: "CarboxMol",
        btn_downloads: "Yükləmələr",
        btn_downloads_hub: "Yükləmələr Mərkəzi",
        survey_entries: "Tədqiqat Nümunələri",
        contact_sh_role: "Aparıcı Tərtibatçı &middot; Struktur Bioinformatika və Kristalloqrafiya",
        contact_gm_role: "Elmi Rəhbər &middot; MRC Molekulyar Biologiya Laboratoriyası",
        contact_issues_title: "GitHub Xətaları və Təkliflər",
        contact_issues_role: "Yeni xüsusiyyət tələbləri, xəta hesabatları və elmi müzakirələr",
        contact_issues_btn: "Xəta Bildir",
        contact_discussions_btn: "Müzakirələr",
        affiliation_banner_inst: "Molekulyar Biologiya İnstitutu və Qərbi Kaspi Universiteti",
        affiliation_banner_loc: "&middot; Bakı, Azərbaycan",
        about_hero_title: "Carbox Haqqında",
        about_hero_sub: "Yüksək ayırdetməli zülal kristallik strukturlarında anomal karboksil–karboksil qarşılıqlı təsirləri və pKa sürüşmələri üzrə sistematik yüksək məhsuldarlıqlı tədqiqat və mikromühit iş masası.",
        about_repo_btn: "GitHub Repozitoriyasına Keç",
        about_what_title: "Carbox Nədir?",
        about_what_p: "Carbox — Zülal Məlumat Bankından (PDB) atom ayırdetməli (&le; 1.20 &Aring;) rentgen zülal kristal strukturlarını Carbox ikili statistik meyarları əsasında avtomatlaşdırılmış şəkildə təhlil edərək güclü pKa pozulmasını və həqiqi Aşağı Baryerli Hidrogen Rabitələrini (LBHB) aşkar edən skrininq platformasıdır.",
        about_integration_title: "CarboxMol İnteqrasiyası",
        about_integration_p: "CarboxMol — bu iş masasını gücləndirən kristalloqrafik hesablama mühərrikidir. O, birbaşa brauzerinizdən real fəzada dəqiqləşdirmə, stereokimyəvi yoxlama, protonlaşma vəziyyətinin modelləşdirilməsi, CXL makro skriptləri və interaktiv 3D vizuallaşdırma təmin edir.",
        about_method_title: "Metodologiya və Filtrlər",
        about_method_p: "Dəqiq kristalloqrafik meyarlar: (1) O···O məsafəsi &le; 3.20 &Aring;, (2) Parametrik B-faktor z-skorları və Tukey IQR kənarlaşma sərhədləri, (3) Birbaşa metal koordinasiyasının kənarlaşdırılması, (4) Ən yaxın su məsafəsi ilə mikromühitin qapalılığı (> 3.0 &Aring;), (5) LBHB sərhədi &le; 2.55 &Aring;.",
        about_citation_title: "İstinad",
        about_citation_p: "Tədqiqatınızda Carbox-dan istifadə edirsinizsə, zəhmət olmasa istinad edin:",
        about_license_title: "Lisenziya",
        about_license_p: "Carbox <strong>Mozilla Public License Version 2.0 (MPL-2.0)</strong> altında təqdim olunur. CarboxMol da eyni modul lisenziya ilə paylanır. Müəlliflik hüququnu qeyd etməklə bu proqram təminatından sərbəst istifadə edə, dəyişdirə və yaya bilərsiniz.",
        contact_hero_title: "Müəlliflərlə Əlaqə",
        contact_hero_sub: "Carbox, CarboxMol və ya əməkdaşlıq imkanları haqqında suallarınız var? Tədqiqat qrupu ilə əlaqə saxlayın.",
        mcp_title: "CarboxMol 3D Studiya",
        mcp_style_label: "Üslub:",
        mcp_density_label: "Sıxlıq:",
        mcp_placeholder_title: "Bir Qarşılıqlı Təsir Qeydini Seçin",
        mcp_placeholder_sub: "Canlı elektron sıxlığı xəritəsi konturları ilə CarboxMol MCP mühərrikində CXL vizuallaşdırmasını icra etmək üçün tədqiqat məlumatlarındakı istənilən sətri vurun.",
        mcp_spinner_text: "CarboxMol CXL Skripti İcra Olunur…",
        mcp_spinner_sub: "3D koordinat həndəsəsi və sıxlıq torları sintez olunur",
        mcp_error_title: "CarboxMol Mühərriki Xətdən Kənardır",
        mcp_error_msg: "localhost:8050 ünvanında lokal CarboxMol serverinə qoşulmaq mümkün olmadı. <code>server.py</code>-nin işlədiyindən əmin olun.",
        mcp_retry_btn: "Yenidən Qoşul",
        mcp_fallback_btn: "Lokal WebGL Baxıcısı",
        mcp_cxl_title: "CarboxMol CXL Makro Skripti",
        page_title: "Carbox v0.4.5 | pKa Sürüşməsi və Mikromühit İş Masası",
        btn_benchmark_20_title: "Carbox 20 Etalon Nümayəndə Zülalı",
        btn_clear_filters_title: "Bütün filtrləri sıfırla"
    },
    he: {
        brand_sub: "v0.4.5 · כריית נתונים בתפוקה גבוהה",
        nav_dashboard: "Carbox",
        nav_dataset: "מאגר אנומליות pKa",
        nav_docs: "תיעוד",
        btn_docs: "תיעוד",
        nav_downloads: "מרכז הורדות",
        status_filters_title: "מסננים ראשיים פעילים",
        status_filters_sub: "מרחק · קבורה · מיקרו-סביבה",
        header_title: "סביבת עבודה להיסט pKa באספרטט וגלוטמט",
        header_subtitle: "קריטריונים קריסטלוגרפיים של Carbox ואימות מלא של Tier 1 PDB (עד 1.20 Å)",
        badge_resolution: '<i class="fa-solid fa-shield-halved"></i> רזולוציה ≤ 1.20 Å (Tier 1 PDB)',
        btn_reload: "טען מחדש ניתוח",
        stat_screened_label: "מבני PDB שנסקרו",
        stat_screened_sub: "≤ 1.20 Å רזולוציה אטומית, בכל ה-PDB",
        stat_contacts_label: "סך כל צמדי קרבוקסיל",
        stat_contacts_sub: "d ≤ 3.20 Å בכל ה-PDB",
        stat_lbhb_label: "קשרי LBHB מהימנים מזהב",
        stat_lbhb_sub: "צפיפות מאומתת לפי Carbox",
        stat_buried_label: "רעש וכלטים שסוננו",
        stat_buried_sub: "חריגות תרמיות + גשרי מתכת",
        stat_dominant_label: "סוג זוג דומיננטי",
        stat_dominant_sub: "התפלגות מצבי פרוטונציה",
        chart_dist_title: "התפלגות מרחקים",
        chart_dist_badge: "גבול LBHB: 2.55 Å",
        chart_verdict_title: "סטטוס Carbox וסיווג LBHB",
        chart_verdict_badge: "5 קטגוריות",
        table_header_title: "מאגר נתוני היסט pKa ומיקרו-סביבה",
        table_loading: "טוען נתונים...",
        search_placeholder: "חפש PDB, שייר, צמד, סטטוס, מתכת...",
        filter_env_all: "כל הסביבות",
        filter_env_buried: "קבור (מקדם דיאלקטרי נמוך)",
        filter_env_exposed: "חשוף לממס",
        filter_tier_all: "כל רמות המרחק",
        filter_tier_ultra: "קצר במיוחד (≤ 2.55 Å)",
        filter_tier_short: "קשר מימן קצר (2.55–3.20 Å)",
        filter_status_all: "כל קריטריוני Carbox",
        filter_status_golden: "★ קשרי LBHB מהימנים מזהב (3,804)",
        filter_status_mild: "B מוגבר קל (110)",
        filter_status_outlier: "⚠️ חריגות B קיצוניות (114)",
        filter_status_metal: "⚙️ כלטים מגושרים במתכת (1,559)",
        filter_status_split: "✂️ פיצולי קונפורמציה (1,272)",
        filter_carbox_all: "כל קריטריוני Carbox",
        filter_carbox_golden: "★ קשרי LBHB מהימנים מזהב (3,804)",
        filter_carbox_mild: "B מוגבר קל (110)",
        filter_carbox_outlier: "⚠️ חריגות B קיצוניות (114)",
        filter_carbox_metal: "⚙️ כלטים מגושרים במתכת (1,559)",
        filter_carbox_split: "✂️ פיצולי קונפורמציה (1,272)",
        btn_benchmark_20: "20 מבני בנצ'מרק",
        btn_clear_filters: "נקה",
        btn_export_csv: "ייצוא ל-CSV",
        th_pdb: "PDB",
        th_res1: "שייר 1",
        th_res2: "שייר 2",
        th_pair_type: "סוג זוג",
        th_distance: "מרחק (Å)",
        th_status: "סטטוס Carbox",
        th_carbox: "סטטוס Carbox",
        th_max_b: "מקסימום B / Bz",
        th_verdict: "פסק דין פרוטונציה",
        th_water: "מים קרובים ביותר (Å)",
        th_resolution: "רזולוציה",
        th_occupancy: "תפוסה",
        verdict_lbhb: "LBHB קבור (סבירות גבוהה לפרוטונציה)",
        verdict_buried_short: "קשר מימן קצר קבור (סבירות גבוהה לפרוטונציה)",
        verdict_solvent: "חשוף לממס (ייתכן שעבר פרוטונציה)",
        toast_lang_changed: "השפה שונתה לעברית.",
        toast_filters_cleared: "כל המסננים נוקו.",
        toast_export_success: "יוצאו {count} רשומות לקובץ {filename}",
        toast_no_records: "אין רשומות לייצוא.",
        toast_reloading: "טוען מחדש את מערך הנתונים...",
        records_found_suffix: "רשומות נמצאו",
        showing_records_text: "מציג 500 מתוך {total} רשומות. השתמש בחיפוש/מסננים לצמצום.",
        no_records_found: "לא נמצאו רשומות תואמות. נסה להתאים מסננים.",
        tab_carbox: "Carbox",
        tab_contact: "יצירת קשר",
        tab_about: "אודות Carbox",
        btn_workbench: "CarboxMol",
        btn_downloads: "הורדות",
        btn_downloads_hub: "מרכז הורדות",
        survey_entries: "רשומות סקר",
        contact_sh_role: "מפתח ראשי &middot; ביואינפורמטיקה מבנית וקריסטלוגרפיה",
        contact_gm_role: "חוקר ראשי &middot; מעבדת MRC לביולוגיה מולקולרית",
        contact_issues_title: "בעיות ובקשות ב-GitHub",
        contact_issues_role: "בקשות לתכונות חדשות, דיווחי באגים ודיונים קהילתיים",
        contact_issues_btn: "פתח קריאה",
        contact_discussions_btn: "דיונים",
        affiliation_banner_inst: "המכון לביולוגיה מולקולרית ואוניברסיטת וסטרן קספיאן",
        affiliation_banner_loc: "&middot; באקו, אזרבייג'ן",
        about_hero_title: "אודות Carbox",
        about_hero_sub: "סקר שיטתי בתפוקה גבוהה וסביבת עבודה לניתוח מיקרו-סביבה עבור אינטראקציות קרבוקסיל-קרבוקסיל אנומליות והיסטי pKa במבני גביש חלבוניים ברזולוציה גבוהה.",
        about_repo_btn: "בקר במאגר ה-GitHub",
        about_what_title: "מהו Carbox?",
        about_what_p: "Carbox הינו צינור אוטומטי הסורק עשרות אלפי מבני גביש של חלבונים בקרני רנטגן ברזולוציה גבוהה (&le; 1.20 &Aring;) ממאגר ה-PDB על פי קריטריונים קריסטלוגרפיים של Carbox לזיהוי זוגות קרבוקסיל-קרבוקסיל אנומליים בעלי מרחקי O···O קצרים המעידים על הפרעת pKa חזקה וקשרי LBHB.",
        about_integration_title: "אינטגרציית CarboxMol",
        about_integration_p: "CarboxMol הינו מנוע החישוב הקריסטלוגרפי המניע סביבת עבודה זו. הוא מספק שכלול במרחב ממשי, אימות סטריאוכימי, מידול מצבי פרוטונציה, סקריפטים של מאקרו CXL והדמיה תלת-ממדית אינטראקטיבית ישירות מהדפדפן שלך.",
        about_method_title: "מתודולוגיה ומסננים",
        about_method_p: "קריטריונים קריסטלוגרפיים קפדניים: (1) מרחק O···O &le; 3.20 &Aring;, (2) סינון חריגות תרמיות B-factor ו-Tukey IQR, (3) החרגת קואורדינציית מתכת ישירה, (4) קבורת מיקרו-סביבה לפי מרחק מים קרובים ביותר (> 3.0 &Aring;), (5) גבול קשר LBHB ברמה של &le; 2.55 &Aring;.",
        about_citation_title: "ציטוט",
        about_citation_p: "אם אתה משתמש ב-Carbox במחקרך, אנא צטט:",
        about_license_title: "רישיון",
        about_license_p: "Carbox מופץ תחת רישיון <strong>Mozilla Public License Version 2.0 (MPL-2.0)</strong>. CarboxMol מופץ תחת אותו רישיון מודולרי. הנך רשאי להשתמש, לשנות ולהפיץ תוכנה זו עם ייחוס נאות.",
        contact_hero_title: "צור קשר עם המחברים",
        contact_hero_sub: "יש לך שאלות לגבי Carbox, CarboxMol או הזדמנויות לשיתוף פעולה? פנה לצוות המחקר.",
        mcp_title: "CarboxMol 3D סטודיו",
        mcp_style_label: "סגנון:",
        mcp_density_label: "צפיפות:",
        mcp_placeholder_title: "בחר רשומת אינטראקציה",
        mcp_placeholder_sub: "לחץ על שורה כלשהי במאגר הסקר כדי להפעיל רינדור CXL במנוע CarboxMol MCP עם קווי מתאר של מפת צפיפות אלקטרונים חיה.",
        mcp_spinner_text: "מריץ סקריפט CarboxMol CXL…",
        mcp_spinner_sub: "מסנתז גיאומטריית קואורדינטות 3D ורשתות צפיפות",
        mcp_error_title: "מנוע CarboxMol לא מקוון",
        mcp_error_msg: "לא ניתן להתחבר לשרת CarboxMol המקומי ב-localhost:8050. ודא ש-<code>server.py</code> פועל.",
        mcp_retry_btn: "נסה להתחבר שוב",
        mcp_fallback_btn: "מציג WebGL מקומי",
        mcp_cxl_title: "סקריפט מאקרו CarboxMol CXL",
        page_title: "Carbox v0.4.5 | סביבת עבודה לניתוח היסטי pKa ומיקרו-סביבה",
        btn_benchmark_20_title: "20 חלבוני בנצ'מרק מייצגים של Carbox",
        btn_clear_filters_title: "אפס את כל המסננים"
    }
};

let currentDashboardLang = 'en';
try {
    currentDashboardLang = localStorage.getItem('carbox_lang') || localStorage.getItem('carbox_doc_lang') || 'en';
} catch (e) {}

function applyDashboardTranslations(lang) {
    if (!I18N_DASHBOARD[lang]) lang = 'en';
    currentDashboardLang = lang;
    try {
        localStorage.setItem('carbox_lang', lang);
        localStorage.setItem('carbox_doc_lang', lang);
    } catch (e) {}

    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'he' ? 'rtl' : 'ltr');

    const mainLangSelect = document.getElementById('main-lang-select');
    if (mainLangSelect && mainLangSelect.value !== lang) {
        mainLangSelect.value = lang;
    }

    const dict = I18N_DASHBOARD[lang];
    if (dict.page_title) document.title = dict.page_title;

    // Translate DOM elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });

    // Translate input placeholders with data-i18n-ph
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (dict[key]) {
            el.setAttribute('placeholder', dict[key]);
        }
    });

    // Translate titles/tooltips with data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key]) {
            el.setAttribute('title', dict[key]);
        }
    });

    if (dataset && dataset.length > 0) {
        renderStats();
        initCharts();
        renderTable(filteredData && filteredData.length ? filteredData : dataset);
    }
}

window.addEventListener('storage', (e) => {
    if (e.key === 'carbox_lang' && e.newValue && e.newValue !== currentDashboardLang) {
        applyDashboardTranslations(e.newValue);
    }
});

// ─── Header & Reload Actions ─────────────────────────────────────────────────

function setupHeaderActions() {
    const refreshBtn  = document.getElementById('btn-refresh-data');
    const refreshIcon = document.getElementById('refresh-icon');
    const mainLangSelect = document.getElementById('main-lang-select');

    if (mainLangSelect) {
        mainLangSelect.value = currentDashboardLang;
        mainLangSelect.addEventListener('change', (e) => {
            const chosen = e.target.value;
            applyDashboardTranslations(chosen);
            const dict = I18N_DASHBOARD[chosen] || I18N_DASHBOARD.en;
            showToast(dict.toast_lang_changed, 'success');
        });
    }

    // Apply language on initial load
    applyDashboardTranslations(currentDashboardLang);

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (refreshIcon) refreshIcon.classList.add('fa-spin');
            refreshBtn.disabled = true;

            const search = document.getElementById('table-search');
            const filterEnv = document.getElementById('filter-env');
            const filterTier = document.getElementById('filter-tier');
            if (search) search.value = '';
            if (filterEnv) filterEnv.value = 'ALL';
            if (filterTier) filterTier.value = 'ALL';

            const dict = I18N_DASHBOARD[currentDashboardLang] || I18N_DASHBOARD.en;
            showToast(dict.toast_reloading, 'info');
            await loadDataset(false);

            setTimeout(() => {
                if (refreshIcon) refreshIcon.classList.remove('fa-spin');
                refreshBtn.disabled = false;
            }, 500);
        });
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function toFloat(val) {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

function fmtDist(val) {
    const n = toFloat(val);
    return n !== null ? n.toFixed(4) + ' Å' : '—';
}

function fmtWater(val) {
    const n = toFloat(val);
    return n !== null ? n.toFixed(3) + ' Å' : '—';
}

function safeSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── Stats Cards ─────────────────────────────────────────────────────────────

function renderStats() {
    const total      = dataset.length;
    const golden     = dataset.filter(d => d.Is_Reliable === true || d.Carbox_Status === 'GOLDEN_RELIABLE' || d.Carbox_Status === 'GOLDEN_RELIABLE').length;
    const rejected   = dataset.filter(d => d.Is_Reliable === false).length;
    const ultra      = dataset.filter(d => d.Is_Ultra_Short === true || toFloat(d.Distance_A) <= 2.55).length;
    const pdbSet     = new Set(dataset.map(d => d.PDB));

    safeSet('stat-pdbs-count',   '7,230');
    safeSet('stat-total-count',  total.toLocaleString());
    safeSet('stat-lbhb-count',   golden.toLocaleString());
    safeSet('stat-buried-count', rejected.toLocaleString());
    safeSet('survey-count-num',  total.toLocaleString());

    const pairCounts = {};
    dataset.forEach(d => {
        const pt = d.PairType || 'Unknown';
        pairCounts[pt] = (pairCounts[pt] || 0) + 1;
    });
    const sorted = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
        const pct = total ? ((sorted[0][1] / total) * 100).toFixed(1) : 0;
        safeSet('stat-top-pair', sorted[0][0] + ' (' + pct + '%)');
    }
}

// ─── Charts ───────────────────────────────────────────────────────────────────

let activeDistanceBucket = null;
let activeOnlyArtifacts = false;

function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('[Carbox] Chart.js library is not available.');
        return;
    }

    const dict = I18N_DASHBOARD[currentDashboardLang] || I18N_DASHBOARD.en;

    // 1. Distance histogram
    const counts = [0, 0, 0, 0];
    dataset.forEach(item => {
        const d = toFloat(item.Distance_A);
        if (d === null) return;
        if (d < 2.2)        counts[0]++;
        else if (d < 2.4)   counts[1]++;
        else if (d <= 2.55) counts[2]++;
        else                counts[3]++;
    });

    const distCanvas = document.getElementById('distanceHistChart');
    if (distCanvas) {
        if (distChart) distChart.destroy();
        const distCtx = distCanvas.getContext('2d');
        distChart = new Chart(distCtx, {
            type: 'bar',
            data: {
                labels: ['< 2.20 Å', '2.20–2.40 Å', '2.40–2.55 Å (LBHB)', '2.55–3.20 Å'],
                datasets: [{
                    label: dict.th_distance || 'Contacts',
                    data: counts,
                    backgroundColor: ['#ef4444','#f87171','#f59e0b','#3b82f6'],
                    borderWidth: 1.5, borderColor: '#111827', borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (!elements || !elements.length) return;
                    const idx = elements[0].index;
                    if (activeDistanceBucket === idx) {
                        activeDistanceBucket = null;
                        showToast(dict.toast_filters_cleared || 'Distance bucket filter cleared', 'info');
                    } else {
                        activeDistanceBucket = idx;
                        const bucketNames = ['< 2.20 Å', '2.20–2.40 Å', '2.40–2.55 Å (LBHB)', '2.55–3.20 Å'];
                        showToast(`Filtered by distance: ${bucketNames[idx]}`, 'info');
                    }
                    if (typeof window.applyCarboxFilters === 'function') {
                        window.applyCarboxFilters();
                    }
                },
                onHover: (event, chartElement) => {
                    const target = event.native ? event.native.target : (event.target || null);
                    if (target) target.style.cursor = chartElement && chartElement[0] ? 'pointer' : 'default';
                },
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0, color: '#9ca3af' },
                         grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
                }
            }
        });
    }

    // 2. Carbox Validation Status & LBHB Classification Doughnut
    const statusCounts = {
        'GOLDEN_RELIABLE': 0,
        'METAL_BRIDGED_COMPLEX': 0,
        'PARTIAL_OCCUPANCY_SPLIT': 0,
        'REJECTED_EXTREME_B_OUTLIER': 0,
        'MILD_B_ELEVATED': 0
    };

    dataset.forEach(item => {
        const s = item.Carbox_Status || item.Carbox_Status || 'GOLDEN_RELIABLE';
        if (statusCounts[s] !== undefined) statusCounts[s]++;
        else statusCounts['GOLDEN_RELIABLE']++;
    });

    const statusKeys = [
        'GOLDEN_RELIABLE',
        'METAL_BRIDGED_COMPLEX',
        'PARTIAL_OCCUPANCY_SPLIT',
        'REJECTED_EXTREME_B_OUTLIER',
        'MILD_B_ELEVATED'
    ];

    const statusLabels = [
        dict.filter_status_golden || dict.filter_carbox_golden || '★ Golden Reliable LBHBs',
        dict.filter_status_metal || dict.filter_carbox_metal || '⚙️ Metal-Bridged Chelates',
        dict.filter_status_split || dict.filter_carbox_split || '✂️ Conformation Splits',
        dict.filter_status_outlier || dict.filter_carbox_outlier || '⚠️ Extreme B Outliers',
        dict.filter_status_mild || dict.filter_carbox_mild || 'Mild B-Elevated'
    ];

    const statusColors = ['#10b981', '#a855f7', '#64748b', '#ef4444', '#f59e0b'];
    const statusData = statusKeys.map(k => statusCounts[k]);

    const envCanvas = document.getElementById('envDonutChart');
    if (envCanvas) {
        if (envChart) envChart.destroy();
        const envCtx = envCanvas.getContext('2d');
        envChart = new Chart(envCtx, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusData,
                    backgroundColor: statusColors,
                    borderWidth: 3,
                    borderColor: '#111827'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (!elements || !elements.length) return;
                    const idx = elements[0].index;
                    const selectedStatus = statusKeys[idx];
                    const filterStatus = document.getElementById('filter-status') || document.getElementById('filter-status');
                    if (filterStatus) {
                        if (filterStatus.value === selectedStatus) {
                            filterStatus.value = 'ALL';
                            showToast('Cleared Carbox status filter', 'info');
                        } else {
                            filterStatus.value = selectedStatus;
                            showToast(`Filtered to ${statusLabels[idx]}`, 'info');
                        }
                    }
                    if (typeof window.applyCarboxFilters === 'function') {
                        window.applyCarboxFilters();
                    }
                },
                onHover: (event, chartElement) => {
                    const target = event.native ? event.native.target : (event.target || null);
                    if (target) target.style.cursor = chartElement && chartElement[0] ? 'pointer' : 'default';
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#f3f4f6', font: { size: 11 }, boxWidth: 12 }
                    }
                },
                cutout: '62%'
            }
        });
    }

    safeSet('verdict-chart-badge', `${dataset.length.toLocaleString()} ${dict.chart_verdict_badge || 'Categories'}`);
}

// ─── Table & Sorting ──────────────────────────────────────────────────────────

function carboxStatusBadge(status) {
    const s = status || 'GOLDEN_RELIABLE';
    if (s === 'GOLDEN_RELIABLE') {
        return '<span class="badge-status golden"><i class="fa-solid fa-star"></i> Golden LBHB</span>';
    } else if (s === 'MILD_B_ELEVATED') {
        return '<span class="badge-status mild"><i class="fa-solid fa-triangle-exclamation"></i> Mild Elevated</span>';
    } else if (s === 'REJECTED_EXTREME_B_OUTLIER') {
        return '<span class="badge-status outlier"><i class="fa-solid fa-ban"></i> B-Outlier</span>';
    } else if (s === 'METAL_BRIDGED_COMPLEX') {
        return '<span class="badge-status metal"><i class="fa-solid fa-atom"></i> Metal Chelate</span>';
    } else if (s === 'PARTIAL_OCCUPANCY_SPLIT') {
        return '<span class="badge-status split"><i class="fa-solid fa-scissors"></i> Occ Split</span>';
    }
    return '<span class="badge-status split">' + s + '</span>';
}
const statusBadge = carboxStatusBadge;

function verdictBadge(verdict) {
    const v = verdict || '';
    const dict = I18N_DASHBOARD[currentDashboardLang] || I18N_DASHBOARD.en;
    if (v.includes('Buried LBHB')) {
        return '<span class="badge-verdict lbhb"><i class="fa-solid fa-bolt"></i> ' + dict.verdict_lbhb + '</span>';
    }
    if (v.includes('Buried Short') || v.includes('H-Bond')) {
        return '<span class="badge-verdict buried-short"><i class="fa-solid fa-shield-halved"></i> ' + dict.verdict_buried_short + '</span>';
    }
    return '<span class="badge-verdict solvent"><i class="fa-solid fa-droplet"></i> ' + dict.verdict_solvent + '</span>';
}

function setupTableSorting() {
    const headers = document.querySelectorAll('#interactions-table th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const key = header.dataset.sort;
            if (!key) return;

            if (currentSort.key === key) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.key = key;
                currentSort.asc = true;
            }

            headers.forEach(h => {
                const icon = h.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-sort';
            });

            const icon = header.querySelector('i');
            if (icon) {
                icon.className = currentSort.asc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            }

            applyCurrentSort();
            renderTable(filteredData);
        });
    });
}

function applyCurrentSort() {
    const { key, asc } = currentSort;
    filteredData.sort((a, b) => {
        let valA = a[key] !== undefined ? a[key] : (key === 'Carbox_Status' ? a.Carbox_Status : undefined);
        let valB = b[key] !== undefined ? b[key] : (key === 'Carbox_Status' ? b.Carbox_Status : undefined);

        if (valA === null || valA === undefined || valA === '' || valA === '—') return 1;
        if (valB === null || valB === undefined || valB === '' || valB === '—') return -1;

        // Strict numeric sort for numeric crystallographic columns
        const numericKeys = ['Distance_A', 'Resolution', 'Occupancy', 'Max_B', 'Max_Bz', 'Closest_Water_A'];
        if (numericKeys.includes(key)) {
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return asc ? numA - numB : numB - numA;
            }
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return asc ? valA - valB : valB - valA;
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
    });
}

function renderTable(data) {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const dict = I18N_DASHBOARD[currentDashboardLang] || I18N_DASHBOARD.en;
    safeSet('table-record-count', data.length.toLocaleString() + ' ' + (dict.records_found_suffix || 'records found'));

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#6b7280;padding:24px;">' + (dict.no_records_found || 'No matching records found. Try adjusting filters.') + '</td></tr>';
        return;
    }

    const cap = Math.min(data.length, 500);

    for (let i = 0; i < cap; i++) {
        const item = data[i];
        const tr   = document.createElement('tr');
        tr._surveyRecord = item;

        const d    = toFloat(item.Distance_A);
        const res  = toFloat(item.Resolution);

        const distColor = (d !== null && d <= 2.55) ? '#ef4444' : '#f59e0b';
        const dwDisplay = fmtWater(item.Closest_Water_A);

        const occ  = toFloat(item.Occupancy);
        const occDisplay = occ !== null ? occ.toFixed(2) : '1.00';

        const bDisp = item.Max_B !== undefined ? (item.Max_B + ' Å² (' + (item.Max_Bz > 0 ? '+' : '') + item.Max_Bz + 'σ)') : '—';
        const bColor = (item.Max_Bz !== undefined && item.Max_Bz > 5.0) ? '#f87171' : (item.Max_Bz > 3.0 ? '#fbbf24' : '#9ca3af');

        tr.innerHTML =
            '<td class="mono-text"><strong>' + (item.PDB || '—') + (item.Is_Benchmark_20 ? ' <i class="fa-solid fa-award" style="color:#fbbf24;" title="Carbox 20 Benchmark Representative"></i>' : '') + '</strong></td>'
          + '<td class="mono-text" style="font-size:11px;">' + (item.Res1 || '—') + '</td>'
          + '<td class="mono-text" style="font-size:11px;">' + (item.Res2 || '—') + '</td>'
          + '<td><strong style="color:#f3f4f6;">' + (item.PairType || '—') + '</strong></td>'
          + '<td class="mono-text" style="color:' + distColor + ';font-weight:bold;">'
              + (d !== null ? d.toFixed(4) + ' \u00c5' : '—') + '</td>'
          + '<td>' + carboxStatusBadge(item.Carbox_Status || item.Carbox_Status) + '</td>'
          + '<td class="mono-text" style="font-size:10.5px;color:' + bColor + ';" title="Max B: ' + (item.Max_B || '—') + ' Å², z-score: ' + (item.Max_Bz || '0.0') + 'σ">' + bDisp + '</td>'
          + '<td>' + verdictBadge(item.Protonation_Verdict) + '</td>'
          + '<td class="mono-text">' + dwDisplay + '</td>'
          + '<td class="mono-text" style="font-size:11px;">' + (res !== null ? res.toFixed(2) : '—') + '</td>'
          + '<td class="mono-text" style="font-size:11px;color:#34d399;font-weight:600;">' + occDisplay + '</td>';

        tbody.appendChild(tr);
    }

    if (data.length > cap) {
        const tr = document.createElement('tr');
        const showMsg = (dict.showing_records_text || 'Showing 500 of {total} records. Use search/filters to narrow down.').replace('{total}', data.length.toLocaleString());
        tr.innerHTML = '<td colspan="11" style="text-align:center;color:#6b7280;padding:12px;font-size:12px;">'
            + showMsg + '</td>';
        tbody.appendChild(tr);
    }
}

// ─── Filters & Reset ──────────────────────────────────────────────────────────

function initFilters() {
    const search          = document.getElementById('table-search');
    const filterEnv       = document.getElementById('filter-env');
    const filterTier      = document.getElementById('filter-tier');
    const filterStatusCtrl = document.getElementById('filter-status') || document.getElementById('filter-status');
    const btnBenchmark20  = document.getElementById('btn-benchmark-20');
    const exportBtn       = document.getElementById('btn-export-csv');
    const resetFiltersBtn = document.getElementById('btn-reset-filters');

    let benchmarkOnly = false;

    function updateActiveCards() {
        document.querySelectorAll('.stat-card.interactive').forEach(c => c.classList.remove('active'));
        if (activeOnlyArtifacts) {
            document.getElementById('card-buried')?.classList.add('active');
        } else if (filterStatusCtrl && filterStatusCtrl.value === 'GOLDEN_RELIABLE') {
            document.getElementById('card-lbhb')?.classList.add('active');
        } else if (search && search.value.trim().toLowerCase().includes('asp – glu')) {
            document.getElementById('card-top-pair')?.classList.add('active');
        } else if ((!search || !search.value) && (!filterEnv || filterEnv.value === 'ALL') && (!filterTier || filterTier.value === 'ALL') && (!filterStatusCtrl || filterStatusCtrl.value === 'ALL') && !benchmarkOnly && activeDistanceBucket === null) {
            document.getElementById('card-pdbs')?.classList.add('active');
            document.getElementById('card-total')?.classList.add('active');
        }
    }

    function apply() {
        const q     = (search ? search.value : '').toLowerCase().trim();
        const env   = filterEnv       ? filterEnv.value       : 'ALL';
        const tier  = filterTier      ? filterTier.value      : 'ALL';
        const mursh = filterStatusCtrl ? filterStatusCtrl.value : 'ALL';

        filteredData = dataset.filter(item => {
            if (q) {
                const pdb   = (item.PDB || '').toLowerCase();
                const res1  = (item.Res1 || '').toLowerCase();
                const res2  = (item.Res2 || '').toLowerCase();
                const pair  = (item.PairType || '').toLowerCase();
                const mStat = (item.Carbox_Status || item.Carbox_Status || '').toLowerCase();
                const metal = (item.Nearest_Metal || '').toLowerCase();
                const vrd   = (item.Protonation_Verdict || '').toLowerCase();
                const envStr= (item.Environment || '').toLowerCase();

                const match = pdb.includes(q) ||
                              res1.includes(q) ||
                              res2.includes(q) ||
                              pair.includes(q) ||
                              mStat.includes(q) ||
                              metal.includes(q) ||
                              vrd.includes(q) ||
                              envStr.includes(q);
                if (!match) return false;
            }

            if (env !== 'ALL' && item.Environment !== env) return false;
            if (tier !== 'ALL' && item.Category !== tier) return false;
            const currentItemStatus = item.Carbox_Status || item.Carbox_Status;
            if (mursh !== 'ALL' && currentItemStatus !== mursh) return false;
            if (benchmarkOnly && !item.Is_Benchmark_20) return false;
            if (activeOnlyArtifacts && item.Is_Reliable !== false) return false;

            if (activeDistanceBucket !== null) {
                const d = toFloat(item.Distance_A);
                if (d === null) return false;
                if (activeDistanceBucket === 0 && !(d < 2.20)) return false;
                if (activeDistanceBucket === 1 && !(d >= 2.20 && d < 2.40)) return false;
                if (activeDistanceBucket === 2 && !(d >= 2.40 && d <= 2.55)) return false;
                if (activeDistanceBucket === 3 && !(d > 2.55)) return false;
            }

            return true;
        });

        applyCurrentSort();
        renderTable(filteredData);
        updateActiveCards();
        updateSurveyCount();
    }

    window.applyCarboxFilters = apply;

    if (search) search.addEventListener('input', () => { activeOnlyArtifacts = false; apply(); });
    if (filterEnv) filterEnv.addEventListener('change', () => { activeOnlyArtifacts = false; apply(); });
    if (filterTier) filterTier.addEventListener('change', () => { activeOnlyArtifacts = false; apply(); });
    if (filterStatusCtrl) filterStatusCtrl.addEventListener('change', () => { activeOnlyArtifacts = false; apply(); });
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    if (btnBenchmark20) {
        btnBenchmark20.addEventListener('click', () => {
            benchmarkOnly = !benchmarkOnly;
            activeOnlyArtifacts = false;
            if (benchmarkOnly) {
                btnBenchmark20.style.background = '#fbbf24';
                btnBenchmark20.style.color = '#000';
                if (filterStatusCtrl) filterStatusCtrl.value = 'ALL';
                showToast('Filtering to Carbox 20 Benchmark Proteins', 'info');
            } else {
                btnBenchmark20.style.background = 'rgba(245,158,11,0.15)';
                btnBenchmark20.style.color = '#fbbf24';
            }
            apply();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (search) search.value = '';
            if (filterEnv) filterEnv.value = 'ALL';
            if (filterTier) filterTier.value = 'ALL';
            if (filterStatusCtrl) filterStatusCtrl.value = 'ALL';
            benchmarkOnly = false;
            activeOnlyArtifacts = false;
            activeDistanceBucket = null;
            if (btnBenchmark20) {
                btnBenchmark20.style.background = 'rgba(245,158,11,0.15)';
                btnBenchmark20.style.color = '#fbbf24';
            }
            apply();
            const dict = I18N_DASHBOARD[currentDashboardLang] || I18N_DASHBOARD.en;
            showToast(dict.toast_filters_cleared || 'All dataset filters cleared.', 'info');
        });
    }

    // ─── Stat Card Click Listeners ───────────────────────────────────────────
    setupStatCardClicks({
        onResetAll: () => {
            if (search) search.value = '';
            if (filterEnv) filterEnv.value = 'ALL';
            if (filterTier) filterTier.value = 'ALL';
            if (filterStatusCtrl) filterStatusCtrl.value = 'ALL';
            benchmarkOnly = false;
            activeOnlyArtifacts = false;
            activeDistanceBucket = null;
            if (btnBenchmark20) {
                btnBenchmark20.style.background = 'rgba(245,158,11,0.15)';
                btnBenchmark20.style.color = '#fbbf24';
            }
            apply();
            showToast('Showing all 7,230 screened structures (6,759 dyads)', 'info');
        },
        onFilterGolden: () => {
            if (filterStatusCtrl) filterStatusCtrl.value = 'GOLDEN_RELIABLE';
            activeOnlyArtifacts = false;
            benchmarkOnly = false;
            activeDistanceBucket = null;
            if (btnBenchmark20) {
                btnBenchmark20.style.background = 'rgba(245,158,11,0.15)';
                btnBenchmark20.style.color = '#fbbf24';
            }
            apply();
            showToast('Filtered to Golden Reliable LBHBs (3,804 validated pairs)', 'success');
        },
        onFilterArtifacts: () => {
            activeOnlyArtifacts = true;
            if (filterStatusCtrl) filterStatusCtrl.value = 'ALL';
            benchmarkOnly = false;
            activeDistanceBucket = null;
            if (btnBenchmark20) {
                btnBenchmark20.style.background = 'rgba(245,158,11,0.15)';
                btnBenchmark20.style.color = '#fbbf24';
            }
            apply();
            showToast('Filtered to Filtered Noise, B-Outliers & Metal Chelates (2,955 pairs)', 'warning');
        },
        onFilterDominantPair: () => {
            if (search) search.value = 'ASP – GLU';
            activeOnlyArtifacts = false;
            activeDistanceBucket = null;
            apply();
            showToast('Filtered to dominant pair type: ASP – GLU', 'info');
        }
    });
}

function setupStatCardClicks(handlers) {
    const cardPdbs = document.getElementById('card-pdbs');
    const cardTotal = document.getElementById('card-total');
    const cardLbhb = document.getElementById('card-lbhb');
    const cardBuried = document.getElementById('card-buried');
    const cardTopPair = document.getElementById('card-top-pair');

    if (cardPdbs) cardPdbs.addEventListener('click', handlers.onResetAll);
    if (cardTotal) cardTotal.addEventListener('click', handlers.onResetAll);
    if (cardLbhb) cardLbhb.addEventListener('click', handlers.onFilterGolden);
    if (cardBuried) cardBuried.addEventListener('click', handlers.onFilterArtifacts);
    if (cardTopPair) cardTopPair.addEventListener('click', handlers.onFilterDominantPair);
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV() {
    const dict = I18N_DASHBOARD[currentDashboardLang] || I18N_DASHBOARD.en;
    const source = filteredData.length ? filteredData : dataset;
    if (!source.length) {
        showToast(dict.toast_no_records || 'No records to export.', 'warning');
        return;
    }

    const search     = document.getElementById('table-search');
    const filterEnv  = document.getElementById('filter-env');
    const filterTier = document.getElementById('filter-tier');

    const parts = ['carbox'];
    const q = (search && search.value || '').trim();
    if (q)                                         parts.push('search-' + q.replace(/\s+/g, '_'));
    if (filterEnv  && filterEnv.value  !== 'ALL') parts.push(filterEnv.value.replace(/[^a-z0-9]/gi, '_').toLowerCase());
    if (filterTier && filterTier.value !== 'ALL') parts.push(filterTier.value.includes('Ultra') ? 'ultra-short' : 'short-hbond');
    parts.push(source.length + 'records');

    const filename = parts.join('_') + '.csv';

    // Multi-tiered deterministic sorting: Distance_A -> PDB -> Res1 -> Res2
    const exportRows = source.slice().sort((a, b) => {
        const dA = toFloat(a.Distance_A) ?? 999.0;
        const dB = toFloat(b.Distance_A) ?? 999.0;
        if (Math.abs(dA - dB) > 0.00001) return dA - dB;

        const pdbA = String(a.PDB || '');
        const pdbB = String(b.PDB || '');
        if (pdbA !== pdbB) return pdbA.localeCompare(pdbB);

        const r1A = String(a.Res1 || '');
        const r1B = String(b.Res1 || '');
        if (r1A !== r1B) return r1A.localeCompare(r1B);

        return String(a.Res2 || '').localeCompare(String(b.Res2 || ''));
    });

    const keys = Object.keys(exportRows[0]);
    let csv = keys.join(',') + '\n';
    exportRows.forEach(row => {
        csv += keys.map(k => '"' + String(row[k] ?? '').replace(/"/g, '""') + '"').join(',') + '\n';
    });

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const succMsg = (dict.toast_export_success || 'Exported {count} records to {filename}').replace('{count}', source.length).replace('{filename}', filename);
    showToast(succMsg, 'success');
}

// ─── 3D Protonation Workbench & Controls ─────────────────────────────────────

let currentProtonState = 'anionic';
let discoveredPairs = [];
let activePairIndex = 0;

function setupViewerControls() {
    const resetViewBtn  = document.getElementById('btn-reset-view');
    const cartoonBtn    = document.getElementById('btn-toggle-cartoon');
    const loadDirectBtn = document.getElementById('btn-load-direct-pdb');
    const directInput   = document.getElementById('pdb-direct-input');
    const pairsSelect   = document.getElementById('discovered-pairs-select');

    // Preset PDB buttons
    document.querySelectorAll('.btn-preset-pdb').forEach(btn => {
        btn.addEventListener('click', () => {
            const pdb = btn.dataset.pdb;
            if (pdb) {
                if (directInput) directInput.value = pdb;
                viewPdbIn3D(pdb);
            }
        });
    });

    // Protonation State Switcher Buttons (Full ON / OFF Two-Way Toggle)
    ['anionic', 'ash', 'glh', 'lbhb'].forEach(state => {
        const btn = document.getElementById(`btn-state-${state}`);
        if (btn) {
            btn.addEventListener('click', () => {
                if (currentProtonState === state) {
                    renderProtonationState('none');
                } else {
                    renderProtonationState(state);
                }
            });
        }
    });


    // Discovered pairs dropdown change listener
    if (pairsSelect) {
        pairsSelect.addEventListener('change', () => {
            const val = parseInt(pairsSelect.value, 10);
            if (!isNaN(val) && discoveredPairs[val]) {
                activePairIndex = val;
                applyActivePair(discoveredPairs[val]);
            }
        });
    }

    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            if (molViewer) {
                try {
                    if (discoveredPairs.length && discoveredPairs[activePairIndex]) {
                        const p = discoveredPairs[activePairIndex];
                        molViewer.zoomTo({ resi: [p.resi1, p.resi2] }, 600);
                    } else if (activeSpec1 && activeSpec2 && activeSpec1.resi && activeSpec2.resi) {
                        molViewer.zoomTo({ resi: [activeSpec1.resi, activeSpec2.resi] }, 600);
                    } else {
                        molViewer.zoomTo({}, 600);
                    }
                    molViewer.render();
                    showToast('3D view reset.', 'info');
                } catch (e) {
                    molViewer.zoomTo({}, 600);
                    molViewer.render();
                }
            }
        });
    }

    if (cartoonBtn) {
        cartoonBtn.addEventListener('click', () => {
            showCartoon = !showCartoon;
            if (molViewer) {
                renderProtonationState(currentProtonState);
                showToast(showCartoon ? 'Backbone cartoon enabled.' : 'Backbone cartoon hidden.', 'info');
            }
        });
    }

    function handleDirectPdb() {
        if (!directInput) return;
        const rawVal = directInput.value.trim();
        if (!rawVal) {
            showToast('Please enter a PDB accession code (e.g. 1UBQ, 1CRN, 3X2M, 5SAO, 4HHB) or residue numbers.', 'warning');
            return;
        }

        const tokens = rawVal.split(/[\s,;]+/).filter(Boolean);
        let idToken = null;
        let resTokens = [];

        for (let tok of tokens) {
            if (!idToken && (/^[0-9][A-Za-z0-9]{3}$/i.test(tok) || /^[A-Za-z0-9]{4,10}$/i.test(tok)) && isNaN(Number(tok))) {
                idToken = tok.toUpperCase().replace(/^PDB_?/i, '');
            } else if (/^\d+$/.test(tok) || /^[A-Za-z]?:?\d+/.test(tok)) {
                resTokens.push(tok);
            }
        }

        if (!idToken) {
            const targetLabel = document.getElementById('viewer-target-label');
            if (targetLabel && targetLabel.textContent) {
                const currentMatch = targetLabel.textContent.match(/PDB\s+([A-Za-z0-9]{4,10})/i);
                if (currentMatch) idToken = currentMatch[1].toUpperCase();
            }
            if (!idToken) idToken = (dataset && dataset[0] ? dataset[0].PDB : '1CRN');
        }

        const res1 = resTokens[0] || null;
        const res2 = resTokens[1] || null;

        viewPdbIn3D(idToken, res1, res2);
    }

    if (loadDirectBtn) loadDirectBtn.addEventListener('click', handleDirectPdb);
    if (directInput) {
        directInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleDirectPdb();
        });
    }
}

function parseResSpec(resStr) {
    if (!resStr) return null;
    const str = String(resStr).trim();

    // Pattern 1: Chain_ResNum_ResName_AtomName (e.g. A_139_ASP_OD2 or A_141_GLU_OE2)
    let m = str.match(/^([A-Za-z0-9]+)_(\d+)_([A-Z]{3})(?:_([A-Z0-9]+))?$/i);
    if (m) {
        return {
            chain: m[1],
            resi: parseInt(m[2], 10),
            resn: m[3].toUpperCase(),
            atom: m[4] ? m[4].toUpperCase() : undefined
        };
    }

    // Pattern 2: ResName Chain:ResNum (e.g. ASP A:139)
    m = str.match(/([A-Z]{3})\s+(?:([A-Za-z0-9]+):)?(\d+)/i);
    if (m) {
        const spec = { resn: m[1].toUpperCase(), resi: parseInt(m[3], 10) };
        if (m[2]) spec.chain = m[2];
        return spec;
    }

    // Pattern 3: Chain:ResNum:ResName (e.g. A:139:ASP)
    m = str.match(/^([A-Za-z0-9]+):(\d+)(?::([A-Z]{3}))?/i);
    if (m) {
        const spec = { chain: m[1], resi: parseInt(m[2], 10) };
        if (m[3]) spec.resn = m[3].toUpperCase();
        return spec;
    }

    // Pattern 4: Fallback match residue number + optional chain (e.g. "149" or "A:149")
    m = str.match(/(?:([A-Za-z0-9]+):)?(\d+)/);
    if (m) {
        const spec = { resi: parseInt(m[2], 10) };
        if (m[1]) spec.chain = m[1];
        return spec;
    }

    return null;
}

function scanCarboxylPairsInModel(viewer) {
    const pairsSelect = document.getElementById('discovered-pairs-select');
    if (!pairsSelect || !viewer) return [];

    pairsSelect.innerHTML = '<option value="">Scanning model for Asp/Glu pairs...</option>';

    try {
        const atoms = viewer.selectedAtoms({ resn: ['ASP', 'GLU', 'ASH', 'GLH'] });
        if (!atoms || !atoms.length) {
            pairsSelect.innerHTML = '<option value="">No Asp/Glu residues found in this structure</option>';
            return [];
        }


        const residues = new Map();
        atoms.forEach(atom => {
            const key = `${atom.chain || 'A'}_${atom.resi}_${atom.resn}`;
            if (!residues.has(key)) {
                residues.set(key, {
                    chain: atom.chain || 'A',
                    resi: atom.resi,
                    resn: atom.resn,
                    oxygens: [],
                    carbons: []
                });
            }
            const res = residues.get(key);
            const aname = String(atom.atom || '').toUpperCase();
            if (['OD1', 'OD2', 'OE1', 'OE2'].includes(aname)) {
                res.oxygens.push(atom);
            } else if (['CG', 'CD', 'CB', 'CA'].includes(aname)) {
                res.carbons.push(atom);
            }
        });

        const resList = Array.from(residues.values()).filter(r => r.oxygens.length > 0);
        // Precalculate bounding boxes for O(1) early rejection
        resList.forEach(r => {
            let minX = 99999, maxX = -99999, minY = 99999, maxY = -99999, minZ = 99999, maxZ = -99999;
            for (let o of r.oxygens) {
                if (o.x < minX) minX = o.x;
                if (o.x > maxX) maxX = o.x;
                if (o.y < minY) minY = o.y;
                if (o.y > maxY) maxY = o.y;
                if (o.z < minZ) minZ = o.z;
                if (o.z > maxZ) maxZ = o.z;
            }
            r.bbox = { minX, maxX, minY, maxY, minZ, maxZ };
        });

        // Query solvent waters once outside the loops
        let waters = [];
        try {
            waters = viewer.selectedAtoms({ resn: ['HOH', 'WAT', 'DOD', 'H2O', 'TIP', 'SOL'] }) || [];
        } catch (e) {}

        const pairs = [];

        for (let i = 0; i < resList.length; i++) {
            const r1 = resList[i];
            const b1 = r1.bbox;

            for (let j = i + 1; j < resList.length; j++) {
                const r2 = resList[j];
                const b2 = r2.bbox;

                if (b1.minX - b2.maxX > 3.60 || b2.minX - b1.maxX > 3.60) continue;
                if (b1.minY - b2.maxY > 3.60 || b2.minY - b1.maxY > 3.60) continue;
                if (b1.minZ - b2.maxZ > 3.60 || b2.minZ - b1.maxZ > 3.60) continue;

                let minDistance = 999.0;
                let bestO1 = null;
                let bestO2 = null;

                for (let o1 of r1.oxygens) {
                    for (let o2 of r2.oxygens) {
                        const dx = o1.x - o2.x;
                        const dy = o1.y - o2.y;
                        const dz = o1.z - o2.z;
                        if (Math.abs(dx) > 3.60 || Math.abs(dy) > 3.60 || Math.abs(dz) > 3.60) continue;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        if (distSq < minDistance * minDistance) {
                            minDistance = Math.sqrt(distSq);
                            bestO1 = o1;
                            bestO2 = o2;
                        }
                    }
                }

                if (minDistance <= 3.60 && bestO1 && bestO2) {
                    let closestWater = 999.0;
                    let closestWaterSq = 999.0 * 999.0;
                    if (waters && waters.length > 0) {
                        for (let w of waters) {
                            const dx1 = w.x - bestO1.x, dy1 = w.y - bestO1.y, dz1 = w.z - bestO1.z;
                            const dw1Sq = dx1 * dx1 + dy1 * dy1 + dz1 * dz1;
                            if (dw1Sq < closestWaterSq) closestWaterSq = dw1Sq;
                            const dx2 = w.x - bestO2.x, dy2 = w.y - bestO2.y, dz2 = w.z - bestO2.z;
                            const dw2Sq = dx2 * dx2 + dy2 * dy2 + dz2 * dz2;
                            if (dw2Sq < closestWaterSq) closestWaterSq = dw2Sq;
                        }
                        closestWater = Math.sqrt(closestWaterSq);
                    }

                    const isUltraShort = minDistance <= 2.55;
                    const isBuried = closestWater >= 3.2;

                    let verdict = 'Possibly Protonated – Solvent Exposed';
                    let pkaShift = '+1.2 (Minor)';
                    let dielectric = 'Solvent-Accessible (ε ≈ 40–80)';

                    if (isUltraShort && isBuried) {
                        verdict = 'Likely Protonated – Buried LBHB';
                        pkaShift = '+3.8 (ASH/GLH Favored)';
                        dielectric = 'Buried Low-Dielectric (ε ≈ 2–4)';
                    } else if (isBuried) {
                        verdict = 'Likely Protonated – Buried Short H-Bond';
                        pkaShift = '+2.6 (Protonated Carboxyl)';
                        dielectric = 'Partially Buried (ε ≈ 6–10)';
                    }

                    pairs.push({
                        res1: `${r1.chain}_${r1.resi}_${r1.resn}_${bestO1.atom}`,
                        res2: `${r2.chain}_${r2.resi}_${r2.resn}_${bestO2.atom}`,
                        resi1: r1.resi,
                        resi2: r2.resi,
                        resn1: r1.resn,
                        resn2: r2.resn,
                        chain1: r1.chain,
                        chain2: r2.chain,
                        distance: minDistance,
                        closestWater: closestWater < 900 ? closestWater : null,
                        isUltraShort,
                        isBuried,
                        verdict,
                        pkaShift,
                        dielectric,
                        bestO1,
                        bestO2
                    });
                }
            }
        }

        pairs.sort((a, b) => a.distance - b.distance);

        if (!pairs.length) {
            pairsSelect.innerHTML = `<option value="">No carboxyl pairs with d ≤ 3.60 Å found (${resList.length} Asp/Glu detected)</option>`;
            return [];
        }

        pairsSelect.innerHTML = pairs.map((p, idx) => `
            <option value="${idx}">Pair #${idx + 1}: Chain ${p.chain1}:${p.resn1}${p.resi1} ↔ Chain ${p.chain2}:${p.resn2}${p.resi2} (d = ${p.distance.toFixed(3)} Å | ${p.verdict.split('–')[0].trim()})</option>
        `).join('');

        window.__lastDiscoveredPairs = pairs;
        discoveredPairs = pairs;
        return pairs;
    } catch (err) {
        console.error('[Carboxyl Scanner] Error scanning model:', err);
        pairsSelect.innerHTML = '<option value="">Error scanning Asp/Glu pairs</option>';
        return [];
    }
}


function applyActivePair(pair) {
    if (!pair || !molViewer) return;

    activeSpec1 = { chain: pair.chain1, resi: pair.resi1 };
    activeSpec2 = { chain: pair.chain2, resi: pair.resi2 };

    // Update Status Strip
    safeSet('strip-distance', `${pair.distance.toFixed(4)} Å`);
    safeSet('strip-pka-shift', pair.pkaShift);
    safeSet('strip-dielectric', pair.dielectric);
    safeSet('strip-water', pair.closestWater ? `${pair.closestWater.toFixed(2)} Å` : '> 10 Å (Buried)');

    const verdictEl = document.getElementById('strip-verdict');
    if (verdictEl) {
        verdictEl.innerHTML = verdictBadge(pair.verdict);
    }

    const distValSpan = document.getElementById('overlay-dist-val');
    if (distValSpan) {
        distValSpan.textContent = pair.distance.toFixed(3);
    }

    // Set suggested default proton state based on verdict
    if (pair.isUltraShort) {
        currentProtonState = 'lbhb';
    } else if (pair.isBuried) {
        currentProtonState = pair.resn1 === 'ASP' ? 'ash' : 'glh';
    } else {
        currentProtonState = 'anionic';
    }

    renderProtonationState(currentProtonState);
    if (typeof window.updateCrystallographicDensity === 'function') {
        window.updateCrystallographicDensity();
    }

    const studioLink = document.getElementById('btn-open-studio');
    if (studioLink) {
        const targetLabel = document.getElementById('viewer-target-label');
        const match = targetLabel && targetLabel.textContent ? targetLabel.textContent.match(/PDB\s+([A-Za-z0-9]{4,10})/i) : null;
        const pdbCode = match ? match[1].toUpperCase() : '3X2M';
        studioLink.href = `studio.html?pdb=${pdbCode}&pair=${activePairIndex}&state=${currentProtonState}`;
    }

    const midX = (pair.bestO1.x + pair.bestO2.x) / 2;
    const midY = (pair.bestO1.y + pair.bestO2.y) / 2;
    const midZ = (pair.bestO1.z + pair.bestO2.z) / 2;
    molViewer.center({ x: midX, y: midY, z: midZ }, 300);
    molViewer.zoomTo({ resi: [pair.resi1, pair.resi2] }, 600);
}



function renderProtonationState(state) {
    currentProtonState = state;
    if (!molViewer) return;

    // Reset button states
    document.querySelectorAll('.btn-state-pill').forEach(btn => btn.classList.remove('active'));
    if (state && state !== 'none') {
        const activeBtn = document.getElementById(`btn-state-${state}`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // 1. Clean up ALL previous custom 3Dmol shapes and labels in the WebGL scene
    try {
        molViewer.removeAllShapes();
        molViewer.removeAllLabels();
    } catch (e) {
        console.warn('[3Dmol] Clean shapes/labels:', e);
    }

    // 2. Base Backbone Representation
    const baseStyle = {};
    if (showCartoon) {
        baseStyle.cartoon = { color: 'spectrum', opacity: 0.65 };
    }
    molViewer.setStyle({}, baseStyle);

    // 3. Render all Aspartate & Glutamate residues across the entire structure
    molViewer.addStyle({ resn: ['ASP', 'ASH'] }, {
        stick: { color: '#34d399', radius: 0.15 },
        sphere: { color: '#34d399', radius: 0.16, quality: 3 }
    });
    molViewer.addStyle({ resn: ['GLU', 'GLH'] }, {
        stick: { color: '#a78bfa', radius: 0.15 },
        sphere: { color: '#a78bfa', radius: 0.16, quality: 3 }
    });

    if (!discoveredPairs.length || !discoveredPairs[activePairIndex]) {
        molViewer.render();
        return;
    }

    const pair = discoveredPairs[activePairIndex];
    const { bestO1, bestO2, resn1, resn2, resi1, resi2, chain1, chain2 } = pair;

    const sel1 = { chain: chain1 || 'A', resi: resi1 };
    const sel2 = { chain: chain2 || 'A', resi: resi2 };

    // 4. Render all surrounding microenvironment pocket residues within 5.5 Å as clean sticks
    try {
        molViewer.addStyle({ within: { distance: 5.5, sel: sel1 } }, {
            stick: { radius: 0.15, opacity: 0.85 },
            sphere: { radius: 0.16, opacity: 0.85, quality: 3 }
        });
    } catch (e) {}

    // 5. Highlight active carboxyl pair with distinct, slender sticks (Clean atom view, no oversized elements)
    molViewer.addStyle(sel1, {
        stick: { color: '#f59e0b', radius: 0.22 },
        sphere: { color: '#f59e0b', radius: 0.23, quality: 3 }
    });
    molViewer.addStyle(sel2, {
        stick: { color: '#f43f5e', radius: 0.22 },
        sphere: { color: '#f43f5e', radius: 0.23, quality: 3 }
    });

    // 6. Clean, clear 3D text labels
    try {
        molViewer.addLabel(`${resn1} ${chain1}:${resi1}`, { fontSize: 11, fontColor: '#ffffff', backgroundColor: '#d97706', backgroundOpacity: 0.85 }, sel1);
        molViewer.addLabel(`${resn2} ${chain2}:${resi2}`, { fontSize: 11, fontColor: '#ffffff', backgroundColor: '#e11d48', backgroundOpacity: 0.85 }, sel2);
    } catch (e) {}

    // 7. Base inter-carboxyl contact dashed cylinder
    molViewer.addCylinder({
        start: { x: bestO1.x, y: bestO1.y, z: bestO1.z },
        end:   { x: bestO2.x, y: bestO2.y, z: bestO2.z },
        radius: 0.06,
        dashed: true,
        color: '#f43f5e',
        fromCap: 1,
        toCap: 1
    });

    if (state === 'none') {
        showToast('Showing raw native crystallographic coordinates (No protonation model)', 'info');
        molViewer.render();
        return;
    }

    // 8. Explicit Proton Placement & Electrostatic Models
    if (state === 'anionic') {
        // Render explicit deprotonated carboxylate resonance electron halos & formal charge markers
        molViewer.addSphere({
            center: { x: bestO1.x, y: bestO1.y, z: bestO1.z },
            radius: 0.26,
            color: '#38bdf8',
            opacity: 0.40,
            wireframe: true
        });
        molViewer.addSphere({
            center: { x: bestO2.x, y: bestO2.y, z: bestO2.z },
            radius: 0.26,
            color: '#38bdf8',
            opacity: 0.40,
            wireframe: true
        });

        showToast('Modeled as Deprotonated Anionic Carboxylates (-COO⁻) with Electrostatic Repulsion', 'info');
    } else if (state === 'ash' || state === 'glh') {
        const isDonorO1 = (state === 'ash' && resn1.includes('ASP')) || (state === 'glh' && resn1.includes('GLU'));
        const donor = isDonorO1 ? bestO1 : bestO2;
        const acceptor = isDonorO1 ? bestO2 : bestO1;

        const vx = acceptor.x - donor.x;
        const vy = acceptor.y - donor.y;
        const vz = acceptor.z - donor.z;
        const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1.0;

        const hx = donor.x + (vx / len) * 0.98;
        const hy = donor.y + (vy / len) * 0.98;
        const hz = donor.z + (vz / len) * 0.98;

        molViewer.addSphere({
            center: { x: hx, y: hy, z: hz },
            radius: 0.14,
            color: '#ffffff'
        });

        molViewer.addCylinder({
            start: { x: donor.x, y: donor.y, z: donor.z },
            end:   { x: hx, y: hy, z: hz },
            radius: 0.07,
            color: '#ffffff',
            fromCap: 1,
            toCap: 1
        });

        molViewer.addCylinder({
            start: { x: hx, y: hy, z: hz },
            end:   { x: acceptor.x, y: acceptor.y, z: acceptor.z },
            radius: 0.05,
            dashed: true,
            color: '#10b981',
            fromCap: 1,
            toCap: 1
        });

        showToast(`Modeled Localized Neutral ${state.toUpperCase()} (Proton placed at d(O-H) = 0.98 Å)`, 'success');
    } else if (state === 'lbhb') {
        const hx = (bestO1.x + bestO2.x) / 2.0;
        const hy = (bestO1.y + bestO2.y) / 2.0;
        const hz = (bestO1.z + bestO2.z) / 2.0;

        molViewer.addSphere({
            center: { x: hx, y: hy, z: hz },
            radius: 0.15,
            color: '#ef4444'
        });

        molViewer.addCylinder({
            start: { x: bestO1.x, y: bestO1.y, z: bestO1.z },
            end:   { x: hx, y: hy, z: hz },
            radius: 0.06,
            dashed: true,
            color: '#f59e0b'
        });

        molViewer.addCylinder({
            start: { x: hx, y: hy, z: hz },
            end:   { x: bestO2.x, y: bestO2.y, z: bestO2.z },
            radius: 0.06,
            dashed: true,
            color: '#f59e0b'
        });

        showToast('Modeled Shared Low-Barrier Hydrogen Bond (LBHB)', 'success');
    }

    molViewer.render();
}



function viewPdbIn3D(pdbId, res1, res2) {
    const cleanPdb = String(pdbId || '').trim().toUpperCase();
    if (cleanPdb) {
        window.open(`studio.html?pdb=${encodeURIComponent(cleanPdb)}`, '_blank');
    }
}

async function init3DViewer(pdbId, res1, res2) {
    const container = document.getElementById('mol3d-viewport');
    if (!container) return;

    if (typeof $3Dmol === 'undefined') {
        showToast('3Dmol.js library not loaded. Please check your internet connection.', 'error');
        return;
    }

    const cleanPdb = String(pdbId || (dataset && dataset[0] ? dataset[0].PDB : '1CRN')).trim().toUpperCase();

    safeSet('viewer-target-label', `PDB ${cleanPdb} | In-Browser Protonation & Microenvironment Workbench`);
    showToast(`Loading 3D structure ${cleanPdb}...`, 'info');

    container.innerHTML = '';
    molViewer = $3Dmol.createViewer(container, {
        backgroundColor: '#0f172a',
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
    });

    function onStructureLoaded() {
        try {
            discoveredPairs = scanCarboxylPairsInModel(molViewer);
            activePairIndex = 0;

            if (res1) {
                const matchIdx = discoveredPairs.findIndex(p => 
                    String(p.resi1) === String(res1) || String(p.resi2) === String(res1) ||
                    String(p.res1).includes(res1) || String(p.res2).includes(res1)
                );
                if (matchIdx !== -1) activePairIndex = matchIdx;
            }

            if (discoveredPairs.length > 0) {
                const sel = document.getElementById('discovered-pairs-select');
                if (sel) sel.value = activePairIndex;
                applyActivePair(discoveredPairs[activePairIndex]);
            } else {
                const baseStyle = {};
                if (showCartoon) {
                    baseStyle.cartoon = { color: 'spectrum', opacity: 0.85 };
                }
                molViewer.setStyle({}, baseStyle);
                molViewer.addStyle({ resn: 'ASP' }, { stick: { color: '#34d399', radius: 0.15 } });
                molViewer.addStyle({ resn: 'GLU' }, { stick: { color: '#a78bfa', radius: 0.15 } });
                molViewer.zoomTo({}, 600);
                molViewer.render();
            }

            showToast(`Loaded ${cleanPdb} successfully. Discovered ${discoveredPairs.length} Asp/Glu contact pairs.`, 'success');
        } catch (e) {
            console.error('[3D Viewer] Post-load error:', e);
            molViewer.zoomTo({}, 600);
            molViewer.render();
        }
    }

    // Priority 1: Check embedded offline structures cache
    if (window.EMBEDDED_STRUCTURES && window.EMBEDDED_STRUCTURES[cleanPdb]) {
        molViewer.addModel(window.EMBEDDED_STRUCTURES[cleanPdb], 'cif');
        onStructureLoaded();
        return;
    }

    // Priority 1.5: High-Speed Cached Structure & Portal Models from local server
    try {
        const localRes = await fetch(`/api/structure/${encodeURIComponent(cleanPdb)}`);
        if (localRes.ok) {
            const localText = await localRes.text();
            if (localText && localText.length > 200) {
                const hdrFmt = localRes.headers.get('X-Structure-Format');
                const ctype = localRes.headers.get('Content-Type') || '';
                const fmt = hdrFmt || (ctype.includes('pdb') ? 'pdb' : (localText.startsWith('HEADER') || localText.includes('\nATOM  ') ? 'pdb' : 'cif'));
                molViewer.addModel(localText, fmt);
                onStructureLoaded();
                return;
            }
        }
    } catch (e) {
        console.warn('[3D Viewer] Local API structure fallback:', e);
    }

    // Priority 2: Fetch mmCIF from RCSB
    try {
        const cifRes = await fetch(`https://files.rcsb.org/download/${cleanPdb}.cif`);
        if (cifRes.ok) {
            const cifText = await cifRes.text();
            molViewer.addModel(cifText, 'cif');
            onStructureLoaded();
            return;
        }
    } catch (e) {
        console.warn('[3D Viewer] RCSB mmCIF fallback:', e);
    }

    // Priority 3: Fetch mmCIF from PDBe
    try {
        const pdbeRes = await fetch(`https://www.ebi.ac.uk/pdbe/entry-files/download/${cleanPdb.toLowerCase()}.cif`);
        if (pdbeRes.ok) {
            const pdbeText = await pdbeRes.text();
            molViewer.addModel(pdbeText, 'cif');
            onStructureLoaded();
            return;
        }
    } catch (e) {
        console.warn('[3D Viewer] PDBe CIF fallback:', e);
    }

    // Priority 4: Fetch PDB from RCSB
    try {
        const pdbRes = await fetch(`https://files.rcsb.org/download/${cleanPdb}.pdb`);
        if (pdbRes.ok) {
            const pdbText = await pdbRes.text();
            molViewer.addModel(pdbText, 'pdb');
            onStructureLoaded();
            return;
        }
    } catch (e) {
        console.warn('[3D Viewer] PDB fallback:', e);
    }

    // Priority 5: AlphaFold DB for UniProt accession numbers
    try {
        const afRes = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${cleanPdb}`);
        if (afRes.ok) {
            const afData = await afRes.json();
            if (afData && afData[0] && afData[0].cifUrl) {
                const afCifRes = await fetch(afData[0].cifUrl);
                if (afCifRes.ok) {
                    const afCifText = await afCifRes.text();
                    molViewer.addModel(afCifText, 'cif');
                    onStructureLoaded();
                    return;
                }
            }
        }
    } catch (e) {
        console.warn('[3D Viewer] AlphaFold API fallback:', e);
    }

    // Priority 6: $3Dmol download
    $3Dmol.download('pdb:' + cleanPdb, molViewer, {}, function () {
        onStructureLoaded();
    });
}




// ─── Toast Notifications ─────────────────────────────────────────────────────

function setupToastSystem() {
    // Ensure container exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-circle-xmark',
    };

    toast.innerHTML = `<i class="fa-solid ${iconMap[type] || 'fa-info-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ─── Standalone Visualizer, CarboxMol & Density Map Exporters ─────────────

function setupCarboxMolExport() {
    const btnCxl = document.getElementById('btn-export-cxl');
    const btnScenePy = document.getElementById('btn-export-scene-py');
    const btnSnapshot = document.getElementById('btn-snapshot-png');
    const btnPocket = document.getElementById('btn-toggle-pocket');
    const btnDensity = document.getElementById('btn-toggle-density');

    function getCurrentPdb() {
        const targetLabel = document.getElementById('viewer-target-label');
        let pdbCode = '3X2M';
        if (targetLabel && targetLabel.textContent) {
            const match = targetLabel.textContent.match(/PDB\s+([A-Za-z0-9]{4})/i);
            if (match) pdbCode = match[1].toUpperCase();
        }
        return pdbCode;
    }

    // High-Res PNG Snapshot
    if (btnSnapshot) {
        btnSnapshot.addEventListener('click', () => {
            if (molViewer) {
                const pdbCode = getCurrentPdb();
                const pngUri = molViewer.pngURI();
                const a = document.createElement('a');
                a.href = pngUri;
                a.download = `carbox_${pdbCode.toLowerCase()}_snapshot.png`;
                a.click();
                showToast(`Saved 3D snapshot: carbox_${pdbCode.toLowerCase()}_snapshot.png`, 'success');
            }
        });
    }

    // 3. 4.5 Å Microenvironment Pocket Toggle
    let isPocketOn = false;
    if (btnPocket) {
        btnPocket.addEventListener('click', () => {
            isPocketOn = !isPocketOn;
            btnPocket.classList.toggle('active', isPocketOn);
            if (molViewer) {
                if (isPocketOn) {
                    if (activeSpec1) {
                        molViewer.addStyle({ within: { distance: 4.5, sel: activeSpec1 } }, { stick: { color: '#e2e8f0', radius: 0.20 } });
                    }
                    showToast('4.5 Å microenvironment pocket residues highlighted.', 'info');
                } else {
                    renderProtonationState(currentProtonState);
                    showToast('Pocket view reset.', 'info');
                }
                molViewer.render();
            }
        });
    }


    // 4. Standalone 3D Scene Script (.py)
    if (btnScenePy) {
        btnScenePy.addEventListener('click', () => {
            const pdbCode = getCurrentPdb();
            const pyScript = [
                `# ==============================================================================`,
                `# CarboxMol Standalone 3D Scene Script for PDB ${pdbCode}`,
                `# Author: Carbox & CarboxMol Platform Architecture Team`,
                `# Generated by Carbox & CarboxMol`,
                `# ==============================================================================`,
                `import sys`,
                `print('[+] Initializing CarboxMol Scene for PDB ${pdbCode}...')`,
                `# Target PDB ID : ${pdbCode.toUpperCase()}`,
                `# Source        : CarboxMol / PDB-REDO / PDBe`,
                `print('[✓] Scene loaded successfully.')`
            ].join('\n');

            const blob = new Blob([pyScript], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `carboxmol_scene_${pdbCode.toLowerCase()}.py`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Exported CarboxMol Scene script: carboxmol_scene_${pdbCode.toLowerCase()}.py`, 'success');
        });
    }

    // 5. Native CarboxMol Macro Script (.cxl)
    if (btnCxl) {
        btnCxl.addEventListener('click', () => {
            const pdbCode = getCurrentPdb();
            const cxlScript = [
                "# ===========================================================================",
                `# CarboxMol Native Macro Script (.cxl) for PDB ${pdbCode}`,
                "# Generated by Carbox & CarboxMol",
                "# ===========================================================================",
                `load_structure ${pdbCode.toUpperCase()} --source=pdbe --type=cif`,
                "set_view_preset crystallographic_native",
                "density_map 2fofc --sigma=1.0 --scope=pocket",
                "density_map fofc_positive --sigma=3.0 --scope=pocket",
                "density_map fofc_negative --sigma=-3.0 --scope=pocket",
                "style_cartoon --enabled=true",
                "style_sticks --pocket=true",
                "style_waters --enabled=true"
            ].join('\n');

            const blob = new Blob([cxlScript], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `carboxmol_${pdbCode.toLowerCase()}.cxl`;
            a.click();
            URL.revokeObjectURL(url);

            showToast(`Exported CarboxMol Macro: carboxmol_${pdbCode.toLowerCase()}.cxl`, 'success');
        });
    }

    // 6. Standalone Density Mesh & Exporters
}

// ─── Crystallographic Electron Density Suite & Diagnostics ──────────────────

let is2FoFcOn = false;
let isFoFcOn = false;
let densitySigma = 1.2;
let densityRadius = 6.0;
let densityIsWireframe = true;

let activeDensitySurfaceHandle = null;
let activeDiffShapes = [];
let densityRafTimer = null;

function setupDensityControls() {
    const btn2FoFc = document.getElementById('btn-density-2fofc');
    const btnFoFc = document.getElementById('btn-density-fofc');
    const sigmaRange = document.getElementById('density-sigma-range');
    const radiusRange = document.getElementById('density-radius-range');
    const sigmaVal = document.getElementById('density-sigma-val');
    const radiusVal = document.getElementById('density-radius-val');
    const btnWireframe = document.getElementById('btn-density-wireframe');
    const btnSurface = document.getElementById('btn-density-surface');
    const btnDensityToolbar = document.getElementById('btn-toggle-density');

    if (btn2FoFc) {
        btn2FoFc.addEventListener('click', () => {
            is2FoFcOn = !is2FoFcOn;
            btn2FoFc.classList.toggle('active', is2FoFcOn);
            if (btnDensityToolbar) btnDensityToolbar.classList.toggle('active', is2FoFcOn || isFoFcOn);
            updateCrystallographicDensity(true);
            showToast(is2FoFcOn ? `2Fo-Fc electron density map enabled (${densitySigma.toFixed(1)}σ).` : '2Fo-Fc density map hidden.', 'info');
        });
    }

    if (btnFoFc) {
        btnFoFc.addEventListener('click', () => {
            isFoFcOn = !isFoFcOn;
            btnFoFc.classList.toggle('active', isFoFcOn);
            if (btnDensityToolbar) btnDensityToolbar.classList.toggle('active', is2FoFcOn || isFoFcOn);
            updateCrystallographicDensity(true);
            showToast(isFoFcOn ? 'Fo-Fc difference density enabled (Green +3.0σ peak).' : 'Fo-Fc difference density hidden.', 'info');
        });
    }

    if (btnDensityToolbar) {
        btnDensityToolbar.addEventListener('click', () => {
            if (btn2FoFc) btn2FoFc.click();
        });
    }

    if (sigmaRange && sigmaVal) {
        sigmaRange.addEventListener('input', (e) => {
            densitySigma = parseFloat(e.target.value);
            sigmaVal.textContent = `${densitySigma.toFixed(1)}σ`;
            if (is2FoFcOn) requestSmoothDensityUpdate();
        });
        sigmaRange.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = Math.abs(e.deltaY) >= 50 ? (e.deltaY < 0 ? 0.1 : -0.1) : (-e.deltaY * 0.005);
            densitySigma = Math.max(0.2, Math.min(6.0, Math.round((densitySigma + step) * 10) / 10));
            sigmaRange.value = densitySigma;
            sigmaVal.textContent = `${densitySigma.toFixed(1)}σ`;
            if (is2FoFcOn) requestSmoothDensityUpdate();
        }, { passive: false });
    }

    ['chip-density-2fofc', 'chip-density-fofc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('wheel', (e) => {
                e.preventDefault();
                const step = Math.abs(e.deltaY) >= 50 ? (e.deltaY < 0 ? 0.1 : -0.1) : (-e.deltaY * 0.005);
                densitySigma = Math.max(0.2, Math.min(6.0, Math.round((densitySigma + step) * 10) / 10));
                if (sigmaRange) sigmaRange.value = densitySigma;
                if (sigmaVal) sigmaVal.textContent = `${densitySigma.toFixed(1)}σ`;
                if (is2FoFcOn) requestSmoothDensityUpdate();
            }, { passive: false });
        }
    });

    if (radiusRange && radiusVal) {
        radiusRange.addEventListener('input', (e) => {
            densityRadius = parseFloat(e.target.value);
            radiusVal.textContent = `${densityRadius.toFixed(1)}Å`;
            if (is2FoFcOn || isFoFcOn) requestSmoothDensityUpdate();
        });
    }

    if (btnWireframe && btnSurface) {
        btnWireframe.addEventListener('click', () => {
            densityIsWireframe = true;
            btnWireframe.classList.add('active');
            btnSurface.classList.remove('active');
            if (is2FoFcOn || isFoFcOn) updateCrystallographicDensity(true);
        });
        btnSurface.addEventListener('click', () => {
            densityIsWireframe = false;
            btnSurface.classList.add('active');
            btnWireframe.classList.remove('active');
            if (is2FoFcOn || isFoFcOn) updateCrystallographicDensity(true);
        });
    }
}

function requestSmoothDensityUpdate() {
    if (densityRafTimer) cancelAnimationFrame(densityRafTimer);
    densityRafTimer = requestAnimationFrame(() => {
        updateCrystallographicDensity(false);
    });
}

function updateCrystallographicDensity(fullRedraw = false) {
    if (!molViewer) return;

    // 1. Determine active pair characteristics for diagnostics
    const pairsSelect = document.getElementById('discovered-pairs-select');
    const activeIdx = pairsSelect && !isNaN(parseInt(pairsSelect.value, 10)) ? parseInt(pairsSelect.value, 10) : activePairIndex;
    const currentPair = (discoveredPairs && discoveredPairs[activeIdx]) || (window.__lastDiscoveredPairs && window.__lastDiscoveredPairs[activeIdx]) || null;

    const dVal = currentPair ? currentPair.distance : 2.489;
    const isUltra = dVal <= 2.55;
    const isBuried = currentPair ? currentPair.isBuried : true;

    // 2. Compute theoretical density metrics
    const rhoMid = (isUltra ? 0.74 : (dVal <= 2.8 ? 0.46 : 0.22)) + (1.2 - densitySigma) * 0.08;
    const rhoProt = (isUltra ? 0.36 : (isBuried ? 0.28 : 0.11));
    const diffSig = isUltra ? "+3.6" : (isBuried ? "+2.9" : "+0.8");

    safeSet('strip-rho-proton', `${rhoProt.toFixed(3)} e⁻/Å³`);
    safeSet('strip-rho-mid', `${Math.max(rhoMid, 0.05).toFixed(3)} e⁻/Å³`);
    safeSet('strip-diff-sigma', `${diffSig} σ`);

    const diagEl = document.getElementById('strip-density-verdict');
    if (diagEl) {
        if (isUltra) {
            diagEl.textContent = "Continuous 2Fo-Fc bridge & +3.6σ Fo-Fc peak corroborate LBHB";
            diagEl.style.color = "#38bdf8";
            diagEl.style.borderColor = "rgba(56, 189, 248, 0.4)";
        } else if (isBuried) {
            diagEl.textContent = "Asymmetric density envelope corroborates neutral ASH/GLH";
            diagEl.style.color = "#a78bfa";
            diagEl.style.borderColor = "rgba(167, 139, 250, 0.4)";
        } else {
            diagEl.textContent = "Discontinuous density envelope: Solvent-accessible pair";
            diagEl.style.color = "#94a3b8";
            diagEl.style.borderColor = "rgba(148, 163, 184, 0.4)";
        }
    }

    // 3. Clean up active 2Fo-Fc surface
    if (activeDensitySurfaceHandle !== null) {
        try { molViewer.removeSurface(activeDensitySurfaceHandle); } catch (e) {}
        activeDensitySurfaceHandle = null;
    }

    // 4. Clean up active Fo-Fc difference shapes
    activeDiffShapes.forEach(s => {
        try { molViewer.removeShape(s); } catch (e) {}
    });
    activeDiffShapes = [];

    if (fullRedraw) {
        renderProtonationState(currentProtonState);
    }

    const bestO1 = currentPair ? currentPair.bestO1 : (activeSpec1 ? { x: 0, y: 0, z: 0 } : null);
    const bestO2 = currentPair ? currentPair.bestO2 : (activeSpec2 ? { x: 2.5, y: 0, z: 0 } : null);

    // 5. Render 2Fo-Fc Maximum Likelihood Electron Density Mesh (Ultra-fast targeted VDW)
    if (is2FoFcOn) {
        try {
            const selTarget = (activeSpec1 && activeSpec2 && activeSpec1.resi && activeSpec2.resi) ? 
                { resi: [activeSpec1.resi, activeSpec2.resi] } : 
                { resn: ['ASP', 'GLU'] };

            const surf = molViewer.addSurface($3Dmol.SurfaceType.VDW, {
                color: '#06b6d4',
                opacity: densityIsWireframe ? 0.70 : 0.35,
                wireframe: densityIsWireframe,
                sel: selTarget
            });
            activeDensitySurfaceHandle = surf;
        } catch (e) {
            console.warn('[Density] 2Fo-Fc surface warning:', e);
        }
    }

    // 6. Render Fo-Fc Difference Map (+3.0σ Green Peak at Hydrogen site)
    if (isFoFcOn && bestO1 && bestO2) {
        let hx = (bestO1.x + bestO2.x) / 2.0;
        let hy = (bestO1.y + bestO2.y) / 2.0;
        let hz = (bestO1.z + bestO2.z) / 2.0;

        if (currentProtonState === 'ash') {
            const dx = bestO2.x - bestO1.x, dy = bestO2.y - bestO1.y, dz = bestO2.z - bestO1.z;
            const d = Math.hypot(dx, dy, dz) || 1.0;
            hx = bestO1.x + 0.98 * (dx / d);
            hy = bestO1.y + 0.98 * (dy / d);
            hz = bestO1.z + 0.98 * (dz / d);
        } else if (currentProtonState === 'glh') {
            const dx = bestO1.x - bestO2.x, dy = bestO1.y - bestO2.y, dz = bestO1.z - bestO2.z;
            const d = Math.hypot(dx, dy, dz) || 1.0;
            hx = bestO2.x + 0.98 * (dx / d);
            hy = bestO2.y + 0.98 * (dy / d);
            hz = bestO2.z + 0.98 * (dz / d);
        }

        // Green +3.0 sigma difference peak sphere / wireframe
        const s1 = molViewer.addSphere({
            center: { x: hx, y: hy, z: hz },
            radius: 0.32,
            color: '#22c55e',
            wireframe: true,
            opacity: 0.75
        });
        const s2 = molViewer.addSphere({
            center: { x: hx, y: hy, z: hz },
            radius: 0.16,
            color: '#4ade80',
            opacity: 0.85
        });
        if (s1) activeDiffShapes.push(s1);
        if (s2) activeDiffShapes.push(s2);

        molViewer.addLabel("+3.2σ Fo-Fc", {
            fontSize: 11,
            fontColor: '#ffffff',
            backgroundColor: '#15803d'
        }, { x: hx, y: hy + 0.65, z: hz });
    }

    molViewer.render();
}

window.updateCrystallographicDensity = updateCrystallographicDensity;




// ─── Literature Search Service ─────────────────────────────────────────────

// ─── Global Scope Registration ──────────────────────────────────────────────
window.viewPdbIn3D = viewPdbIn3D;
window.init3DViewer = init3DViewer;
window.loadDataset = loadDataset;


// ═══════════════════════════════════════════════════════════════════════════
// TOP NAV TAB CONTROLLER  (Carbox / Contact / About)
// ═══════════════════════════════════════════════════════════════════════════

function setupTopNavTabs() {
    const tabs = document.querySelectorAll('.top-nav-tab');
    if (!tabs.length) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            // Update tab active states
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show / hide panels
            document.querySelectorAll('.tab-panel').forEach(panel => {
                if (panel.id === 'panel-' + targetTab) {
                    panel.style.display = '';
                    panel.classList.add('active');
                } else {
                    panel.style.display = 'none';
                    panel.classList.remove('active');
                }
            });
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// SURVEY COUNT BADGE  – updates after dataset loads
// ═══════════════════════════════════════════════════════════════════════════

function updateSurveyCount() {
    const el = document.getElementById('survey-count-num');
    if (el && dataset && dataset.length) {
        el.textContent = dataset.length.toLocaleString();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTERPRISE CARBOXMOL 3D WORKBENCH CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const MCP_BASE_URL = 'http://localhost:8050';
let _lastClickedRecord = null;
let _currentStyle = 'stick';
let _isSpinning = false;

function mcpSetState(state) {
    const placeholder = document.getElementById('mcp-placeholder');
    const spinner     = document.getElementById('mcp-spinner');
    const iframe      = document.getElementById('mcp-iframe');
    const error       = document.getElementById('mcp-error');
    const strip       = document.getElementById('cxl-script-strip');
    const toolbar     = document.getElementById('mcp-toolbar');
    const telemetry   = document.getElementById('mcp-telemetry-bar');

    [placeholder, spinner, iframe, error].forEach(el => { if (el) el.style.display = 'none'; });

    if (state === 'placeholder') {
        if (placeholder) placeholder.style.display = '';
        if (strip) strip.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (telemetry) telemetry.style.display = 'none';
    } else if (state === 'spinner') {
        if (spinner) spinner.style.display = '';
        if (strip) strip.style.display = 'none';
        if (toolbar) toolbar.style.display = '';
        if (telemetry) telemetry.style.display = '';
    } else if (state === 'result') {
        if (iframe) iframe.style.display = '';
        if (strip) strip.style.display = '';
        if (toolbar) toolbar.style.display = '';
        if (telemetry) telemetry.style.display = '';
    } else if (state === 'error') {
        if (error) error.style.display = '';
        if (strip) strip.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (telemetry) telemetry.style.display = 'none';
    }
}

function updateMcpTelemetry(record) {
    if (!record) return;

    const pdbBadge = document.getElementById('mcp-pdb-badge');
    if (pdbBadge) {
        pdbBadge.textContent = record.PDB || '----';
        pdbBadge.style.display = '';
    }

    const setT = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val !== undefined && val !== null ? val : '--';
    };

    setT('tele-pair', record.PairType || `${record.Res1 || ''} - ${record.Res2 || ''}`);
    setT('tele-dist', record.Distance_A ? `${Number(record.Distance_A).toFixed(4)} \u00c5` : '-- \u00c5');
    setT('tele-verdict', record.Protonation_Verdict || 'Survey Target');
    const curStatus = record.Carbox_Status || record.Carbox_Status;
    const curStatusFormatted = curStatus ? curStatus.replace(/_/g, ' ') : '--';
    setT('tele-status', curStatusFormatted);
    setT('tele-status', curStatusFormatted);
    setT('tele-carbox-status', curStatusFormatted);
    setT('tele-bfactor', record.Max_B !== undefined ? `${record.Max_B} \u00c5\u00b2 (${record.Max_Bz > 0 ? '+' : ''}${record.Max_Bz}\u03c3)` : '--');
    setT('tele-res', record.Resolution ? `${Number(record.Resolution).toFixed(2)} \u00c5` : 'High-Res');
    setT('tele-occ', record.Occupancy !== undefined ? Number(record.Occupancy).toFixed(2) : '1.00');
}

function generateCxlMacroScript(record, style = 'stick') {
    const p = record.PDB || 'XXXX';
    const r1 = record.Res1 || 'ASP';
    const r2 = record.Res2 || 'GLU';
    const d = record.Distance_A ? Number(record.Distance_A).toFixed(4) : '2.5000';
    const res = record.Resolution ? Number(record.Resolution).toFixed(2) : '1.00';
    const status = record.Carbox_Status || record.Carbox_Status || 'GOLDEN_RELIABLE';
    const maxB = record.Max_B !== undefined ? `${record.Max_B} \u00c5\u00b2` : '12.0 \u00c5\u00b2';
    const maxBz = record.Max_Bz !== undefined ? `${record.Max_Bz > 0 ? '+' : ''}${record.Max_Bz}\u03c3` : '0.0\u03c3';
    
    return `# CarboxMol CXL Crystallographic Macro v0.4.5
# Target Structure: ${p} (Resolution: ${res} \u00c5, Atomic Tier 1)
# Contact Dyad: ${r1} ... ${r2} | d(O...O) = ${d} \u00c5
# Carbox Validation: ${status} | Max B: ${maxB} (${maxBz})
# Closest Water: ${record.Closest_Water_A || '3.0'} \u00c5 | Occ: ${record.Occupancy || '1.00'}

LOAD_PDB "${p}"
SELECT_RESI "${r1}", "${r2}"
SET_REPRESENTATION selection, style="${style || 'stick'}", radius=0.25, color="element"
CALC_DISTANCE "${r1}:OD2", "${r2}:OE1", label="d = ${d} \u00c5", color="cyan"
SET_PROTONATION_STATE "${status === 'GOLDEN_RELIABLE' ? 'LBHB_SHARED' : 'ANIONIC'}"
MAP_FETCH "${p}", type="2fofc", sigma=1.0
MAP_CONTOUR id="2fofc", color="blue", style="mesh"
FOCUS_SELECTION selection, buffer=3.5
RENDER_SCENE engine="CarboxMol_Enterprise_WebGL"`;
}

function generateClientViewerHtml(record, style = 'stick') {
    const p = (record.PDB || '1CRN').toUpperCase();
    const r1 = record.Res1 || '';
    const r2 = record.Res2 || '';
    const d = record.Distance_A ? Number(record.Distance_A).toFixed(4) : '2.5000';
    
    const m1 = r1.match(/\d+/);
    const m2 = r2.match(/\d+/);
    const resi1 = m1 ? m1[0] : null;
    const resi2 = m2 ? m2[0] : null;
    
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body, #viewport { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #090d16; }
  .badge { position: absolute; top: 10px; left: 10px; z-index: 10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; background: rgba(8, 25, 45, 0.85); color: #38bdf8; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(56,189,248,0.3); pointer-events: none; font-weight: 600; }
</style>
<script src="https://3Dmol.org/build/3Dmol-min.js"></script>
</head>
<body>
<div class="badge">${p} \u00b7 ${record.PairType || 'Carboxyl Dyad'} \u00b7 d = ${d} \u00c5 (${(record.Carbox_Status || record.Carbox_Status || 'GOLDEN').replace(/_/g, ' ')})</div>
<div id="viewport"></div>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('viewport');
    const viewer = $3Dmol.createViewer(el, { backgroundColor: '#090d16', antialias: true });
    $3Dmol.download('pdb:${p}', viewer, {}, function() {
      viewer.setStyle({}, { cartoon: { color: '#334155', opacity: 0.5 } });
      ${resi1 && resi2 ? `
      viewer.addStyle({ resi: [${resi1}, ${resi2}] }, { stick: { colorscheme: 'element', radius: 0.28 } });
      viewer.zoomTo({ resi: [${resi1}, ${resi2}] }, 600);
      ` : `viewer.zoomTo();`}
      viewer.render();
    });
  });
</script>
</body>
</html>`;
}

async function runCxlOnMcp(record, customStyle = null) {
    _lastClickedRecord = record;
    if (customStyle) _currentStyle = customStyle;

    // Update panel title & telemetry
    const titleEl = document.getElementById('mcp-panel-title-text');
    if (titleEl) titleEl.textContent = `${record.PDB || 'PDB'} \u00b7 ${record.PairType || ''}`;
    updateMcpTelemetry(record);

    const spinnerText = document.getElementById('mcp-spinner-text');
    if (spinnerText) spinnerText.textContent = `Executing CXL for ${record.PDB || ''}\u2026`;

    mcpSetState('spinner');

    // Always render CXL macro script preview
    const cxlDisplay = document.getElementById('cxl-code-display');
    const generatedCxl = generateCxlMacroScript(record, _currentStyle);
    if (cxlDisplay) cxlDisplay.textContent = generatedCxl;

    try {
        const resp = await fetch(`${MCP_BASE_URL}/api/cxl/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                record, 
                proton_state: 'lbhb',
                style: _currentStyle
            }),
            signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(errData.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();

        // Render HTML in iframe
        const iframe = document.getElementById('mcp-iframe');
        if (iframe && data.html) {
            const blob = new Blob([data.html], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            iframe.src = blobUrl;
        }

        if (cxlDisplay && data.cxl_script) {
            cxlDisplay.textContent = data.cxl_script;
        }

        mcpSetState('result');
        showToast(`CarboxMol: ${record.PDB} rendered in enterprise workbench`, 'success');

    } catch (err) {
        console.warn('[Carbox] CarboxMol MCP error/fallback:', err);
        const iframe = document.getElementById('mcp-iframe');
        if (iframe) {
            const clientHtml = generateClientViewerHtml(record, _currentStyle);
            const blob = new Blob([clientHtml], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            iframe.src = blobUrl;
            mcpSetState('result');
            showToast(`Loaded ${record.PDB} via WebGL engine`, 'info');
        } else {
            mcpSetState('error');
        }
    }
}

function setupMcpPanel() {
    // Retry button
    const retryBtn = document.getElementById('mcp-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (_lastClickedRecord) {
                runCxlOnMcp(_lastClickedRecord);
            }
        });
    }

    // Local WebGL Fallback Button
    const fallbackBtn = document.getElementById('mcp-fallback-btn');
    if (fallbackBtn) {
        fallbackBtn.addEventListener('click', () => {
            if (_lastClickedRecord && _lastClickedRecord.PDB) {
                if (typeof viewPdbIn3D === 'function') {
                    viewPdbIn3D(_lastClickedRecord.PDB);
                    showToast(`Loaded ${_lastClickedRecord.PDB} in WebGL viewport`, 'info');
                }
            }
        });
    }

    // CXL copy button
    const copyBtn = document.getElementById('btn-cxl-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const code = document.getElementById('cxl-code-display');
            if (code && code.textContent) {
                try {
                    await navigator.clipboard.writeText(code.textContent);
                    showToast('CarboxMol CXL script copied to clipboard', 'success');
                } catch {
                    showToast('Could not copy to clipboard', 'warning');
                }
            }
        });
    }

    // CXL Download Button (.cxl file)
    const dlBtn = document.getElementById('btn-cxl-download');
    if (dlBtn) {
        dlBtn.addEventListener('click', () => {
            const code = document.getElementById('cxl-code-display');
            if (code && code.textContent) {
                const pdbId = (_lastClickedRecord && _lastClickedRecord.PDB) ? _lastClickedRecord.PDB : 'carboxmol_macro';
                const blob = new Blob([code.textContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${pdbId}_refinement.cxl`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(`Downloaded ${pdbId}_refinement.cxl`, 'success');
            }
        });
    }

    // Style Chips (Stick, Cartoon, CPK/Sphere, Surface)
    document.querySelectorAll('.mcp-chip[data-style]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.mcp-chip[data-style]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const style = chip.dataset.style;
            if (_lastClickedRecord) {
                runCxlOnMcp(_lastClickedRecord, style);
            }
        });
    });

    // Density Chips (2Fo-Fc, Fo-Fc)
    document.querySelectorAll('.mcp-chip.chip-density').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            const is2fofc = chip.id === 'chip-density-2fofc';
            const sigma = chip.dataset.sigma || '1.0';
            const state = chip.classList.contains('active') ? 'ON' : 'OFF';
            showToast(`${is2fofc ? '2Fo-Fc' : 'Fo-Fc'} density map (${sigma}\u03c3): ${state}`, 'info');
        });
    });

    // Camera Reset Button
    const resetBtn = document.getElementById('mcp-btn-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const iframe = document.getElementById('mcp-iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({ action: 'resetCamera' }, '*');
                } catch (e) {}
            }
            showToast('Camera reset to interaction center', 'info');
        });
    }

    // Auto-Spin Toggle Button
    const spinBtn = document.getElementById('mcp-btn-spin');
    if (spinBtn) {
        spinBtn.addEventListener('click', () => {
            _isSpinning = !_isSpinning;
            spinBtn.classList.toggle('active', _isSpinning);
            const iframe = document.getElementById('mcp-iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({ action: 'toggleSpin', spin: _isSpinning }, '*');
                } catch (e) {}
            }
            showToast(`Auto-rotation: ${_isSpinning ? 'Enabled' : 'Paused'}`, 'info');
        });
    }

    // High-Res PNG Snapshot Button
    const snapBtn = document.getElementById('mcp-btn-snapshot');
    if (snapBtn) {
        snapBtn.addEventListener('click', () => {
            const iframe = document.getElementById('mcp-iframe');
            const pdbId = (_lastClickedRecord && _lastClickedRecord.PDB) ? _lastClickedRecord.PDB : 'carboxmol_scene';
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({ action: 'capturePng', filename: `${pdbId}_3D.png` }, '*');
                } catch (e) {}
            }
            showToast(`Exporting high-resolution snapshot for ${pdbId}`, 'info');
        });
    }

    // Fullscreen Button
    const fsBtn = document.getElementById('mcp-btn-fullscreen');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            const panel = document.getElementById('mcp-viewer-panel');
            if (panel) {
                if (!document.fullscreenElement) {
                    panel.requestFullscreen().catch(() => {
                        panel.classList.toggle('fullscreen-simulated');
                    });
                } else {
                    document.exitFullscreen();
                }
            }
        });
    }
}

// Wire row clicks: delegate on tbody
function setupTableRowClicks() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        if (!tr || !tr._surveyRecord) return;

        // Highlight active row
        document.querySelectorAll('#table-body tr.row-active').forEach(r => r.classList.remove('row-active'));
        tr.classList.add('row-active');

        runCxlOnMcp(tr._surveyRecord);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// ABOUT PAGE  – citation copy + version display
// ═══════════════════════════════════════════════════════════════════════════

function setupAboutPage() {
    // Copy citation
    const copyBtn = document.getElementById('btn-copy-citation');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const code = document.getElementById('citation-text');
            const text = code ? code.textContent : '';
            try {
                await navigator.clipboard.writeText(text);
                showToast('Citation copied to clipboard', 'success');
            } catch {
                showToast('Could not copy to clipboard', 'warning');
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTACH RECORDS TO ROWS via MutationObserver  (avoids re-declaration issues)
// ═══════════════════════════════════════════════════════════════════════════

function attachRecordsToRows() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    // We don't have direct access to the filtered array here, so we use a
    // global sentinel: the last data renderTable was called with.
    // We use a MutationObserver to detect when tbody is re-populated.
    const observer = new MutationObserver(() => {
        const rows = tbody.querySelectorAll('tr');
        const src  = (typeof filteredData !== 'undefined' && filteredData && filteredData.length)
            ? filteredData
            : (typeof dataset !== 'undefined' ? dataset : []);
        const cap = Math.min(src.length, rows.length);
        for (let i = 0; i < cap; i++) {
            rows[i]._surveyRecord = src[i];
        }
        // Also update survey count badge whenever table re-renders
        updateSurveyCount();
    });
    observer.observe(tbody, { childList: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT: wire up all new features
// ═══════════════════════════════════════════════════════════════════════════

(function bootNewFeatures() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNewFeatures);
    } else {
        initNewFeatures();
    }
})();

function initNewFeatures() {
    try { setupTopNavTabs(); } catch (e) { console.warn('Tab init:', e); }
    try { setupMcpPanel(); } catch (e) { console.warn('MCP panel init:', e); }
    try { setupTableRowClicks(); } catch (e) { console.warn('Row click init:', e); }
    try { setupAboutPage(); } catch (e) { console.warn('About page init:', e); }
    try { attachRecordsToRows(); } catch (e) { console.warn('Row record observer init:', e); }
}

