const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveCsv: (defaultName, content) => ipcRenderer.invoke('save-csv', { defaultName, content }),
  setDirty: (v) => ipcRenderer.send('set-dirty', !!v),
});
