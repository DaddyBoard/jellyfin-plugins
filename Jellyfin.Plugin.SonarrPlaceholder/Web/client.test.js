const { JSDOM } = require('jsdom');

function createMockJellyfinPage(pageType, itemId) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Jellyfin</title></head>
        <body>
            <div class="page" id="itemDetailPage">
                ${pageType === 'series' ? `
                    <div id="upcomingSection" data-section="next-up">
                        <div class="itemsContainer scrollSlider">
                            <div data-type="Episode" data-id="episode1">
                                <a href="#/details?id=episode1"></a>
                                <div class="cardImageContainer">
                                    <div class="cardText">Episode 1</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${pageType === 'season' ? `
                    <div id="childrenContent">
                        <div class="childrenItemsContainer">
                            <div class="listItem">
                                <a href="#/details?id=episode1"></a>
                                <div class="listItemBody">
                                    <div class="listItemIndexNumber">S01E01</div>
                                    <h3>Episode 1</h3>
                                    <div class="secondary">Info</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${pageType === 'episode' ? `
                    <div id="moreFromSeasonSection" data-section="more-from-season">
                        <div class="itemsContainer scrollSlider">
                            <div data-type="Episode" data-id="episode2">
                                <a href="#/details?id=episode2"></a>
                                <div class="cardImageContainer">
                                    <div class="cardText">Episode 2</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </body>
        </html>
    `;
    return new JSDOM(html, {
        url: `https://jellyfin.local/web/index.html#/details?id=${itemId}`,
        runScripts: 'dangerously',
        resources: 'usable'
    });
}

function setupMockApiClient(dom, itemType, itemId, providerIds, episodes) {
    dom.window.ApiClient = {
        getCurrentUserId: () => 'user123',
        getUrl: (path) => `https://jellyfin.local/${path}`,
        accessToken: () => 'mock-token',
        getItem: (userId, id) => {
            return Promise.resolve({
                Id: id,
                Type: itemType,
                SeriesId: itemType !== 'Series' ? 'series123' : null,
                SeasonNumber: itemType === 'Season' ? 1 : null,
                ParentIndexNumber: itemType === 'Episode' ? 1 : null,
                ProviderIds: providerIds
            });
        }
    };

    const originalFetch = dom.window.fetch;
    dom.window.fetch = (url, options) => {
        if (url.includes('MissingEpisodes')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(episodes)
            });
        }
        return originalFetch(url, options);
    };
}

function waitForPlaceholders(dom, expectedCount, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder]');
            if (placeholders.length >= expectedCount) {
                resolve(placeholders);
            } else if (Date.now() - start > timeout) {
                reject(new Error(`Timeout: expected ${expectedCount} placeholders, found ${placeholders.length}`));
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

function clearView(dom) {
    const page = dom.window.document.querySelector('.page');
    if (page) {
        page.classList.add('hide');
    }
}

function showView(dom) {
    const page = dom.window.document.querySelector('.page');
    if (page) {
        page.classList.remove('hide');
        const event = new dom.window.Event('viewshow');
        dom.window.document.dispatchEvent(event);
    }
}

async function testSeriesPage() {
    console.log('\n=== Testing Series Page ===');
    const dom = createMockJellyfinPage('series', 'series123');
    const episodes = [
        {
            seasonNumber: 1,
            episodeNumber: 3,
            title: 'Episode 3',
            airDate: '2026-10-01',
            airDateUtc: '2026-10-01T00:00:00Z',
            hasAired: false
        }
    ];
    setupMockApiClient(dom, 'Series', 'series123', { Tvdb: '12345' }, episodes);

    const clientScript = require('fs').readFileSync(__dirname + '/client.js', 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    for (let i = 1; i <= 3; i++) {
        console.log(`  Visit ${i}...`);
        if (i > 1) {
            clearView(dom);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        showView(dom);
        
        await waitForPlaceholders(dom, 1);
        const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder="card"]');
        console.log(`    ✓ Found ${placeholders.length} card placeholder(s)`);
        
        if (i === 1) {
            const countdown = dom.window.document.querySelector('.sonarr-placeholder-countdown');
            console.log(`    ✓ Countdown present: ${!!countdown}`);
        }
    }
    
    console.log('  ✓ Series page test passed');
}

async function testSeasonPage() {
    console.log('\n=== Testing Season Page ===');
    const dom = createMockJellyfinPage('season', 'season123');
    const episodes = [
        {
            seasonNumber: 1,
            episodeNumber: 4,
            title: 'Episode 4',
            airDate: '2026-10-08',
            airDateUtc: '2026-10-08T00:00:00Z',
            hasAired: false
        }
    ];
    setupMockApiClient(dom, 'Season', 'season123', { Tvdb: '12345' }, episodes);

    const clientScript = require('fs').readFileSync(__dirname + '/client.js', 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    for (let i = 1; i <= 3; i++) {
        console.log(`  Visit ${i}...`);
        if (i > 1) {
            clearView(dom);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        showView(dom);
        
        await waitForPlaceholders(dom, 1);
        const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder="row"]');
        console.log(`    ✓ Found ${placeholders.length} row placeholder(s)`);
    }
    
    console.log('  ✓ Season page test passed');
}

async function testEpisodePage() {
    console.log('\n=== Testing Episode Page ===');
    const dom = createMockJellyfinPage('episode', 'episode123');
    const episodes = [
        {
            seasonNumber: 1,
            episodeNumber: 5,
            title: 'Episode 5',
            airDate: '2026-10-15',
            airDateUtc: '2026-10-15T00:00:00Z',
            hasAired: false
        }
    ];
    setupMockApiClient(dom, 'Episode', 'episode123', { Tvdb: '12345' }, episodes);

    const clientScript = require('fs').readFileSync(__dirname + '/client.js', 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    for (let i = 1; i <= 3; i++) {
        console.log(`  Visit ${i}...`);
        if (i > 1) {
            clearView(dom);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        showView(dom);
        
        await waitForPlaceholders(dom, 1);
        const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder="card"]');
        console.log(`    ✓ Found ${placeholders.length} card placeholder(s)`);
    }
    
    console.log('  ✓ Episode page test passed');
}

async function runTests() {
    console.log('SonarrPlaceholder Client Test Suite');
    console.log('===================================');
    
    try {
        await testSeriesPage();
        await testSeasonPage();
        await testEpisodePage();
        
        console.log('\n✓ All tests passed');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        process.exit(1);
    }
}

runTests();
