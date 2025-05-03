// preload.js
const { ipcRenderer, contextBridge } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  window.closeWindow = () => {
    ipcRenderer.send("close");
  };

  window.minimizeWindow = () => {
    ipcRenderer.send("minimize");
  };
  window.maximizeWindow = () => {
    ipcRenderer.send("maximize");
  };

  document.body.classList.add("electron-app");

  documenter.on("input", "#run-on-startup", function () {
    ipcRenderer.send("set-Startup", this.checked);
  });
});

contextBridge.exposeInMainWorld("stream", {
  getSources: () => ipcRenderer.invoke("getSources"),
  setSource: (data) =>
    ipcRenderer.invoke("setSource", { id:data.id, isAudioEnabled:data.audio }),
});
