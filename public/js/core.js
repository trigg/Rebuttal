'use strict';
/**
 * List of parts that need to be globally passed about
 */
// Websocket
var ws = null;
// State of client
var roomlist = [];
var userlist = [];
var messagelist = [];
var currentView = '';
var iam = null;
var localWebcamStream = null;
var localLiveStream = null;
var remoteWebcamStream = {};
var remoteLiveStream = {};
var peerConnection = {};
var el = {};
var isWebcam = false;
var isScreenShare = false;
var isMute = false;
var isSettings = false;
var isServer = false;
var lastChatYPos = 0;
var cacheDragAndDropFile = null;
var sharedVideo = null;
var permissions = [];
var groups = [];
var signUpCode = null;
// Browser storage

var theme = null;
var font = null;
var themelist = [];

// Functions to allow to be used in console
var markupParser;
var changeTheme;
var changeFont;
var toggleSettings;
var toggleServer;
var startLocalDevices;
var updateThemesInSettings;
var updateInputsInSettings;
var updateOutputsInSettings;
var getUserByID;
var loadMoreText;
var playToGroup;
var send;

getUserByID = (id) => {
    var ret = null;
    userlist.forEach(user => {
        if (user.id == id) {
            ret = user;
        }
    })
    return ret;
}