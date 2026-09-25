(function () {
    if (window.SonarrPlaceholder) {
        return;
    }

    var STYLE_ID = 'sonarr-placeholder-style-v1';
    var state = {
        loaded: false,
        lastSeriesId: null,
        lastSeasonNumber: null,
        injectTimer: 0,
        updateTimer: 0,
        placeholders: []
    };

    function authHeaders() {
        var headers = { accept: 'application/json' };
        try {
            var token = window.ApiClient && window.ApiClient.accessToken && window.ApiClient.accessToken();
            if (token) {
                headers.Authorization = 'MediaBrowser Token="' + token + '"';
                headers['X-Emby-Token'] = token;
            }
        } catch (e) {
            console.error('SonarrPlaceholder: failed to get auth headers', e);
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
            '.sonarr-placeholder-aired{color:#f44336;}'
        ].join('');
        document.head.appendChild(style);
    }

    function parseItemId(id) {
        if (!id || typeof id !== 'string') {
            return null;
        }
        var parts = id.split('_');
        if (parts.length < 2) {
            return null;
        }
        return {
            itemId: parts[0],
            seasonNumber: parts[1] === 'season' && parts.length > 2 ? parseInt(parts[2], 10) : null
        };
    }

    function getCurrentContext() {
        var hash = window.location.hash || '';
        var seriesMatch = hash.match(/[#\/]details\?id=([a-f0-9]+)/i);
        if (!seriesMatch) {
            return null;
        }
        var itemId = seriesMatch[1];
        var seasonMatch = hash.match(/[&#]season=(\d+)/i);
        var seasonNumber = seasonMatch ? parseInt(seasonMatch[1], 10) : null;
        return {
            itemId: itemId,
            seasonNumber: seasonNumber
        };
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

    function createPlaceholderCard(episode, existingCard) {
        if (!existingCard) {
            return null;
        }
        var clone = existingCard.cloneNode(true);
        clone.classList.add('sonarr-placeholder-episode');
        clone.setAttribute('data-sonarr-placeholder', 'true');
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
            titleEl.textContent = 'Episode ' + episode.episodeNumber;
            if (episode.title && episode.title !== 'TBA') {
                titleEl.textContent += ' - ' + episode.title;
            }
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
                    overlayHTML += '<div class="sonarr-placeholder-countdown">' + countdown + '</div>';
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

    function findEpisodeContainer() {
        var containers = document.querySelectorAll('[data-type="Episode"], [data-itemtype="Episode"], .itemsContainer');
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            if (container.querySelector('[data-type="Episode"], [data-itemtype="Episode"]')) {
                return container;
            }
        }
        return null;
    }

    function findExistingEpisodes() {
        var episodes = {};
        var cards = document.querySelectorAll('[data-type="Episode"]:not([data-sonarr-placeholder]), [data-itemtype="Episode"]:not([data-sonarr-placeholder])');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var link = card.querySelector('a[href*="details"]');
            if (link) {
                var href = link.getAttribute('href') || '';
                var match = href.match(/id=([a-f0-9]+)/i);
                if (match) {
                    episodes[match[1]] = card;
                }
            }
        }
        return episodes;
    }

    function injectPlaceholders(missingEpisodes) {
        ensureStyle();
        var container = findEpisodeContainer();
        if (!container) {
            return;
        }
        var existingEpisodes = findExistingEpisodes();
        var existingCards = Object.values(existingEpisodes);
        if (existingCards.length === 0) {
            return;
        }
        var templateCard = existingCards[0];
        var oldPlaceholders = container.querySelectorAll('[data-sonarr-placeholder="true"]');
        for (var i = 0; i < oldPlaceholders.length; i++) {
            oldPlaceholders[i].remove();
        }
        state.placeholders = [];
        for (var j = 0; j < missingEpisodes.length; j++) {
            var episode = missingEpisodes[j];
            var placeholder = createPlaceholderCard(episode, templateCard);
            if (placeholder) {
                container.appendChild(placeholder);
                state.placeholders.push({
                    element: placeholder,
                    episode: episode
                });
            }
        }
    }

    function updateCountdowns() {
        for (var i = 0; i < state.placeholders.length; i++) {
            var item = state.placeholders[i];
            if (!item.episode.airDateUtc || item.episode.hasAired) {
                continue;
            }
            var countdown = getTimeUntil(item.episode.airDateUtc);
            var countdownEl = item.element.querySelector('.sonarr-placeholder-countdown');
            if (countdownEl && countdown) {
                countdownEl.textContent = countdown;
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

    function fetchAndInject(itemId, seasonNumber) {
        if (!window.ApiClient) {
            return;
        }
        window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), itemId).then(function (item) {
            if (!item || item.Type !== 'Series') {
                return;
            }
            var tvdbId = null;
            var imdbId = null;
            if (item.ProviderIds) {
                tvdbId = item.ProviderIds.Tvdb || item.ProviderIds.tvdb;
                imdbId = item.ProviderIds.Imdb || item.ProviderIds.imdb;
            }
            if (!tvdbId && !imdbId) {
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
                    injectPlaceholders(episodes);
                    startCountdownUpdater();
                }
            }).catch(function (error) {
                console.error('SonarrPlaceholder: failed to fetch missing episodes', error);
            });
        }).catch(function (error) {
            console.error('SonarrPlaceholder: failed to get item details', error);
        });
    }

    function inject() {
        var context = getCurrentContext();
        if (!context || !context.itemId) {
            stopCountdownUpdater();
            state.lastSeriesId = null;
            state.lastSeasonNumber = null;
            return;
        }
        if (context.itemId === state.lastSeriesId && context.seasonNumber === state.lastSeasonNumber) {
            return;
        }
        state.lastSeriesId = context.itemId;
        state.lastSeasonNumber = context.seasonNumber;
        fetchAndInject(context.itemId, context.seasonNumber);
    }

    function scheduleInject() {
        window.clearTimeout(state.injectTimer);
        state.injectTimer = window.setTimeout(inject, 500);
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
            scheduleInject();
            return result;
        };
        history.replaceState = function () {
            var result = originalReplace.apply(this, arguments);
            scheduleInject();
            return result;
        };
        window.addEventListener('hashchange', scheduleInject);
        window.addEventListener('popstate', scheduleInject);
    }

    function waitForApi(attempt) {
        if (window.ApiClient && window.ApiClient.getCurrentUserId && window.ApiClient.getCurrentUserId()) {
            state.loaded = true;
            scheduleInject();
            return;
        }
        if (attempt > 80) {
            return;
        }
        window.setTimeout(function () {
            waitForApi(attempt + 1);
        }, 250);
    }

    window.SonarrPlaceholder = {
        getState: function () {
            return {
                loaded: state.loaded,
                lastSeriesId: state.lastSeriesId,
                lastSeasonNumber: state.lastSeasonNumber,
                placeholderCount: state.placeholders.length
            };
        },
        refresh: function () {
            state.lastSeriesId = null;
            state.lastSeasonNumber = null;
            scheduleInject();
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
    console.log('SonarrPlaceholder client loaded');
})();
