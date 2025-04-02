var protocol = {

    switch: function (server, socket, user) {
        // Connection has just transfered from another protocol to v1.
        // Give them the information they'd expect to have
        socket.suppress = false;
        server.sendTo(socket, {
            type: "login",
            userid: socket.id,
            success: true
        });
        server.sendTo(socket, {
            type: 'updateUsers',
            userList: server.updateUsers()
        });
        server.sendTo(socket, {
            type: 'updateRooms',
            roomList: server.updateRooms()
        });

        var perms = server.storage.getGroupPermissionList(user.group);
        server.sendTo(socket, {
            type: 'updatePerms',
            perms: perms
        });
        server.sendTo(socket, {
            type: 'updateGroups',
            groups: server.getGroups()
        })

        // Alert everyone else
        server.sendUpdateRooms();
        server.sendUpdateUsers();

    },
    handle: function (server, socket, data) {
        const {
            type,
            userName,
            email,
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
            audio,
            video,
            context,
            option,
            value,
        } = data;
        switch (type) {
            case 'invite':
                var uuid = uuidv4();

                server.storage.generateSignUp(groupName, uuid);
                server.sendTo(socket, {
                    type: 'invite',
                    url: server.config.url + 'invite/' + uuid
                });
                break
            case "getmessages":
                var getsegment;
                if (segment === undefined || segment === null) {
                    getsegment = server.storage.getTextRoomNewestSegment(roomid);
                } else {
                    getsegment = segment;
                }
                var returnsegment = server.storage.getTextForRoom(roomid, getsegment);
                var ret = { type: 'updateText', roomid: roomid, segment: getsegment, messages: returnsegment };
                server.sendToID(socket.id, ret);
                break;
            case "message":
                var outputfilename = null;
                // Send a notice that this single message has arrived.
                var allow1 = server.event.trigger('messagecreate', { roomUuid: roomid, message: message });
                var allow2 = server.event.trigger('messagesend', { userUuid: socket.id, userName: socket.name, roomUuid: roomid, message: message });
                if (allow1 && allow2) {
                    if (filename && rawfile) {
                        // TODO File upload in message event?
                        fs.mkdirSync(path.join(uploadDir, socket.id), { recursive: true });
                        const reg = /[^a-z0-9-_]/gi;
                        outputfilename = filename;
                        outputfilename = outputfilename.replace(reg, '');
                        var uuid = uuidv4();
                        var outputuri = path.join(uploadUri, socket.id, outputfilename + uuid);
                        outputfilename = path.join(uploadDir, socket.id, outputfilename + uuid);

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
                    message.userid = socket.id;
                    server.storage.addNewMessage(roomid, message);
                    server.sendUpdatesMessages(roomid);
                    server.sendToAll(server.connections, { type: 'sendMessage', roomid: roomid, message: message })
                } else {
                    console.log("Message")
                }
                break;
            case "joinroom":
                // TODO Validate room exists
                server.event.trigger('userjoinroom', { userUuid: socket.id, userName: socket.name, roomUuid: roomid });
                server.setRoom(socket, roomid);
                server.sendUpdateRooms();
                break;
            case "leaveroom":
                server.event.trigger('userleaveroom', { userUuid: socket.id, userName: socket.name, roomUuid: roomid });
                server.setRoom(socket, null);
                server.sendUpdateRooms();
                break;
            case "video":
                if (touserid && fromuserid && payload) {
                    server.sendToID(touserid, data);
                }
                break;
            case "golive":
                socket.livestate = livestate;
                server.sendToAll(server.connections, { type: 'golive', livestate, livelabel, userid: socket.id, roomid: socket.currentRoom });
                if (livestate) {
                    socket.livelabel = livelabel;
                } else {
                    socket.livelabel = '';
                }
                server.sendUpdateRooms();
                break;
            case "letmesee":
                server.sendToID(touserid, {
                    type: "letmesee",
                    touserid,
                    fromuserid,
                    message
                });
                break;
            case "createroom":
                if (server.storage.getAccountPermission(socket.id, 'createRoom')) {
                    if (roomType && roomName) {
                        var roomUuid = uuidv4();
                        server.storage.createRoom({
                            type: roomType,
                            name: roomName,
                            id: roomUuid
                        });
                        server.event.trigger('roomdelete', { roomUuid: roomUuid })
                        server.sendUpdateRooms();
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "createRoom"' });
                }
                break;
            case "createuser":
                if (server.storage.getAccountPermission(socket.id, 'createUser')) {
                    if (userName && groupName && email) {
                        var password2 = uuidv4();
                        var userUuid = uuidv4();
                        server.storage.createAccount({
                            id: userUuid,
                            name: userName,
                            group: groupName,
                            email: email,
                            password: password2
                        });
                        server.event.trigger('usercreate', { userName, userUuid })
                        server.sendTo(socket, { type: 'adminMessage', message: 'User created with password : ' + password2 });
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "createUser"' });
                }
                break;
            case "updateroom":
                if (server.storage.getAccountPermission(socket.id, 'renameRoom')) {
                    if (roomName && roomid) {
                        var room = server.storage.getRoomByID(roomid);
                        room.name = roomName;
                        server.storage.updateRoom(roomid, room);
                        server.sendUpdateRooms();
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "renameRoom"' });
                }
                break
            case "updateuser":
                if (server.storage.getAccountPermission(socket.id, 'renameUser') || socket.id === userid) {
                    if (userid && userName && userName.match(/^[a-zA-Z0-9-_ ]+$/)) {
                        var user2 = server.storage.getAccountByID(userid);
                        user2.name = userName;
                        server.storage.updateAccount(userid, user2);
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "renameUser"' });
                }
                break;
            case "removeroom":
                if (server.storage.getAccountPermission(socket.id, 'removeRoom')) {
                    if (roomid) {
                        server.event.trigger('roomdelete', { roomUuid: roomid })
                        server.storage.removeRoom(roomid);
                        server.sendUpdateRooms();
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "removeRoom"' });
                }
                break;
            case "removeuser":
                if (server.storage.getAccountPermission(socket.id, 'removeUser')) {
                    var deleteuser = touserid;
                    if (touserid === null) {
                        deleteuser = socket.id
                    }
                    if (deleteuser) {
                        if (withvengeance) {
                            // TODO Delete Messages
                            // TODO Delete Uploads
                        }
                        server.event.trigger('userdelete', { userUuid: deleteuser })
                        server.disconnectId(deleteuser);
                        server.storage.removeAccount(deleteuser);
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    console.log("Failed to delete")
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "removeUser"' });
                }
                break;
            case "updatemessage":
                if (server.storage.getAccountPermission(socket.id, 'changeMessage')) {
                    if (roomid && messageid && message) {
                        server.event.trigger('messagechange', { roomUuid: roomid, newMessage: message, oldMessage: "NOT IMPLEMENTED" })//TODO
                        server.storage.updateMessage(roomid, messageid, message);
                        server.sendUpdatesMessages(roomid);

                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "changeMessage"' });
                }
                break;
            case "removemessage":
                if (server.storage.getAccountPermission(socket.id, 'removeMessage')) {
                    if (roomid && messageid) {
                        server.event.trigger('messagechange', { roomUuid: roomid, newMessage: 'removed', oldMessage: "NOT IMPLEMENTED" })//TODO
                        server.storage.removeMessage(roomid, messageid);
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "removeMessage"' });
                }
                break;
            case "creategroup":
                if (server.storage.getAccountPermission(socket.id, 'setGroupPerm')) {
                    //TODO
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                }
                break;
            case "updategroup":
                if (server.storage.getAccountPermission(socket.id, 'setGroupPerm')) {

                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                }
                break;
            case "removegroup":
                if (server.storage.getAccountPermission(socket.id, 'setGroupPerm')) {

                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "setGroupPerm"' });
                }
                break;
            case "setusergroup":
                if (server.storage.getAccountPermission(socket.id, 'setUserGroup')) {
                    if (userid && groupName) {
                        server.storage.setAccountGroup(userid, groupName);
                    } else {
                        server.sendTo(socket, { type: 'error', message: 'Not enough info' });
                    }
                } else {
                    server.sendTo(socket, { type: 'error', message: 'Permission denied "setUserGroup"' });
                }
                break;
            case "chatdev":
                if (socket.currentRoom) {
                    server.sendToRoom(socket.currentRoom, { type: 'chatdev', video, audio, userid: socket.id });
                }
                break;
            case 'fileupload':
                // TODO Check permissions
                var id = socket.id;
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
                    server.setUserSuppressed(userid, message);
                    server.sendToAll(server.connections, {
                        type: 'servermute',
                        userid,
                        message
                    })
                }
                break;
            case 'talking':
                if (userid && message) {
                    server.setUserTalking(userid, message);
                }
                server.sendToAll(server.connections,
                    {
                        type: 'talking',
                        userid,
                        message
                    })
                break;
            case 'contextoption':
                if (context && option && value) {
                    server.event.trigger("usercontextmenucallback", { userUuid: socket.id, context, option, value, ref: socket })
                }
                break;
            case 'windowinput':
                if (inputid && value && allinputs) {
                    server.event.trigger("userwindowinputcallback", { userUuid: socket.id, inputId: inputid, value, inputValues: allinputs, ref: socket });
                }
                break;
            default:
                server.sendTo(socket, { type: 'error', message: 'Unknown packet type : "' + type + '"' });
                socket.close();
        }
    }
}
module.exports = protocol;