// preload.js
const { ipcRenderer } = require("electron");


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

  ipcRenderer.on("keyaction",function(event,arguments){
    AppKeyAction(arguments)
  })

  ipcRenderer.on("get-Startup",function(event,arg){
    document.getElementById("run-on-startup").checked = arg;
  })
  
  documenter.on("input","#run-on-startup",function(){
    ipcRenderer.send("set-Startup", this.checked);
  })

});

