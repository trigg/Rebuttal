const { app, BrowserWindow, ipcMain } = require('electron');
const path = require("path")
var url = app.commandLine.getSwitchValue('url');
if (!url) {
    console.log("Needs a Server URL currently");
    process.exit(1);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 400,

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })
    win.loadFile('public/index.html');
    win.once('ready-to-show', () => {
        win.webContents.executeJavaScript("customUrl = '" + url + "';console.log('" + url + "'); connect();");
        win.show();
    });
    //win.setMenu(null);
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
