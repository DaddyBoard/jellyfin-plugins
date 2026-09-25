export default function (view) {
    const pluginId = 'a7f8c2e1-3d4b-5c6a-7e8f-9a0b1c2d3e4f';
    const form = view.querySelector('#SonarrPlaceholderConfigForm');
    const txtSonarrUrl = view.querySelector('#txtSonarrUrl');
    const txtSonarrApiKey = view.querySelector('#txtSonarrApiKey');
    const chkEnabled = view.querySelector('#chkEnabled');
    const chkShowAiredButMissing = view.querySelector('#chkShowAiredButMissing');
    const chkShowUnairedEpisodes = view.querySelector('#chkShowUnairedEpisodes');
    const txtMaxDaysAhead = view.querySelector('#txtMaxDaysAhead');
    const txtCacheDuration = view.querySelector('#txtCacheDuration');
    const btnTestConnection = view.querySelector('#btnTestConnection');
    const testConnectionResult = view.querySelector('#testConnectionResult');
    let started = false;

    function authHeaders() {
        var headers = { accept: 'application/json', 'Content-Type': 'application/json' };
        try {
            var token = window.ApiClient && window.ApiClient.accessToken && window.ApiClient.accessToken();
            if (token) {
                headers.Authorization = 'MediaBrowser Token="' + token + '"';
                headers['X-Emby-Token'] = token;
            }
        } catch (e) {
            console.error('Failed to get auth headers', e);
        }
        return headers;
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
        api.getPluginConfiguration(pluginId).then(function (config) {
            txtSonarrUrl.value = config.SonarrUrl || '';
            txtSonarrApiKey.value = config.SonarrApiKey || '';
            chkEnabled.checked = config.Enabled !== false;
            chkShowAiredButMissing.checked = config.ShowAiredButMissing !== false;
            chkShowUnairedEpisodes.checked = config.ShowUnairedEpisodes !== false;
            txtMaxDaysAhead.value = config.MaxDaysAhead || 365;
            txtCacheDuration.value = config.CacheDurationMinutes || 5;
        }).catch(function (error) {
            console.error('SonarrPlaceholder: failed to load configuration', error);
        }).finally(function () {
            if (dashboard) {
                dashboard.hideLoadingMsg();
            }
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
            config.SonarrUrl = txtSonarrUrl.value.trim();
            config.SonarrApiKey = txtSonarrApiKey.value.trim();
            config.Enabled = chkEnabled.checked;
            config.ShowAiredButMissing = chkShowAiredButMissing.checked;
            config.ShowUnairedEpisodes = chkShowUnairedEpisodes.checked;
            config.MaxDaysAhead = parseInt(txtMaxDaysAhead.value, 10) || 365;
            config.CacheDurationMinutes = parseInt(txtCacheDuration.value, 10) || 5;
            return api.updatePluginConfiguration(pluginId, config);
        }).then(function (result) {
            if (dashboard && dashboard.processPluginConfigurationUpdateResult) {
                dashboard.processPluginConfigurationUpdateResult(result);
            }
        }).catch(function (error) {
            console.error('SonarrPlaceholder: failed to save configuration', error);
        }).finally(function () {
            if (dashboard) {
                dashboard.hideLoadingMsg();
            }
        });
        return false;
    }

    function testConnection() {
        const url = txtSonarrUrl.value.trim();
        const apiKey = txtSonarrApiKey.value.trim();

        if (!url || !apiKey) {
            testConnectionResult.textContent = 'Please enter both URL and API key';
            testConnectionResult.style.color = '#ff0000';
            return;
        }

        testConnectionResult.textContent = 'Testing...';
        testConnectionResult.style.color = '#808080';
        btnTestConnection.disabled = true;

        fetch(window.ApiClient.getUrl('SonarrPlaceholder/TestConnection'), {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify({ SonarrUrl: url, SonarrApiKey: apiKey })
        }).then(function (response) {
            return response.json();
        }).then(function (data) {
            if (data.success) {
                testConnectionResult.textContent = 'Connection successful!';
                testConnectionResult.style.color = '#00ff00';
            } else {
                testConnectionResult.textContent = 'Connection failed';
                testConnectionResult.style.color = '#ff0000';
            }
        }).catch(function (error) {
            console.error('Test connection error:', error);
            testConnectionResult.textContent = 'Connection failed: ' + error.message;
            testConnectionResult.style.color = '#ff0000';
        }).finally(function () {
            btnTestConnection.disabled = false;
        });
    }

    function start() {
        if (started) {
            load();
            return;
        }
        started = true;
        form.addEventListener('submit', save);
        btnTestConnection.addEventListener('click', testConnection);
        load();
    }

    view.addEventListener('viewshow', start);
    start();
}
