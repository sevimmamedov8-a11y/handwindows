const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('handAR', {
  createBrowser: (url) => ipcRenderer.invoke('browser:create', url),
  navigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  click: (point) => ipcRenderer.invoke('browser:click', point),
  move: (point) => ipcRenderer.invoke('browser:move', point),
  scroll: (delta) => ipcRenderer.invoke('browser:scroll', delta),
  bounds: () => ipcRenderer.invoke('browser:bounds'),
  focus: (point) => ipcRenderer.invoke('browser:focus', point)
});
