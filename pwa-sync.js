/**
 * Carbox & CarboxMol — Universal PWA Silent Background Synchronization & Offline Engine
 * Version: v0.4.5
 * Golden Rules: 100% Trilingual Parity (EN, AZ, HE) & Universal Cross-Platform Support.
 * Silent Protocol: Runs 100% in the background without intrusive banners or toasts.
 */

(function () {
    'use strict';

    const PWA_VERSION = 'v0.4.5';

    // ─── Trilingual Translations for PWA Engine Parity ───────────────────────────
    const PWA_I18N = {
        en: {
            badge_online: "● Online (Synced)",
            badge_offline: "○ Offline (Cached)",
            syncing: "Syncing...",
            sync_tooltip_online: "CarboxMol PWA: Connected & synchronized with latest version",
            sync_tooltip_offline: "CarboxMol PWA: Offline mode active. Full local workbench available",
            update_title: "Carbox & CarboxMol Update Ready",
            update_msg: "A new version of CarboxMol ({version}) is ready with the latest crystallographic algorithms and electron density maps.",
            btn_update_now: "Update Now",
            btn_dismiss: "Later",
            online_restored: "Internet connection restored. Synchronizing latest updates to offline storage...",
            offline_notice: "Offline Mode active. All crystallographic tools, 3D viewer & cached data are operational.",
            install_success: "Carbox / CarboxMol installed successfully to your device!",
            install_app: "Install App"
        },
        az: {
            badge_online: "● Onlayn (Sinxron)",
            badge_offline: "○ Oflayn (Keş)",
            syncing: "Sinxronlaşdırılır...",
            sync_tooltip_online: "CarboxMol PWA: Ən son versiya ilə əlaqəli və sinxronlaşdırılmışdır",
            sync_tooltip_offline: "CarboxMol PWA: Oflayn rejim aktivdir. Bütün yerli alətlər işləkdir",
            update_title: "Carbox və CarboxMol Yenilənməsi Hazırdır",
            update_msg: "CarboxMol-un ən son kristalloqrafik alqoritmlər və elektron sıxlıq xəritələri olan yeni versiyası ({version}) hazırdır.",
            btn_update_now: "İndi Yenilə",
            btn_dismiss: "Sonra",
            online_restored: "İnternet bərpa olundu. Ən son yeniliklər oflayn yaddaşa sinxronlaşdırılır...",
            offline_notice: "Oflayn rejim aktivdir. Bütün kristalloqrafik alətlər, 3D baxış və keşlənmiş məlumatlar işləkdir.",
            install_success: "Carbox / CarboxMol cihazınıza uğurla quraşdırıldı!",
            install_app: "Tətbiqi Quraşdır"
        },
        he: {
            badge_online: "● מקוון (מסונכרן)",
            badge_offline: "○ לא מקוון (מטמון)",
            syncing: "מסנכרן...",
            sync_tooltip_online: "CarboxMol PWA: מחובר ומסונכרן עם הגרסה האחרונה",
            sync_tooltip_offline: "CarboxMol PWA: מצב לא מקוון פעיל. כל הכלים המקומיים זמינים",
            update_title: "עדכון Carbox ו-CarboxMol מוכן",
            update_msg: "גרסה חדשה של CarboxMol ({version}) מוכנה עם האלגוריתמים והמפות הקריסטלוגרפיות העדכניות ביותר.",
            btn_update_now: "עדכן עכשיו",
            btn_dismiss: "מאוחר יותר",
            online_restored: "החיבור לאינטרנט שוחזר. מסנכרן עדכונים אחרונים לאחסון הלא מקוון...",
            offline_notice: "מצב לא מקוון פעיל. כל הכלים הקריסטלוגרפיים, תצוגת ה-3D והנתונים במטמון פועלים.",
            install_success: "Carbox / CarboxMol הותקן בהצלחה במכשיר שלך!",
            install_app: "התקן אפליקציה"
        }
    };

    let swRegistration = null;
    let deferredInstallPrompt = null;

    // ─── Silent Background Synchronization Engine ────────────────────────────────
    function initPwaEngine() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             window.navigator.standalone === true ||
                             (document.referrer && document.referrer.includes('android-app://'));

        const standaloneBadge = document.getElementById('badge-pwa-standalone');
        if (isStandalone && standaloneBadge) {
            standaloneBadge.style.display = 'inline-flex';
        }

        // Silent network state listeners (quiet background sync without toasts or banners)
        window.addEventListener('online', () => {
            if (swRegistration) {
                swRegistration.update().catch(() => {});
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
                }
            }
        });

        // Register Service Worker silently
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
                swRegistration = reg;
                console.log('[Carbox PWA] Service Worker registered silently:', reg.scope);

                // Listen for updates on the registration: activate immediately in background
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            // Automatically skip waiting to apply the new cache silently
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            console.log('[Carbox PWA] New update cached and activated silently in background.');
                        }
                    });
                });

                // Immediate background update check
                setTimeout(() => {
                    if (navigator.onLine) reg.update().catch(() => {});
                }, 1200);

                // Periodic silent update check every 60 seconds when online
                setInterval(() => {
                    if (navigator.onLine) reg.update().catch(() => {});
                }, 60000);
            }).catch((err) => {
                console.warn('[Carbox PWA] Registration error:', err);
            });

            // Listen for messages from Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (!event.data) return;
                if (event.data.type === 'PWA_ACTIVATED' || event.data.type === 'PWA_SYNC_COMPLETE') {
                    console.log('[Carbox PWA] Service Worker activated version:', event.data.version);
                }
            });
        }

        // Check for updates silently when switching back to app window
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && navigator.onLine && swRegistration) {
                swRegistration.update().catch(() => {});
            }
        });

        // ─── Native Install Prompt Handling ─────────────────────────────────────
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            const installBtns = document.querySelectorAll('.btn-pwa-install, #btn-pwa-install');
            installBtns.forEach(btn => {
                btn.style.display = 'inline-flex';
                btn.onclick = async () => {
                    if (deferredInstallPrompt) {
                        deferredInstallPrompt.prompt();
                        const { outcome } = await deferredInstallPrompt.userChoice;
                        if (outcome === 'accepted') {
                            installBtns.forEach(b => b.style.display = 'none');
                        }
                        deferredInstallPrompt = null;
                    }
                };
            });
        });

        window.addEventListener('appinstalled', () => {
            console.log('[Carbox PWA] App installed successfully.');
            if (standaloneBadge) standaloneBadge.style.display = 'inline-flex';
            const installBtns = document.querySelectorAll('.btn-pwa-install, #btn-pwa-install');
            installBtns.forEach(b => b.style.display = 'none');
        });
    }

    // Expose Global PWA Controller API for programmatic inspection
    window.CarboxPWA = {
        version: PWA_VERSION,
        isOnline: () => navigator.onLine,
        checkUpdate: () => {
            if (swRegistration && navigator.onLine) {
                return swRegistration.update();
            }
            return Promise.resolve();
        },
        syncNow: () => {
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPwaEngine);
    } else {
        initPwaEngine();
    }
})();
