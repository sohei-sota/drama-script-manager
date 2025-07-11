const { contextBridge, ipcRenderer } = require('electron');

console.log('electron-preload.js loaded');

contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    saveScript: (script) => ipcRenderer.invoke('save-script', script),
    getAllScripts: () => ipcRenderer.invoke('get-all-scripts'),
    searchScripts: (query, searchBy) => ipcRenderer.invoke('search-scripts', { query, searchBy }),
    deleteScript: (id) => ipcRenderer.invoke('delete-script', id),
    updateScript: (script) => ipcRenderer.invoke('update-script', script),
    exportScript: (script) => ipcRenderer.invoke('export-script', script)
  }
);