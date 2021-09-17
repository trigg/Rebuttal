'use strict';

const express = require('express');
const WebSocket = require("ws");
const https = require('https');
const { v4: uuidv4 } = require("uuid");
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const { Readable } = require('stream');
const sizeOfImage = require('buffer-image-size');
const gravatar = require('gravatar');
const event = require('./events');

const app = express();
const plugins = [];

var thisServer = {
    app: null,
    event: null,
    storage: null,
    contextmenu: { user: [], room: [], textroom: [], voiceroom: [], message: [] },
    clientcontextmenu: { user: [], room: [], textroom: [], voiceroom: [], message: [] },
    connections: [],

    init: function () {
        wss.on("connection", ws => { thisServer.startConnection(ws) });

        // TODO Populate client context menu

        // TODO FINAL events for most events. 

        // Get FINAL event callbacks
        this.event.listen('connectionnew', this.event.priority.FINAL, function (event) {
            if (!event.cancelled) {
                event.ref.send(JSON.stringify(event.welcomeObj));
            } else {
                // TODO Decide what cancelling a new connection does
            }
        });

    },

    sendToID: function (id, message) {
        Object.values(this.connections).forEach(client => {
            if (client.id === id) {
                this.sendTo(client, message);
            }
        })
    },
    sendTo: function (connection, message) {
        connection.send(JSON.stringify(message));
    },

    sendToAll: function (clients, message, ownsocket) {
        Object.values(clients).forEach(client => {
            if (client !== ownsocket) {
                this.sendTo(client, message);
            }
        })
    },

    sendToRoom: function (roomid, message) {
        Object.values(this.connections).forEach(client => {
            if (client.currentRoom === roomid) {
                this.sendTo(client, message);
            }
        })
    },

    sendUpdateUsers: function () {
        this.sendToAll(this.connections, {
            type: 'updateUsers',
            userList: this.updateUsers()
        });
    },

    sendUpdatesMessages: function (roomid) {
        var segnum = this.storage.getTextRoomNewestSegment(roomid);
        this.sendToAll(this.connections, { type: 'updateText', roomid: roomid, segment: segnum, messages: this.storage.getTextForRoom(roomid, segnum) });
    },

    sendUpdateRooms: function () {
        this.sendToAll(this.connections, {
            type: 'updateRooms',
            roomList: this.updateRooms()
        });
    },

    getUsersInRoom: function (roomid) {
        let users = [];
        Object.values(this.connections).forEach(connection => {
            if (connection.currentRoom === roomid) {
                users.push({ id: connection.id, name: connection.name, livestate: connection.livestate, livelabel: connection.livelabel });
            }
        });
        return users;
    },

    isUserConnected: function (userid) {
        let conn = false;
        Object.values(this.connections).forEach(connection => {
            if (connection.id === userid) {
                conn = true;
            }
        })
        return conn;
    },

    isUserSuppressed: function (userid) {
        let conn = false;
        Object.values(this.connections).forEach(connection => {
            if (connection.id === userid && connection.suppress) {
                conn = connection.suppress;
            }
        })
        return conn;
    },

    setUserSuppressed: function (userid, suppress) {
        Object.values(this.connections).forEach(connection => {
            if (connection.id === userid) {
                connection.suppress = suppress;
            }
        })
    },

    isUserTalking: function (userid) {
        let conn = false;
        Object.values(this.connections).forEach(connection => {
            if (connection.id === userid && connection.talking) {
                conn = connection.talking;
            }
        })
        return conn;
    },

    setUserTalking: function (userid, talking) {
        Object.values(this.connections).forEach(connection => {
            if (connection.id === userid) {
                connection.talking = talking;
            }
        })
    },


    updateUsers: function () {
        // Create a client-usable copy of users
        // Add transient data, hide private
        let users = [];
        this.storage.getAllAccounts().forEach(account => {
            if (!('hidden' in account)) {
                account.hidden = false;
            }
            if (!('avatar' in account)) {
                account.avatar = gravatar.url(account.email, { protocol: 'https', d: config.gravatarfallback }, true);
            }
            if (!('livestate' in account)) {
                account.livestate = false;
            }
            if (!('livelabel' in account)) {
                account.livelabel = '';
            }
            users.push(
                {
                    id: account.id,
                    name: account.name,
                    status: this.isUserConnected(account.id),
                    avatar: account.avatar,
                    hidden: account.hidden,
                    suppress: this.isUserSuppressed(account.id),
                    talking: this.isUserTalking(account.id),
                    livestate: account.livestate,
                    livelabel: account.livelabel
                }
            );

        });
        return users;
    },

    setRoom: function (socket, roomid) {
        // TODO sendToAll appears to not do what I'd want
        let room = this.storage.getRoomByID(roomid);
        // Can only 'join' media rooms
        if (room && room.type !== 'voice') {
            return;
        }
        // Do action on same room
        if (roomid == socket.currentRoom) {
            return;
        }
        if (socket.currentRoom) {
            this.sendToAll(this.connections, { type: "leaveRoom", userid: socket.id, roomid: socket.currentRoom }, null);
        }
        socket.currentRoom = roomid;
        if (roomid) {
            this.sendToAll(this.connections, { type: "joinRoom", userid: socket.id, roomid: socket.currentRoom }, null);
        }
        this.sendUpdateRooms();
    },

    updateRooms: function () {
        // Create a client-usable copy of rooms
        // Add transient data
        let array = [];
        this.storage.getAllRooms().forEach(room => {
            array.push(
                {
                    id: room.id,
                    name: room.name,
                    type: room.type,
                    userlist: this.getUsersInRoom(room.id),
                });
        });

        return array;
    },

    getGroups: function () {
        var list = {};
        this.storage.getGroups().forEach(group => {
            list[group] = this.storage.getGroupPermissionList(group);
        })
        return list;
    },

    startConnection: function (ws) {
        ws.on("close", () => {
            this.event('connectionclose', { ref: ws });
            // Can't cancel a disconnection
            if (ws.id) {
                this.sendToAll(this.connections, { type: "disconnect", userid: ws.id });
                delete this.connections[ws.id];

                this.sendUpdateRooms();
                this.sendUpdateUsers();
            } else {
            }
        });
        ws.on("message", msg => {
            let data;
            try {
                data = JSON.parse(msg);
            } catch (e) {
                console.log("Invalid JSON");
                data = {}
            }
            const {
                type,
                userName,
                email,
                password,
                roomid,
                touserid,
                fromuserid,
                payload,
                livestate,
                livelabel,
                filename,
                rawfile,
                segment,
                message,
                url,
                withvengeance,
                roomName,
                roomType,
                groupName,
                permissionName,
                messageid,
                userid,
                signUp,
                audio,
                video,
            } = data;
            switch (type) {
                case 'invite':
                    var uuid = uuidv4();

                    this.storage.generateSignUp(groupName, uuid);
                    this.sendTo(ws, {
                        type: 'invite',
                        url: config.url + 'invite/' + uuid
                    });
                    break
                case "signup":
                    // Put effort into matching the same checks from client side
                    if (password &&
                        email &&
                        userName &&
                        signUp &&
                        email.indexOf("@") > -1 &&
                        email.indexOf('.') &&
                        userName.match(/^[a-zA-Z0-9-_ ]+$/) &&
                        userName.length >= 3 &&
                        password.length >= 7) {

                        console.log("Checking invite");
                        var group = null;
                        if ('infinitesignup' in config && signUp === 'signup') {
                            group = config.infinitesignup;
                        } else {

                            group = this.storage.expendSignUp(signUp);
                        }
                        if (group) {
                            var allow = this.event.trigger('usercreate', { userName, userUuid })
                            // In this case we don't use FINAL event as it won't have email/password
                            // If we put email/password in the event it'll be plaintext for every plugin
                            // I simply don't feel that is right
                            if (allow) {
                                console.log("Created user");
                                var userUuid = uuidv4();
                                this.storage.createAccount({
                                    id: userUuid,
                                    name: userName,
                                    password,
                                    email,
                                    group
                                });

                                this.sendTo(ws, { type: 'refreshNow' });
                            } else {
                                console.log("Invite denied by plugin");
                                this.sendTo(ws, { type: 'error', message: 'Signup permission denied by plugin' });
                            }
                        } else {
                            console.log("Invite invalid");
                            this.sendTo(ws, { type: 'error', message: 'Signup code expired or invalid' });
                        }
                    } else {
                        console.log("Not enough details to create account");
                        this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }

                    break;
                case "login":

                    let user = this.storage.getAccountByLogin(email, password);
                    if (user) {
                        // Log user out from other sources. Maybe later allow multiple login for one user
                        // But it is not this day
                        this.connections.forEach(conn => {
                            if (conn.id && conn.id === user.id) {
                                conn.close();
                            }
                        })
                        var allow = this.event.trigger('userauth', { userUuid: user.id, userName: user.name });
                        // As before, avoiding FINAL event as we can't allow plain-text passwords to be seen by plugin
                        if (allow) {

                            this.connections[user.id] = ws;
                            ws.name = user.name;
                            ws.id = user.id;
                            ws.suppress = false;
                            this.sendTo(ws, {
                                type: "login",
                                userid: user.id,
                                success: true
                            });
                            this.sendTo(ws, {
                                type: 'updateUsers',
                                userList: this.updateUsers()
                            });
                            this.sendTo(ws, {
                                type: 'updateRooms',
                                roomList: this.updateRooms()
                            });
                            var perms = this.storage.getGroupPermissionList(user.group);
                            this.sendTo(ws, {
                                type: 'updatePerms',
                                perms: perms
                            });
                            this.sendTo(ws, {
                                type: 'updateGroups',
                                groups: this.getGroups()
                            })

                            // Alert everyone else
                            this.sendUpdateRooms();
                            this.sendUpdateUsers();
                        } else {
                            console.log("User login denied by plugin");
                            this.sendTo(ws, { type: 'error', message: 'Permission denied' });
                        }
                    } else {
                        this.sendTo(ws, {
                            type: "login",
                            success: false
                        })
                    }
                    break;
                case "getmessages":
                    var getsegment;
                    if (segment === undefined || segment === null) {
                        getsegment = this.storage.getTextRoomNewestSegment(roomid);
                    } else {
                        getsegment = segment;
                    }
                    var returnsegment = this.storage.getTextForRoom(roomid, getsegment);
                    var ret = { type: 'updateText', roomid: roomid, segment: getsegment, messages: returnsegment };
                    this.sendToID(ws.id, ret);
                    break;
                case "message":
                    var outputfilename = null;
                    // Send a notice that this single message has arrived.
                    var allow1 = this.event.trigger('messagecreate', { roomUuid: roomid, message: message });
                    var allow2 = this.event.trigger('messagesend', { userUuid: ws.id, userName: ws.name, roomUuid: roomid, message: message });
                    if (allow1 && allow2) {
                        if (filename && rawfile) {
                            // TODO File upload in message event?
                            fs.mkdirSync(path.join(uploadDir, ws.id), { recursive: true });
                            const reg = /[^a-z0-9-_]/gi;
                            outputfilename = filename;
                            outputfilename = outputfilename.replace(reg, '');
                            var uuid = uuidv4();
                            var outputuri = path.join(uploadUri, ws.id, outputfilename + uuid);
                            outputfilename = path.join(uploadDir, ws.id, outputfilename + uuid);

                            const buffer = Buffer.from(rawfile, 'base64');
                            try {
                                var dim = sizeOfImage(buffer);
                                console.log(dim.width, dim.height);
                                var s = new Readable();
                                s.push(buffer);
                                s.push(null);
                                s.pipe(fs.createWriteStream(outputfilename));
                                message.img = outputuri;
                                message.height = dim.height;
                                message.width = dim.width;
                            } catch (e) {
                                console.log("Could not accept uploaded file");
                                console.log(e);
                            }
                        }
                        message.userid = ws.id;
                        this.storage.addNewMessage(roomid, message);
                        this.sendUpdatesMessages(roomid);
                        this.sendToAll(this.connections, { type: 'sendMessage', roomid: roomid, message: message })
                    } else {
                        console.log("Messag")
                    }
                    break;
                case "joinroom":
                    // TODO Validate room exists
                    this.event.trigger('userjoinroom', { userUuid: ws.id, userName: ws.name, roomUuid: roomid });
                    this.setRoom(ws, roomid);
                    this.sendUpdateRooms();
                    break;
                case "leaveroom":
                    this.event.trigger('userleaveroom', { userUuid: ws.id, userName: ws.name, roomUuid: roomid });
                    this.setRoom(ws, null);
                    this.sendUpdateRooms();
                    break;
                case "video":
                    if (touserid && fromuserid && payload) {
                        this.sendToID(touserid, data);
                    }
                    break;
                case "golive":
                    ws.livestate = livestate;
                    this.sendToAll(this.connections, { type: 'golive', livestate, livelabel, userid: ws.id, roomid: ws.currentRoom });
                    if (livestate) {
                        ws.livelabel = livelabel;
                    } else {
                        ws.livelabel = '';
                    }
                    this.sendUpdateRooms();
                    break;
                case "letmesee":
                    this.sendToID(touserid, {
                        type: "letmesee",
                        touserid,
                        fromuserid,
                        message
                    });
                    break;
                case "createroom":
                    if (this.storage.getAccountPermission(ws.id, 'createRoom')) {
                        if (roomType && roomName) {
                            var roomUuid = uuidv4();
                            this.storage.createRoom({
                                type: roomType,
                                name: roomName,
                                id: roomUuid
                            });
                            this.event.trigger('roomdelete', { roomUuid: roomUuid })
                            this.sendUpdateRooms();
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "createRoom"' });
                    }
                    break;
                case "createuser":
                    if (this.storage.getAccountPermission(ws.id, 'createUser')) {
                        if (userName && groupName && email) {
                            var password2 = uuidv4();
                            var userUuid = uuidv4();
                            this.storage.createAccount({
                                id: userUuid,
                                name: userName,
                                group: groupName,
                                email: email,
                                password: password2
                            });
                            this.event.trigger('usercreate', { userName, userUuid })
                            this.sendTo(ws, { type: 'adminMessage', message: 'User created with password : ' + password2 });
                            this.sendUpdateUsers();
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "createUser"' });
                    }
                    break;
                case "updateroom":
                    if (this.storage.getAccountPermission(ws.id, 'renameRoom')) {
                        if (roomName && roomid) {
                            var room = this.storage.getRoomByID(roomid);
                            room.name = roomName;
                            this.storage.updateRoom(roomid, room);
                            this.sendUpdateRooms();
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "renameRoom"' });
                    }
                    break
                case "updateuser":
                    if (this.storage.getAccountPermission(ws.id, 'renameUser') || ws.id === userid) {
                        if (userid && userName && userName.match(/^[a-zA-Z0-9-_ ]+$/)) {
                            var user2 = this.storage.getAccountByID(userid);
                            user2.name = userName;
                            this.storage.updateAccount(userid, user2);
                            this.sendUpdateUsers();
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "renameUser"' });
                    }
                    break;
                case "removeroom":
                    if (this.storage.getAccountPermission(ws.id, 'removeRoom')) {
                        if (roomid) {
                            this.event.trigger('roomdelete', { roomUuid: roomid })
                            this.storage.removeRoom(roomid);
                            this.sendUpdateRooms();
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "removeRoom"' });
                    }
                    break;
                case "removeuser":
                    if (this.storage.getAccountPermission(ws.id, 'removeUser')) {
                        if (userid) {
                            if (withvengeance) {
                                // TODO Delete Messages
                                // TODO Delete Uploads
                            }
                            this.event.trigger('userdelete', { roomUuid: userid })
                            this.storage.removeAccount(userid);
                            this.sendUpdateUsers();
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "removeUser"' });
                    }
                    break;
                case "updatemessage":
                    if (this.storage.getAccountPermission(ws.id, 'changeMessage')) {
                        if (roomid && messageid && message) {
                            this.event.trigger('messagechange', { roomUuid: roomid, newMessage: message, oldMessage: "NOT IMPLEMENTED" })//TODO
                            this.storage.updateMessage(roomid, messageid, message);
                            this.sendUpdatesMessages(roomid);

                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "changeMessage"' });
                    }
                    break;
                case "removemessage":
                    if (this.storage.getAccountPermission(ws.id, 'removeMessage')) {
                        if (roomid && messageid) {
                            this.event.trigger('messagechange', { roomUuid: roomid, newMessage: 'removed', oldMessage: "NOT IMPLEMENTED" })//TODO
                            this.storage.removeMessage(roomid, messageid);
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "removeMessage"' });
                    }
                    break;
                case "creategroup":
                    if (this.storage.getAccountPermission(ws.id, 'setGroupPerm')) {

                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                    }
                    break;
                case "updategroup":
                    if (this.storage.getAccountPermission(ws.id, 'setGroupPerm')) {

                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                    }
                    break;
                case "removegroup":
                    if (this.storage.getAccountPermission(ws.id, 'setGroupPerm')) {

                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                    }
                    break;
                case "setusergroup":
                    if (this.storage.getAccountPermission(ws.id, 'setUserGroup')) {
                        if (userid && groupName) {
                            this.storage.setAccountGroup(userid, groupName);
                        } else {
                            this.sendTo(ws, { type: 'error', message: 'Not enough info' });
                        }
                    } else {
                        this.sendTo(ws, { type: 'error', message: 'Permission denied "setUserGroup"' });
                    }
                    break;
                case "chatdev":
                    if (ws.currentRoom) {
                        this.sendToRoom(ws.currentRoom, { type: 'chatdev', video, audio, userid: ws.id });
                    }
                    break;
                case 'fileupload':
                    // TODO Check permissions
                    var id = ws.id;
                    if (!id) {
                        id = 'undefined'
                    }
                    fs.mkdir(path.join(uploadDir, id), { recursive: true }, (err) => {
                        if (err) {
                            console.error(err);
                            process.exit(1);
                        }
                        const reg = /[^a-z0-9-_]/gi;
                        var outputfilename = filename;
                        outputfilename = outputfilename.replace(reg, '');
                        outputfilename = path.join(uploadDir, id, outputfilename + uuidv4());
                        const buffer = Buffer.from(rawfile, 'base64');
                        try {
                            var dim = sizeOfImage(buffer);
                            console.log(dim.width, dim.height);
                            var s = new Readable();
                            s.push(buffer);
                            s.push(null);
                            s.pipe(fs.createWriteStream(outputfilename));
                        } catch (e) {
                            console.log("Could not accept uploaded file");
                            console.log(e);
                        }
                    });
                    break;
                case 'servermute':
                    if (userid && message) {
                        this.setUserSuppressed(userid, message);
                        this.sendToAll(this.connections, {
                            type: 'servermute',
                            userid,
                            message
                        })
                    }
                    break;
                case 'talking':
                    if (userid && message) {
                        this.setUserTalking(userid, message);
                    }
                    this.sendToAll(this.connections,
                        {
                            type: 'talking',
                            userid,
                            message
                        })
                    break;
                case 'contextoption':
                    if (userid && context && option && value) {
                        this.event.trigger("usercontextmenucallback", { context, option, value })
                    }
                    break;
                default:
                    console.log("Recv : %s", msg);
                    break;
            }
        });
        var url = null;
        if ('url' in config) {
            url = config.url;
        }
        this.event('connectionnew', {
            ref: ws, welcomeObj: {
                type: "connect",
                message: config.servername,
                icon: config.serverimg,
                url,
                contextmenus: clientcontextmenu

            }
        });


    }
}



// Prepare storage engine
const port = config['port'];
const storageEngineFileName = path.join(__dirname, 'storage-' + config['storage']);
var storageEngineExists = false;
try {
    if (fs.existsSync(storageEngineFileName + ".js")) {
        storageEngineExists = true;
    }
} catch (err) {
    console.error(err)
}
if (!storageEngineExists) {
    console.error("Storage option not available : " + config['storage']);
    process.exit(1);
}
const storage = require(storageEngineFileName);
if (!storage) {
    console.error("Storage option non-functional : " + config['storage']);
    process.exit(1);
}

console.log(config.plugins);
if ('plugins' in config) {
    config.plugins.forEach(plugin => {
        const pluginFileName = path.join(__dirname, 'plugin', plugin);
        var exist = false;
        console.log(pluginFileName);
        try {
            if (fs.existsSync(pluginFileName + '.js')) {
                exist = true;
            }
        } catch (err) {
            console.log(err);
        }
        if (exist) {
            plugins.push(require(pluginFileName));
        } else {
            console.log("Could not load '" + pluginFileName + ".js'");
            process.exit(1);
        }
    });
}

var options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

const uploadDir = '/uploads';
const uploadUri = '/uploads';
var server = https.createServer(options, app);
const wss = new WebSocket.Server({ server: server, path: "/ipc" });
app.use('/invite', express.static(path.join(__dirname, 'invite')));

thisServer.app = app;
thisServer.storage = storage;
thisServer.event = event;

// Prepare event system
event.init();

plugins.forEach(plugin => {
    event.trigger('pluginprep', { pluginName: plugin.pluginName, ref: plugin });
    plugin.start(thisServer);
    event.trigger('pluginstart', { pluginName: plugin.pluginName, ref: plugin });
})

event.trigger('serverprep', {});
thisServer.init();
storage.start();

event.trigger('serverstart', {});
server.listen(port, '0.0.0.0');