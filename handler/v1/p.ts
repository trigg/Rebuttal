import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import sizeOfImage from 'buffer-image-size';
import { Buffer } from 'node:buffer';
import event from '../../events.ts';
import {
    type rebuttal,
    type rebuttalSocket,
} from '../../server.ts';
import {
    type AccountStorage,
} from '../../storage/types.ts';
import { type v1_cts_packet } from '../../protocols/v1/client_to_server.ts';
import v1_cts_iface from '../../protocols/v1/client_to_server-ti.ts';
import v1_shared_iface from '../../protocols/v1/shared-ti.ts';
import { createCheckers } from 'ts-interface-checker';
import { v4 as uuidv4 } from 'uuid';
import { type v1_shared_message_real } from '../../protocols/v1/shared.ts';

const checker = createCheckers(v1_cts_iface, v1_shared_iface);

/* Heavy handed get an error message to user and close connection */
function invalid_packet(server: rebuttal, socket: rebuttalSocket, data: unknown) {
    if (!(data instanceof Object && 'type' in data && typeof data.type == 'string')) {
        console.log("v1 got malformed packet : ");
        console.log(data);
        return;
    }
    console.log('v1 got malformed packet : ' + data.type);
    console.log(JSON.stringify(data));

    const issues = checker.v1_cts_packet.validate(data);
    if (issues != null) {
        server.chase(issues);
    }

    server.sendTo(socket, {
        type: 'error',
        message: 'Malformed packet of type : "' + data.type + '"',
    });
    socket.close(
        3001,
        'Malformed packet of type : "' + data.type + '"',
    );
}

