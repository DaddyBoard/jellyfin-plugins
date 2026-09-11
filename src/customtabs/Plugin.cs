using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using CustomTabsJF12.Configuration;

namespace CustomTabsJF12;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public override string Name => "Custom Tabs JF12";

    public override Guid Id => Guid.Parse("7c3f8a92-4b1d-4e8f-9a2c-5d6e7f8a9b0c");

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        RegisterFileTransformation();
    }

    public static Plugin? Instance { get; private set; }

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = "customtabsjf12",
                EmbeddedResourcePath = GetType().Namespace + ".Configuration.configPage.html"
            },
            new PluginPageInfo
            {
                Name = "customtabsjf12.js",
                EmbeddedResourcePath = GetType().Namespace + ".Configuration.configPage.js"
            }
        };
    }

    private void RegisterFileTransformation()
    {
        try
        {
            var ftAssembly = AppDomain.CurrentDomain.Load("Jellyfin.Plugin.FileTransformation");
            var pluginInterfaceType = ftAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            
            if (pluginInterfaceType == null)
            {
                return;
            }

            var registerMethod = pluginInterfaceType.GetMethod("RegisterTransformation");
            if (registerMethod == null)
            {
                return;
            }

            registerMethod.Invoke(null, new object[] { "index.html", new Func<string, string>(TransformIndexHtml) });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CustomTabsJF12] Failed to register file transformation: {ex.Message}");
        }
    }

    private string TransformIndexHtml(string content)
    {
        const string injectionMarker = "</body>";
        var scriptTag = @"
<script>
(function() {
    console.log('[CustomTabsJF12] Initializing Custom Tabs injection');
    
    let customTabsOverlay = null;
    let customTabsIframe = null;
    
    function injectCustomTabs() {
        console.log('[CustomTabsJF12] Attempting to inject custom tabs');
        
        const toolbar = document.querySelector('.MuiToolbar-root .MuiStack-root');
        if (!toolbar) {
            console.log('[CustomTabsJF12] Toolbar not found, will retry');
            return false;
        }
        
        if (document.querySelector('.custom-tabs-jf12-injected')) {
            console.log('[CustomTabsJF12] Already injected');
            return true;
        }
        
        fetch('/CustomTabsJF12/Tabs')
            .then(res => res.json())
            .then(tabs => {
                console.log('[CustomTabsJF12] Received tabs:', tabs);
                
                tabs.forEach(tab => {
                    if (!tab.Enabled) return;
                    
                    const button = document.createElement('button');
                    button.className = 'MuiButtonBase-root MuiButton-root custom-tabs-jf12-injected';
                    button.style.cssText = 'color: inherit; text-transform: none; min-width: 64px; padding: 6px 16px; font-size: 0.875rem;';
                    button.textContent = tab.Title;
                    
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openCustomTab(tab.Title, tab.Url);
                    });
                    
                    toolbar.appendChild(button);
                });
                
                console.log('[CustomTabsJF12] Successfully injected ' + tabs.length + ' custom tabs');
            })
            .catch(err => {
                console.error('[CustomTabsJF12] Failed to fetch tabs:', err);
            });
        
        return true;
    }
    
    function openCustomTab(title, url) {
        console.log('[CustomTabsJF12] Opening custom tab:', title, url);
        
        if (customTabsOverlay) {
            customTabsOverlay.remove();
        }
        
        customTabsOverlay = document.createElement('div');
        customTabsOverlay.style.cssText = `
            position: fixed;
            top: 64px;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            flex-direction: column;
        `;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 24px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 2001;
        `;
        closeButton.onclick = closeCustomTab;
        
        customTabsIframe = document.createElement('iframe');
        customTabsIframe.src = url;
        customTabsIframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
        `;
        
        customTabsOverlay.appendChild(closeButton);
        customTabsOverlay.appendChild(customTabsIframe);
        document.body.appendChild(customTabsOverlay);
        
        document.addEventListener('keydown', handleEscape);
    }
    
    function closeCustomTab() {
        console.log('[CustomTabsJF12] Closing custom tab');
        if (customTabsOverlay) {
            customTabsOverlay.remove();
            customTabsOverlay = null;
            customTabsIframe = null;
        }
        document.removeEventListener('keydown', handleEscape);
    }
    
    function handleEscape(e) {
        if (e.key === 'Escape') {
            closeCustomTab();
        }
    }
    
    const observer = new MutationObserver((mutations) => {
        injectCustomTabs();
    });
    
    function startObserving() {
        const targetNode = document.body;
        if (targetNode) {
            observer.observe(targetNode, { childList: true, subtree: true });
            console.log('[CustomTabsJF12] MutationObserver started');
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                injectCustomTabs();
                startObserving();
            }, 1000);
        });
    } else {
        setTimeout(() => {
            injectCustomTabs();
            startObserving();
        }, 1000);
    }
})();
</script>
";
        
        if (content.Contains(injectionMarker))
        {
            content = content.Replace(injectionMarker, scriptTag + injectionMarker);
        }
        
        return content;
    }
}
