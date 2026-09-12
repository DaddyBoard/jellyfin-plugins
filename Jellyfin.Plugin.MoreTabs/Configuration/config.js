export default function (view) {
    const pluginId = '9f3c2a71-6d84-4b1e-9e2a-1c8f0d5a7b33';
    const list = view.querySelector('#moreTabsList');
    const template = view.querySelector('#moreTabTemplate');
    const form = view.querySelector('#MoreTabsConfigForm');
    const addButton = view.querySelector('#btnAddMoreTab');
    const status = view.querySelector('#moreTabsStatus');
    let started = false;

    function newId() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID().replace(/-/g, '');
        }
        return 't' + Date.now().toString(16) + Math.random().toString(16).slice(2);
    }

    function addRow(tab) {
        const node = template.content.cloneNode(true);
        const row = node.querySelector('[data-id=tab-row]');
        row.querySelector('[data-id=id]').value = tab.Id || newId();
        row.querySelector('[data-id=title]').value = tab.Title || '';
        row.querySelector('[data-id=url]').value = tab.Url || '';
        row.querySelector('[data-id=icon]').value = tab.Icon || '';
        row.querySelector('[data-id=enabled]').checked = tab.Enabled !== false;
        list.appendChild(node);
        if (window.CustomElements && window.CustomElements.upgradeSubtree) {
            window.CustomElements.upgradeSubtree(list);
        }
    }

    function collectTabs() {
        const tabs = [];
        list.querySelectorAll('[data-id=tab-row]').forEach(function (row) {
            tabs.push({
                Id: row.querySelector('[data-id=id]').value || newId(),
                Title: row.querySelector('[data-id=title]').value.trim(),
                Url: row.querySelector('[data-id=url]').value.trim(),
                Icon: row.querySelector('[data-id=icon]').value.trim(),
                Enabled: row.querySelector('[data-id=enabled]').checked
            });
        });
        return tabs;
    }

    function load() {
        const api = window.ApiClient;
        const dashboard = window.Dashboard;
        if (!api) {
            return;
        }
        if (dashboard) {
            dashboard.showLoadingMsg();
        }
        loadStatus(api);
        api.getPluginConfiguration(pluginId).then(function (config) {
            list.innerHTML = '';
            const tabs = config && config.Tabs ? config.Tabs : [];
            tabs.forEach(addRow);
            if (tabs.length === 0) {
                addRow({ Id: newId(), Title: '', Url: '', Icon: '', Enabled: true });
            }
        }).catch(function (error) {
            console.error('MoreTabs: failed to load configuration', error);
        }).finally(function () {
            if (dashboard) {
                dashboard.hideLoadingMsg();
            }
        });
    }

    function loadStatus(api) {
        if (!status) {
            return;
        }
        fetch(api.getUrl('MoreTabs/Status'), {
            headers: {
                accept: 'application/json',
                Authorization: 'MediaBrowser Token="' + api.accessToken() + '"',
                'X-Emby-Token': api.accessToken()
            },
            credentials: 'same-origin'
        }).then(function (response) {
            return response.json();
        }).then(function (info) {
            var parts = [];
            if (info.injectionLastApplied) {
                parts.push('Web client script injection is working.');
            } else if (info.injectionLastPath) {
                parts.push('Jellyfin saw ' + info.injectionLastPath + ' but did not inject (' + (info.injectionLastSkipReason || 'unknown') + '). Hard-refresh Home.');
            } else {
                parts.push('Open Home once after a hard refresh so MoreTabs can inject into index.html.');
            }
            if (info.fileTransformationRegistered) {
                parts.push('File Transformation is also registered.');
            } else if (info.fileTransformationLoaded) {
                parts.push('File Transformation is loaded but not registered' + (info.lastError ? ': ' + info.lastError : '.'));
            }
            status.textContent = parts.join(' ');
        }).catch(function () {
            status.textContent = 'Could not read MoreTabs status.';
        });
    }

    function save(event) {
        event.preventDefault();
        const api = window.ApiClient;
        const dashboard = window.Dashboard;
        if (!api) {
            return false;
        }
        if (dashboard) {
            dashboard.showLoadingMsg();
        }
        api.getPluginConfiguration(pluginId).then(function (config) {
            config.Tabs = collectTabs();
            return api.updatePluginConfiguration(pluginId, config);
        }).then(function (result) {
            if (dashboard && dashboard.processPluginConfigurationUpdateResult) {
                dashboard.processPluginConfigurationUpdateResult(result);
            }
        }).catch(function (error) {
            console.error('MoreTabs: failed to save configuration', error);
        }).finally(function () {
            if (dashboard) {
                dashboard.hideLoadingMsg();
            }
        });
        return false;
    }

    function onListClick(event) {
        const button = event.target.closest('button');
        if (!button) {
            return;
        }
        const row = event.target.closest('[data-id=tab-row]');
        if (!row) {
            return;
        }
        const action = button.getAttribute('data-id');
        if (action === 'remove') {
            row.remove();
            return;
        }
        if (action === 'move-up' && row.previousElementSibling) {
            row.parentNode.insertBefore(row, row.previousElementSibling);
            return;
        }
        if (action === 'move-down' && row.nextElementSibling) {
            row.parentNode.insertBefore(row.nextElementSibling, row);
        }
    }

    function ensureClient() {
        if (window.MoreTabs) {
            return;
        }
        if (document.querySelector('script[src*="MoreTabs/client.js"]')) {
            return;
        }
        if (!window.ApiClient || !window.ApiClient.getUrl) {
            return;
        }
        var script = document.createElement('script');
        script.src = window.ApiClient.getUrl('MoreTabs/client.js');
        script.defer = true;
        document.head.appendChild(script);
    }

    function start() {
        ensureClient();
        if (started) {
            load();
            return;
        }
        started = true;
        addButton.addEventListener('click', function () {
            addRow({ Id: newId(), Title: 'New tab', Url: '', Icon: '', Enabled: true });
        });
        form.addEventListener('submit', save);
        list.addEventListener('click', onListClick);
        load();
    }

    view.addEventListener('viewshow', start);
    start();
}
