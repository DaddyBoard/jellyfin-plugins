(function () {
    if (window.MoreTabs) {
        return;
    }

    var STYLE_ID = 'moretabs-style';
    var OVERLAY_ID = 'moretabs-overlay';
    var FRAME_ID = 'moretabs-frame';
    var NAV_ATTR = 'data-moretabs-id';
    var HASH_PREFIX = '#/moretabs/';

    var state = {
        tabs: [],
        loaded: false,
        injectTimer: 0,
        lastError: null
    };

    function isVisible(el) {
        if (!el) {
            return false;
        }
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function authHeaders() {
        var headers = { accept: 'application/json' };
        try {
            var token = window.ApiClient && window.ApiClient.accessToken && window.ApiClient.accessToken();
            if (token) {
                headers.Authorization = 'MediaBrowser Token="' + token + '"';
                headers['X-Emby-Token'] = token;
            }
        } catch (e) {
            state.lastError = String(e);
        }
        return headers;
    }

    function configUrl() {
        return window.ApiClient.getUrl('MoreTabs/Config');
    }

    function loadTabs() {
        if (!window.ApiClient || !window.ApiClient.getCurrentUserId || !window.ApiClient.getCurrentUserId()) {
            return Promise.resolve([]);
        }
        return fetch(configUrl(), { headers: authHeaders(), credentials: 'same-origin' })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('MoreTabs/Config HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (tabs) {
                state.tabs = Array.isArray(tabs) ? tabs : [];
                state.loaded = true;
                state.lastError = null;
                return state.tabs;
            })
            .catch(function (error) {
                state.lastError = String(error);
                console.error('MoreTabs: failed to load tabs', error);
                return state.tabs;
            });
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' + OVERLAY_ID + '{position:fixed;left:0;right:0;bottom:0;z-index:1050;background:var(--theme-body-bg,#101010);display:none;}',
            '#' + OVERLAY_ID + '.is-open{display:block;}',
            '#' + FRAME_ID + '{width:100%;height:100%;border:0;background:transparent;}',
            '.moretabs-nav-btn{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:6px 10px;margin:0 2px;border:0;background:transparent;color:inherit;text-decoration:none;text-transform:none;font:inherit;cursor:pointer;opacity:.72;border-radius:8px;}',
            '.moretabs-nav-btn:hover,.moretabs-nav-btn.is-active{opacity:1;}',
            '.moretabs-nav-btn .material-icons{font-size:20px;line-height:1;}',
            '.moretabs-drawer-btn{display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;border:0;background:transparent;color:inherit;text-decoration:none;font:inherit;cursor:pointer;opacity:.85;text-align:left;}',
            '.moretabs-drawer-btn.is-active,.moretabs-drawer-btn:hover{opacity:1;}'
        ].join('');
        document.head.appendChild(style);
    }

    function appBarBottom() {
        var bar = document.querySelector('.MuiAppBar-root, .skinHeader, header');
        if (bar && isVisible(bar)) {
            return Math.max(48, Math.round(bar.getBoundingClientRect().bottom));
        }
        return 64;
    }

    function ensureOverlay() {
        var overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        var frame = document.createElement('iframe');
        frame.id = FRAME_ID;
        frame.setAttribute('allowfullscreen', 'allowfullscreen');
        frame.setAttribute('allow', 'fullscreen');
        overlay.appendChild(frame);
        document.body.appendChild(overlay);
        return overlay;
    }

    function currentTabId() {
        var hash = window.location.hash || '';
        if (hash.indexOf(HASH_PREFIX) === 0) {
            return decodeURIComponent(hash.slice(HASH_PREFIX.length).split('?')[0]);
        }
        return '';
    }

    function findTab(id) {
        for (var i = 0; i < state.tabs.length; i++) {
            if (state.tabs[i].Id === id) {
                return state.tabs[i];
            }
        }
        return null;
    }

    function setActive(id) {
        document.querySelectorAll('[' + NAV_ATTR + ']').forEach(function (el) {
            if (el.getAttribute(NAV_ATTR) === id) {
                el.classList.add('is-active');
            } else {
                el.classList.remove('is-active');
            }
        });
    }

    function hideOverlay() {
        var overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            overlay.classList.remove('is-open');
            var frame = document.getElementById(FRAME_ID);
            if (frame) {
                frame.removeAttribute('src');
            }
        }
        setActive('');
    }

    function showOverlay(tab) {
        ensureStyle();
        var overlay = ensureOverlay();
        overlay.style.top = appBarBottom() + 'px';
        var frame = document.getElementById(FRAME_ID);
        if (frame.getAttribute('src') !== tab.Url) {
            frame.setAttribute('src', tab.Url);
        }
        overlay.classList.add('is-open');
        setActive(tab.Id);
    }

    function openTab(tab) {
        var next = HASH_PREFIX + encodeURIComponent(tab.Id);
        if (window.location.hash !== next) {
            window.location.hash = next;
        } else {
            showOverlay(tab);
        }
    }

    function syncFromHash() {
        var id = currentTabId();
        if (!id) {
            hideOverlay();
            return;
        }
        var tab = findTab(id);
        if (tab) {
            showOverlay(tab);
        }
    }

    function createIcon(name) {
        if (!name) {
            return null;
        }
        var icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = name;
        return icon;
    }

    function createHeaderButton(tab) {
        var a = document.createElement('a');
        a.className = 'moretabs-nav-btn';
        a.setAttribute(NAV_ATTR, tab.Id);
        a.href = HASH_PREFIX + encodeURIComponent(tab.Id);
        a.title = tab.Title;
        var icon = createIcon(tab.Icon);
        if (icon) {
            a.appendChild(icon);
        }
        var label = document.createElement('span');
        label.textContent = tab.Title;
        a.appendChild(label);
        a.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            openTab(tab);
        });
        return a;
    }

    function createDrawerButton(tab) {
        var a = document.createElement('a');
        a.className = 'moretabs-drawer-btn';
        a.setAttribute(NAV_ATTR, tab.Id);
        a.href = HASH_PREFIX + encodeURIComponent(tab.Id);
        var icon = createIcon(tab.Icon);
        if (icon) {
            a.appendChild(icon);
        }
        var label = document.createElement('span');
        label.textContent = tab.Title;
        a.appendChild(label);
        a.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            openTab(tab);
        });
        return a;
    }

    function looksLikeFavorites(el) {
        var href = (el.getAttribute('href') || '').toLowerCase();
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return href.indexOf('tab=1') !== -1 || text === 'favorites' || text === 'favourites';
    }

    function looksLikeMore(el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return text === 'more' || el.getAttribute('aria-haspopup') === 'true' && text.indexOf('more') !== -1;
    }

    function findHeaderHost() {
        var toolbars = document.querySelectorAll('.MuiToolbar-root');
        for (var i = 0; i < toolbars.length; i++) {
            var toolbar = toolbars[i];
            if (!isVisible(toolbar)) {
                continue;
            }
            var links = toolbar.querySelectorAll('a,button');
            for (var j = 0; j < links.length; j++) {
                if (looksLikeFavorites(links[j])) {
                    return links[j].parentElement;
                }
            }
            if (toolbar.querySelector('a[href*="home"], a[href*="/list"]')) {
                return toolbar;
            }
        }
        return null;
    }

    function injectHeader() {
        var host = findHeaderHost();
        if (!host) {
            return false;
        }
        var existing = host.querySelectorAll('[' + NAV_ATTR + ']');
        if (existing.length === state.tabs.length) {
            return true;
        }
        existing.forEach(function (el) {
            el.remove();
        });
        var before = null;
        var children = Array.prototype.slice.call(host.children);
        for (var i = 0; i < children.length; i++) {
            if (looksLikeMore(children[i])) {
                before = children[i];
                break;
            }
        }
        state.tabs.forEach(function (tab) {
            var btn = createHeaderButton(tab);
            if (before) {
                host.insertBefore(btn, before);
            } else {
                host.appendChild(btn);
            }
        });
        return true;
    }

    function findDrawerHost() {
        var candidates = [
            document.querySelector('.MuiDrawer-paper'),
            document.querySelector('.mainDrawer-scrollContainer'),
            document.querySelector('.mainDrawer')
        ];
        for (var i = 0; i < candidates.length; i++) {
            if (isVisible(candidates[i])) {
                return candidates[i];
            }
        }
        return null;
    }

    function injectDrawer() {
        var host = findDrawerHost();
        if (!host) {
            return false;
        }
        var existing = host.querySelectorAll('[' + NAV_ATTR + ']');
        if (existing.length === state.tabs.length) {
            return true;
        }
        existing.forEach(function (el) {
            el.remove();
        });
        var wrap = host.querySelector('[data-moretabs-drawer]') || document.createElement('div');
        wrap.setAttribute('data-moretabs-drawer', '1');
        wrap.innerHTML = '';
        state.tabs.forEach(function (tab) {
            wrap.appendChild(createDrawerButton(tab));
        });
        if (!wrap.parentElement) {
            host.appendChild(wrap);
        }
        return true;
    }

    function inject() {
        if (!state.loaded || state.tabs.length === 0) {
            return;
        }
        ensureStyle();
        injectHeader();
        injectDrawer();
        syncFromHash();
    }

    function scheduleInject() {
        window.clearTimeout(state.injectTimer);
        state.injectTimer = window.setTimeout(inject, 80);
    }

    function startObserver() {
        if (!document.body) {
            return;
        }
        var observer = new MutationObserver(scheduleInject);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function hookHistory() {
        var originalPush = history.pushState;
        var originalReplace = history.replaceState;
        history.pushState = function () {
            var result = originalPush.apply(this, arguments);
            window.setTimeout(syncFromHash, 0);
            scheduleInject();
            return result;
        };
        history.replaceState = function () {
            var result = originalReplace.apply(this, arguments);
            window.setTimeout(syncFromHash, 0);
            scheduleInject();
            return result;
        };
        window.addEventListener('hashchange', function () {
            syncFromHash();
            scheduleInject();
        });
        window.addEventListener('popstate', function () {
            syncFromHash();
            scheduleInject();
        });
        window.addEventListener('resize', function () {
            var overlay = document.getElementById(OVERLAY_ID);
            if (overlay && overlay.classList.contains('is-open')) {
                overlay.style.top = appBarBottom() + 'px';
            }
        });
    }

    function waitForApi(attempt) {
        if (window.ApiClient && window.ApiClient.getCurrentUserId && window.ApiClient.getCurrentUserId()) {
            loadTabs().then(scheduleInject);
            return;
        }
        if (attempt > 80) {
            return;
        }
        window.setTimeout(function () {
            waitForApi(attempt + 1);
        }, 250);
    }

    window.MoreTabs = {
        getState: function () {
            return {
                tabs: state.tabs,
                loaded: state.loaded,
                lastError: state.lastError,
                hash: window.location.hash,
                headerHost: !!findHeaderHost(),
                drawerHost: !!findDrawerHost(),
                scriptInjected: !!document.querySelector('script[src*="MoreTabs/client.js"]'),
                favorites: Array.prototype.slice.call(document.querySelectorAll('a,button')).filter(looksLikeFavorites).map(function (el) {
                    return {
                        text: (el.textContent || '').trim(),
                        href: el.getAttribute('href'),
                        visible: isVisible(el)
                    };
                }),
                toolbars: Array.prototype.slice.call(document.querySelectorAll('.MuiToolbar-root')).map(function (el) {
                    return {
                        visible: isVisible(el),
                        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)
                    };
                })
            };
        },
        reload: function () {
            return loadTabs().then(scheduleInject);
        }
    };

    ensureStyle();
    hookHistory();
    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startObserver);
    }
    waitForApi(0);
    console.log('MoreTabs client loaded');
})();
