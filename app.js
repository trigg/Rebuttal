const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require("path")
var url = app.commandLine.getSwitchValue('url');

var disableOverlay = false;
// Check for capabilities RE: Overlay
if (process.env.XDG_SESSION_TYPE) {
    console.log("Running in " + process.env.XDG_SESSION_TYPE);
    switch (process.env.XDG_SESSION_TYPE) {
        case 'wayland':
            disableOverlay = true;
            // Currently not working
            break;
        case 'x11':
            disableOverlay = !app.commandLine.hasSwitch('enable-transparent-visuals');
            break;
    }
}



var overlay;
var win;

function createOverlay() {
    var prim = screen.getPrimaryDisplay();
    overlay = new BrowserWindow({
        width: prim.bounds.width,
        height: prim.bounds.height,
        frame: false,
        transparent: true,
        focusable: false,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'overlay', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });
    overlay.loadFile('client/overlay.html');
    overlay.setAlwaysOnTop(true, 'screen');
    overlay.setIgnoreMouseEvents(true);


    overlay.setPosition(prim.bounds.x, prim.bounds.y);
    //overlay.setSize();
}

function createServerBrowser() {
    win = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname, 'client', 'preload-browser.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    })
    win.loadFile('client/browser.html');

    win.once('ready-to-show', () => {
        win.show();
        win.setAutoHideMenuBar(true);
    });
}

function prepareOverlay() {
    if (!disableOverlay) {
        ipcMain.on('overlayready', function (e, a) {
            console.log("Overlay ready");
        });
        ipcMain.on('clientready', function (e, a) {
            console.log("Client ready");
        });
        ipcMain.on('enableoverlay', function (e, a) {
            if (!overlay) {
                createOverlay();
            }
        });
        ipcMain.on('disableoverlay', function (e, a) {
            if (overlay) {
                overlay.close();
                overlay = null;
            }
        });
        ipcMain.on('userlist', function (e, a) {
            if (overlay) {
                overlay.webContents.send('userlist', a);
            }
        })

        ipcMain.on('talkstart', function (e, a) {
            if (overlay) {
                overlay.webContents.send('talkstart', a);
            }
        })

        ipcMain.on('talkstop', function (e, a) {
            if (overlay) {
                overlay.webContents.send('talkstop', a);
            }
        })
    } else {
        console.log("Overlay is not yet supported on this platform");
    }
}

function createWindow() {
    win = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    })
    win.loadFile('public/index.html');

    win.once('ready-to-show', () => {
        win.webContents.executeJavaScript("customUrl = '" + url + "';console.log('" + url + "'); connect();");
        win.show();
        win.setAutoHideMenuBar(true);
    });
}

app.whenReady().then(() => {
    if (!url) {
        createServerBrowser();
    } else {
        createWindow();
    }
    prepareOverlay();
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
