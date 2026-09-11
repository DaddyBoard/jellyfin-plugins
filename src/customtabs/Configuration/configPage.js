const CustomTabsJF12ConfigPage = {
    pluginUniqueId: '7c3f8a92-4b1d-4e8f-9a2c-5d6e7f8a9b0c',

    loadConfiguration: function() {
        ApiClient.getPluginConfiguration(this.pluginUniqueId).then(function(config) {
            CustomTabsJF12ConfigPage.renderTabs(config.Tabs || []);
        });
    },

    renderTabs: function(tabs) {
        const container = document.getElementById('tabsList');
        container.innerHTML = '';
        
        tabs.forEach(function(tab, index) {
            const tabDiv = document.createElement('div');
            tabDiv.className = 'verticalSection';
            tabDiv.style.border = '1px solid #333';
            tabDiv.style.padding = '1em';
            tabDiv.style.marginBottom = '1em';
            
            tabDiv.innerHTML = `
                <h3>Tab ${index + 1}</h3>
                <div class="inputContainer">
                    <label class="inputLabel" for="tabTitle${index}">Title:</label>
                    <input is="emby-input" type="text" id="tabTitle${index}" value="${tab.Title || ''}" class="emby-input" />
                </div>
                <div class="inputContainer">
                    <label class="inputLabel" for="tabUrl${index}">URL:</label>
                    <input is="emby-input" type="text" id="tabUrl${index}" value="${tab.Url || ''}" class="emby-input" />
                </div>
                <div class="checkboxContainer">
                    <label>
                        <input is="emby-checkbox" type="checkbox" id="tabEnabled${index}" ${tab.Enabled !== false ? 'checked' : ''} />
                        <span>Enabled</span>
                    </label>
                </div>
                <button is="emby-button" type="button" class="raised button-cancel block deleteTabBtn" data-index="${index}">
                    <span>Delete Tab</span>
                </button>
            `;
            
            container.appendChild(tabDiv);
        });
        
        document.querySelectorAll('.deleteTabBtn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                CustomTabsJF12ConfigPage.deleteTab(index);
            });
        });
    },

    deleteTab: function(index) {
        ApiClient.getPluginConfiguration(this.pluginUniqueId).then(function(config) {
            config.Tabs.splice(index, 1);
            ApiClient.updatePluginConfiguration(CustomTabsJF12ConfigPage.pluginUniqueId, config).then(function() {
                Dashboard.processPluginConfigurationUpdateResult();
                CustomTabsJF12ConfigPage.loadConfiguration();
            });
        });
    },

    addTab: function() {
        ApiClient.getPluginConfiguration(this.pluginUniqueId).then(function(config) {
            if (!config.Tabs) {
                config.Tabs = [];
            }
            config.Tabs.push({
                Title: 'New Tab',
                Url: 'https://example.com',
                Enabled: true
            });
            ApiClient.updatePluginConfiguration(CustomTabsJF12ConfigPage.pluginUniqueId, config).then(function() {
                Dashboard.processPluginConfigurationUpdateResult();
                CustomTabsJF12ConfigPage.loadConfiguration();
            });
        });
    },

    onSubmit: function() {
        const form = document.getElementById('customTabsJF12ConfigForm');
        
        ApiClient.getPluginConfiguration(this.pluginUniqueId).then(function(config) {
            const tabs = [];
            const tabElements = document.querySelectorAll('#tabsList > div');
            
            tabElements.forEach(function(tabDiv, index) {
                tabs.push({
                    Title: document.getElementById('tabTitle' + index).value,
                    Url: document.getElementById('tabUrl' + index).value,
                    Enabled: document.getElementById('tabEnabled' + index).checked
                });
            });
            
            config.Tabs = tabs;
            
            ApiClient.updatePluginConfiguration(CustomTabsJF12ConfigPage.pluginUniqueId, config).then(function() {
                Dashboard.processPluginConfigurationUpdateResult();
            });
        });
        
        return false;
    }
};

function initConfigPage() {
    console.log('[CustomTabsJF12] Config page initialization started');
    
    const page = document.getElementById('customTabsJF12ConfigPage');
    if (!page) {
        console.log('[CustomTabsJF12] Config page element not found, skipping init');
        return;
    }
    
    console.log('[CustomTabsJF12] Config page found, loading configuration');
    CustomTabsJF12ConfigPage.loadConfiguration();
    
    const form = document.getElementById('customTabsJF12ConfigForm');
    if (form) {
        console.log('[CustomTabsJF12] Binding form submit handler');
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    }
    
    const addBtn = document.getElementById('addTabBtn');
    if (addBtn) {
        console.log('[CustomTabsJF12] Binding Add Tab button click handler');
        addBtn.removeEventListener('click', handleAddTab);
        addBtn.addEventListener('click', handleAddTab);
    } else {
        console.warn('[CustomTabsJF12] Add Tab button not found!');
    }
    
    console.log('[CustomTabsJF12] Config page initialization complete');
}

function handleSubmit(e) {
    console.log('[CustomTabsJF12] Form submit handler called');
    e.preventDefault();
    CustomTabsJF12ConfigPage.onSubmit();
    return false;
}

function handleAddTab(e) {
    console.log('[CustomTabsJF12] Add Tab button clicked');
    e.preventDefault();
    CustomTabsJF12ConfigPage.addTab();
}

window.addEventListener('pageshow', function(e) {
    console.log('[CustomTabsJF12] pageshow event fired');
    initConfigPage();
});

window.addEventListener('viewshow', function(e) {
    console.log('[CustomTabsJF12] viewshow event fired');
    if (e.detail && e.detail.type === 'customTabsJF12ConfigPage') {
        initConfigPage();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('[CustomTabsJF12] DOMContentLoaded event fired');
    initConfigPage();
});
