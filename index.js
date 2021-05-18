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

const app = express();

// Prepare storage engine
const port = config['port'];
const storageEngineFileName = './storage-' + config['storage'];
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

var options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

var connections = [];
var groupplay = [];
const uploadDir = 'public/uploads';
const uploadUri = '/uploads';
var server = https.createServer(options, app);
const wss = new WebSocket.Server({ server: server, path: "/ipc" });
app.use('/', express.static('public'));
app.use('/webhook/', express.json());
app.use('/webhook/', express.urlencoded({
    extended: true
}));
app.post("/webhook/", (req, res) => {
    console.log(req.headers);
    console.log(req.header('x-hub-signiture'));
    var room = getRoomForHash(req.header('x-hub-signiture'));
    if (!room) { res.status(404).end(); }
    var payload;
    if (req.body.payload) {
        payload = JSON.parse(req.body.payload)
    } else {
        payload = req.body;
    }
    if (!payload) {
        console.log(req.body);
        return;
    }
    var m = '';
    if (payload.action) {
        switch (payload.action) {
            case "opened":
                m = "Opened Issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                if (payload.issue.body && payload.issue.body !== '') {
                    m += "  \n" + payload.issue.body;
                }
                var message = {
                    type: 'webhook',
                    avatar: payload.sender.avatar_url,
                    username: payload.sender.login,
                    message: m,
                    url: payload.issue.url
                }
                break;
            case "labeled":
                m = "Changed labels on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                var message = {
                    type: 'webhook',
                    avatar: payload.sender.avatar_url,
                    username: payload.sender.login,
                    message: m,
                    url: payload.issue.url
                }
                break;
            case "created": // Commented
                m = "Commented on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                if (payload.comment.body) {
                    m += payload.comment.body.replaceAll("\r\n", "  \n");
                }
                var message = {
                    avatar: payload.sender.avatar_url,
                    username: payload.sender.login,
                    message: m,
                    url: payload.issue.url
                }
                break;
            case "edited":
                m = "Edited comment on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                var message = {
                    avatar: payload.sender.avatar_url,
                    username: payload.sender.login,
                    message: m,
                    url: payload.issue.url
                }
            default:
                console.log(payload);
                break;
        }
    } else {
        if (payload.commits) {
            m = "Pushed commits to " + payload.repository.full_name;
            payload.commits.forEach(commit => {
                m += "```\n" + commit.message + "\n```\n";
            })
            var message = {
                avatar: payload.sender.avatar_url,
                username: payload.sender.login,
                message: m,
                url: payload.issue.url
            }
        }
    }

    res.status(200).end();
});

// Prepare known theme list
var themelist = [];

