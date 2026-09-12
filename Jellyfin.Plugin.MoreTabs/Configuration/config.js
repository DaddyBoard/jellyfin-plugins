export default function (view) {
    const pluginId = '9f3c2a71-6d84-4b1e-9e2a-1c8f0d5a7b33';
    const list = view.querySelector('#moreTabsList');
    const template = view.querySelector('#moreTabTemplate');
    const form = view.querySelector('#MoreTabsConfigForm');
    const addButton = view.querySelector('#btnAddMoreTab');
    const addDividerButton = view.querySelector('#btnAddMoreDivider');
    const status = view.querySelector('#moreTabsStatus');
    let started = false;
    const iconGroups = [
        {
            label: 'Media',
            icons: [
                ['movie', 'Movie'],
                ['theaters', 'Theaters'],
                ['local_movies', 'Local movies'],
                ['tv', 'TV'],
                ['live_tv', 'Live TV'],
                ['video_library', 'Video library'],
                ['videocam', 'Videocam'],
                ['play_arrow', 'Play'],
                ['play_circle', 'Play circle'],
                ['playlist_play', 'Playlist'],
                ['queue', 'Queue'],
                ['subscriptions', 'Subscriptions']
            ]
        },
        {
            label: 'Music',
            icons: [
                ['library_music', 'Music library'],
                ['music_note', 'Music note'],
                ['headphones', 'Headphones'],
                ['album', 'Album'],
                ['radio', 'Radio'],
                ['mic', 'Microphone']
            ]
        },
        {
            label: 'Library',
            icons: [
                ['photo_library', 'Photo library'],
                ['collections', 'Collections'],
                ['folder', 'Folder'],
                ['folder_special', 'Folder special'],
                ['bookmark', 'Bookmark'],
                ['bookmarks', 'Bookmarks'],
                ['favorite', 'Favorite'],
                ['star', 'Star']
            ]
        },
        {
            label: 'Requests and calendar',
            icons: [
                ['assignment', 'Assignment'],
                ['pending_actions', 'Pending actions'],
                ['add_circle', 'Add'],
                ['checklist', 'Checklist'],
                ['task', 'Task'],
                ['event', 'Event'],
                ['calendar_today', 'Calendar'],
                ['schedule', 'Schedule']
            ]
        },
        {
            label: 'Network',
            icons: [
                ['public', 'Public'],
                ['language', 'Language'],
                ['travel_explore', 'Explore'],
                ['open_in_new', 'Open in new'],
                ['link', 'Link'],
                ['rss_feed', 'RSS'],
                ['cell_tower', 'Cell tower'],
                ['wifi', 'Wi-Fi'],
                ['download', 'Download'],
                ['cloud_download', 'Cloud download'],
                ['cloud', 'Cloud']
            ]
        },
        {
            label: 'People and chat',
            icons: [
                ['person', 'Person'],
                ['people', 'People'],
                ['groups', 'Groups'],
                ['child_care', 'Kids'],
                ['forum', 'Forum'],
                ['chat', 'Chat'],
                ['mail', 'Mail'],
                ['campaign', 'Campaign']
            ]
        },
        {
            label: 'General',
            icons: [
                ['tab', 'Tab'],
                ['home', 'Home'],
                ['dashboard', 'Dashboard'],
                ['apps', 'Apps'],
                ['widgets', 'Widgets'],
                ['extension', 'Extension'],
                ['settings', 'Settings'],
                ['tune', 'Tune'],
                ['search', 'Search'],
                ['view_list', 'List'],
                ['grid_view', 'Grid'],
                ['article', 'Article'],
                ['menu_book', 'Book'],
                ['auto_stories', 'Stories'],
                ['map', 'Map'],
                ['place', 'Place'],
                ['photo', 'Photo'],
                ['image', 'Image'],
                ['sports_esports', 'Esports'],
                ['sports', 'Sports'],
                ['toys', 'Toys'],
                ['celebration', 'Celebration'],
                ['emoji_events', 'Trophy'],
                ['code', 'Code'],
                ['terminal', 'Terminal'],
                ['smart_toy', 'Robot'],
                ['science', 'Science'],
                ['storage', 'Storage'],
                ['dns', 'DNS']
            ]
        }
    ];

    function fillIconSelect(select, selected) {
        if (select.options.length <= 1) {
            iconGroups.forEach(function (group) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = group.label;
                group.icons.forEach(function (icon) {
                    const option = document.createElement('option');
                    option.value = icon[0];
                    option.textContent = icon[1];
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            });
        }
        if (selected && !Array.prototype.some.call(select.options, function (option) {
            return option.value === selected;
        })) {
            const extra = document.createElement('option');
            extra.value = selected;
            extra.textContent = selected;
            select.appendChild(extra);
        }
        select.value = selected || '';
    }

    function bindIconPreview(row) {
        const select = row.querySelector('[data-id=icon]');
        const preview = row.querySelector('[data-id=icon-preview]');
        if (!select || !preview) {
            return;
        }
        function sync() {
            preview.textContent = select.value || '';
        }
        select.addEventListener('change', sync);
        sync();
    }

    function newId() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID().replace(/-/g, '');
        }
        return 't' + Date.now().toString(16) + Math.random().toString(16).slice(2);
    }

    function addRow(tab) {
        const node = template.content.cloneNode(true);
        const row = node.querySelector('[data-id=tab-row]');
        const divider = !!(tab.Divider || tab.divider);
        if (divider) {
            row.setAttribute('data-kind', 'divider');
        }
        row.querySelector('[data-id=id]').value = tab.Id || tab.id || newId();
        row.querySelector('[data-id=title]').value = divider ? '|' : (tab.Title || tab.title || '');
        row.querySelector('[data-id=url]').value = divider ? '' : (tab.Url || tab.url || '');
        const iconValue = divider ? '' : (tab.Icon || tab.icon || '');
        fillIconSelect(row.querySelector('[data-id=icon]'), iconValue);
        row.querySelector('[data-id=enabled]').checked = tab.Enabled !== false;
        list.appendChild(node);
        if (window.CustomElements && window.CustomElements.upgradeSubtree) {
            window.CustomElements.upgradeSubtree(list);
        }
        row.querySelector('[data-id=icon]').value = iconValue;
        bindIconPreview(row);
    }

    function collectTabs() {
        const tabs = [];
        list.querySelectorAll('[data-id=tab-row]').forEach(function (row) {
            const divider = row.getAttribute('data-kind') === 'divider';
            tabs.push({
                Id: row.querySelector('[data-id=id]').value || newId(),
                Title: divider ? '|' : row.querySelector('[data-id=title]').value.trim(),
                Url: divider ? '' : row.querySelector('[data-id=url]').value.trim(),
                Icon: divider ? '' : row.querySelector('[data-id=icon]').value.trim(),
                Enabled: row.querySelector('[data-id=enabled]').checked,
                Divider: divider
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
            addRow({ Id: newId(), Title: 'New tab', Url: '', Icon: '', Enabled: true, Divider: false });
        });
        addDividerButton.addEventListener('click', function () {
            addRow({ Id: newId(), Title: '|', Url: '', Icon: '', Enabled: true, Divider: true });
        });
        form.addEventListener('submit', save);
        list.addEventListener('click', onListClick);
        load();
    }

    view.addEventListener('viewshow', start);
    start();
}
