import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import gravatar from 'gravatar';

import { event, Priority, type Event } from './events.ts';
import { protocolv0 } from './protocol/v0/p.ts';
import { protocolv1 } from './protocol/v1/p.ts';

import jsonstorage from './storage/json.ts';
//import mysqlstorage from './storage/mysql.ts';
import sqlitestorage from './storage/sqlite.ts';
import { type pluginInterface } from './plugin/interface.ts';
import {
    type PermissionsStorage,
    type StorageInterface,
    type RoomStorage,
    type AccountStorage,
} from './storage/interface.ts';

export interface config {
    storage: string;
    plugins: string[];
    certpath?: string;
    keypath?: string;
    port?: number;
    servername?: string;
    serverimg?: string;
    gravatarfallback?: string;
    url?: string;
    infinitesignup?: string;
    test_mode?: boolean;
}

export interface contextMenu {
    label: string;
    permissionRequired: string;
    option: string;
}

export interface contextMenus {
    user: contextMenu[];
    room: contextMenu[];
    textroom: contextMenu[];
    voiceroom: contextMenu[];
    message: contextMenu[];
}

export type rebuttalSocket = WebSocket & {
    protocol_version: string;
    id: string | null;
    currentRoom: string | null;
    livestate: boolean;
    livelabel: string;
    name: string;
    talking: boolean;
    suppress: boolean;
};

// Alike to Account, but not quite. Specifically it's a collection some Account properties and some rebuttalSocket properties.
export interface User {
    id: string;
    currentRoom: string | null;
    livestate: boolean;
    livelabel: string;
    name: string;
    talking: boolean;
    suppress: boolean;
    status: boolean;
    avatar: string | undefined;
    hidden: boolean;
}

// Message in the format expected by sockets
export interface Message {
    roomid: string;
    idx: number;
    text: string;
    img?: string;
    url?: string;
    height?: number;
    width?: number;
    userid?: string;
    tags: string[];
    type?: string;
    username: string;
}

// Room in the format expected by sockets
export interface Room {
    id: string;
    type: string;
    name: string;
    userlist: User[];
}

export interface rebuttal {
    config: config;
    storage: StorageInterface;
    server: https.Server;
    app: typeof express.application;
    protocols: string[];
    connections: rebuttalSocket[];
    port: number;
    contextmenu: contextMenus;

    listen(post: number, hostname: string, fn: () => void): void;
    close(fn: () => void): void;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTo(ws: rebuttalSocket, msg: any): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendToID(id: string, msg: any): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendToAll(wsList: rebuttalSocket[], msg: any, me?: rebuttalSocket): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendToRoom(id: string, msg: any): void;
    sendUpdateUsers(): Promise<void>;
    sendUpdateRooms(): Promise<void>;
    sendUpdatesMessages(id: string): Promise<void>;
    disconnectId(id: string): void;

    isUserConnected(id: string): boolean;
    isUserSuppressed(id: string): boolean;
    setUserSuppressed(id: string, suppressed: boolean): void;
    isUserTalking(id: string): boolean;
    setUserTalking(id: string, talking: boolean): void;
    setRoom(socket: rebuttalSocket, id: string | null): Promise<void>;
    getGroups(): Promise<PermissionsStorage>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    presentCustomWindow(socket: rebuttalSocket, window: any): void; // TODO, Clean up, move to v1
}

export type rebuttalInternal = rebuttal & {
    wss: WebSocketServer;
    startConnection(ws: rebuttalSocket): void;
    populateNewConfig(): Promise<void>;
    init(): void;

    updateUsers(): Promise<User[]>;
    updateRooms(): Promise<RoomStorage[]>;
    getUsersInRoom(id: string): User[];
    getUser(acc: AccountStorage): User;
};