fs.readdirSync(path.join(__dirname, 'public', 'img'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .forEach(entry => {
        var themefile = path.join(__dirname, 'public', 'img', entry.name, 'theme.json');
        if (fs.existsSync(themefile)) {
            var data = JSON.parse(fs.readFileSync(themefile));
            data.id = entry.name;
            themelist.push(data);
        }
    });

const getRoomForHash = (hash) => {
    var r = null;
    storage.getAllRooms().forEach(room => {
        var roomHash = crypto.createHash('sha256').update(room.id).digest('hex');
        console.log(room.name);
        console.log(roomHash + " == " + hash);
        if (roomHash === hash) {
            r = room;
        }
    })
    return r;
}

const sendToID = (id, message) => {
    Object.values(connections).forEach(client => {
        if (client.id === id) {
            sendTo(client, message);
        }
    })
}
const sendTo = (connection, message) => {
    connection.send(JSON.stringify(message));
}

const sendToAll = (clients, message, ownsocket) => {
    Object.values(clients).forEach(client => {
        if (client !== ownsocket) {
            sendTo(client, message);
        }
    })
}

const sendToRoom = (roomid, message) => {
    Object.values(connections).forEach(client => {
        if (client.currentRoom === roomid) {
            sendTo(client, message);
        }
    })
}

const sendUpdateUsers = () => {
    sendToAll(connections, {
        type: 'updateUsers',
        userList: updateUsers()
    });
}

const sendUpdateRooms = () => {
    sendToAll(connections, {
        type: 'updateRooms',
        roomList: updateRooms()
    });
}

const getUsersInRoom = (roomid) => {
    let users = [];
    Object.values(connections).forEach(connection => {
        if (connection.currentRoom === roomid) {
            users.push({ id: connection.id, name: connection.name, livestate: connection.livestate, livelabel: connection.livelabel });
        }
    });
    return users;
}

const isUserConnected = (userid) => {
    let conn = false;
    Object.values(connections).forEach(connection => {
        if (connection.id === userid) {
            conn = true;
        }
    })
    return conn;
}

const updateUsers = () => {
    // Create a client-usable copy of users
    // Add transient data, hide private
    let users = [];
    storage.getAllAccounts().forEach(account => {
        if (!('hidden' in account)) {
            account.hidden = false;
        }
        users.push(
            {
                id: account.id,
                name: account.name,
                status: isUserConnected(account.id),
                hidden: account.hidden
            }
        );

    });
    return users;
}

const setRoom = (socket, roomid) => {
    // TODO sendToAll appears to not do what I'd want
    let room = storage.getRoomByID(roomid);
    // Can only 'join' media rooms
    if (room && room.type !== 'voice') {
        return;
    }
    // Do action on same room
    if (roomid == socket.currentRoom) {
        return;
    }
    if (socket.currentRoom) {
        sendToAll(connections, { type: "leaveRoom", userid: socket.id, roomid: socket.currentRoom }, null);
    }
    socket.currentRoom = roomid;
    if (roomid) {
        sendToAll(connections, { type: "joinRoom", userid: socket.id, roomid: socket.currentRoom }, null);
    }
    sendUpdateRooms();
}

const updateRooms = () => {
    // Create a client-usable copy of rooms
    // Add transient data
    let array = [];
    storage.getAllRooms().forEach(room => {
        array.push(
            {
                id: room.id,
                name: room.name,
                type: room.type,
                userlist: getUsersInRoom(room.id),
            });
    });

    return array;
}

const getGroups = () => {
    var list = {};
    storage.getGroups().forEach(group => {
        list[group] = storage.getGroupPermissionList(group);
    })
    return list;
}

wss.on("connection", ws => {
    ws.on("close", () => {
        if (ws.id) {
            sendToAll(connections, { type: "disconnect", userid: ws.id });
            delete connections[ws.id];

            sendUpdateRooms();
            sendUpdateUsers();
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

                storage.generateSignUp(groupName, uuid);
                sendTo(ws, {
                    type: 'invite',
                    url: uuid
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
                    var group = storage.expendSignUp(signUp);
                    if (group) {
                        console.log("Created user");
                        storage.createAccount({
                            id: uuidv4(),
                            name: userName,
                            password,
                            email,
                            group
                        });

                        sendTo(ws, { type: 'refreshNow' });
                    } else {
                        console.log("Invite invalid");
                        sendTo(ws, { type: 'error', message: 'Signup code expired or invalid' });
                    }
                } else {
                    console.log("Not enough details to create account");
                    sendTo(ws, { type: 'error', message: 'Not enough info' });
                }

                break;
            case "login":

                let user = storage.getAccountByLogin(email, password);
                if (user) {
                    // Log user out from other sources. Maybe later allow multiple login for one user
                    // But it is not this day
                    connections.forEach(conn => {
                        if (conn.id && conn.id === user.id) {
                            conn.close();
                        }
                    })

                    connections[user.id] = ws;
                    ws.name = user.name;
                    ws.id = user.id;
                    sendTo(ws, {
                        type: "login",
                        userid: user.id,
                        success: true
                    });
                    sendTo(ws, {
                        type: 'updateUsers',
                        userList: updateUsers()
                    });
                    sendTo(ws, {
                        type: 'updateRooms',
                        roomList: updateRooms()
                    });
                    var perms = storage.getGroupPermissionList(user.group);
                    sendTo(ws, {
                        type: 'updatePerms',
                        perms: perms
                    });
                    sendTo(ws, {
                        type: 'updateGroups',
                        groups: getGroups()
                    })

                    // Alert everyone else
                    sendUpdateRooms();
                    sendUpdateUsers();
                } else {
                    sendTo(ws, {
                        type: "login",
                        success: false
                    })
                }
                break;
            case "getmessages":
                var getsegment;
                if (segment === undefined || segment === null) {
                    getsegment = storage.getTextRoomNewestSegment(roomid);
                } else {
                    getsegment = segment;
                }
                var returnsegment = storage.getTextForRoom(roomid, getsegment);
                var ret = { type: 'updateText', roomid: roomid, segment: getsegment, messages: returnsegment };
                sendToID(ws.id, ret);
                break;
            case "message":
                var outputfilename = null;
                if (filename && rawfile) {
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
                storage.addNewMessage(roomid, message);
                var segnum = storage.getTextRoomNewestSegment(roomid);

                // Generally, you have new text. Send a whole chunk replacement
                sendToAll(connections, { type: 'updateText', roomid: roomid, segment: segnum, messages: storage.getTextForRoom(roomid, segnum) });
                // Send a notice that this single message has arrived.
                sendToAll(connections, { type: 'sendMessage', roomid: roomid, message: message })
                break;
            case "joinroom":
                // TODO Validate room exists
                setRoom(ws, roomid);
                sendUpdateRooms();
                if (roomid in groupplay) {
                    sendToAll(connections, { type: 'groupplay', url: groupplay[roomid], roomid: roomid });
                }
                break;
            case "leaveroom":
                setRoom(ws, null);
                sendUpdateRooms();
                break;
            case "video":
                if (touserid && fromuserid && payload) {
                    sendToID(touserid, data);
                }
                break;
            case "golive":
                ws.livestate = livestate;
                sendToAll(connections, { type: 'golive', livestate, livelabel, userid: ws.id });
                if (livestate) {
                    ws.livelabel = livelabel;
                } else {
                    ws.livelabel = '';
                }
                sendUpdateRooms();
                break;
            case "groupplay":
                var rid = ws.currentRoom;
                groupplay[rid] = url;
                sendToAll(connections, { type: 'groupplay', url: url, roomid: rid });
                break;
            case "createroom":
                if (storage.getAccountPermission(ws.id, 'createRoom')) {
                    if (roomType && roomName) {
                        storage.createRoom({
                            type: roomType,
                            name: roomName,
                            id: uuidv4()
                        });
                        sendUpdateRooms();
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "createRoom"' });
                }
                break;
            case "createuser":
                if (storage.getAccountPermission(ws.id, 'createUser')) {
                    if (userName && groupName && email) {
                        var password2 = uuidv4();
                        storage.createAccount({
                            id: uuidv4(),
                            name: userName,
                            group: groupName,
                            email: email,
                            password: password2
                        });
                        sendTo(ws, { type: 'adminMessage', message: 'User created with password : ' + password2 });
                        sendUpdateUsers();
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "createUser"' });
                }
                break;
            case "updateroom":
                if (storage.getAccountPermission(ws.id, 'renameRoom')) {
                    if (roomName && roomid) {
                        var room = storage.getRoomByID(roomid);
                        room.name = roomName;
                        storage.updateRoom(roomid, room);
                        sendUpdateRooms();
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "renameRoom"' });
                }
                break
            case "updateuser":
                if (storage.getAccountPermission(ws.id, 'renameUser')) {
                    if (userid && userName) {
                        var user2 = storage.getAccountByID(userid);
                        user2.name = userName;
                        storage.updateUser(userid, user2);
                        sendUpdateUsers();
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "renameUser"' });
                }
                break;
            case "removeroom":
                if (storage.getAccountPermission(ws.id, 'removeRoom')) {
                    if (roomid) {
                        storage.removeRoom(roomid);
                        sendUpdateRooms();
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "removeRoom"' });
                }
                break;
            case "removeuser":
                if (storage.getAccountPermission(ws.id, 'removeUser')) {
                    if (userid) {
                        if (withvengeance) {
                            // TODO Delete Messages
                            // TODO Delete Uploads
                        }
                        storage.removeAccount(userid);
                        sendUpdateUsers();
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "removeUser"' });
                }
                break;
            case "updatemessage":
                if (storage.getAccountPermission(ws.id, 'changeMessage')) {
                    if (roomid && messageid && message) {
                        storage.updateMessage(roomid, messageid, message);
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "changeMessage"' });
                }
                break;
            case "removemessage":
                if (storage.getAccountPermission(ws.id, 'removeMessage')) {
                    if (roomid && messageid) {
                        storage.removeMessage(roomid, messageid);
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "removeMessage"' });
                }
                break;
            case "creategroup":
                if (storage.getAccountPermission(ws.id, 'setGroupPerm')) {

                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                }
                break;
            case "updategroup":
                if (storage.getAccountPermission(ws.id, 'setGroupPerm')) {

                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                }
                break;
            case "removegroup":
                if (storage.getAccountPermission(ws.id, 'setGroupPerm')) {

                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                }
                break;
            case "setusergroup":
                if (storage.getAccountPermission(ws.id, 'setUserGroup')) {
                    if (userid && groupName) {
                        storage.setAccountGroup(userid, groupName);
                    } else {
                        sendTo(ws, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    sendTo(ws, { type: 'error', message: 'Permission denied "setUserGroup"' });
                }
                break;
            case "chatdev":
                if (ws.currentRoom) {
                    sendToRoom(ws.currentRoom, { type: 'chatdev', video, audio, userid: ws.id });
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
                        return console.error(err);
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
            default:
                console.log("Recv : %s", msg);
                break;
        }
    });
    ws.send(
        JSON.stringify({
            type: "connect",
            message: config.servername,
            icon: config.serverimg,
            themelist

        })
    );
});

storage.start();
server.listen(port, '0.0.0.0');