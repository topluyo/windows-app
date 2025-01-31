// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
  shell,
  dialog,
} = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const { GlobalKeyboardListener } = require("node-global-key-listener");
const windowStateKeeper = require("electron-window-state");

let mainWindow, loadingWindow, updateWindow;

function showSourceSelectionWindow(sources, callback) {
  const selectionWindow = new BrowserWindow({
    width: 620,
    height: 400,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "topluyo.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  selectionWindow.loadFile("./ScreenShare.html");

  let success = false;
  ipcMain.once("source-selected", (event, data) => {
    callback(data);
    success = true;
    try {
      selectionWindow.close();
    } catch (e) {
      dialog.showMessageBox({
        type: "error",
        title: "Hata",
        message:
          "Ekran paylaşımı seçilirken bir hata oluştu. \n Detaylar: " + e,
      });
    }
  });

  selectionWindow.on("closed", function () {
    if (success == false) {
      callback({ id: false });
    }
  });
}

app.setLoginItemSettings({
  openAtLogin: true,
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
    //* create Main Window Settings
    mainWindow = new BrowserWindow({
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

    session.defaultSession.setDisplayMediaRequestHandler(
      (request, callback) => {
        desktopCapturer
          .getSources({
            types: ["screen", "window"],
            thumbnailSize: { width: 300, height: 300 },
          })
          .then((sources) => {
            showSourceSelectionWindow(sources, (data) => {
              let id = data.id;
              if (id) {
                const source = sources.find((source) => source.id === id);
                let stream = { video: source };
                if (data.audio) stream.audio = "loopback";
                try {
                  callback(stream);
                } catch (e) {
                  dialog.showMessageBox({
                    type: "error",
                    title: "Hata",
                    message:
                      "Ekran paylaşımı sırasında bir hata oluştu. \n Detaylar: " +
                      e,
                  });
                }
              } else {
                try {
                  callback(null);
                } catch (e) {
                  dialog.showMessageBox({
                    type: "error",
                    title: "Hata",
                    message:
                      "Ekran paylaşımı sırasında bir hata oluştu. \n Detaylar: " +
                      e,
                  });
                }
              }
            });
          })
          .catch((e) => {
            dialog.showMessageBox({
              type: "error",
              title: "Hata",
              message:
                "Ekran paylaşımı sırasında bir hata oluştu. \n Detaylar: " + e,
            });
          });
      },
      { useSystemPicker: false }
    );

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

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
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
  }

  function LoadingWindowCreate() {
    //* create Loading Window Settings
    loadingWindow = new BrowserWindow({
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
      mainWindow.destroy();
      if (process.platform !== "darwin") app.quit();
    });
  }

  //* call windows settings
  LoadingWindowCreate();
  createWindow();

  function createUpdateWindow() {
    updateWindow = new BrowserWindow({
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
  }

  const retryIntervals = [5000, 10000, 15000, 30000]; // first 4 retry intervals in ms
  let currentRetry = 0;

  const loadMainWindow = () => {
    mainWindow
      .loadURL("https://topluyo.com")
      .then(() => {
        loadingWindow.hide();
        mainWindow.show();
        currentRetry = 0;
      })
      .catch(() => {
        loadingWindow.show();
        mainWindow.hide();

        const retryDelay = retryIntervals[currentRetry] || 30000;
        currentRetry++;

        setTimeout(() => {
          loadMainWindow();
        }, retryDelay);
      });
  };

  function checkForUpdates() {
    createUpdateWindow();
    if (process.env.NODE_ENV === "development") {
      updateWindow.close();
      loadMainWindow();
    }

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
      loadMainWindow();
    });

    autoUpdater.on("update-not-available", () => {
      console.log("Güncelleme bulunamadı.");
      updateWindow.close();
      loadMainWindow();
    });

    autoUpdater.on("update-downloaded", () => {
      console.log("Güncelleme indirildi. Yeniden başlatılıyor...");
      autoUpdater.quitAndInstall();
    });

    autoUpdater.checkForUpdatesAndNotify();
  }

  checkForUpdates();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  app.quit();
});

ipcMain.on("minimize", () => {
  BrowserWindow.getFocusedWindow().minimize();
});
ipcMain.on("maximize", () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow.isMaximized()) {
    focusedWindow.unmaximize();
  } else {
    focusedWindow.maximize();
  }
});
ipcMain.on("close", () => {
  BrowserWindow.getFocusedWindow().close();
});
