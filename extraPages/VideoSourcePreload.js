const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("streamScreen", {
  getSources: () => ipcRenderer.invoke("getSources"),
  setSource: (sourceType, sourceId,isAudioEnabled) =>
    ipcRenderer.invoke("setSource", { sourceType, sourceId, isAudioEnabled }),
});
