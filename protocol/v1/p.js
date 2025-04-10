const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const sizeOfImage = require('buffer-image-size');

var protocolv1 = {
    uploadDir: './uploads',
    uploadUri: './uploads',
    switch_protocol: async function (server, socket, user) {
        // Connection has just transfered from another protocol to v1.
        // Give them the information they'd expect to have
        socket.suppress = false;
        server.sendTo(socket, {
            type: 'login',
            userid: socket.id,
            success: true,
        });
        var perms = await server.storage.getGroupPermissionList(user.group);
        server.sendTo(socket, {
            type: 'updatePerms',
            perms: perms,
        });
        server.sendTo(socket, {
            type: 'updateGroups',
            groups: await server.getGroups(),
        });

        // Alert everyone else
        server.sendUpdateRooms();
        server.sendUpdateUsers();
    },
    handle: async function (server, socket, data) {
        var uuid;
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
            withvengeance,
            roomName,
            roomType,
            groupName,
            messageid,
            userid,
            audio,
            video,
            context,
            option,
            value,
            inputid,
            allinputs,
            changes,
        } = data;
        switch (type) {
            case 'invite':
                uuid = uuidv4();
                // TODO Invites from anyone outside of admin
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'inviteUserAny',
                    )
                ) {
                    await server.storage.generateSignUp(groupName, uuid);
                    server.sendTo(socket, {
                        type: 'invite',
                        url: server.config.url + 'invite/' + uuid,
                    });
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied',
                    });
                }
                break;
            case 'getmessages':
                var getsegment;
                if (segment === undefined || segment === null) {
                    getsegment = await server.storage.getTextRoomNewestSegment(
                        roomid,
                    );
                } else {
                    getsegment = segment;
                }
                var returnsegment = await server.storage.getTextForRoom(
                    roomid,
                    getsegment,
                );
                var ret = {
                    type: 'updateText',
                    roomid: roomid,
                    segment: getsegment,
                    messages: returnsegment,
                };
                server.sendToID(socket.id, ret);
                break;
            case 'message':
                var outputfilename = null;
                // Send a notice that this single message has arrived.
                var allow1 = server.event.trigger('messagecreate', {
                    roomUuid: roomid,
                    message: message,
                });
                var allow2 = server.event.trigger('messagesend', {
                    userUuid: socket.id,
                    userName: socket.name,
                    roomUuid: roomid,
                    message: message,
                });
                if (allow1 && allow2) {
                    if (filename && rawfile) {
                        // TODO File upload before message event?
                        fs.mkdirSync(path.join(this.uploadDir, socket.id), {
                            recursive: true,
                        });
                        const reg = /[^a-z0-9-_]/gi;
                        outputfilename = filename;
                        outputfilename = outputfilename.replace(reg, '');
                        uuid = uuidv4();
                        var outputuri = path.join(
                            this.uploadUri,
                            socket.id,
                            outputfilename + uuid,
                        );
                        outputfilename = path.join(
                            this.uploadDir,
                            socket.id,
                            outputfilename + uuid,
                        );

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
                            console.log('Could not accept uploaded file');
                            console.log(e);
                        }
                    }
                    message.userid = socket.id;
                    await server.storage.addNewMessage(roomid, message);
                    server.sendUpdatesMessages(roomid);
                    server.sendToAll(server.connections, {
                        type: 'sendMessage',
                        roomid: roomid,
                        message: message,
                    });
                } else {
                    console.log('Message');
                }
                break;
            case 'joinroom':
                // TODO Validate room exists
                server.event.trigger('userjoinroom', {
                    userUuid: socket.id,
                    userName: socket.name,
                    roomUuid: roomid,
                });
                await server.setRoom(socket, roomid);
                server.sendUpdateRooms();
                break;
            case 'leaveroom':
                server.event.trigger('userleaveroom', {
                    userUuid: socket.id,
                    userName: socket.name,
                    roomUuid: roomid,
                });
                await server.setRoom(socket, null);
                server.sendUpdateRooms();
                break;
            case 'video':
                fromuserid = socket.id;
                if (touserid && fromuserid && payload) {
                    server.sendToID(touserid, data);
                }
                break;
            case 'golive':
                socket.livestate = livestate;
                server.sendToAll(server.connections, {
                    type: 'golive',
                    livestate,
                    livelabel,
                    userid: socket.id,
                    roomid: socket.currentRoom,
                });
                if (livestate) {
                    socket.livelabel = livelabel;
                } else {
                    socket.livelabel = '';
                }
                server.sendUpdateRooms();
                break;
            case 'letmesee':
                server.sendToID(touserid, {
                    type: 'letmesee',
                    touserid,
                    fromuserid: socket.id,
                    message,
                });
                break;
            case 'createroom':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'createRoom',
                    )
                ) {
                    if (roomType && roomName) {
                        var roomUuid = uuidv4();
                        await server.storage.createRoom({
                            type: roomType,
                            name: roomName,
                            id: roomUuid,
                        });
                        server.event.trigger('roomcreate', {
                            roomUuid: roomUuid,
                        });
                        server.sendUpdateRooms();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "createRoom"',
                    });
                }
                break;
            case 'createuser':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'createUser',
                    )
                ) {
                    if (userName && groupName && email) {
                        var password2 = uuidv4();
                        var userUuid = uuidv4();
                        await server.storage.createAccount({
                            id: userUuid,
                            name: userName,
                            group: groupName,
                            email: email,
                            password: password2,
                        });
                        server.event.trigger('usercreate', {
                            userName,
                            userUuid,
                        });
                        server.sendTo(socket, {
                            type: 'adminMessage',
                            message:
                                'User created with password : ' + password2,
                        });
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "createUser"',
                    });
                }
                break;
            case 'updateroom':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'renameRoom',
                    )
                ) {
                    if (roomName && roomid) {
                        var room = await server.storage.getRoomByID(roomid);
                        room.name = roomName;
                        await server.storage.updateRoom(roomid, room);
                        server.sendUpdateRooms();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "renameRoom"',
                    });
                }
                break;
            case 'updateuser':
                if (
                    (await server.storage.getAccountPermission(
                        socket.id,
                        'renameUser',
                    )) ||
                    socket.id === userid
                ) {
                    if (
                        userid &&
                        userName &&
                        userName.match(/^[a-zA-Z0-9-_ ]+$/)
                    ) {
                        var user2 = await server.storage.getAccountByID(userid);
                        user2.name = userName;
                        await server.storage.updateAccount(userid, user2);
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "renameUser"',
                    });
                }
                break;
            case 'removeroom':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'removeRoom',
                    )
                ) {
                    if (roomid) {
                        server.event.trigger('roomdelete', {
                            roomUuid: roomid,
                        });
                        await server.storage.removeRoom(roomid);
                        server.sendUpdateRooms();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "removeRoom"',
                    });
                }
                break;
            case 'removeuser':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'removeUser',
                    )
                ) {
                    var deleteuser = touserid;
                    if (deleteuser) {
                        if (withvengeance) {
                            // TODO Delete Messages
                            // TODO Delete Uploads
                        }
                        server.event.trigger('userdelete', {
                            userUuid: deleteuser,
                        });
                        server.disconnectId(deleteuser);
                        await server.storage.removeAccount(deleteuser);
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    console.log('Failed to delete');
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "removeUser"',
                    });
                }
                break;
            case 'updatemessage':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'changeMessage',
                    )
                ) {
                    if (
                        roomid &&
                        messageid !== undefined &&
                        messageid !== null &&
                        message
                    ) {
                        server.event.trigger('messagechange', {
                            roomUuid: roomid,
                            newMessage: message,
                            oldMessage: 'NOT IMPLEMENTED',
                        }); //TODO
                        await server.storage.updateMessage(
                            roomid,
                            messageid,
                            message,
                        );
                        server.sendUpdatesMessages(roomid);
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "changeMessage"',
                    });
                }
                break;
            case 'removemessage':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'changeMessage',
                    )
                ) {
                    if (
                        roomid &&
                        messageid !== undefined &&
                        messageid !== null
                    ) {
                        server.event.trigger('messagechange', {
                            roomUuid: roomid,
                            newMessage: 'removed',
                            oldMessage: 'NOT IMPLEMENTED',
                        }); //TODO
                        await server.storage.removeMessage(roomid, messageid);
                        server.sendUpdatesMessages(roomid);
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "removeMessage"',
                    });
                }
                break;
            case 'creategroup':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'setGroupPerm',
                    )
                ) {
                    if (groupName) {
                        server.storage.createGroup(groupName);
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "setGroupPerm"',
                    });
                }
                break;
            case 'updategroup':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'setGroupPerm',
                    )
                ) {
                    if (groupName && changes) {
                        for (let change of changes) {
                            if (change.add !== undefined) {
                                await server.storage.addGroupPermission(
                                    groupName,
                                    change.add,
                                );
                            }
                            if (change.remove !== undefined) {
                                await server.storage.removeGroupPermission(
                                    groupName,
                                    change.remove,
                                );
                            }
                        }
                        server.sendTo(socket, {
                            type: 'updateGroups',
                            groups: await server.getGroups(),
                        });
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "setGroupPerm"',
                    });
                }
                break;
            case 'removegroup':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'setGroupPerm',
                    )
                ) {
                    if (groupName) {
                        await server.storage.removeGroup(groupName);
                        server.sendTo(socket, {
                            type: 'updateGroups',
                            groups: await server.getGroups(),
                        });
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "setGroupPerm"',
                    });
                }
                break;
            case 'setusergroup':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'setUserGroup',
                    )
                ) {
                    if (userid && groupName) {
                        await server.storage.setAccountGroup(userid, groupName);
                        // If the user is logged in, inform them
                        var perms = await server.storage.getGroupPermissionList(
                            groupName,
                        );
                        server.sendToID(userid, {
                            type: 'updatePerms',
                            perms: perms,
                        });
                        server.sendUpdateUsers();
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Not enough info',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied "setUserGroup"',
                    });
                }
                break;
            case 'chatdev':
                if (socket.currentRoom) {
                    server.sendToRoom(socket.currentRoom, {
                        type: 'chatdev',
                        video,
                        audio,
                        userid: socket.id,
                    });
                }
                break;
            case 'servermute':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'suppressUser',
                    )
                ) {
                    if (userid && message) {
                        server.setUserSuppressed(userid, message);
                        server.sendToAll(server.connections, {
                            type: 'servermute',
                            userid,
                            message,
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied',
                    });
                }
                break;
            case 'talking':
                talker_id = socket.id;
                if (talker_id && message) {
                    server.setUserTalking(talker_id, message);
                }
                server.sendToAll(server.connections, {
                    type: 'talking',
                    userid,
                    message,
                });
                break;
            case 'contextoption':
                if (context && option && value) {
                    server.event.trigger('usercontextmenucallback', {
                        userUuid: socket.id,
                        context,
                        option,
                        value,
                        ref: socket,
                    });
                }
                break;
            case 'windowinput':
                if (inputid && value && allinputs) {
                    server.event.trigger('userwindowinputcallback', {
                        userUuid: socket.id,
                        inputId: inputid,
                        value,
                        inputValues: allinputs,
                        ref: socket,
                    });
                }
                break;
            default:
                console.log('v1 does not handle packet type : ' + type);
                server.sendTo(socket, {
                    type: 'error',
                    message: 'Unknown packet type : "' + type + '"',
                });
                socket.close(3001, 'Unknown packet type : "' + type + '"');
        }
    },
};
module.exports = protocolv1;
