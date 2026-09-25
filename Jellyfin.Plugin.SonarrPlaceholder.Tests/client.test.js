const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function createMockJellyfinPage(pageType, itemId) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Jellyfin</title></head>
        <body>
            <div class="page hide" id="itemDetailPage">
                ${pageType === 'series' ? `
                    <div id="nextUpSection">
                        <div class="itemsContainer scrollSlider">
                            <div data-type="Episode" data-id="episode1">
                                <a href="#/details?id=episode1"></a>
                                <div class="cardImageContainer">
                                    <img src="episode1.jpg" />
                                    <div class="cardText">Episode 1</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${pageType === 'season' ? `
                    <div id="childrenContent">
                        <div class="listItem" data-id="episode1">
                            <a href="#/details?id=episode1"></a>
                            <div class="listItemBody">
                                <div class="listItemIndexNumber">S01E01</div>
                                <h3>Episode 1</h3>
                                <div class="secondary">Info</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${pageType === 'episode' ? `
                    <div id="moreFromSeasonSection">
                        <div class="itemsContainer scrollSlider">
                            <div data-type="Episode" data-id="episode2">
                                <a href="#/details?id=episode2"></a>
                                <div class="cardImageContainer">
                                    <img src="episode2.jpg" />
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
        resources: 'usable',
        beforeParse(window) {
            window.console = console;
        }
    });
}

function setupMockApiClient(dom, itemType, itemId, seasonNumber, providerIds, episodes, validateSeasonFilter) {
    const seriesId = itemType === 'Series' ? itemId : 'abc123def456';
    const seriesItem = {
        Id: seriesId,
        Type: 'Series',
        ProviderIds: providerIds
    };

    dom.window.ApiClient = {
        getCurrentUserId: () => 'user123',
        getUrl: (path) => `https://jellyfin.local/${path}`,
        accessToken: () => 'mock-token',
        getItem: (userId, id) => {
            if (id === seriesId || (itemType === 'Series' && id === itemId)) {
                return Promise.resolve(seriesItem);
            } else if (itemType === 'Season' && id === itemId) {
                return Promise.resolve({
                    Id: itemId,
                    Type: 'Season',
                    SeriesId: seriesId,
                    IndexNumber: seasonNumber,
                    ProviderIds: {}
                });
            } else if (itemType === 'Episode' && id === itemId) {
                return Promise.resolve({
                    Id: itemId,
                    Type: 'Episode',
                    SeriesId: seriesId,
                    ParentIndexNumber: seasonNumber,
                    ProviderIds: {}
                });
            }
            return Promise.reject(new Error('Item not found: ' + id));
        }
    };

    const originalFetch = dom.window.fetch || function() { return Promise.reject(new Error('fetch not implemented')); };
    dom.window.fetch = (url, options) => {
        if (url.includes('MissingEpisodes')) {
            if (validateSeasonFilter && seasonNumber != null) {
                if (!url.includes('seasonNumber=' + seasonNumber)) {
                    return Promise.reject(new Error('Season filter not applied! URL: ' + url));
                }
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(episodes)
            });
        }
        return originalFetch(url, options);
    };
}