export async function create_rebuttal(config: config) {
    const app = express();
    app.use('/invite', express.static('invite'));
    const plugins: pluginInterface[] = [];
    let storage = null;
    switch (config['storage']) {
        /*case 'mysql':
            storage = mysqlstorage;
            break;*/
        case 'sqlite':
            storage = sqlitestorage;
            break;
        case 'json':
            storage = jsonstorage;
            break;
    }
    if (storage === null) {
        throw new Error('no storage');
    }
    if (config.test_mode) {
        await storage.test_mode();
    }
    await storage.start();

    if ('plugins' in config) {
        for (const plugin of config['plugins']) {
            const pluginFileName = path.join('plugin', plugin + '.ts');
            let exist = false;
            if (fs.existsSync(pluginFileName)) {
                exist = true;
            }

            if (exist) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const plugin_actual = await import('./' + pluginFileName);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                plugins.push(plugin_actual.default);
            } else {
                console.log("Could not load '" + pluginFileName + "'");
                throw new Error('unknown plugin');
            }
        }
    }
    let key_path = './key.pem';
    let cert_path = './cert.pem';
    if (config.keypath) {
        key_path = config.keypath;
    }
    if (config.certpath) {
        cert_path = config.certpath;
    }
    if (!fs.existsSync(key_path)) {
        throw new Error('key file not found');
    }
    if (!fs.existsSync(cert_path)) {
        throw new Error('cert file not found');
    }
    const options = {
        key: fs.readFileSync(key_path),
        cert: fs.readFileSync(cert_path),
    };
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const server = https.createServer(options, app);

    const wss = new WebSocketServer({
        server: server,
        path: '/ipc',
    });
    const port = config['port'];
    if (!port) {
        throw new Error('Port not set');
    }

    const rebuttal: rebuttalInternal = {
        config,
        storage,
        server,
        app,
        wss,
        port,
        contextmenu: {
            user: new Array<contextMenu>(),
            room: new Array<contextMenu>(),
            textroom: new Array<contextMenu>(),
            voiceroom: new Array<contextMenu>(),
            message: new Array<contextMenu>(),
        },
        connections: new Array<rebuttalSocket>(),
        protocols: ['v1'],

        listen: function (port: number, hostname: string, fn: () => void) {
            if (this.server === null) {
                throw new Error('Not created before listen');
            }
            this.server.listen(port, hostname, fn);
        },
        close: function (fn: () => void) {
            this.server.close(fn);
        },

        populateNewConfig: async function () {
            const users = await this.storage.getAllAccounts();
            if (!users || users.length == 0) {
                // Should be run when no users are in config
                const userUuid = uuidv4();
                const password = uuidv4();
                console.log('Created Root account : root@localhost');
                // TODO Pass the admin a one-use URL to login with this password
                //console.log('Pass : ' + password);
                await this.storage.createAccount({
                    id: userUuid,
                    name: 'root',
                    password,
                    email: 'root@localhost',
                    group: 'admin',
                });
                for (const perm of [
                    'createRoom',
                    'createUser',
                    'renameRoom',
                    'renameUser',
                    'renameServer',
                    'removeRoom',
                    'removeUser',
                    'inviteUser',
                    'joinVoiceRoom',
                    'sendMessage',
                    'setUserGroup',
                    'setGroupPerm',
                    'changeMessage',
                    'noInviteFor',
                    'inviteUserAny',
                ]) {
                    await this.storage.addGroupPermission('admin', perm);
                }

                for (const perm of ['joinVoiceRoom', 'sendMessage']) {
                    await this.storage.addGroupPermission('user', perm);
                }

                const roomUuid = uuidv4();
                await this.storage.createRoom({
                    id: roomUuid,
                    name: 'Main',
                    type: 'text',
                });

                const voiceUuid = uuidv4();
                await this.storage.createRoom({
                    id: voiceUuid,
                    name: 'Chat',
                    type: 'voice',
                });
            }
        },

        init: function () {
            this.wss.on('connection', (ws: rebuttalSocket) => {
                rebuttal.startConnection(ws);
            });

            // TODO Populate client context menu

            // TODO FINAL events for most events.

            // Get FINAL event callbacks
            event.listen('connectionnew', Priority.FINAL, (event: Event) => {
                if (!event.cancelled && event.ref) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    event.ref.send(JSON.stringify(event.welcomeObj));
                } else {
                    // TODO Decide what cancelling a new connection does
                }
            });
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        presentCustomWindow: function (ws: rebuttalSocket, window: any) {
            // TODO Check sanity of window before sending?
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this.sendTo(ws, { type: 'presentcustomwindow', window });
        },

        disconnectId: function (id: string) {
            for (const client of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (client.id === id) {
                    client.close();
                }
            }
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendToID: function (id: string, message: any) {
            for (const client of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (client.id === id) {
                    this.sendTo(client, message);
                }
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendTo: function (connection: rebuttalSocket, message: any) {
            connection.send(JSON.stringify(message));
        },

        sendToAll: function (
            clients: rebuttalSocket[],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: any,
            ownsocket?: rebuttalSocket | null,
        ) {
            for (const client of clients) {
                if (!ownsocket || client !== ownsocket) {
                    this.sendTo(client, message);
                }
            }
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendToRoom: function (roomid: string, message: any) {
            for (const client of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (client.currentRoom === roomid) {
                    this.sendTo(client, message);
                }
            }
        },

        sendUpdateUsers: async function () {
            this.sendToAll(this.connections, {
                type: 'updateUsers',
                userList: await this.updateUsers(),
            });
        },

        sendUpdatesMessages: async function (roomid: string) {
            let segnum = await this.storage.getTextRoomNewestSegment(roomid);
            if (!segnum) {
                segnum = 0;
            }
            this.sendToAll(this.connections, {
                type: 'updateText',
                roomid: roomid,
                segment: segnum,
                messages: await this.storage.getTextForRoom(roomid, segnum),
            });
        },

        sendUpdateRooms: async function () {
            this.sendToAll(this.connections, {
                type: 'updateRooms',
                roomList: await this.updateRooms(),
            });
        },

        getUsersInRoom: function (roomid: string) {
            const users: User[] = [];
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === null) {
                    continue;
                }
                if (connection.currentRoom === roomid) {
                    const user: User = {
                        id: connection.id,
                        name: connection.name,
                        livestate: connection.livestate,
                        livelabel: connection.livelabel,
                        currentRoom: connection.currentRoom,
                        talking: false,
                        suppress: false,
                        status: false,
                        avatar: undefined,
                        hidden: false,
                    };
                    users.push(user);
                }
            }
            return users;
        },

        isUserConnected: function (userid: string) {
            let conn = false;
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === userid) {
                    conn = true;
                }
            }
            return conn;
        },

        isUserSuppressed: function (userid: string) {
            let supp = false;
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === userid && connection.suppress) {
                    supp = connection.suppress;
                }
            }
            return supp;
        },

        setUserSuppressed: function (userid: string, suppress: boolean) {
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === userid) {
                    connection.suppress = suppress;
                }
            }
        },

        isUserTalking: function (userid: string) {
            let conn = false;
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === userid && connection.talking) {
                    conn = connection.talking;
                }
            }
            return conn;
        },

        setUserTalking: function (userid: string, talking: boolean) {
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === userid) {
                    connection.talking = talking;
                }
            }
        },

        getUser: function (account: AccountStorage) {
            if (!('hidden' in account)) {
                account.hidden = false;
            }
            if (!('avatar' in account)) {
                account.avatar = gravatar.url(
                    account.email,
                    {
                        protocol: 'https',
                        d: this.config.gravatarfallback,
                    },
                    true,
                );
            }

            let livestate = false;
            let livelabel = '';
            let connected = false;
            let suppressed = false;
            let talking = false;
            let currentRoom = null;
            for (const connection of this.connections) {
                if (connection.id && connection.id === account.id) {
                    connected = true;
                    if (
                        connection.livestate &&
                        connection.livelabel.length > 0
                    ) {
                        livestate = true;
                        livelabel = connection.livelabel;
                    }
                    if (connection.suppress) {
                        suppressed = true;
                    }
                    if (connection.talking) {
                        talking = true;
                    }
                    if (connection.currentRoom) {
                        currentRoom = connection.currentRoom;
                    }
                }
            }
            const user: User = {
                id: account.id,
                name: account.name,
                status: connected,
                avatar: account.avatar,
                hidden: account.hidden as boolean,
                suppress: suppressed,
                talking,
                livelabel,
                livestate,
                currentRoom,
            };
            return user;
        },

        updateUsers: async function () {
            // Create a client-usable copy of users
            // Add transient data, hide private
            const users: User[] = [];
            const in_users = await this.storage.getAllAccounts();
            if (!in_users) {
                throw new Error('No users in user list');
            }
            for (const account of in_users) {
                const user = this.getUser(account);
                users.push(user);
            }
            return users;
        },

        setRoom: async function (socket: rebuttalSocket, roomid: string) {
            // TODO sendToAll appears to not do what I'd want
            const room = await this.storage.getRoomByID(roomid);
            // Can only 'join' media rooms
            if (room && room.type !== 'voice') {
                return;
            }
            // Do action on same room
            if (roomid == socket.currentRoom) {
                return;
            }
            if (socket.currentRoom) {
                this.sendToAll(this.connections, {
                    type: 'leaveRoom',
                    userid: socket.id,
                    roomid: socket.currentRoom,
                });
            }
            socket.currentRoom = roomid;
            if (roomid) {
                this.sendToAll(this.connections, {
                    type: 'joinRoom',
                    userid: socket.id,
                    roomid: socket.currentRoom,
                });
            }
            await this.sendUpdateRooms();
        },

        updateRooms: async function () {
            // Create a client-usable copy of rooms
            // Add transient data
            const array: Room[] = [];
            const in_rooms = await this.storage.getAllRooms();
            if (!in_rooms) {
                throw new Error('Void rooms in update');
            }
            for (const room of in_rooms) {
                array.push({
                    id: room.id,
                    name: room.name,
                    type: room.type,
                    userlist: this.getUsersInRoom(room.id),
                });
            }

            return array;
        },

        getGroups: async function () {
            const list: PermissionsStorage = {};
            const in_groups = await this.storage.getGroups();
            if (!in_groups) {
                throw new Error('Void in get groups');
            }
            for (const group of in_groups) {
                const in_perm = await this.storage.getGroupPermissionList(
                    group,
                );
                if (!in_perm) {
                    throw new Error('Void in permissions');
                }
                list[group] = in_perm;
            }
            return list;
        },

        startConnection: function (ws: rebuttalSocket) {
            ws.protocol_version = 'v0';
            ws.on('close', () => {
                event.trigger('connectionclose', { ref: ws }).catch((e) => {
                    console.log(e);
                });
                // Can't cancel a disconnection
                if (ws.id) {
                    this.sendToAll(this.connections, {
                        type: 'disconnect',
                        userid: ws.id,
                    });
                    const index = this.connections.indexOf(ws);
                    if (index !== -1) {
                        this.connections.splice(index, 1);
                    }
                    this.sendUpdateRooms().catch((e) => {
                        console.log(e);
                    });
                    this.sendUpdateUsers().catch((e) => {
                        console.log(e);
                    });
                }
            });
            ws.on('message', (msg: string) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let data: any;
                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    data = JSON.parse(msg);
                } catch (e: unknown) {
                    if (typeof e === 'string') {
                        ws.close(3001, 'Invalid JSON : ' + e);
                    } else if (e instanceof Error) {
                        ws.close(3001, 'Invalid JSON : ' + e.message);
                    }
                    return;
                }
                switch (ws.protocol_version) {
                    case 'v0':
                        protocolv0.handle(this, ws, data).catch((e) => {
                            console.log(e);
                        });
                        break;
                    case 'v1':
                        protocolv1.handle(this, ws, data).catch((e) => {
                            console.log(e);
                        });
                        break;
                    default:
                        this.sendTo(ws, {
                            type: 'error',
                            message:
                                'Invalid protocol : "' +
                                ws.protocol_version +
                                '"',
                        });
                        ws.close(
                            3001,
                            'Invalid protocol : "' + ws.protocol_version + '"',
                        );
                }
            });
            let url = null;
            if ('url' in this.config) {
                url = this.config.url;
            }
            event
                .trigger('connectionnew', {
                    ref: ws,
                    welcomeObj: {
                        type: 'connect',
                        message: this.config.servername,
                        icon: this.config.serverimg,
                        url,
                        contextmenus: this.contextmenu,
                        protocols: this.protocols,
                    },
                })
                .catch((e) => {
                    console.log(e);
                });
        },
    };
    await rebuttal.populateNewConfig();
    // Prepare event system
    event.init();

    for (const plugin of plugins) {
        event
            .trigger('pluginprep', {
                pluginName: plugin.pluginName,
                ref: plugin,
            })
            .catch((e) => {
                console.log(e);
            });
        console.log(plugin);
        plugin.start(rebuttal).catch((e) => {
            console.log(e);
        });
        event
            .trigger('pluginstart', {
                pluginName: plugin.pluginName,
                ref: plugin,
            })
            .catch((e) => {
                console.log(e);
            });
    }

    event.trigger('serverprep', {}).catch((e) => {
        console.log(e);
    });
    rebuttal.init();

    event.trigger('serverstart', {}).catch((e) => {
        console.log(e);
    });

    return rebuttal;
}
