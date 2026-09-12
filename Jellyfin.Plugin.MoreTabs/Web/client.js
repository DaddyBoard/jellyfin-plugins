(function () {
    if (window.MoreTabs) {
        return;
    }

    var STYLE_ID = 'moretabs-style-v5';
    var SKIN = '6';
    var OVERLAY_ID = 'moretabs-overlay';
    var FRAME_ID = 'moretabs-frame';
    var NAV_ATTR = 'data-moretabs-id';
    var HASH_PREFIX = '#/moretabs/';
    var QUERY_KEY = 'moretabs';

    var state = {
        tabs: [],
        loaded: false,
        injectTimer: 0,
        titleTimer: 0,
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
        ['moretabs-style', 'moretabs-style-v3'].forEach(function (id) {
            var stale = document.getElementById(id);
            if (stale) {
                stale.remove();
            }
        });
        var root = document.documentElement;
        root.style.removeProperty('--moretabs-nav-font-size');
        root.style.removeProperty('--moretabs-nav-font-weight');
        root.style.removeProperty('--moretabs-nav-line-height');
        root.style.removeProperty('--moretabs-nav-icon-size');
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' + OVERLAY_ID + '{position:fixed;left:0;right:0;bottom:0;z-index:1050;background:var(--theme-body-bg,#101010);display:none;}',
            '#' + OVERLAY_ID + '.is-open{display:block;}',
            '#' + FRAME_ID + '{width:100%;height:100%;border:0;background:transparent;}',
            'a[' + NAV_ATTR + ']{text-decoration:none;}',
            'a[' + NAV_ATTR + '].is-active{background-color:var(--mui-palette-action-hover,rgba(255,255,255,.08));}',
            '.moretabs-divider{display:inline-flex;align-items:center;padding:0 6px;margin:0 2px;opacity:.4;pointer-events:none;user-select:none;line-height:1;cursor:default;}',
            '.moretabs-drawer-btn{display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;border:0;background:transparent;color:inherit;text-decoration:none;font:inherit;cursor:pointer;opacity:.85;text-align:left;border-radius:8px;transition:background-color 150ms cubic-bezier(.4,0,.2,1),opacity 150ms cubic-bezier(.4,0,.2,1);}',
            '.moretabs-drawer-btn.is-active,.moretabs-drawer-btn:hover{opacity:1;background-color:rgba(255,255,255,.08);background-color:color-mix(in srgb,currentColor 8%,transparent);}',
            '.moretabs-drawer-divider{display:flex;align-items:center;justify-content:center;padding:4px 0;opacity:.35;pointer-events:none;user-select:none;cursor:default;}'
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

    function tabKey(tab) {
        return tab && (tab.Id || tab.id) || '';
    }

    function tabTitle(tab) {
        return tab && (tab.Title || tab.title) || 'MoreTabs';
    }

    function hashForTab(tab) {
        return '#/home?' + QUERY_KEY + '=' + encodeURIComponent(tabKey(tab));
    }

    function currentTabId() {
        var hash = window.location.hash || '';
        if (hash.indexOf(HASH_PREFIX) === 0) {
            return decodeURIComponent(hash.slice(HASH_PREFIX.length).split(/[?#]/)[0]);
        }
        var qIndex = hash.indexOf('?');
        if (qIndex < 0) {
            return '';
        }
        try {
            return new URLSearchParams(hash.slice(qIndex + 1)).get(QUERY_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function findTab(id) {
        for (var i = 0; i < state.tabs.length; i++) {
            if (tabKey(state.tabs[i]) === id) {
                return state.tabs[i];
            }
        }
        return null;
    }

    function serverName() {
        try {
            if (window.ApiClient && window.ApiClient.serverName) {
                var name = window.ApiClient.serverName();
                if (name) {
                    return name;
                }
            }
            if (window.ApiClient && window.ApiClient.serverInfo) {
                var info = window.ApiClient.serverInfo();
                if (info && info.ServerName) {
                    return info.ServerName;
                }
            }
        } catch (e) {
        }
        return '';
    }

    function desiredTitle(tab) {
        var name = serverName();
        var title = tabTitle(tab);
        return name ? title + ' - ' + name : title;
    }

    function applyDocumentTitle(tab) {
        var wanted = desiredTitle(tab);
        if (document.title !== wanted) {
            document.title = wanted;
        }
    }

    function stopTitleWatch() {
        if (state.titleTimer) {
            window.clearInterval(state.titleTimer);
            state.titleTimer = 0;
        }
    }

    function startTitleWatch(tab) {
        stopTitleWatch();
        applyDocumentTitle(tab);
        state.titleTimer = window.setInterval(function () {
            var overlay = document.getElementById(OVERLAY_ID);
            if (!overlay || !overlay.classList.contains('is-open')) {
                stopTitleWatch();
                return;
            }
            applyDocumentTitle(tab);
        }, 400);
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
        stopTitleWatch();
    }

    function showOverlay(tab) {
        ensureStyle();
        var overlay = ensureOverlay();
        overlay.style.top = appBarBottom() + 'px';
        var frame = document.getElementById(FRAME_ID);
        var url = tab.Url || tab.url || '';
        if (frame.getAttribute('src') !== url) {
            frame.setAttribute('src', url);
        }
        overlay.classList.add('is-open');
        setActive(tabKey(tab));
        startTitleWatch(tab);
    }

    function openTab(tab) {
        var next = hashForTab(tab);
        if (window.location.hash !== next) {
            window.location.hash = next;
        } else {
            showOverlay(tab);
        }
    }

    function syncFromHash() {
        var hash = window.location.hash || '';
        if (hash.indexOf(HASH_PREFIX) === 0) {
            var legacyId = decodeURIComponent(hash.slice(HASH_PREFIX.length).split(/[?#]/)[0]);
            var legacyTab = findTab(legacyId);
            if (legacyTab) {
                window.location.hash = hashForTab(legacyTab);
                return;
            }
        }
        var id = currentTabId();
        if (!id) {
            hideOverlay();
            return;
        }
        var tab = findTab(id);
        if (tab && !isDivider(tab)) {
            showOverlay(tab);
        }
    }

    function isDivider(tab) {
        return !!(tab && (tab.Divider || tab.divider));
    }

    function isAdminArea() {
        var hash = (window.location.hash || '').toLowerCase();
        return hash.indexOf('/dashboard') !== -1 || hash.indexOf('configurationpage') !== -1;
    }

    function looksLikeAdminNav(el) {
        if (!el) {
            return false;
        }
        var text = (el.textContent || '').replace(/\s+/g, ' ').toLowerCase();
        return text.indexOf('plugins') !== -1 && (text.indexOf('dashboard') !== -1 || text.indexOf('users') !== -1 || text.indexOf('libraries') !== -1);
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

    function libraryButtonText(el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return text === 'favourites' || text === 'favorites' || text === 'movies' || text === 'shows' || text === 'tv shows';
    }

    function nativeHeaderButton(host) {
        var scopes = [];
        if (host) {
            scopes.push(host);
        }
        var toolbar = document.querySelector('.MuiToolbar-root');
        if (toolbar && scopes.indexOf(toolbar) === -1) {
            scopes.push(toolbar);
        }
        var i;
        var links;
        var el;
        for (i = 0; i < scopes.length; i++) {
            links = scopes[i].querySelectorAll('a.MuiButton-root,button.MuiButton-root');
            for (var j = 0; j < links.length; j++) {
                el = links[j];
                if (el.hasAttribute(NAV_ATTR) || !isVisible(el)) {
                    continue;
                }
                if (libraryButtonText(el) && String(el.className).indexOf('MuiButton-sizeLarge') === -1) {
                    return el;
                }
            }
        }
        for (i = 0; i < scopes.length; i++) {
            links = scopes[i].querySelectorAll('a.MuiButton-sizeMedium,button.MuiButton-sizeMedium');
            for (var k = 0; k < links.length; k++) {
                el = links[k];
                if (!el.hasAttribute(NAV_ATTR) && isVisible(el)) {
                    return el;
                }
            }
        }
        return null;
    }

    function createHeaderItem(tab) {
        var native = nativeHeaderButton(findHeaderHost());
        if (isDivider(tab)) {
            var divider = document.createElement('span');
            divider.className = 'moretabs-divider';
            divider.setAttribute(NAV_ATTR, tabKey(tab));
            divider.setAttribute('data-moretabs-skin', SKIN);
            divider.setAttribute('aria-hidden', 'true');
            divider.textContent = '|';
            if (native) {
                var dcs = window.getComputedStyle(native);
                divider.style.fontSize = dcs.fontSize;
                divider.style.fontWeight = dcs.fontWeight;
                divider.style.fontFamily = dcs.fontFamily;
                divider.style.lineHeight = dcs.lineHeight;
            }
            return divider;
        }
        var a = document.createElement('a');
        a.className = native
            ? native.className
            : 'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textInherit MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-colorInherit';
        a.tabIndex = 0;
        a.setAttribute(NAV_ATTR, tabKey(tab));
        a.setAttribute('data-moretabs-skin', SKIN);
        a.href = hashForTab(tab);
        a.title = tabTitle(tab);
        var iconName = tab.Icon || tab.icon;
        if (iconName) {
            var wrap = document.createElement('span');
            var nativeWrap = native && native.querySelector('.MuiButton-startIcon');
            wrap.className = nativeWrap ? nativeWrap.className : 'MuiButton-icon MuiButton-startIcon MuiButton-iconSizeMedium';
            var icon = document.createElement('span');
            var nativeSvg = native && native.querySelector('.MuiSvgIcon-root, .MuiIcon-root');
            icon.className = (nativeSvg ? nativeSvg.getAttribute('class') + ' ' : 'MuiSvgIcon-root MuiSvgIcon-fontSizeMedium ') + 'material-icons';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = iconName;
            wrap.appendChild(icon);
            a.appendChild(wrap);
        }
        a.appendChild(document.createTextNode(tabTitle(tab)));
        a.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            openTab(tab);
        });
        return a;
    }

    function createDrawerItem(tab) {
        if (isDivider(tab)) {
            var divider = document.createElement('span');
            divider.className = 'moretabs-drawer-divider';
            divider.setAttribute(NAV_ATTR, tabKey(tab));
            divider.setAttribute('aria-hidden', 'true');
            divider.textContent = '|';
            return divider;
        }
        var a = document.createElement('a');
        a.className = 'moretabs-drawer-btn';
        a.setAttribute(NAV_ATTR, tabKey(tab));
        a.href = hashForTab(tab);
        var icon = createIcon(tab.Icon || tab.icon);
        if (icon) {
            a.appendChild(icon);
        }
        var label = document.createElement('span');
        label.textContent = tabTitle(tab);
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
        if (isAdminArea()) {
            return null;
        }
        var toolbars = document.querySelectorAll('.MuiToolbar-root');
        for (var i = 0; i < toolbars.length; i++) {
            var toolbar = toolbars[i];
            if (!isVisible(toolbar) || toolbar.closest('.MuiDrawer-root, .MuiDrawer-paper, .mainDrawer')) {
                continue;
            }
            var links = toolbar.querySelectorAll('a,button');
            for (var j = 0; j < links.length; j++) {
                if (looksLikeFavorites(links[j])) {
                    var host = links[j].parentElement;
                    if (host && !host.closest('.MuiDrawer-root, .MuiDrawer-paper, .mainDrawer')) {
                        return host;
                    }
                }
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
        var stale = existing.length !== state.tabs.length;
        for (var e = 0; e < existing.length; e++) {
            if (existing[e].getAttribute('data-moretabs-skin') !== SKIN) {
                stale = true;
                break;
            }
        }
        if (!stale) {
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
            var item = createHeaderItem(tab);
            if (before) {
                host.insertBefore(item, before);
            } else {
                host.appendChild(item);
            }
        });
        return true;
    }

    function findDrawerHost() {
        if (isAdminArea()) {
            return null;
        }
        var candidates = [
            document.querySelector('.MuiDrawer-paper'),
            document.querySelector('.mainDrawer-scrollContainer'),
            document.querySelector('.mainDrawer')
        ];
        for (var i = 0; i < candidates.length; i++) {
            var host = candidates[i];
            if (isVisible(host) && !looksLikeAdminNav(host)) {
                var links = host.querySelectorAll('a,button');
                for (var j = 0; j < links.length; j++) {
                    if (looksLikeFavorites(links[j])) {
                        return host;
                    }
                }
            }
        }
        return null;
    }

    function removeInjected() {
        document.querySelectorAll('[' + NAV_ATTR + '], [data-moretabs-drawer]').forEach(function (el) {
            el.remove();
        });
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
            wrap.appendChild(createDrawerItem(tab));
        });
        if (!wrap.parentElement) {
            host.appendChild(wrap);
        }
        return true;
    }

    function inject() {
        if (isAdminArea()) {
            removeInjected();
            hideOverlay();
            return;
        }
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
