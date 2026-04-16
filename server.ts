import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import gravatar from 'gravatar';

import { event, Priority, type Event } from './events.ts';
import { protocolv0 } from './handler/v0/p.ts';
import { protocolv1 } from './handler/v1/p.ts';

import { createStorageGuard } from './storage/guard.ts';
import { jsonstorage } from './storage/json.ts';
import { mysqlstorage } from './storage/mysql.ts';
import { sqlitestorage } from './storage/sqlite.ts';
import { type pluginInterface } from './plugin/interface.ts';
import {
    type PermissionsStorage,
    type AccountStorage,
} from './storage/types.ts';
import { type StorageInterface } from './storage/interface.ts';
import { env } from 'process';
import { v4 as uuidv4 } from 'uuid';
import { type v0_stc_packet } from './protocols/v0/server_to_client.ts';
import { type v1_stc_packet } from './protocols/v1/server_to_client.ts';
import { type v1_shared_room, type v1_shared_user, type UserUUID, type RoomUUID } from './protocols/v1/shared.ts';
import { createCheckers } from 'ts-interface-checker';
import v0_stc_iface from './protocols/v0/server_to_client-ti.ts';
import v0_shared_iface from './protocols/v0/shared-ti.ts';
import v1_stc_iface from './protocols/v1/server_to_client-ti.ts';
import v1_shared_iface from './protocols/v1/shared-ti.ts';

const checker = createCheckers(v0_stc_iface, v1_stc_iface, v1_shared_iface, v0_shared_iface);
type packet_all = v0_stc_packet | v1_stc_packet;

export interface config {
    storage: string;
    plugins: string[];
    certpath?: string;
    keypath?: string;
    port?: number;
    servername?: string;
    serverimg?: string;
    gravatarfallback?: string;
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
    id: UserUUID | null;
    currentRoom: RoomUUID | null;
    livestate: boolean;
    livelabel: string;
    name: string;
    talking: boolean;
    suppress: boolean;
};


export interface rebuttal {
    config: config;
    storage: StorageInterface;
    server: https.Server | http.Server;
    app: typeof express.application;
    protocols: string[];
    connections: rebuttalSocket[];
    port: number;
    contextmenu: contextMenus;

    listen(post: number, hostname: string, fn: () => void): void;
    close(fn: () => void): void;

    sendTo(ws: rebuttalSocket, msg: packet_all): void;
    sendToID(id: UserUUID, msg: packet_all): void;
    sendToAll(wsList: rebuttalSocket[], msg: packet_all, me?: rebuttalSocket): void;
    sendToRoom(id: RoomUUID, msg: packet_all): void;
    sendUpdateUsers(): Promise<void>;
    sendUpdateRooms(): Promise<void>;
    sendUpdatesMessages(id: RoomUUID): Promise<void>;
    disconnectId(id: UserUUID): void;

    isUserConnected(id: UserUUID): boolean;
    isUserSuppressed(id: UserUUID): boolean;
    setUserSuppressed(id: UserUUID, suppressed: boolean): void;
    isUserTalking(id: UserUUID): boolean;
    setUserTalking(id: UserUUID, talking: boolean): void;
    setRoom(socket: rebuttalSocket, id: RoomUUID | null): Promise<void>;
    getGroups(): Promise<PermissionsStorage>;

    chase(issues: unknown[]): void;

    presentCustomWindow(socket: rebuttalSocket, window: unknown): void; // TODO, Clean up, move to v1
}

export type rebuttalInternal = rebuttal & {
    wss: WebSocketServer;
    startConnection(ws: rebuttalSocket): void;
    populateNewConfig(): Promise<void>;
    init(): void;

    updateUsers(): Promise<v1_shared_user[]>;
    updateRooms(): Promise<v1_shared_room[]>;
    getUsersInRoom(id: RoomUUID): v1_shared_user[];
    getUser(acc: AccountStorage): v1_shared_user;
};

