const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
  dialog,
} = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const { GlobalKeyboardListener } = require("node-global-key-listener");

const { MediaRequestHandler } = require("./utils");

//* Main Window BrowserWindow
function createMainWindow(mainWindowState) {
  //* create Main Window Settings
  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    title: "Topluyo",
    frame: false,
    closable: true,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "topluyo.png"),
    webPreferences: {
      allowRunningInsecureContent: true,
      enableRemoteModule: true,
      contextIsolation: false,
      preload: path.join(app.getAppPath(), "preload.js"),
    },
  });

  mainWindowState.manage(mainWindow);

  mainWindow.hide();

  session.defaultSession.setDisplayMediaRequestHandler(MediaRequestHandler, {
    useSystemPicker: false,
  });

  ipcMain.handle("get-sources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      fetchWindowIcons: true,
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  });

  mainWindow.on("close", function (e) {
    e.preventDefault();
    mainWindow.destroy();
    if (process.platform !== "darwin") app.quit();
  });

  const globalKeyboardListener = new GlobalKeyboardListener();
  let lastDown = {};
  let lastEvent = {};
  globalKeyboardListener.addListener(function (event, down) {
    if (
      JSON.stringify(lastDown) === JSON.stringify(down) &&
      JSON.stringify(lastEvent.name) === JSON.stringify(event.name) &&
      JSON.stringify(lastEvent.state) === JSON.stringify(event.state)
    )
      return;

    lastDown = down;
    lastEvent = event;
    let type = event.state === "DOWN" ? "keydown" : "keyup";
    let ctrlKey = down["LEFT CTRL"] || down["RIGHT CTRL"] || false;
    let altKey = down["LEFT ALT"] || down["RIGHT ALT"] || false;
    let metaKey = down["LEFT META"] || down["RIGHT META"] || false;
    let shiftKey = down["LEFT SHIFT"] || down["RIGHT SHIFT"] || false;
    let code = "Key" + event.name;

    let keyboardEvent = { type, ctrlKey, altKey, metaKey, shiftKey, code };
    mainWindow.webContents.send("keyaction", keyboardEvent);
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
  return mainWindow;
}
//* Loading Window BrowserWindow
function LoadingWindowCreate() {
  //* create Loading Window Settings
  const loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    icon: path.join(app.getAppPath(), "topluyo.png"),
  });
  loadingWindow.loadFile("loading.html");
  loadingWindow.hide();
  loadingWindow.on("closed", (e) => {
    e.preventDefault();
    loadingWindow.destroy();
    if (process.platform !== "darwin") app.quit();
  });
  return loadingWindow;
}

const retryIntervals = [5000, 10000, 15000, 30000]; // first 4 retry intervals in ms
let currentRetry = 0;
//* Load Main Window
const loadMainWindow = (url, mainWindow, loadingWindow) => {
  mainWindow
    .loadURL("https://topluyo.com" + (url ? "/" + url : ""))
    .then(() => {
      loadingWindow.hide();
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      currentRetry = 0;
    })
    .catch(() => {
      loadingWindow.show();
      mainWindow.hide();

      const retryDelay = retryIntervals[currentRetry] || 30000;
      currentRetry++;

      setTimeout(() => {
        loadMainWindow(url, mainWindow, loadingWindow);
      }, retryDelay);
    });
};

//* Update Window BrowserWindow
function createUpdateWindow() {
  const updateWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    // transparent: true,
    resizable: false,
    icon: path.join(app.getAppPath(), "topluyo.png"),
    webPreferences: {
      contextIsolation: false,
    },
  });
  updateWindow.loadFile("update.html");
  return updateWindow;
}

//* Check for Updates and Load Main Window with URL
function checkForUpdates(url, mainWindow, loadingWindow, mainWindowState) {
  const updateWindow = createUpdateWindow();
  if (process.env.NODE_ENV === "development") {
    updateWindow.close();
    if (!mainWindow || !loadingWindow) {
      const mainWindow = createMainWindow(mainWindowState);
      const loadingWindow = LoadingWindowCreate();
      loadMainWindow(url, mainWindow, loadingWindow);
    } else {
      loadMainWindow(url, mainWindow, loadingWindow);
    }
    return;
  }
  autoUpdater.autoDownload = true; // Sessiz indir
  autoUpdater.autoInstallOnAppQuit = false; // Uygulama kapanmadan yükleme

  autoUpdater.on("checking-for-update", () => {
    console.log("Güncellemeler kontrol ediliyor...");
  });

  autoUpdater.on("update-available", () => {
    console.log("Güncelleme bulundu. İndiriliyor...");
  });

  autoUpdater.on("error", (error) => {
    console.error("Güncelleme hatası:", error);

    dialog.showMessageBox({
      type: "error",
      title: "Güncelleme Hatası",
      message: "Güncelleme sırasında bir hata oluştu." + error,
    });

    updateWindow.close();
    if (!mainWindow || !loadingWindow) {
      const mainWindow = createMainWindow(mainWindowState);
      const loadingWindow = LoadingWindowCreate();
      loadMainWindow(url, mainWindow, loadingWindow);
    } else {
      loadMainWindow(url, mainWindow, loadingWindow);
    }
  });

  autoUpdater.on("update-not-available", () => {
    console.log("Güncelleme bulunamadı.");
    updateWindow.close();
    if (!mainWindow || !loadingWindow) {
      const mainWindow = createMainWindow(mainWindowState);
      const loadingWindow = LoadingWindowCreate();
      loadMainWindow(url, mainWindow, loadingWindow);
    } else {
      loadMainWindow(url, mainWindow, loadingWindow);
    }
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("🎉 Güncelleme indirildi. Uygulama yeniden başlatılıyor...");

    updateWindow.close();
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

module.exports = {
  createMainWindow,
  LoadingWindowCreate,
  loadMainWindow,
  createUpdateWindow,
  checkForUpdates,
};
