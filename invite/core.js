'use strict';

/**
 * List of parts that need to be globally passed about
 */
// Websocket
var ws = null;
// State of client
var el = {};
var signUpCode = null;
var electronMode = false;
var markupParser = null;
// Browser storage

var theme = null;
var themelist = [
    {
        "id": 'bubblegum',
        "name": "Bubblegum (default)",
        "description": "A light hearted theme for those with a weak disposition"
    }
];
var soundlist = [];

// Functions to allow to be used in console
var changeTheme;
var changeSoundTheme;
var changeFont;
var send;
var connect;
var showError;

electronMode = /electron/i.test(navigator.userAgent)
console.log("Electron: " + electronMode);