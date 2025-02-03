const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const windowStateKeeper = require("electron-window-state");
const {
  createMainWindow,
  LoadingWindowCreate,
  checkForUpdates,
  loadMainWindow,
} = require("./Windows");

let mainWindow, loadingWindow;

//* App Settings
app.setLoginItemSettings({
  openAtLogin: true,
});
//* App Protocol Handler
if (!app.isDefaultProtocolClient("topluyo")) {
  app.setAsDefaultProtocolClient("topluyo");
}
//* App Single Instance Handler
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    // Windows için URL'yi al
    const url = commandLine.find((arg) => arg.startsWith("topluyo://"));
    if (url && mainWindow) {
      loadMainWindow(url.replace("topluyo://", ""), mainWindow, loadingWindow);
    }
  });

  app.whenReady().then(() => {
    //* Load the previous state with fallback to defaults
    const mainWindowState = windowStateKeeper({
      defaultWidth: 800,
      defaultHeight: 600,
    });

    mainWindow = createMainWindow(mainWindowState);
    loadingWindow = LoadingWindowCreate();

    //* Check for updates and start app with url if there is any
    const url = process.argv.find((arg) => arg.startsWith("topluyo://"));
    const cleanUrl = url ? url.replace("topluyo://", "") : null;
    checkForUpdates(cleanUrl, mainWindow, loadingWindow, mainWindowState);
    //* url handler
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeUrl(url)) {
        loadMainWindow(
          url.replace("https://topluyo.com/", ""),
          mainWindow,
          loadingWindow
        );
        return { action: "deny" };
      } else if (url.startsWith("topluyo://")) {
        loadMainWindow(
          url.replace("topluyo://", ""),
          mainWindow,
          loadingWindow
        );
        return { action: "deny" };
      } else if (url.startsWith("javascript:")) {
        return { action: "deny" };
      } else {
        dialog
          .showMessageBox({
            type: "warning",
            buttons: ["Evet", "Hayır"],
            defaultId: 1,
            title: "Dış Bağlantı Açılıyor",
            message: "Bu bağlantıyı açmak istiyor musunuz?\n" + url,
          })
          .then((response) => {
            if (response.response === 0) {
              shell.openExternal(url);
            }
          });
        return { action: "deny" };
      }
    });
  });

  //* start app for macOS
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const mainWindowState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 600,
      });
      checkForUpdates(null, mainWindow, loadingWindow, mainWindowState);
    }
  });
}

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
