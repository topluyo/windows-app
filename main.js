// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require("node-global-key-listener");
const windowStateKeeper = require('electron-window-state');

function showSourceSelectionWindow(sources, callback) {
  const selectionWindow = new BrowserWindow({
    width: 620,
    height: 400,
    autoHideMenuBar:true,
    icon: path.join(app.getAppPath(), 'topluyo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  selectionWindow.loadFile("./ScreenShare.html");

  let success = false
  ipcMain.once('source-selected', (event, data) => {
    callback(data);
    success=true
    try{ selectionWindow.close(); }catch(e){}
  });

  selectionWindow.on("closed",function(){
    if(success==false){
      callback({id:false})
    }
  })
}

app.setLoginItemSettings({
  openAtLogin: true
});

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600,
  }); //* Load the previous state with fallback to defaults
  function createWindow() {
    const mainWindow = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      title: "Topluyo",
      frame: false,
      closable: true,
      autoHideMenuBar: true,
      icon: path.join(app.getAppPath(), 'topluyo.png'),
      webPreferences: {
        allowRunningInsecureContent: true,
        enableRemoteModule: true,
        contextIsolation: false,
        preload: path.join(app.getAppPath(), 'preload.js'),
      }
    });

    mainWindowState.manage(mainWindow);
  
    
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 300, height: 300 } }).then(sources => {
        showSourceSelectionWindow(sources, data => {
          let id = data.id
          if(id){
            const source = sources.find(source => source.id === id);
            let stream = {video: source}
            if(data.audio) stream.audio = "loopback"
            try{ callback(stream) }catch(e){}
          }else{
            try{ callback(null) }catch(e){ }
          }
        });
      }).catch(e=>{
  
      });
    },{useSystemPicker:false});
    
  
    ipcMain.handle('get-sources', async () => {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: true });
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));
    });
  
    mainWindow.loadURL('https://topluyo.com/');
  
    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });
  
    mainWindow.on('close', function (e) {
      e.preventDefault();
      mainWindow.destroy();
      if (process.platform !== 'darwin') app.quit();
    });
  
    const globalKeyboardListener = new GlobalKeyboardListener();
    let lastDown = {};
    let lastEvent = {};
    globalKeyboardListener.addListener(function (event, down) {
      if (JSON.stringify(lastDown) === JSON.stringify(down) &&
          JSON.stringify(lastEvent.name) === JSON.stringify(event.name) &&
          JSON.stringify(lastEvent.state) === JSON.stringify(event.state)) return;
  
      lastDown = down;
      lastEvent = event;
      let type = event.state === "DOWN" ? "keydown" : "keyup";
      let ctrlKey = (down["LEFT CTRL"] || down["RIGHT CTRL"]) || false;
      let altKey = (down["LEFT ALT"] || down["RIGHT ALT"]) || false;
      let metaKey = (down["LEFT META"] || down["RIGHT META"]) || false;
      let shiftKey = (down["LEFT SHIFT"] || down["RIGHT SHIFT"]) || false;
      let code = "Key" + event.name;
  
      let keyboardEvent = { type, ctrlKey, altKey, metaKey, shiftKey, code };
      mainWindow.webContents.send('keyaction', keyboardEvent);
    });
  
    //!! Bu satırı Silme - Open the DevTools. !!//
    // mainWindow.webContents.openDevTools()
  }
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  app.quit();
});

ipcMain.on("minimize", () => { BrowserWindow.getFocusedWindow().minimize(); });
ipcMain.on("maximize", () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow.isMaximized()) {
    focusedWindow.unmaximize();
  } else {
    focusedWindow.maximize();
  }
});
ipcMain.on("close", () => { BrowserWindow.getFocusedWindow().close(); });
