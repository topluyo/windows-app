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
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ekran Kaynağı Seçimi</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: #f0f2f5;
            color: #333;
        }

        h1 {
            margin: 20px 0;
            color: #0056b3;
        }

        #source-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            margin: 20px 0;
        }

        .source-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #fff;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
        }

        .source-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .source-item img {
            max-width: 100px;
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .source-item button {
            padding: 5px 10px;
            border: none;
            border-radius: 4px;
            background-color: #0056b3;
            color: #fff;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .source-item button:hover {
            background-color: #003d82;
        }

        #start-sharing {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            background-color: #28a745;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        #start-sharing:hover {
            background-color: #218838;
        }
    </style>
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
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';

                if (source.thumbnail) {
                    const img = document.createElement('img');
                    img.src = source.thumbnail;
                    sourceItem.appendChild(img);
                }

                const sourceName = document.createElement('div');
                sourceName.textContent = source.name;
                sourceItem.appendChild(sourceName);

                const selectButton = document.createElement('button');
                selectButton.textContent = 'Seç';
                selectButton.onclick = () => selectSource(source);
                sourceItem.appendChild(selectButton);

                sourceList.appendChild(sourceItem);
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