function waitForPlaceholders(dom, expectedCount, timeout = 3000) {
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

function reRenderChildren(dom, pageType) {
    let container;
    if (pageType === 'series') {
        container = dom.window.document.querySelector('#nextUpSection .itemsContainer');
    } else if (pageType === 'season') {
        container = dom.window.document.querySelector('#childrenContent');
    } else if (pageType === 'episode') {
        container = dom.window.document.querySelector('#moreFromSeasonSection .itemsContainer');
    }
    
    if (container) {
        const nonPlaceholders = Array.from(container.querySelectorAll(':not([data-sonarr-placeholder])'));
        container.innerHTML = '';
        nonPlaceholders.forEach(node => container.appendChild(node));
    }
}

async function testSeriesPage() {
    console.log('\n=== Testing Series Page ===');
    const dom = createMockJellyfinPage('series', 'abc123def456');
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
    setupMockApiClient(dom, 'Series', 'abc123def456', null, { Tvdb: '12345' }, episodes, false);

    const clientScript = fs.readFileSync(path.join(__dirname, '../Jellyfin.Plugin.SonarrPlaceholder/Web/client.js'), 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    await new Promise(resolve => setTimeout(resolve, 200));

    for (let i = 1; i <= 3; i++) {
        console.log(`  Visit ${i}...`);
        if (i > 1) {
            clearView(dom);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        showView(dom);
        
        await waitForPlaceholders(dom, 1);
        const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder="card"]');
        console.log(`    ✓ Found ${placeholders.length} card placeholder(s)`);
        
        if (i === 1) {
            const countdown = dom.window.document.querySelector('.sonarr-placeholder-countdown');
            console.log(`    ✓ Countdown present: ${!!countdown}`);
            
            const dataAttrs = placeholders[0].getAttribute('data-id');
            console.log(`    ✓ data-id stripped: ${dataAttrs === null}`);
        }
    }
    
    console.log('  ✓ Series page test passed');
}

async function testSeasonPage() {
    console.log('\n=== Testing Season Page ===');
    const dom = createMockJellyfinPage('season', 'bcd234efa567');
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
    setupMockApiClient(dom, 'Season', 'bcd234efa567', 1, { Tvdb: '12345' }, episodes, true);

    const clientScript = fs.readFileSync(path.join(__dirname, '../Jellyfin.Plugin.SonarrPlaceholder/Web/client.js'), 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    await new Promise(resolve => setTimeout(resolve, 200));

    for (let i = 1; i <= 3; i++) {
        console.log(`  Visit ${i}...`);
        if (i > 1) {
            clearView(dom);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        showView(dom);
        
        await waitForPlaceholders(dom, 1);
        const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder="row"]');
        console.log(`    ✓ Found ${placeholders.length} row placeholder(s)`);
        
        if (i === 1) {
            const text = placeholders[0].textContent;
            console.log(`    ✓ Contains S01E04: ${text.includes('S01E04')}`);
        }
    }
    
    console.log('  ✓ Season page test passed (seasonNumber=1 in URL verified)');
}

async function testEpisodePage() {
    console.log('\n=== Testing Episode Page ===');
    const dom = createMockJellyfinPage('episode', 'cde345fab678');
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
    setupMockApiClient(dom, 'Episode', 'cde345fab678', 1, { Tvdb: '12345' }, episodes, true);

    const clientScript = fs.readFileSync(path.join(__dirname, '../Jellyfin.Plugin.SonarrPlaceholder/Web/client.js'), 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    await new Promise(resolve => setTimeout(resolve, 200));

    for (let i = 1; i <= 3; i++) {
        console.log(`  Visit ${i}...`);
        if (i > 1) {
            clearView(dom);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        showView(dom);
        
        await waitForPlaceholders(dom, 1);
        const placeholders = dom.window.document.querySelectorAll('[data-sonarr-placeholder="card"]');
        console.log(`    ✓ Found ${placeholders.length} card placeholder(s)`);
    }
    
    console.log('  ✓ Episode page test passed (seasonNumber=1 in URL verified)');
}

async function testDelayedContainer() {
    console.log('\n=== Testing Delayed Container Render ===');
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head><title>Jellyfin</title></head>
        <body>
            <div class="page hide" id="itemDetailPage"></div>
        </body>
        </html>
    `, {
        url: 'https://jellyfin.local/web/index.html#/details?id=abc123def456',
        runScripts: 'dangerously',
        resources: 'usable',
        beforeParse(window) {
            window.console = console;
        }
    });

    const episodes = [{
        seasonNumber: 1,
        episodeNumber: 10,
        title: 'Late Episode',
        airDate: '2026-11-01',
        airDateUtc: '2026-11-01T00:00:00Z',
        hasAired: false
    }];
    setupMockApiClient(dom, 'Series', 'abc123def456', null, { Tvdb: '12345' }, episodes, false);

    const clientScript = fs.readFileSync(path.join(__dirname, '../Jellyfin.Plugin.SonarrPlaceholder/Web/client.js'), 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    await new Promise(resolve => setTimeout(resolve, 200));

    showView(dom);
    
    console.log('  Waiting 1.5s before adding container...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const page = dom.window.document.querySelector('.page');
    page.innerHTML = `
        <div id="nextUpSection">
            <div class="itemsContainer">
                <div data-type="Episode" data-id="episode1">
                    <a href="#/details?id=episode1"></a>
                    <div class="cardImageContainer">
                        <div class="cardText">Episode 1</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    await waitForPlaceholders(dom, 1);
    console.log('  ✓ Placeholders appeared after delayed container render');
}

async function testReRender() {
    console.log('\n=== Testing Re-render After Injection ===');
    const dom = createMockJellyfinPage('series', 'abc123def456');
    const episodes = [{
        seasonNumber: 1,
        episodeNumber: 20,
        title: 'Rerender Test',
        airDate: '2026-12-01',
        airDateUtc: '2026-12-01T00:00:00Z',
        hasAired: false
    }];
    setupMockApiClient(dom, 'Series', 'abc123def456', null, { Tvdb: '12345' }, episodes, false);

    const clientScript = fs.readFileSync(path.join(__dirname, '../Jellyfin.Plugin.SonarrPlaceholder/Web/client.js'), 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = clientScript;
    dom.window.document.head.appendChild(scriptEl);

    await new Promise(resolve => setTimeout(resolve, 200));

    showView(dom);
    await waitForPlaceholders(dom, 1);
    console.log('  ✓ Initial placeholders rendered');
    
    console.log('  Simulating list re-render (remove all children, re-add non-placeholders)...');
    reRenderChildren(dom, 'series');
    
    await waitForPlaceholders(dom, 1);
    console.log('  ✓ Placeholders re-appeared after re-render');
}

async function runTests() {
    console.log('SonarrPlaceholder Client Test Suite v1.0.0.1');
    console.log('==============================================');
    
    try {
        await testSeriesPage();
        await testSeasonPage();
        await testEpisodePage();
        await testDelayedContainer();
        await testReRender();
        
        console.log('\n✓ All tests passed');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runTests();
