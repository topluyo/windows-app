// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain, desktopCapturer, session} = require('electron')
const path = require('path')
const {GlobalKeyboardListener} = require("node-global-key-listener");


function createWindow () {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 480,
    //fullscreen: true,
    //width: 1200,
    //height: 800,
    title: "topluyo",
    frame: false,
    closable: true,
    autoHideMenuBar: true,
    icon:  path.join(app.getAppPath(), 'topluyo.png'),
    show:true,
    webPreferences: {
      //nodeIntegration: true, // is default value after Electron v5
      allowRunningInsecureContent : true,
      enableRemoteModule: true, // turn off remote
      contextIsolation: false, // protect against prototype pollution
      preload: path.join(app.getAppPath(), 'preload.js'),
    }
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Grant access to the first screen found.
      callback({ video: sources[0], audio: 'loopback' })
    })
    // If true, use the system picker if available.
    // Note: this is currently experimental. If the system picker
    // is available, it will be used and the media request handler
    // will not be invoked.
  }, { useSystemPicker: true })

  mainWindow.loadURL('https://topluyo.com')

  mainWindow.webContents.setWindowOpenHandler((details) => {
    return { action: 'deny' }
  })

  mainWindow.on('close', function(e) { 
    e.preventDefault();
    mainWindow.destroy();
    if (process.platform !== 'darwin') app.quit()
  });

  

  
  
  const globalKeyboardListener = new GlobalKeyboardListener();

  let lastDown = {}
  let lastEvent = {}
  globalKeyboardListener.addListener(function (event, down) {
    
    if(JSON.stringify(lastDown)==JSON.stringify(down) && 
      JSON.stringify(lastEvent.name)==JSON.stringify(event.name) && 
      JSON.stringify(lastEvent.state)==JSON.stringify(event.state)
    ) return
    
    lastDown = down;
    lastEvent = event
    let type = event.state == "DOWN" ? "keydown" : "keyup";
    let ctrlKey = (down["LEFT CTRL"] || down["RIGHT CTRL"]) || false
    let altKey = (down["LEFT ALT"] || down["RIGHT ALT"]) || false
    let metaKey = (down["LEFT META"] || down["RIGHT META"]) || false
    let shiftKey = (down["LEFT SHIFT"] || down["RIGHT SHIFT"]) || false
    let code =  "Key" + event.name

    let keyboardEvent = {type,ctrlKey,altKey,metaKey,shiftKey,code}
    mainWindow.webContents.send('keyaction', keyboardEvent);
  });

  
  // - Open the DevTools.
  //mainWindow.webContents.openDevTools()
}

app.setLoginItemSettings({
  openAtLogin: true    
})

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})



app.on('window-all-closed', function () {
  app.quit()
  //if (process.platform !== 'darwin') app.quit()
})

ipcMain.on("minimize",()=>{ BrowserWindow.getFocusedWindow().minimize(); })
ipcMain.on("maximize",()=>{
  if( BrowserWindow.getFocusedWindow().isMaximized() ){
    BrowserWindow.getFocusedWindow().unmaximize();
  }else{
    BrowserWindow.getFocusedWindow().maximize();
  }
})
ipcMain.on("close",()=>{ BrowserWindow.getFocusedWindow().close(); })