export async function create_rebuttal(config: config) {
    const app = express();
    app.use('/invite', express.static('invite'));
    const plugins: pluginInterface[] = [];
    let storage = null;
    if (config.test_mode) {
        storage = createStorageGuard(await jsonstorage(null));
    } else {
        switch (config['storage']) {
            case 'mysql':
                {
                    const username = process.env.REBUTTAL_MYSQL_USERNAME ? process.env.REBUTTAL_MYSQL_USERNAME : "rebuttal";
                    const password = process.env.REBUTTAL_MYSQL_PASSWORD ? process.env.REBUTTAL_MYSQL_PASSWORD : "rebuttal";
                    const database = process.env.REBUTTAL_MYSQL_DATABASE ? process.env.REBUTTAL_MYSQL_DATABASE : "rebuttal";
                    const host = process.env.REBUTTAL_MYSQL_HOST ? process.env.REBUTTAL_MYSQL_HOST : "localhosts";
                    storage = createStorageGuard(await mysqlstorage(username, password, database, host, false));
                }
                break;
            case 'sqlite':
                storage = createStorageGuard(await sqlitestorage("data/data.sqlite"));
                break;
            case 'json':
                storage = createStorageGuard(await jsonstorage("data/data.json"));
                break;
        }
    }
    if (storage === null) {
        throw new Error('no storage');
    }

    if ('plugins' in config) {
        for (const plugin of config['plugins']) {
            const pluginFileName = path.join('plugin', plugin + '.ts');
            if (fs.existsSync(pluginFileName)) {
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
    function create_server(app: typeof express.application) {
        if (env.HTTP) {
            if (env.HTTP == "1") {
                return http.createServer({}, app);
            } else if (env.HTTP != "0") {
                throw new Error("Environment Variable HTTP can only be '1' or '0'. '1' Allows Unsecured connections to server");
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
        return https.createServer(options, app);
    };
    const server = create_server(app);


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
                let password: string = uuidv4();
                console.log('Created Root account : root@localhost');
                if (env.REBUTTAL_ADMIN_PASSWORD && env.REBUTTAL_ADMIN_PASSWORD.length > 6) {
                    password = env.REBUTTAL_ADMIN_PASSWORD;
                } else {
                    console.log("Fallback randomly assigned password : " + password);
                    console.log("Make sure you reset this as soon as possible");
                }

                await this.storage.createAccount({
                    id: userUuid,
                    name: 'root',
                    passwordHash: '',
                    email: 'root@localhost',
                    group: 'admin',
                }, password);
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
                    position: 10,
                });

                const voiceUuid = uuidv4();
                await this.storage.createRoom({
                    id: voiceUuid,
                    name: 'Chat',
                    type: 'voice',
                    position: 5,
                });
            }
        },

        init: function () {
            this.wss.on('connection', (ws: rebuttalSocket) => {
                // Set all initial values
                ws.protocol_version = "";
                ws.id = null;
                ws.currentRoom = null;
                ws.livestate = false;
                ws.livelabel = "";
                ws.name = "";
                ws.talking = false;
                ws.suppress = false;
                rebuttal.startConnection(ws);
            });

            // TODO Populate client context menu

            // TODO FINAL events for most events.

            // Get FINAL event callbacks
            event.listen('connectionnew', Priority.FINAL, (event: Event) => {
                if (!event.cancelled) {
                    event.ref.send(JSON.stringify(event.welcomeObj));
                } else {
                    // TODO Decide what cancelling a new connection does
                }
            });
        },

        presentCustomWindow: function (ws: rebuttalSocket, window: unknown) {
            // TODO Check sanity of window before sending?
            this.sendTo(ws, { type: 'presentcustomwindow', window });
        },

        disconnectId: function (id: UserUUID) {
            for (const client of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (client.id === id) {
                    client.close();
                }
            }
        },

        sendToID: function (id: UserUUID, message: packet_all) {

            for (const client of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (client.id === id) {
                    this.sendTo(client, message);
                }
            }
        },
        sendTo: function (connection: rebuttalSocket, message: packet_all) {
            // TODO This checking is proabably too heavy and should be skipped in production
            const valid = checker.v1_stc_packet.validate(message) == null ||
                checker.v0_stc_packet.validate(message) == null;
            if (!valid) {
                console.log("v1 feedback");
                console.log(JSON.stringify(message, null, "  "))
                const issues = checker.v1_stc_packet.validate(message);
                if (issues != null) {
                    this.chase(issues);
                }
                console.log("v0 feedback");
                const issues2 = checker.v0_stc_packet.validate(message);
                if (issues2 != null) {
                    this.chase(issues2)
                }
                throw new Error("Attempting to send invalid packet");

            }
            connection.send(JSON.stringify(message));
        },

        sendToAll: function (
            clients: rebuttalSocket[],
            message: packet_all,
            ownsocket?: rebuttalSocket | null,
        ) {
            for (const client of clients) {
                if (!ownsocket || client !== ownsocket) {
                    this.sendTo(client, message);
                }
            }
        },

        sendToRoom: function (roomid: RoomUUID, message: packet_all) {
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

        sendUpdatesMessages: async function (roomid: RoomUUID) {
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

        getUsersInRoom: function (roomid: RoomUUID) {
            const users: v1_shared_user[] = [];
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === null) {
                    continue;
                }
                if (connection.currentRoom === roomid) {
                    const user: v1_shared_user = {
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

        isUserConnected: function (userid: UserUUID) {
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

        isUserSuppressed: function (userid: UserUUID) {
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

        setUserSuppressed: function (userid: UserUUID, suppress: boolean) {
            for (const connection of Object.values<rebuttalSocket>(
                this.connections,
            )) {
                if (connection.id === userid) {
                    connection.suppress = suppress;
                }
            }
        },

        isUserTalking: function (userid: UserUUID) {
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

        setUserTalking: function (userid: UserUUID, talking: boolean) {
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
            const user: v1_shared_user = {
                id: account.id,
                name: account.name,
                status: connected,
                avatar: account.avatar,
                hidden: account.hidden ? account.hidden : false,
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
            const users: v1_shared_user[] = [];
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

        setRoom: async function (socket: rebuttalSocket, roomid: RoomUUID) {
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
            if (socket.id == null) {
                console.log("User UUID invalid in setRoom");
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
            const array: v1_shared_room[] = [];
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
                    position: room.position
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
                let data: unknown;
                try {
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
            event
                .trigger('connectionnew', {
                    ref: ws,
                    welcomeObj: {
                        type: 'connect',
                        message: this.config.servername,
                        icon: this.config.serverimg,
                        protocols: this.protocols,
                    },
                })
                .catch((e) => {
                    console.log(e);
                });
        },
        chase: function (issues: unknown[]) {
            for (const issue of issues) {
                if (issue instanceof Object) {
                    if ('path' in issue && 'message' in issue) {
                        console.log((issue.path as string) + " " + (issue.message as string));
                    }
                    if ('nested' in issue) {
                        this.chase(issue.nested as unknown[]);
                    }
                }
            }
        }
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
