const { ipcMain, desktopCapturer, BrowserWindow, dialog, app, shell } = require("electron");
const path = require("path");

const getAllSources = async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
    });
    return sources.map((source) => ({
      name: source.name,
      id: source.id,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (e) {
    throw e;
  }
};

async function createStreamWindow  (_, callback) {
  console.log(callback);
  let callbackcalled = false;
  const win = new BrowserWindow({
    width: 620,
    height: 400,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "topluyo.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("ScreenShare.html");

  const allSources = await getAllSources();

  ipcMain.handle("setSource", async (_, data) => {
    if (callbackcalled) return;
    const selectedSource = allSources.find((s) => s.id === data.id);
    try {
      if (!selectedSource) {
        throw new Error("Source not found");
      }
      callbackcalled = true;
      let stream = { video: selectedSource };
      if (data.isAudioEnabled) {
        stream.audio = "loopback";
      }
      callback(stream);
      ipcMain.removeHandler("getSources");
      ipcMain.removeHandler("setSource");
      win.close();
    } catch (e) {
      throw e;
    }
  });

  win.on("close", () => {
    if (callbackcalled) return;
    callbackcalled = true;
    try {
      ipcMain.removeHandler("getSources");
      ipcMain.removeHandler("setSource");

      callback(null);
    } catch (e) {
      throw e;
    }
  });
};

const mediaHandler = async (req, callback) => {
  try {
    ipcMain.removeHandler("setSource");
    ipcMain.removeHandler("getSources");

    const allSources = await getAllSources();
    ipcMain.handle("getSources", async () => {
      return allSources;
    });

    await createStreamWindow(req, callback);
  } catch (e) {
    dialog.showErrorBox("Error", "hata:" + e.message);
  }
};

//* URL Safety Function
function isSafeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.origin === "https://topluyo.com" &&
      parsedUrl.protocol === "https:"
    );
  } catch (e) {
    return false;
  }
}

const openExternalLinks = (url)=>{
  if (process.platform === "linux") {
    require("child_process").exec(`xdg-open "${url}"`);
  } else {
    shell.openExternal(url);
  }
}
module.exports = { isSafeUrl, mediaHandler, openExternalLinks };
