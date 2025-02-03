const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  dialog,
} = require("electron");
const path = require("path");
//* Media Handler BrowserWindow
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

//* Media Handler Function
function MediaRequestHandler(request, callback) {
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
                "Ekran paylaşımı sırasında bir hata oluştu. \n Detaylar: " + e,
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
                "Ekran paylaşımı sırasında bir hata oluştu. \n Detaylar: " + e,
            });
          }
        }
      });
    })
    .catch((e) => {
      dialog.showMessageBox({
        type: "error",
        title: "Hata",
        message: "Ekran paylaşımı sırasında bir hata oluştu. \n Detaylar: " + e,
      });
    });
}

//* URL Safety Function
function isSafeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.origin === "https://topluyo.com" &&
        parsedUrl.protocol === "https:"
      ); // Tam eşleşme kontrolü
    } catch (e) {
      return false;
    }
  }
module.exports = { MediaRequestHandler, isSafeUrl };