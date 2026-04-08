const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  getApiConfig: () => ipcRenderer.invoke('config:getApi'),
  getApiConfigStatus: () => ipcRenderer.invoke('config:getApiStatus'),
  chooseExportDirectory: () => ipcRenderer.invoke('config:chooseExportDirectory'),
  saveApiConfig: (config) => ipcRenderer.invoke('config:saveApi', config),
  openSettings: () => ipcRenderer.invoke('app:openSettings'),
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:open-settings', listener);
    return () => ipcRenderer.removeListener('app:open-settings', listener);
  },
});
