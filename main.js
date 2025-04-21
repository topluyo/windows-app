const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const windowStateKeeper = require("electron-window-state");
const {
  createMainWindow,
  LoadingWindowCreate,
  checkForUpdates,
  loadMainWindow,
} = require("./Windows");
const { isSafeUrl, openExternalLinks } = require("./utils");
const { URL } = require("url");

let mainWindow, loadingWindow;

//* App Protocol Handler
if (process.platform === "win32") {
  if (!app.isDefaultProtocolClient("topluyo")) {
    app.setAsDefaultProtocolClient("topluyo");
  }
} else if (process.platform === "linux") {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const desktopFile = `${process.env.HOME}/.local/share/applications/topluyo.desktop`;

  try {
    // Protokolün kayıtlı olup olmadığını kontrol et
    const currentHandler = execSync(
      "xdg-mime query default x-scheme-handler/topluyo",
      { encoding: "utf-8" }
    ).trim();

    if (currentHandler !== "topluyo.desktop") {
      // Desktop entry dosyasını oluştur
      const desktopEntry = `[Desktop Entry]
Name=Topluyo
Exec=${process.execPath} %u
Type=Application
Terminal=false
MimeType=x-scheme-handler/topluyo;
`;

      fs.writeFileSync(desktopFile, desktopEntry);

      // MIME türünü güncelle
      execSync(`update-desktop-database ~/.local/share/applications`);
      execSync(`xdg-mime default topluyo.desktop x-scheme-handler/topluyo`);

      console.log("Linux'ta protokol başarıyla kaydedildi.");
    } else {
      console.log("Protokol zaten kayıtlı.");
    }
  } catch (error) {
    console.error("Protokol kontrol edilirken hata oluştu:", error);
  }
}

//* App Single Instance Handler
if (!app.requestSingleInstanceLock()) {
  if (process.platform === "win32") {
    app.quit();
  }
  app.exit();
} else {
  app.on("second-instance", (event, commandLine) => {
    // Windows ve Linux için URL'yi al
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

    let cleanUrl = null;
    //* Check for updates and start app with url if there is any
    if (process.platform === "win32") {
      const url = process.argv.find((arg) => arg.startsWith("topluyo://"));
      cleanUrl = url ? url.replace("topluyo://", "") : null;
    }
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
        const parsedUrl = new URL(url)
        if (parsedUrl.search && parsedUrl.search.includes("!login")) {
          shell.openExternal(url);
        }else{
          dialog
          .showMessageBox({
            type: "warning",
            buttons: ["Evet", "Hayır"],
            defaultId: 1,
            title: "Dış Bağlantı Açılıyor",
            message: "Bu bağlantıyı açmak istiyor musunuz?\n" + url,
          })
          .then((response) => {
            if (response.response !== 1) {
              shell.openExternal(url);
            }
          });
        }
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
  if (process.platform === "win32") {
    app.quit();
  } else {
    app.exit();
  }
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
