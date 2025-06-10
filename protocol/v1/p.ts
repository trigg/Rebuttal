import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import sizeOfImage from 'buffer-image-size';
import { Buffer } from 'node:buffer';
import event from '../../events.ts';
import {
    type Message,
    type rebuttal,
    type rebuttalSocket,
} from '../../server.ts';
import {
    type MessageStorage,
    type AccountStorage,
} from '../../storage/interface.ts';

interface v1packet {
    type: string;
    userName: string;
    email: string;
    roomid: string;
    touserid: string;
    fromuserid: string;
    payload: RTCSessionDescription;
    livestate: boolean;
    livelabel: string;
    filename: string;
    rawfile: string;
    segment: number;
    message: Message;
    withvengeance: boolean;
    roomName: string;
    roomType: string;
    groupName: string;
    messageid: number;
    userid: string;
    audio: boolean;
    video: boolean;
    talking: boolean;
    suppressed: boolean;
    context: string;
    option: string;
    value: string;
    inputid: string;
    allinputs: string[];
    changes: Change[];
}

interface Change {
    add?: string;
    remove?: string;
}

function messagePacketToMessageStorage(message: Message): MessageStorage {
    const new_message: MessageStorage = {
        idx: message.idx,
        roomid: message.roomid,
        text: message.text,
        tags: message.tags,
        url: message.url ? message.url : null,
        img: message.img ? message.img : null,
        userid: message.userid ? message.userid : null,
        type: message.type ? message.type : null,
        username: message.username,
    };
    if (message.img) {
        new_message.img = message.img;
    }
    if (message.width) {
        new_message.width = message.width;
    }
    return new_message;
}

