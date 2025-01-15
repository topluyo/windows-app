// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
  shell,
} = require("electron");
const path = require("path");
const { GlobalKeyboardListener } = require("node-global-key-listener");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 520,
    //fullscreen: true,
    //width: 1200,
    //height: 800,
    title: "Topluyo",
    frame: false,
    closable: true,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "topluyo.png"),
    show: true,
    webPreferences: {
      //nodeIntegration: true, // is default value after Electron v5
      allowRunningInsecureContent: true,
      enableRemoteModule: true, // turn off remote
      contextIsolation: false,
      preload: path.join(app.getAppPath(), "preload.js"),
    },
  });

  async function StreamFunc(request, callback) {
    const windows = await desktopCapturer.getSources({ types: ["window"] });
    const screens = await desktopCapturer.getSources({ types: ["screen"] });
    const allSources = { windows, screens };
    let callbackCalled = false;

    // Create a new BrowserWindow for the screen sharing selection
    const streamScreen = new BrowserWindow({
      width: 800,
      height: 600,
      frame: false,
      webPreferences: {
        contextIsolation: true,
        allowRunningInsecureContent: true,
        enableRemoteModule: true,
        preload: path.join(
          app.getAppPath(),
          "extraPages/VideoSourcePreload.js"
        ),
      },
    });

    streamScreen.loadURL(app.getAppPath() + "/extraPages/VideoSourcePage.html");

    ipcMain.handle("getSources", async (event, arg) => {
      return allSources;
    });

    ipcMain.handle("setSource", (event, arg) => {
      if (callbackCalled) return;
      callbackCalled = true;
      const selectedSource = allSources[arg.sourceType].find(
        (source) => source.id === arg.sourceId
      );
      ipcMain.removeHandler("getSources");
      ipcMain.removeHandler("setSource");

      callback({
        video: selectedSource,
        audio: arg.isAudioEnabled ? "loopback" : "loopbackWithMute",
      });

      streamScreen.close();
    });

    streamScreen.on("close", () => {
      if (callbackCalled) return;
      callbackCalled = true;
      ipcMain.removeHandler("getSources");
      ipcMain.removeHandler("setSource");

      callback(null);
    });
  }

  // ekran paylaşımı
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      // Remove existing handlers to avoid duplicate registration
      ipcMain.removeHandler("getSources");
      ipcMain.removeAllListeners("setSource");

      //TODO* The function works correctly, and each time it starts the newly selected screen properly inside the callback function. The sound setting also works as expected ("when you mute it, it mutes the computer's sound"). Once the stream is provided, it cannot be stopped or a new stream cannot be initiated due to an issue with the Topluyo site, as I didn't receive any errors. This needs to be fixed.
      await StreamFunc(request, callback);
    }
  );

  //TODO* should be create a function for webcam sharing like the screen sharing function above.

  mainWindow.loadURL("https://topluyo.com");

  // harici linke gitme olayı
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // tam çıkış
  mainWindow.on("close", function (e) {
    e.preventDefault();
    mainWindow.destroy();
    if (process.platform !== "darwin") app.quit();
  });

  // klavye kısayolları
  const globalKeyboardListener = new GlobalKeyboardListener();
  let lastDown = {};
  let lastEvent = {};
  globalKeyboardListener.addListener(function (event, down) {
    if (
      JSON.stringify(lastDown) == JSON.stringify(down) &&
      JSON.stringify(lastEvent.name) == JSON.stringify(event.name) &&
      JSON.stringify(lastEvent.state) == JSON.stringify(event.state)
    )
      return;

    lastDown = down;
    lastEvent = event;
    let type = event.state == "DOWN" ? "keydown" : "keyup";
    let ctrlKey = down["LEFT CTRL"] || down["RIGHT CTRL"] || false;
    let altKey = down["LEFT ALT"] || down["RIGHT ALT"] || false;
    let metaKey = down["LEFT META"] || down["RIGHT META"] || false;
    let shiftKey = down["LEFT SHIFT"] || down["RIGHT SHIFT"] || false;
    let code = "Key" + event.name;

    let keyboardEvent = { type, ctrlKey, altKey, metaKey, shiftKey, code };
    mainWindow.webContents.send("keyaction", keyboardEvent);
  });

  // - Open the DevTools.
  mainWindow.webContents.openDevTools();
}

app.setLoginItemSettings({
  openAtLogin: true,
});

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  app.quit();
  //if (process.platform !== 'darwin') app.quit()
});

ipcMain.on("minimize", () => {
  BrowserWindow.getFocusedWindow().minimize();
});
ipcMain.on("maximize", () => {
  if (BrowserWindow.getFocusedWindow().isMaximized()) {
    BrowserWindow.getFocusedWindow().unmaximize();
  } else {
    BrowserWindow.getFocusedWindow().maximize();
  }
});
ipcMain.on("close", () => {
  BrowserWindow.getFocusedWindow().close();
});
