(function () {
    if (window.SonarrPlaceholder) {
        return;
    }

    var STYLE_ID = 'sonarr-placeholder-style-v1';
    var state = {
        updateTimer: 0,
        placeholders: [],
        pendingInject: null
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
            '.sonarr-placeholder-episode{opacity:.45;pointer-events:none;position:relative;}',
            '.sonarr-placeholder-episode::before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(128,128,128,.1) 10px,rgba(128,128,128,.1) 20px);z-index:1;pointer-events:none;}',
            '.sonarr-placeholder-overlay{position:absolute;bottom:8px;left:8px;right:8px;background:rgba(0,0,0,.85);padding:8px;border-radius:4px;font-size:.85em;z-index:2;}',
            '.sonarr-placeholder-status{font-weight:bold;color:#ff9800;}',
            '.sonarr-placeholder-countdown{color:#ffc107;font-size:.95em;margin-top:4px;}',
            '.sonarr-placeholder-aired{color:#f44336;}',
            '.sonarr-placeholder-row{opacity:.45;pointer-events:none;}',
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

    function createPlaceholderCard(episode, templateCard) {
        if (!templateCard) {
            return null;
        }
        var clone = templateCard.cloneNode(true);
        clone.classList.add('sonarr-placeholder-episode');
        clone.setAttribute('data-sonarr-placeholder', 'card');
        clone.setAttribute('data-episode-number', episode.episodeNumber);
        clone.setAttribute('data-season-number', episode.seasonNumber);
        clone.style.cursor = 'default';
        var links = clone.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            links[i].removeAttribute('href');
            links[i].style.pointerEvents = 'none';
        }
        var titleEl = clone.querySelector('.cardText, .cardTitle, [class*="cardText"], [class*="cardTitle"]');
        if (titleEl) {
            var title = episode.title && episode.title !== 'TBA' ? episode.title : 'Episode ' + episode.episodeNumber;
            titleEl.textContent = title;
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
                    overlayHTML += '<div class="sonarr-placeholder-countdown" data-air-date-utc="' + episode.airDateUtc + '">' + countdown + '</div>';
                }
                overlayHTML += '<div>Airs: ' + formatAirDate(episode.airDate) + '</div>';
            } else {
                overlayHTML += '<div>Air date: TBA</div>';
            }
        }
        overlayHTML += '</div>';
        var cardImageContainer = clone.querySelector('.cardImageContainer, .cardImage, [class*="cardImage"]');
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
        clone.style.cursor = 'default';
        var links = clone.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            links[i].removeAttribute('href');
            links[i].style.pointerEvents = 'none';
        }
        var indexNumberEl = clone.querySelector('.listItemIndexNumber, .listItemBody > div:first-child');
        if (indexNumberEl) {
            indexNumberEl.textContent = 'S' + episode.seasonNumber + 'E' + episode.episodeNumber;
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
                        infoText = 'Not aired - ' + countdown + ' - Airs: ' + formatAirDate(episode.airDate);
                    } else {
                        infoText = 'Not aired - Airs: ' + formatAirDate(episode.airDate);
                    }
                } else {
                    infoText = 'Not aired - Air date: TBA';
                }
            }
            infoEl.textContent = infoText;
            infoEl.setAttribute('data-air-date-utc', episode.airDateUtc || '');
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
        state.placeholders = [];
    }

    function injectCardsIntoContainer(episodes, container, templateCard) {
        clearPlaceholders(container);
        for (var i = 0; i < episodes.length; i++) {
            var episode = episodes[i];
            var placeholder = createPlaceholderCard(episode, templateCard);
            if (placeholder) {
                container.appendChild(placeholder);
                state.placeholders.push({ element: placeholder, episode: episode });
            }
        }
        log('Injected ' + episodes.length + ' card placeholders');
    }

    function injectRowsIntoContainer(episodes, container, templateRow) {
        clearPlaceholders(container);
        for (var i = 0; i < episodes.length; i++) {
            var episode = episodes[i];
            var placeholder = createPlaceholderRow(episode, templateRow);
            if (placeholder) {
                container.appendChild(placeholder);
                state.placeholders.push({ element: placeholder, episode: episode });
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
                    var isRow = el.closest('[data-sonarr-placeholder="row"]');
                    if (isRow) {
                        var text = el.textContent;
                        text = text.replace(/\d+[dhm]\s*\d*[hm]?/, countdown);
                        el.textContent = text;
                    } else {
                        el.textContent = countdown;
                    }
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

    function injectIntoSeriesNextUp(seriesId, seriesItem, activeView) {
        var nextUpSection = activeView.querySelector('#upcomingSection, [data-section="next-up"], .nextUpSection');
        if (!nextUpSection) {
            return;
        }
        var container = nextUpSection.querySelector('.itemsContainer, .scrollSlider');
        if (!container) {
            return;
        }
        var existingCards = container.querySelectorAll('[data-type="Episode"]:not([data-sonarr-placeholder]), [data-itemtype="Episode"]:not([data-sonarr-placeholder])');
        if (existingCards.length === 0) {
            return;
        }
        var templateCard = existingCards[0];
        fetchAndInjectCards(seriesItem, null, container, templateCard);
    }

    function injectIntoSeasonList(seasonId, seasonItem, activeView) {
        var container = activeView.querySelector('#childrenContent .childrenItemsContainer, .itemsContainer.vertical-list, .listTopPaging + .itemsContainer');
        if (!container) {
            return;
        }
        var existingRows = container.querySelectorAll('.listItem:not([data-sonarr-placeholder])');
        if (existingRows.length === 0) {
            return;
        }
        var templateRow = existingRows[0];
        fetchAndInjectRows(seasonItem, seasonItem.SeasonNumber, container, templateRow);
    }

    function injectIntoEpisodeMoreFromSeason(episodeId, episodeItem, activeView) {
        var moreFromSeasonSection = activeView.querySelector('#moreFromSeasonSection, [data-section="more-from-season"]');
        if (!moreFromSeasonSection) {
            return;
        }
        var container = moreFromSeasonSection.querySelector('.itemsContainer, .scrollSlider');
        if (!container) {
            return;
        }
        var existingCards = container.querySelectorAll('[data-type="Episode"]:not([data-sonarr-placeholder]), [data-itemtype="Episode"]:not([data-sonarr-placeholder])');
        if (existingCards.length === 0) {
            return;
        }
        var templateCard = existingCards[0];
        fetchAndInjectCards(episodeItem, episodeItem.ParentIndexNumber, container, templateCard);
    }

    function fetchAndInjectCards(item, seasonNumber, container, templateCard) {
        var tvdbId = item.ProviderIds && (item.ProviderIds.Tvdb || item.ProviderIds.tvdb);
        var imdbId = item.ProviderIds && (item.ProviderIds.Imdb || item.ProviderIds.imdb);
        if (!tvdbId && !imdbId) {
            log('No TVDB/IMDB ID for item', item);
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
        fetch(url, {
            headers: authHeaders(),
            credentials: 'same-origin'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        }).then(function (episodes) {
            if (episodes && episodes.length > 0) {
                injectCardsIntoContainer(episodes, container, templateCard);
                startCountdownUpdater();
            } else {
                log('No missing episodes to inject');
            }
        }).catch(function (error) {
            console.error('[SonarrPlaceholder] Failed to fetch missing episodes', error);
        });
    }

    function fetchAndInjectRows(item, seasonNumber, container, templateRow) {
        var tvdbId = item.ProviderIds && (item.ProviderIds.Tvdb || item.ProviderIds.tvdb);
        var imdbId = item.ProviderIds && (item.ProviderIds.Imdb || item.ProviderIds.imdb);
        if (!tvdbId && !imdbId) {
            log('No TVDB/IMDB ID for item', item);
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
        fetch(url, {
            headers: authHeaders(),
            credentials: 'same-origin'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        }).then(function (episodes) {
            if (episodes && episodes.length > 0) {
                injectRowsIntoContainer(episodes, container, templateRow);
                startCountdownUpdater();
            } else {
                log('No missing episodes to inject');
            }
        }).catch(function (error) {
            console.error('[SonarrPlaceholder] Failed to fetch missing episodes', error);
        });
    }

    function tryInject() {
        if (state.pendingInject) {
            clearTimeout(state.pendingInject);
            state.pendingInject = null;
        }
        if (!window.ApiClient || !window.ApiClient.getCurrentUserId || !window.ApiClient.getCurrentUserId()) {
            log('ApiClient not ready, retrying...');
            state.pendingInject = setTimeout(tryInject, 250);
            return;
        }
        var itemId = findItemIdInUrl();
        if (!itemId) {
            stopCountdownUpdater();
            return;
        }
        var activeView = getActiveView();
        if (!activeView) {
            log('No active view');
            return;
        }
        log('Attempting inject for item ' + itemId);
        window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), itemId).then(function (item) {
            if (!item) {
                log('Item not found');
                return;
            }
            log('Item type: ' + item.Type);
            ensureStyle();
            if (item.Type === 'Series') {
                injectIntoSeriesNextUp(itemId, item, activeView);
            } else if (item.Type === 'Season') {
                var seriesId = item.SeriesId;
                if (seriesId) {
                    return window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), seriesId).then(function (seriesItem) {
                        injectIntoSeasonList(itemId, seriesItem, activeView);
                    });
                }
            } else if (item.Type === 'Episode') {
                var seriesId = item.SeriesId;
                if (seriesId) {
                    return window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), seriesId).then(function (seriesItem) {
                        injectIntoEpisodeMoreFromSeason(itemId, seriesItem, activeView);
                    });
                }
            }
        }).catch(function (error) {
            console.error('[SonarrPlaceholder] Failed to get item', error);
        });
    }

    function scheduleInject() {
        if (state.pendingInject) {
            clearTimeout(state.pendingInject);
        }
        state.pendingInject = setTimeout(tryInject, 500);
    }

    function setupViewShowListener() {
        document.addEventListener('viewshow', function (e) {
            log('viewshow event');
            scheduleInject();
        });
    }

    function setupPageShowListener() {
        document.addEventListener('pageshow', function (e) {
            log('pageshow event');
            scheduleInject();
        });
    }

    function setupHashChangeListener() {
        window.addEventListener('hashchange', function () {
            log('hashchange event');
            scheduleInject();
        });
    }

    function init() {
        log('Initializing');
        ensureStyle();
        setupViewShowListener();
        setupPageShowListener();
        setupHashChangeListener();
        scheduleInject();
    }

    window.SonarrPlaceholder = {
        getState: function () {
            return {
                placeholderCount: state.placeholders.length
            };
        },
        refresh: function () {
            log('Manual refresh requested');
            scheduleInject();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
