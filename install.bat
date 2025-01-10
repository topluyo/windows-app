winget install OpenJS.NodeJS
del /s /q node_modules
del /s /q dist
npm install --save-dev electron electron-builder && npm install node-global-key-listener  && npm install && npx electron-builder --win --x64