export const protocolv1 = {
    uploadDir: './uploads',
    uploadUri: './uploads',
    switch_protocol: async function (
        server: rebuttal,
        socket: rebuttalSocket,
        user: AccountStorage,
    ) {
        if (socket.id === null) {
            throw new Error('logged in user without an id');
        }
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
        server.sendTo(socket, {
            type: "welcome",
            contextmenus: server.contextmenu,
        });
        // Alert everyone else
        await server.sendUpdateRooms();
        await server.sendUpdateUsers();
    },
    handle: async function (
        server: rebuttal,
        socket: rebuttalSocket,
        data: unknown,
    ) {
        if (socket.id === null) {
            throw new Error('logged in user without an id');
        }
        let uuid;
        if (!checker.v1_cts_packet.test(data)) {
            invalid_packet(server, socket, data);
            return;
        }
        const packet = data as v1_cts_packet;
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
                            invite_code: uuid,
                        });
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Permission denied',
                        });
                    }
                }
                return;
            case 'getmessages':
                {
                    const getsegment = (packet.segment != undefined) ? packet.segment : await server.storage.getTextRoomNewestSegment(packet.roomid);
                    const returnsegment = await server.storage.getTextForRoom(
                        packet.roomid,
                        getsegment,
                    );
                    server.sendToID(socket.id, {
                        type: 'updateText',
                        roomid: packet.roomid,
                        segment: getsegment,
                        messages: returnsegment,
                    });
                }
                return;
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
                    if (!allow1.cancelled && !allow2.cancelled) {
                        let fileuri: string | null = null;
                        let fileheight: number | null = null;
                        let filewidth: number | null = null;
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
                                fileuri = outputuri;
                                fileheight = dim.height;
                                filewidth = dim.width;
                            } catch (e) {
                                console.log('Could not accept uploaded file');
                                console.log(e);
                            }
                        }
                        const full_message = {
                            roomid: packet.roomid,
                            idx: null,
                            userid: socket.id,
                            username: '',
                            text: packet.message.text,
                            tags: packet.message.tags,
                            url: packet.message.url,
                            type: '',
                            img: fileuri,
                            width: filewidth,
                            height: fileheight
                        };
                        await server.storage.addNewMessage(
                            full_message,
                        );
                        await server.sendUpdatesMessages(packet.roomid);
                        server.sendToAll(server.connections, {
                            type: 'sendMessage',
                            roomid: packet.roomid,
                            message: full_message,
                        });
                    } else {
                        console.log('Message');
                    }
                }
                return;
            case 'joinroom':
                {
                    // TODO Validate room exists
                    await event.trigger('userjoinroom', {
                        userUuid: socket.id,
                        userName: socket.name,
                        roomUuid: packet.roomid,
                    });
                    await server.setRoom(socket, packet.roomid);
                    await server.sendUpdateRooms();
                }
                return;
            case 'leaveroom':
                {
                    await event.trigger('userleaveroom', {
                        userUuid: socket.id,
                        userName: socket.name,
                        roomUuid: socket.currentRoom,
                    });
                    await server.setRoom(socket, null);
                    await server.sendUpdateRooms();
                }
                return;
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
                return;
            case 'golive':
                {
                    if (!socket.currentRoom) {
                        return;
                    }
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
                }
                return;
            case 'letmesee':
                {
                    server.sendToID(packet.touserid, {
                        type: 'letmesee',
                        touserid: packet.touserid,
                        fromuserid: socket.id,
                        message: packet.message,
                    });
                }
                return;
            case 'createroom':
                {
                    if (
                        await server.storage.getAccountPermission(
                            socket.id,
                            'createRoom',
                        )
                    ) {
                        if (packet.roomType && packet.roomName && packet.position) {
                            const roomUuid = uuidv4();
                            await server.storage.createRoom({
                                type: packet.roomType,
                                name: packet.roomName,
                                id: roomUuid,
                                position: packet.position,
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
                }
                return;
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
                            const password2: string = uuidv4();
                            const userUuid = uuidv4();
                            await server.storage.createAccount({
                                id: userUuid,
                                name: packet.userName,
                                group: packet.groupName,
                                email: packet.email,
                                passwordHash: '',
                            }, password2);
                            await event.trigger('usercreate', {
                                userName: packet.userName,
                                userUuid,
                            });
                            // TODO Send created user credentials
                            /*server.sendTo(socket, {
                                type: 'adminMessage',
                                message:
                                    'User created with password : ' + password2,
                            });*/
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
                return;
            case 'updateroom':
                {
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
                }
                return;
            case 'updateuser':
                {
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
                }
                return;
            case 'removeroom':
                {
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
                }
                return;
            case 'removeuser':
                {
                    if (
                        await server.storage.getAccountPermission(
                            socket.id,
                            'removeUser',
                        )
                    ) {
                        const deleteuser = packet.touserid;
                        if (deleteuser) {
                            if (packet.withvengence) {
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
                }
                return;
            case 'updatemessage':
                {
                    if (
                        await server.storage.getAccountPermission(
                            socket.id,
                            'changeMessage',
                        )
                    ) {
                        if (
                            packet.message &&
                            packet.message.roomid != null &&
                            packet.message.idx != null

                        ) {
                            const previous_message =
                                await server.storage.getMessage(
                                    packet.message.roomid,
                                    packet.message.idx,
                                );
                            if (!previous_message) {
                                return;
                            }

                            const delta = packet.message;

                            const new_message: v1_shared_message_real = {
                                roomid: delta.roomid,
                                idx: delta.idx,
                                text: delta.text ? delta.text : previous_message.text,
                                img: delta.img ? delta.img : previous_message.img,
                                url: delta.url ? delta.url : previous_message.url,
                                height: delta.height ? delta.height : previous_message.height,
                                width: delta.width ? delta.width : previous_message.width,
                                userid: delta.userid ? delta.userid : previous_message.userid,
                                tags: delta.tags ? delta.tags : previous_message.tags,
                                type: delta.type ? delta.type : previous_message.type,
                                username: delta.username ? delta.username : previous_message.username
                            }
                            const return_event = await event.trigger('messagechange', {
                                roomUuid: packet.message.roomid,
                                newMessage: new_message,
                                oldMessage: previous_message,
                            });
                            if (!return_event.cancelled) {
                                await server.storage.updateMessage(
                                    new_message,
                                );
                                await server.sendUpdatesMessages(packet.message.roomid);
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
                }
                return;
            case 'removemessage':
                {
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
                            const return_event = await event.trigger('messagechange', {
                                roomUuid: packet.roomid,
                                newMessage: message,
                                oldMessage: previous_message,
                            });
                            if (!return_event.cancelled) {
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
                }
                return;
            case 'creategroup':
                {
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
                }
                return;
            case 'updategroup':
                {
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
                }
                return;
            case 'removegroup':
                {
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
                }
                return;
            case 'setusergroup':
                {
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
                }
                return;
            case 'chatdev':
                {
                    if (socket.currentRoom) {
                        server.sendToRoom(socket.currentRoom, {
                            type: 'chatdev',
                            video: packet.video,
                            audio: packet.audio,
                            userid: socket.id,
                        });
                    }
                }
                return;
            case 'servermute':
                {
                    if (
                        await server.storage.getAccountPermission(
                            socket.id,
                            'suppressUser',
                        )
                    ) {
                        if (packet.userid && packet.suppress) {
                            server.setUserSuppressed(
                                packet.userid,
                                packet.suppress,
                            );
                            server.sendToAll(server.connections, {
                                type: 'servermute',
                                userid: packet.userid,
                                message: packet.suppress,
                            });
                        }
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Permission denied',
                        });
                    }
                }
                return;
            case 'talking':
                {
                    const talker_id = socket.id;
                    if (talker_id && packet.talking) {
                        server.setUserTalking(talker_id, packet.talking);
                    }
                    server.sendToAll(server.connections, {
                        type: 'talking',
                        userid: socket.id,
                        talking: packet.talking,
                    });
                }
                return;
            case 'contextoption':
                {
                    if (packet.context && packet.option && packet.value) {
                        await event.trigger('usercontextmenucallback', {
                            userUuid: socket.id,
                            context: packet.context,
                            option: packet.context,
                            value: packet.value,
                            ref: socket,
                        });
                    }
                }
                return;
            case 'windowinput':
                {
                    if (packet.inputid && packet.value && packet.allinputs) {
                        await event.trigger('userwindowinputcallback', {
                            userUuid: socket.id,
                            inputId: packet.inputid,
                            value: packet.value,
                            inputValues: packet.allinputs,
                            ref: socket,
                        });
                    }
                }
                return;

        }
        invalid_packet(server, socket, packet);

    },
};
export default protocolv1;
