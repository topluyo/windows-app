// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require("node-global-key-listener");

function showSourceSelectionWindow(sources, callback) {
  const selectionWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const htmlContent = `
    <!DOCTYPE html>
<html>
<head>
    <title>Ekran Kaynağı Seçimi</title>
</head>
<body>
    <h1>Ekran Paylaşımı</h1>
    <div id="source-list"></div>
    <button id="start-sharing">Ekran Paylaşımını Başlat</button>
    <script>
        const { ipcRenderer } = require('electron');

        async function listSources() {
            const sources = await ipcRenderer.invoke('get-sources');
            const sourceList = document.getElementById('source-list');
            sourceList.innerHTML = '';

            sources.forEach((source) => {
                const button = document.createElement('button');
                button.textContent = source.name;
                button.onclick = () => selectSource(source);
                sourceList.appendChild(button);

                if (source.thumbnail) {
                    const img = document.createElement('img');
                    img.src = source.thumbnail;
                    img.style.width = '100px';
                    img.style.margin = '5px';
                    sourceList.appendChild(img);
                }
            });
        }

        let selectedSource;

        function selectSource(source) {
            selectedSource = source;
            console.log('Seçilen kaynak:', source.name);
        }

        document.getElementById('start-sharing').addEventListener('click', () => {
            if (!selectedSource) {
                alert('Lütfen bir kaynak seçin!');
                return;
            }

            ipcRenderer.send('source-selected', selectedSource.id);
        });

        listSources();
    </script>
</body>
</html>

  `;
  selectionWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  // Seçim yapıldığında mesaj yakalama
  ipcMain.once('source-selected', (event, sourceId) => {
    selectionWindow.close(); // Seçim ekranını kapat
    callback(sourceId); // Callback'e seçilen kaynağı döndür
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 720,
    height: 520,
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

 session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
  desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 300, height: 300 } }).then(sources => {
    showSourceSelectionWindow(sources, selectedSourceId => {
      const selectedSource = sources.find(source => source.id === selectedSourceId);
      callback({ video: selectedSource, audio: 'loopback' });
    });
  });
});


  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: true });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  });

  mainWindow.loadURL('https://topluyo.com');

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
}

app.setLoginItemSettings({
  openAtLogin: true
});

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
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
