(function () {
    if (window.SonarrPlaceholder) {
        return;
    }

    var STYLE_ID = 'sonarr-placeholder-style-v1';
    var state = {
        updateTimer: 0,
        placeholders: [],
        currentItemId: null,
        currentItemType: null,
        episodesCache: {},
        observer: null
    };

    function log(msg, data) {
        console.log('[SonarrPlaceholder] ' + msg, data || '');
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
            console.error('[SonarrPlaceholder] Failed to get auth headers', e);
        }
        return headers;
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.sonarr-placeholder-episode{opacity:.45;pointer-events:none!important;position:relative;cursor:default!important;}',
            '.sonarr-placeholder-episode *{pointer-events:none!important;}',
            '.sonarr-placeholder-episode::before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(128,128,128,.1) 10px,rgba(128,128,128,.1) 20px);z-index:1;pointer-events:none;}',
            '.sonarr-placeholder-overlay{position:absolute;bottom:8px;left:8px;right:8px;background:rgba(0,0,0,.85);padding:8px;border-radius:4px;font-size:.85em;z-index:2;}',
            '.sonarr-placeholder-status{font-weight:bold;color:#ff9800;}',
            '.sonarr-placeholder-countdown{color:#ffc107;font-size:.95em;margin-top:4px;}',
            '.sonarr-placeholder-aired{color:#f44336;}',
            '.sonarr-placeholder-row{opacity:.45;pointer-events:none!important;cursor:default!important;}',
            '.sonarr-placeholder-row *{pointer-events:none!important;}',
            '.sonarr-placeholder-row .listItemBody{position:relative;}',
            '.sonarr-placeholder-row .listItemBody::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(128,128,128,.1) 10px,rgba(128,128,128,.1) 20px);pointer-events:none;}'
        ].join('');
        document.head.appendChild(style);
    }

    function getTimeUntil(utcDate) {
        if (!utcDate) {
            return null;
        }
        var now = new Date();
        var target = new Date(utcDate);
        var diff = target - now;
        if (diff <= 0) {
            return null;
        }
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) {
            return days + 'd ' + hours + 'h';
        }
        if (hours > 0) {
            return hours + 'h';
        }
        var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return minutes + 'm';
    }

    function formatAirDate(airDate) {
        if (!airDate) {
            return 'TBA';
        }
        try {
            var date = new Date(airDate);
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return airDate;
        }
    }

    function formatEpisodeCode(seasonNumber, episodeNumber) {
        var s = String(seasonNumber).padStart(2, '0');
        var e = String(episodeNumber).padStart(2, '0');
        return 'S' + s + 'E' + e;
    }

    function stripInteractiveAttributes(element) {
        var attrs = ['data-id', 'data-action', 'data-playaccess', 'data-isfolder', 'data-positionticks', 'data-serverid', 'data-type', 'data-itemtype', 'data-itemid', 'data-context'];
        for (var i = 0; i < attrs.length; i++) {
            element.removeAttribute(attrs[i]);
        }
        var descendants = element.querySelectorAll('*');
        for (var j = 0; j < descendants.length; j++) {
            for (var k = 0; k < attrs.length; k++) {
                descendants[j].removeAttribute(attrs[k]);
            }
        }
        var buttons = element.querySelectorAll('button, .cardOverlayButton, [data-action], .itemAction, .playedIndicator, .checkboxContainer, .progressBar');
        for (var m = 0; m < buttons.length; m++) {
            buttons[m].remove();
        }
        var links = element.querySelectorAll('a');
        for (var n = 0; n < links.length; n++) {
            links[n].removeAttribute('href');
            links[n].onclick = function(e) { e.stopPropagation(); e.preventDefault(); return false; };
        }
        element.onclick = function(e) { e.stopPropagation(); e.preventDefault(); return false; };
    }

    function createPlaceholderCard(episode, templateCard) {
        if (!templateCard) {
            return null;
        }
        var clone = templateCard.cloneNode(true);
        clone.classList.add('sonarr-placeholder-episode');
        clone.setAttribute('data-sonarr-placeholder', 'card');
        clone.setAttribute('data-episode-number', episode.episodeNumber);
        clone.setAttribute('data-season-number', episode.seasonNumber);
        
        stripInteractiveAttributes(clone);
        
        var epCode = formatEpisodeCode(episode.seasonNumber, episode.episodeNumber);
        var title = episode.title && episode.title !== 'TBA' ? epCode + ' - ' + episode.title : epCode;
        
        var titleEl = clone.querySelector('.cardText, .cardTitle, [class*="cardText"], [class*="cardTitle"]');
        if (titleEl) {
            titleEl.textContent = title;
        }
        
        var cardImageContainer = clone.querySelector('.cardImageContainer, .cardImage, [class*="cardImage"]');
        if (cardImageContainer) {
            var img = cardImageContainer.querySelector('img');
            if (img) {
                img.style.opacity = '0.1';
            }
            cardImageContainer.style.backgroundColor = '#1c1c1c';
        }
        
        var overlayHTML = '<div class="sonarr-placeholder-overlay">';
        if (episode.hasAired) {
            overlayHTML += '<div class="sonarr-placeholder-status sonarr-placeholder-aired">Missing</div>';
            overlayHTML += '<div>Aired: ' + formatAirDate(episode.airDate) + '</div>';
        } else {
            overlayHTML += '<div class="sonarr-placeholder-status">Not aired</div>';
            if (episode.airDateUtc) {
                var countdown = getTimeUntil(episode.airDateUtc);
                if (countdown) {
                    overlayHTML += '<div class="sonarr-placeholder-countdown"><span data-air-date-utc="' + episode.airDateUtc + '">' + countdown + '</span></div>';
                }
                overlayHTML += '<div>Airs: ' + formatAirDate(episode.airDate) + '</div>';
            } else {
                overlayHTML += '<div>Air date: TBA</div>';
            }
        }
        overlayHTML += '</div>';
        
        if (cardImageContainer) {
            var existingOverlays = cardImageContainer.querySelectorAll('.sonarr-placeholder-overlay');
            for (var j = 0; j < existingOverlays.length; j++) {
                existingOverlays[j].remove();
            }
            cardImageContainer.insertAdjacentHTML('beforeend', overlayHTML);
        }
        
        return clone;
    }

    function createPlaceholderRow(episode, templateRow) {
        if (!templateRow) {
            return null;
        }
        var clone = templateRow.cloneNode(true);
        clone.classList.add('sonarr-placeholder-row');
        clone.setAttribute('data-sonarr-placeholder', 'row');
        clone.setAttribute('data-episode-number', episode.episodeNumber);
        clone.setAttribute('data-season-number', episode.seasonNumber);
        
        stripInteractiveAttributes(clone);
        
        var epCode = formatEpisodeCode(episode.seasonNumber, episode.episodeNumber);
        
        var indexNumberEl = clone.querySelector('.listItemIndexNumber, .listItemBody > div:first-child');
        if (indexNumberEl) {
            indexNumberEl.textContent = epCode;
        }
        
        var titleEl = clone.querySelector('.listItemBody h3, .listItemBody .listItemBodyText');
        if (titleEl) {
            var title = episode.title && episode.title !== 'TBA' ? episode.title : 'Episode ' + episode.episodeNumber;
            titleEl.textContent = title;
        }
        
        var infoEl = clone.querySelector('.secondary, .listItemBody .secondary, .listItemBodyText + div');
        if (infoEl) {
            var infoText = '';
            if (episode.hasAired) {
                infoText = 'Missing - Aired: ' + formatAirDate(episode.airDate);
            } else {
                if (episode.airDateUtc) {
                    var countdown = getTimeUntil(episode.airDateUtc);
                    if (countdown) {
                        infoText = 'Not aired - <span data-air-date-utc="' + episode.airDateUtc + '">' + countdown + '</span> - Airs: ' + formatAirDate(episode.airDate);
                    } else {
                        infoText = 'Not aired - Airs: ' + formatAirDate(episode.airDate);
                    }
                } else {
                    infoText = 'Not aired - Air date: TBA';
                }
            }
            infoEl.innerHTML = infoText;
        }
        
        return clone;
    }

    function clearPlaceholders(container) {
        if (!container) {
            return;
        }
        var oldPlaceholders = container.querySelectorAll('[data-sonarr-placeholder]');
        for (var i = 0; i < oldPlaceholders.length; i++) {
            oldPlaceholders[i].remove();
        }
    }

    function injectCardsIntoContainer(episodes, container, templateCard) {
        if (!container || !templateCard || !episodes || episodes.length === 0) {
            return;
        }
        clearPlaceholders(container);
        for (var i = 0; i < episodes.length; i++) {
            var episode = episodes[i];
            var placeholder = createPlaceholderCard(episode, templateCard);
            if (placeholder) {
                container.appendChild(placeholder);
            }
        }
        log('Injected ' + episodes.length + ' card placeholders');
    }

    function injectRowsIntoContainer(episodes, container, templateRow) {
        if (!container || !templateRow || !episodes || episodes.length === 0) {
            return;
        }
        clearPlaceholders(container);
        for (var i = 0; i < episodes.length; i++) {
            var episode = episodes[i];
            var placeholder = createPlaceholderRow(episode, templateRow);
            if (placeholder) {
                container.appendChild(placeholder);
            }
        }
        log('Injected ' + episodes.length + ' row placeholders');
    }

    function updateCountdowns() {
        var countdowns = document.querySelectorAll('[data-sonarr-placeholder] [data-air-date-utc]');
        for (var i = 0; i < countdowns.length; i++) {
            var el = countdowns[i];
            var airDateUtc = el.getAttribute('data-air-date-utc');
            if (airDateUtc) {
                var countdown = getTimeUntil(airDateUtc);
                if (countdown) {
                    el.textContent = countdown;
                }
            }
        }
    }

    function startCountdownUpdater() {
        stopCountdownUpdater();
        updateCountdowns();
        state.updateTimer = window.setInterval(updateCountdowns, 60000);
    }

    function stopCountdownUpdater() {
        if (state.updateTimer) {
            window.clearInterval(state.updateTimer);
            state.updateTimer = 0;
        }
    }

    function stopObserver() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
    }

    function getActiveView() {
        var pages = document.querySelectorAll('.page');
        for (var i = 0; i < pages.length; i++) {
            if (!pages[i].classList.contains('hide')) {
                return pages[i];
            }
        }
        return null;
    }

    function findItemIdInUrl() {
        var hash = window.location.hash || '';
        var match = hash.match(/[#\/]details\?id=([a-f0-9]+)/i);
        return match ? match[1] : null;
    }

    function tryInjectIntoSeriesNextUp(seriesItem, episodes, activeView) {
        var nextUpSection = activeView.querySelector('#nextUpSection, .nextUpSection, [data-section="nextup"]');
        if (!nextUpSection) {
            return false;
        }
        var container = nextUpSection.querySelector('.itemsContainer, .scrollSlider');
        if (!container) {
            return false;
        }
        var existingCards = container.querySelectorAll('[data-type="Episode"]:not([data-sonarr-placeholder]), [data-itemtype="Episode"]:not([data-sonarr-placeholder])');
        if (existingCards.length === 0) {
            return false;
        }
        var templateCard = existingCards[0];
        injectCardsIntoContainer(episodes, container, templateCard);
        return true;
    }

    function tryInjectIntoSeasonList(seriesItem, seasonNumber, episodes, activeView) {
        var container = activeView.querySelector('#childrenContent');
        if (!container) {
            return false;
        }
        var existingRows = container.querySelectorAll('.listItem:not([data-sonarr-placeholder])');
        if (existingRows.length === 0) {
            return false;
        }
        var templateRow = existingRows[0];
        injectRowsIntoContainer(episodes, container, templateRow);
        return true;
    }

    function tryInjectIntoEpisodeMoreFromSeason(seriesItem, seasonNumber, episodes, activeView) {
        var moreFromSeasonSection = activeView.querySelector('#moreFromSeasonSection, [data-section="morefromseason"]');
        if (!moreFromSeasonSection) {
            return false;
        }
        var container = moreFromSeasonSection.querySelector('.itemsContainer, .scrollSlider, #moreFromSeasonItems');
        if (!container) {
            return false;
        }
        var existingCards = container.querySelectorAll('[data-type="Episode"]:not([data-sonarr-placeholder]), [data-itemtype="Episode"]:not([data-sonarr-placeholder])');
        if (existingCards.length === 0) {
            return false;
        }
        var templateCard = existingCards[0];
        injectCardsIntoContainer(episodes, container, templateCard);
        return true;
    }

    function setupObserverForView(itemType, seriesItem, seasonNumber, episodes, activeView) {
        stopObserver();
        
        var injectFunc;
        if (itemType === 'Series') {
            injectFunc = function() { return tryInjectIntoSeriesNextUp(seriesItem, episodes, activeView); };
        } else if (itemType === 'Season') {
            injectFunc = function() { return tryInjectIntoSeasonList(seriesItem, seasonNumber, episodes, activeView); };
        } else if (itemType === 'Episode') {
            injectFunc = function() { return tryInjectIntoEpisodeMoreFromSeason(seriesItem, seasonNumber, episodes, activeView); };
        } else {
            return;
        }
        
        injectFunc();
        
        state.observer = new MutationObserver(function(mutations) {
            var hasRelevantChange = false;
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.type === 'childList') {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        var node = mutation.addedNodes[j];
                        if (node.nodeType === 1 && !node.hasAttribute('data-sonarr-placeholder')) {
                            hasRelevantChange = true;
                            break;
                        }
                    }
                    for (var k = 0; k < mutation.removedNodes.length; k++) {
                        var rnode = mutation.removedNodes[k];
                        if (rnode.nodeType === 1 && !rnode.hasAttribute('data-sonarr-placeholder')) {
                            hasRelevantChange = true;
                            break;
                        }
                    }
                }
                if (hasRelevantChange) {
                    break;
                }
            }
            if (hasRelevantChange) {
                var currentItemId = findItemIdInUrl();
                if (currentItemId === state.currentItemId) {
                    injectFunc();
                }
            }
        });
        
        state.observer.observe(activeView, {
            childList: true,
            subtree: true
        });
    }

    function fetchEpisodesAndSetupInjection(itemId, itemType, seriesItem, seasonNumber) {
        var tvdbId = seriesItem.ProviderIds && (seriesItem.ProviderIds.Tvdb || seriesItem.ProviderIds.tvdb);
        var imdbId = seriesItem.ProviderIds && (seriesItem.ProviderIds.Imdb || seriesItem.ProviderIds.imdb);
        if (!tvdbId && !imdbId) {
            log('No TVDB/IMDB ID for series', seriesItem);
            return;
        }
        
        var cacheKey = itemId + '_' + (seasonNumber != null ? seasonNumber : 'all');
        if (state.episodesCache[cacheKey]) {
            log('Using cached episodes for ' + cacheKey);
            var activeView = getActiveView();
            if (activeView) {
                setupObserverForView(itemType, seriesItem, seasonNumber, state.episodesCache[cacheKey], activeView);
                startCountdownUpdater();
            }
            return;
        }
        
        var params = [];
        if (tvdbId) {
            params.push('tvdbId=' + encodeURIComponent(tvdbId));
        }
        if (imdbId) {
            params.push('imdbId=' + encodeURIComponent(imdbId));
        }
        if (seasonNumber != null && seasonNumber >= 0) {
            params.push('seasonNumber=' + seasonNumber);
        }
        
        var url = window.ApiClient.getUrl('SonarrPlaceholder/MissingEpisodes?' + params.join('&'));
        log('Fetching episodes: ' + url);
        
        fetch(url, {
            headers: authHeaders(),
            credentials: 'same-origin'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        }).then(function (episodes) {
            var currentItemId = findItemIdInUrl();
            if (currentItemId !== state.currentItemId) {
                log('Item changed during fetch, ignoring response');
                return;
            }
            
            if (episodes && episodes.length > 0) {
                log('Fetched ' + episodes.length + ' episodes');
                state.episodesCache[cacheKey] = episodes;
                var activeView = getActiveView();
                if (activeView) {
                    setupObserverForView(itemType, seriesItem, seasonNumber, episodes, activeView);
                    startCountdownUpdater();
                }
            } else {
                log('No missing episodes to inject');
            }
        }).catch(function (error) {
            console.error('[SonarrPlaceholder] Failed to fetch missing episodes', error);
        });
    }

    function handleNewView() {
        stopObserver();
        stopCountdownUpdater();
        state.episodesCache = {};
        
        if (!window.ApiClient || !window.ApiClient.getCurrentUserId || !window.ApiClient.getCurrentUserId()) {
            log('ApiClient not ready');
            return;
        }
        
        var itemId = findItemIdInUrl();
        if (!itemId) {
            state.currentItemId = null;
            state.currentItemType = null;
            return;
        }
        
        state.currentItemId = itemId;
        log('New view for item ' + itemId);
        
        var activeView = getActiveView();
        if (!activeView) {
            log('No active view');
            return;
        }
        
        ensureStyle();
        
        window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), itemId).then(function (item) {
            if (!item) {
                log('Item not found');
                return;
            }
            
            if (findItemIdInUrl() !== itemId) {
                log('Item changed during fetch, aborting');
                return;
            }
            
            state.currentItemType = item.Type;
            log('Item type: ' + item.Type);
            
            if (item.Type === 'Series') {
                fetchEpisodesAndSetupInjection(itemId, 'Series', item, null);
            } else if (item.Type === 'Season') {
                var seriesId = item.SeriesId;
                var seasonNumber = item.IndexNumber;
                if (seriesId && seasonNumber != null) {
                    return window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), seriesId).then(function (seriesItem) {
                        if (findItemIdInUrl() !== itemId) {
                            log('Item changed, aborting');
                            return;
                        }
                        fetchEpisodesAndSetupInjection(itemId, 'Season', seriesItem, seasonNumber);
                    });
                }
            } else if (item.Type === 'Episode') {
                var seriesId = item.SeriesId;
                var seasonNumber = item.ParentIndexNumber;
                if (seriesId && seasonNumber != null) {
                    return window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), seriesId).then(function (seriesItem) {
                        if (findItemIdInUrl() !== itemId) {
                            log('Item changed, aborting');
                            return;
                        }
                        fetchEpisodesAndSetupInjection(itemId, 'Episode', seriesItem, seasonNumber);
                    });
                }
            }
        }).catch(function (error) {
            console.error('[SonarrPlaceholder] Failed to get item', error);
        });
    }

    function setupEventListeners() {
        document.addEventListener('viewshow', function () {
            log('viewshow event');
            handleNewView();
        });
        
        document.addEventListener('pageshow', function () {
            log('pageshow event');
            handleNewView();
        });
        
        window.addEventListener('hashchange', function () {
            log('hashchange event');
            handleNewView();
        });
    }

    function init() {
        log('Initializing v1.0.0.1');
        ensureStyle();
        setupEventListeners();
        
        setTimeout(function() {
            handleNewView();
        }, 100);
    }

    window.SonarrPlaceholder = {
        getState: function () {
            return {
                currentItemId: state.currentItemId,
                currentItemType: state.currentItemType,
                observerActive: !!state.observer
            };
        },
        refresh: function () {
            log('Manual refresh requested');
            handleNewView();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