export const protocolv1 = {
    uploadDir: './uploads',
    uploadUri: './uploads',
    switch_protocol: async function (
        server: rebuttal,
        socket: rebuttalSocket,
        user: AccountStorage,
    ) {
        // Connection has just transfered from another protocol to v1.
        // Give them the information they'd expect to have
        socket.suppress = false;
        server.sendTo(socket, {
            type: 'login',
            userid: socket.id,
            success: true,
        });
        const perms = await server.storage.getGroupPermissionList(user.group);
        server.sendTo(socket, {
            type: 'updatePerms',
            perms: perms,
        });
        server.sendTo(socket, {
            type: 'updateGroups',
            groups: await server.getGroups(),
        });

        // Alert everyone else
        await server.sendUpdateRooms();
        await server.sendUpdateUsers();
    },
    handle: async function (
        server: rebuttal,
        socket: rebuttalSocket,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any,
    ) {
        if (socket.id === null) {
            throw new Error('logged in user without an id');
        }
        let uuid;
        const packet = data as v1packet;
        switch (packet.type) {
            case 'invite':
                {
                    uuid = uuidv4();
                    // TODO Invites from anyone outside of admin
                    if (
                        await server.storage.getAccountPermission(
                            socket.id,
                            'inviteUserAny',
                        )
                    ) {
                        await server.storage.generateSignUp(
                            packet.groupName,
                            uuid,
                        );
                        server.sendTo(socket, {
                            type: 'invite',
                            url: server.config.url + '/?invite=' + uuid,
                        });
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Permission denied',
                        });
                    }
                }
                break;
            case 'getmessages':
                {
                    const getsegment = packet.segment == undefined ? packet.segment : await server.storage.getTextRoomNewestSegment(packet.roomid);
                    const returnsegment = await server.storage.getTextForRoom(
                        packet.roomid,
                        getsegment,
                    );
                    const ret = {
                        type: 'updateText',
                        roomid: packet.roomid,
                        segment: getsegment,
                        messages: returnsegment,
                    };
                    server.sendToID(socket.id, ret);
                }
                break;
            case 'message':
                {
                    // Send a notice that this single message has arrived.
                    const allow1 = await event.trigger('messagecreate', {
                        roomUuid: packet.roomid,
                        message: packet.message,
                    });
                    const allow2 = await event.trigger('messagesend', {
                        userUuid: socket.id,
                        userName: socket.name,
                        roomUuid: packet.roomid,
                        message: packet.message,
                    });
                    if (allow1 && allow2) {
                        if (packet.filename && packet.rawfile) {
                            // TODO File upload before message event?
                            fs.mkdirSync(path.join(this.uploadDir, socket.id), {
                                recursive: true,
                            });
                            const reg = /[^a-z0-9-_]/gi;
                            let outputfilename = packet.filename;
                            outputfilename = outputfilename.replace(reg, '');
                            uuid = uuidv4();
                            const outputuri = path.join(
                                this.uploadUri,
                                socket.id,
                                outputfilename + uuid,
                            );
                            outputfilename = path.join(
                                this.uploadDir,
                                socket.id,
                                outputfilename + uuid,
                            );

                            const buffer = Buffer.from(
                                packet.rawfile,
                                'base64',
                            );
                            try {
                                const dim = sizeOfImage(buffer);
                                console.log(dim.width, dim.height);
                                const s = new Readable();
                                s.push(buffer);
                                s.push(null);
                                s.pipe(fs.createWriteStream(outputfilename));
                                packet.message.img = outputuri;
                                packet.message.height = dim.height;
                                packet.message.width = dim.width;
                            } catch (e) {
                                console.log('Could not accept uploaded file');
                                console.log(e);
                            }
                        }
                        packet.message.userid = socket.id;
                        await server.storage.addNewMessage(
                            packet.roomid,
                            messagePacketToMessageStorage(packet.message),
                        );
                        await server.sendUpdatesMessages(packet.roomid);
                        server.sendToAll(server.connections, {
                            type: 'sendMessage',
                            roomid: packet.roomid,
                            message: packet.message,
                        });
                    } else {
                        console.log('Message');
                    }
                }
                break;
            case 'joinroom':
                // TODO Validate room exists
                await event.trigger('userjoinroom', {
                    userUuid: socket.id,
                    userName: socket.name,
                    roomUuid: packet.roomid,
                });
                await server.setRoom(socket, packet.roomid);
                await server.sendUpdateRooms();
                break;
            case 'leaveroom':
                await event.trigger('userleaveroom', {
                    userUuid: socket.id,
                    userName: socket.name,
                    roomUuid: packet.roomid,
                });
                await server.setRoom(socket, null);
                await server.sendUpdateRooms();
                break;
            case 'video':
                {
                    if (
                        packet.touserid &&
                        packet.payload
                    ) {
                        server.sendToID(packet.touserid, {
                            type: 'video',
                            fromuserid: socket.id,
                            touserid: packet.touserid,
                            payload: packet.payload,
                        });
                    }
                }
                break;
            case 'golive':
                if ('livelabel' in packet && 'livestate' in packet) {
                    socket.livestate = packet.livestate;
                    server.sendToAll(server.connections, {
                        type: 'golive',
                        livestate: packet.livestate,
                        livelabel: packet.livelabel,
                        userid: socket.id,
                        roomid: socket.currentRoom,
                    });
                    if (packet.livestate) {
                        socket.livelabel = packet.livelabel;
                    } else {
                        socket.livelabel = '';
                    }
                    await server.sendUpdateRooms();
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Not enough info ' + JSON.stringify(packet),
                    });
                }
                break;
            case 'letmesee':
                server.sendToID(packet.touserid, {
                    type: 'letmesee',
                    touserid: packet.touserid,
                    fromuserid: socket.id,
                    message: packet.message,
                });
                break;
            case 'createroom':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'createRoom',
                    )
                ) {
                    if (packet.roomType && packet.roomName) {
                        const roomUuid = uuidv4();
                        await server.storage.createRoom({
                            type: packet.roomType,
                            name: packet.roomName,
                            id: roomUuid,
                        });
                        await event.trigger('roomcreate', {
                            roomUuid: roomUuid,
                        });
                        await server.sendUpdateRooms();
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
                {
                    if (
                        await server.storage.getAccountPermission(
                            socket.id,
                            'createUser',
                        )
                    ) {
                        if (
                            packet.userName &&
                            packet.groupName &&
                            packet.email
                        ) {
                            const password2 = uuidv4();
                            const userUuid = uuidv4();
                            await server.storage.createAccount({
                                id: userUuid,
                                name: packet.userName,
                                group: packet.groupName,
                                email: packet.email,
                                password: password2,
                            });
                            await event.trigger('usercreate', {
                                userName: packet.userName,
                                userUuid,
                            });
                            server.sendTo(socket, {
                                type: 'adminMessage',
                                message:
                                    'User created with password : ' + password2,
                            });
                            await server.sendUpdateUsers();
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
                }
                break;
            case 'updateroom':
                if (
                    await server.storage.getAccountPermission(
                        socket.id,
                        'renameRoom',
                    )
                ) {
                    if (packet.roomName && packet.roomid) {
                        const room = await server.storage.getRoomByID(
                            packet.roomid,
                        );
                        if (room) {
                            room.name = packet.roomName;
                            await server.storage.updateRoom(
                                packet.roomid,
                                room,
                            );
                            await server.sendUpdateRooms();
                        }
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
                    socket.id === packet.userid
                ) {
                    if (
                        packet.userid &&
                        packet.userName &&
                        packet.userName.match(/^[a-zA-Z0-9-_ ]+$/)
                    ) {
                        const user2 = await server.storage.getAccountByID(
                            packet.userid,
                        );
                        if (user2) {
                            user2.name = packet.userName;
                            await server.storage.updateAccount(
                                packet.userid,
                                user2,
                            );
                            await server.sendUpdateUsers();
                        }
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
                    if (packet.roomid) {
                        await event.trigger('roomdelete', {
                            roomUuid: packet.roomid,
                        });
                        await server.storage.removeRoom(packet.roomid);
                        await server.sendUpdateRooms();
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
                    const deleteuser = packet.touserid;
                    if (deleteuser) {
                        if (packet.withvengeance) {
                            // TODO Delete Messages
                            // TODO Delete Uploads
                        }
                        server.disconnectId(deleteuser);
                        await event.trigger('userdelete', {
                            userUuid: deleteuser,
                        });
                        server.disconnectId(deleteuser);
                        await server.storage.removeAccount(deleteuser);
                        await server.sendUpdateUsers();
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
                        packet.roomid &&
                        packet.messageid !== undefined &&
                        packet.messageid !== null &&
                        packet.message
                    ) {
                        const previous_message =
                            await server.storage.getMessage(
                                packet.roomid,
                                packet.messageid,
                            );
                        const allow = await event.trigger('messagechange', {
                            roomUuid: packet.roomid,
                            newMessage: packet.message,
                            oldMessage: previous_message,
                        });
                        if (allow) {
                            await server.storage.updateMessage(
                                packet.roomid,
                                packet.messageid,
                                messagePacketToMessageStorage(packet.message),
                            );
                            await server.sendUpdatesMessages(packet.roomid);
                        }
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
                        packet.roomid &&
                        packet.messageid !== undefined &&
                        packet.messageid !== null
                    ) {
                        const previous_message =
                            await server.storage.getMessage(
                                packet.roomid,
                                packet.messageid,
                            );
                        const message = {
                            text: '*Message Removed*',
                            userid: null,
                        };
                        const allow = await event.trigger('messagechange', {
                            roomUuid: packet.roomid,
                            newMessage: message,
                            oldMessage: previous_message,
                        });
                        if (allow) {
                            await server.storage.removeMessage(
                                packet.roomid,
                                packet.messageid,
                            );
                            await server.sendUpdatesMessages(packet.roomid);
                        }
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
                    if (packet.groupName) {
                        await server.storage.createGroup(packet.groupName);
                        // TODO Reply confirmation?
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
                    if (packet.groupName && packet.changes) {
                        for (const change of packet.changes) {
                            if (change.add !== undefined) {
                                await server.storage.addGroupPermission(
                                    packet.groupName,
                                    change.add,
                                );
                            }
                            if (change.remove !== undefined) {
                                await server.storage.removeGroupPermission(
                                    packet.groupName,
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
                    if (packet.groupName) {
                        await server.storage.removeGroup(packet.groupName);
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
                    if (packet.userid && packet.groupName) {
                        await server.storage.setAccountGroup(
                            packet.userid,
                            packet.groupName,
                        );
                        // If the user is logged in, inform them
                        const perms =
                            await server.storage.getGroupPermissionList(
                                packet.groupName,
                            );
                        server.sendToID(packet.userid, {
                            type: 'updatePerms',
                            perms: perms,
                        });
                        await server.sendUpdateUsers();
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
                        video: packet.video,
                        audio: packet.audio,
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
                    if (packet.userid && packet.message) {
                        server.setUserSuppressed(
                            packet.userid,
                            packet.suppressed,
                        );
                        server.sendToAll(server.connections, {
                            type: 'servermute',
                            userid: packet.userid,
                            message: packet.message,
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
                {
                    const talker_id = socket.id;
                    if (talker_id && packet.message) {
                        server.setUserTalking(talker_id, packet.talking);
                    }
                    server.sendToAll(server.connections, {
                        type: 'talking',
                        userid: packet.userid,
                        talking: packet.talking,
                    });
                }
                break;
            case 'contextoption':
                if (packet.context && packet.option && packet.value) {
                    await event.trigger('usercontextmenucallback', {
                        userUuid: socket.id,
                        context: packet.context,
                        option: packet.context,
                        value: packet.value,
                        ref: socket,
                    });
                }
                break;
            case 'windowinput':
                if (packet.inputid && packet.value && packet.allinputs) {
                    await event.trigger('userwindowinputcallback', {
                        userUuid: socket.id,
                        inputId: packet.inputid,
                        value: packet.value,
                        inputValues: packet.allinputs,
                        ref: socket,
                    });
                }
                break;
            default:
                console.log('v1 does not handle packet type : ' + packet.type);
                server.sendTo(socket, {
                    type: 'error',
                    message: 'Unknown packet type : "' + packet.type + '"',
                });
                socket.close(
                    3001,
                    'Unknown packet type : "' + packet.type + '"',
                );
        }
    },
};
export default protocolv1;
