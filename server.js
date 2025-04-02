`use strict`
const express = require('express');
const WebSocket = require("ws");
const https = require('https');
const { v4: uuidv4 } = require("uuid");
const fs = require('fs');
const path = require('path');
const gravatar = require('gravatar');

const event = require('./events');
const protocolv0 = require('./protocol/v0/p');
const protocolv1 = require('./protocol/v1/p');

var thisServer = {
    config: null,
    port: 9000,
    app: null,
    event: null,
    storage: null,
    contextmenu: { user: [], room: [], textroom: [], voiceroom: [], message: [] },
    connections: [],
    server: null,
    protocols: ["v1"],

    create: function (config) {
        this.config = config
        this.app = express();
        this.app.use('/invite', express.static(path.join(__dirname, 'invite')));
        var plugins = [];

        // Prepare storage engine
        var storageEngineFileName = path.join(__dirname, 'storage', config['storage']);
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
        this.storage = require(storageEngineFileName);
        if (!this.storage) {
            console.error("Storage option non-functional : " + config['storage']);
            process.exit(1);
        }

        this.storage.start();
        if (this.storage.getAllAccounts().length == 0) {
            // Should be run when no users are in config
            var userUuid = uuidv4();
            var password = uuidv4();
            console.log("Created Root account.");
            console.log("Pass : " + password);
            this.storage.createAccount({
                id: userUuid,
                name: "root",
                password,
                email: "root@localhost",
                group: "admin"
            });
            [
                'createRoom',
                'createUser',
                'renameRoom',
                'renameUser',
                'renameServer',
                'removeRoom',
                'removeUser',
                'inviteUser',
                'joinVoiceRoom',
                "sendMessage",
                "setUserGroup",
                "setGroupPerm",
                "changeMessage",
                "noInviteFor",
                "inviteUserAny"
            ].forEach(perm => {
                this.storage.addGroupPermission('admin', perm);
            });

            [
                "joinVoiceRoom",
                "sendMessage"
            ].forEach(perm => {
                this.storage.addGroupPermission('user', perm);
            });

            console.log(this.storage.storage);
        }

        if ('plugins' in config) {
            config.plugins.forEach(plugin => {
                const pluginFileName = path.join(__dirname, 'plugin', plugin);
                var exist = false;
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
        }
        this.server = https.createServer(options, this.app, () => {
            console.log("Started HTTPS server")
        })

        this.wss = new WebSocket.Server({ server: this.server, path: "/ipc" });
        this.event = event;
        this.port = config['port'];

        // Prepare event system
        this.event.init();

        plugins.forEach(plugin => {
            this.event.trigger('pluginprep', { pluginName: plugin.pluginName, ref: plugin });
            plugin.start(thisServer);
            this.event.trigger('pluginstart', { pluginName: plugin.pluginName, ref: plugin });
        })

        this.event.trigger('serverprep', {});
        thisServer.init();

        this.event.trigger('serverstart', {});
    },

    init: function () {
        this.wss.on("connection", ws => { thisServer.startConnection(ws) });

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

    presentCustomWindow: function (ws, window) {
        // TODO Check sanity of window before sending?
        this.sendTo(ws, { type: 'presentcustomwindow', window });
    },

    disconnectId: function (id) {
        Object.values(this.connections).forEach(client => {
            if (client.id === id) {
                client.terminate();
            }
        })
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
                account.avatar = gravatar.url(account.email, { protocol: 'https', d: this.config.gravatarfallback }, true);
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
        ws.protocol_version = "v0";
        ws.on("close", () => {
            this.event.trigger('connectionclose', { ref: ws });
            // Can't cancel a disconnection
            if (ws.id) {
                this.sendToAll(this.connections, { type: "disconnect", userid: ws.id });
                var index = this.connections.indexOf(ws);
                if (index !== -1) {
                    this.connections.splice(index, 1);
                }
                this.sendUpdateRooms();
                this.sendUpdateUsers();
            }
        });
        ws.on("message", msg => {
            let data;
            try {
                data = JSON.parse(msg);
            } catch (e) {
                console.log("Invalid JSON "+e);
                data = {}
            }
            switch (ws.protocol_version) {
                case "v0":
                    protocolv0.handle(this, ws, data);
                    break;
                case "v1":
                    protocolv1.handle(this, ws, data);
                    break;
                default:
                    this.sendTo(ws, { type: 'error', message: 'Invalid protocol : "' + ws.protocol_version + '"' });
                    ws.close();
            }
        });
        var url = null;
        if ('url' in this.config) {
            url = this.config.url;
        }
        this.event.trigger('connectionnew', {
            ref: ws, welcomeObj: {
                type: "connect",
                message: this.config.servername,
                icon: this.config.serverimg,
                url,
                contextmenus: this.contextmenu,
                protocols: this.protocols
            }
        });


    }
}
module.exports = thisServer;