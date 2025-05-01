/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs';
import bcrypt from 'bcrypt';
import {
    type RoomStorage,
    type AccountStorage,
    type StorageInterface,
    type MessageStorage,
    type PermissionsStorage,
} from './interface.ts';

type JsonStorageInterface = StorageInterface & {
    storage: internalStorage;
    fileName: string | null;
    save: () => Promise<void>;
};

interface internalStorage {
    rooms: RoomStorage[];
    accounts: AccountStorage[];
    signUp: signUps;
    messages: RoomMessages;
    permissions: PermissionsStorage;
    plugin: plugins;
}

export interface RoomMessages {
    [key: string]: MessageStorage[];
}

export interface signUps {
    [key: string]: string;
}

export interface permissions {
    [key: string]: string[];
}

export interface plugins {
    [key: string]: pluginData;
}

export interface pluginData {
    [key: string]: string;
}
/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 *
 * All data must be sanity checked in the core app.
 */
export const jsonstorage: JsonStorageInterface = {
    storage: {
        rooms: new Array<RoomStorage>(),
        accounts: new Array<AccountStorage>(),
        signUp: {},
        messages: {} as RoomMessages,
        permissions: {},
        plugin: {},
    } as internalStorage,
    fileName: 'test.json',

    getRoomByID: async function (roomid: string) {
        let retroom = null;
        for (const room of jsonstorage.storage.rooms) {
            if (room.id == roomid) {
                retroom = room;
            }
        }
        return retroom;
    },

    getAccountByLogin: async function (email: string, password: string) {
        let retuser = null;
        for (const user of jsonstorage.storage.accounts) {
            if (!user.password) {
                continue;
            }
            if (
                user.email == email &&
                bcrypt.compareSync(password, user.password)
            ) {
                retuser = user;
            }
        }
        return retuser;
    },

    getAccountByID: async function (userid: string) {
        let retuser = null;
        for (const user of jsonstorage.storage.accounts) {
            if (user.id === userid) {
                retuser = user;
            }
        }
        return retuser;
    },
    getAllRooms: async function () {
        return jsonstorage.storage.rooms;
    },

    getAllAccounts: async function () {
        return jsonstorage.storage.accounts;
    },

    createAccount: async function (details: AccountStorage) {
        if (!details.password) {
            throw new Error('No password in create account');
        }
        details.password = bcrypt.hashSync(details.password, 10);

        jsonstorage.storage.accounts.push(details);
        await jsonstorage.save();
    },

    createRoom: async function (details: RoomStorage) {
        jsonstorage.storage.rooms.push(details);
        await jsonstorage.save();
    },

    updateAccount: async function (userid: string, details: AccountStorage) {
        await jsonstorage.removeAccount(userid);
        details['id'] = userid;
        jsonstorage.storage.accounts.push(details);
        await jsonstorage.save();
    },

    updateRoom: async function (roomid: string, details: RoomStorage) {
        await jsonstorage.removeRoom(roomid);
        details['id'] = roomid;
        jsonstorage.storage.rooms.push(details);
        await jsonstorage.save();
    },

    removeAccount: async function (userid: string) {
        const user = await jsonstorage.getAccountByID(userid);
        if (user) {
            const idx = jsonstorage.storage.accounts.indexOf(user);
            jsonstorage.storage.accounts.splice(idx, 1);
            await jsonstorage.save();
        }
    },

    removeRoom: async function (roomid: string) {
        const room = await jsonstorage.getRoomByID(roomid);
        if (room) {
            const idx = jsonstorage.storage.rooms.indexOf(room);
            jsonstorage.storage.rooms.splice(idx, 1);
            await jsonstorage.save();
        }
    },

    getTextForRoom: async function (uuid, segment) {
        const start = segment * 5;
        const end = (segment + 1) * 5;
        if (!(uuid in jsonstorage.storage.messages)) {
            return [];
        }
        return jsonstorage.storage.messages[uuid].slice(start, end);
    },

    getTextRoomNewestSegment: async function (uuid) {
        if (uuid in jsonstorage.storage.messages) {
            const val = jsonstorage.storage.messages[uuid].length;
            if (val <= 0) {
                return 0;
            }
            return Math.floor((val - 1) / 5);
        }
        return 0;
    },

    addNewMessage: async function (roomid, message) {
        if (!(roomid in jsonstorage.storage.messages)) {
            jsonstorage.storage.messages[roomid] = [];
        }
        const idx = jsonstorage.storage.messages[roomid].length;
        message.idx = idx;
        message.roomid = roomid;
        jsonstorage.storage.messages[roomid].push(message);
        await jsonstorage.save();
    },

    updateMessage: async function (roomid, messageid, contents) {
        jsonstorage.storage.messages[roomid][messageid] = contents;
        await jsonstorage.save();
    },

    removeMessage: async function (roomid, messageid) {
        jsonstorage.storage.messages[roomid][messageid]['text'] =
            '*Message Removed*';
        jsonstorage.storage.messages[roomid][messageid]['userid'] = null;

        await jsonstorage.save();
    },

    getMessage: async function (roomid, messageid) {
        if (!(roomid in jsonstorage.storage.messages)) {
            return null;
        }
        if (!(messageid in jsonstorage.storage.messages[roomid])) {
            return null;
        }
        return jsonstorage.storage.messages[roomid][messageid];
    },

    getAccountPermission: async function (userid, permission) {
        const user = await jsonstorage.getAccountByID(userid);
        if (!user) {
            return false;
        }
        return await jsonstorage.getGroupPermission(user.group, permission);
    },

    getGroupPermission: async function (groupname, permission) {
        let permList = jsonstorage.storage.permissions[groupname];
        if (permList == undefined) {
            permList = jsonstorage.storage.permissions[groupname] = [];
        }
        if (permList.indexOf(permission) > -1) {
            return true;
        }
        return false;
    },

    getGroupPermissionList: async function (groupname) {
        return jsonstorage.storage.permissions[groupname];
    },

    addGroupPermission: async function (groupname, permission) {
        if (!(groupname in jsonstorage.storage.permissions)) {
            jsonstorage.storage.permissions[groupname] = [];
        }
        const permList = jsonstorage.storage.permissions[groupname];
        if (permList.indexOf(permission) == -1) {
            permList.push(permission);
            jsonstorage.storage.permissions[groupname] = permList;
            await jsonstorage.save();
        }
    },

    removeGroupPermission: async function (groupname, permission) {
        const permList = jsonstorage.storage.permissions[groupname];
        jsonstorage.storage.permissions[groupname] = permList.filter(
            (p) => p !== permission,
        );
        await jsonstorage.save();
    },

    setAccountGroup: async function (userid, groupname) {
        const account = await jsonstorage.getAccountByID(userid);
        if (account) {
            account.group = groupname;
            await jsonstorage.updateAccount(userid, account);
        }
    },

    removeGroup: async function (groupname) {
        delete jsonstorage.storage.permissions[groupname];
    },

    createGroup: async function (groupname) {
        jsonstorage.storage.permissions[groupname] = [];
    },

    getGroups: async function () {
        return Object.keys(jsonstorage.storage.permissions);
    },

    generateSignUp: async function (group, uuid) {
        jsonstorage.storage.signUp[uuid] = group;
        await jsonstorage.save();
    },

    expendSignUp: async function (uuid) {
        if (uuid in jsonstorage.storage.signUp) {
            const group = jsonstorage.storage.signUp[uuid];
            delete jsonstorage.storage.signUp[uuid];
            await jsonstorage.save();
            return group;
        }
        return null;
    },

    setAccountPassword: async function (userid, password) {
        const hash = bcrypt.hashSync(password, 10);
        const user = await jsonstorage.getAccountByID(userid);
        if (user) {
            user.password = hash;
            await jsonstorage.save();
        }
    },

    setPluginData: async function (
        pluginName: string,
        key: string,
        value: string,
    ) {
        if (!(pluginName in jsonstorage.storage.plugin)) {
            jsonstorage.storage.plugin[pluginName] = {};
        }
        jsonstorage.storage.plugin[pluginName][key] = value;
        await jsonstorage.save();
    },

    getPluginData: async function (pluginName, key) {
        if (!(pluginName in jsonstorage.storage.plugin)) {
            return null;
        }
        if (!(key in jsonstorage.storage.plugin[pluginName])) {
            return null;
        }
        return jsonstorage.storage.plugin[pluginName][key];
    },

    getAllPluginData: async function (pluginName) {
        if (!(pluginName in jsonstorage.storage.plugin)) {
            return {};
        }
        return jsonstorage.storage.plugin[pluginName];
    },

    deletePluginData: async function (pluginName: string, key: string) {
        if (!(pluginName in jsonstorage.storage.plugin)) {
            return;
        }
        delete jsonstorage.storage.plugin[pluginName][key];
        await jsonstorage.save();
    },

    deleteAllPluginData: async function (pluginName) {
        jsonstorage.storage.plugin[pluginName] = {};
        await jsonstorage.save();
    },

    start: async function () {
        if (jsonstorage.fileName) {
            if (fs.existsSync(jsonstorage.fileName)) {
                jsonstorage.storage = JSON.parse(
                    fs.readFileSync(jsonstorage.fileName).toString(),
                ) as internalStorage;
            }
        }
    },

    save: async function () {
        if (jsonstorage.fileName !== null) {
            fs.writeFileSync(
                jsonstorage.fileName,
                JSON.stringify(jsonstorage.storage),
            );
        }
    },

    exit: async function () {
        await jsonstorage.save();
    },

    test_mode: async function () {
        jsonstorage.fileName = null;
    },

    test_passalong: async function (f) {
        f();
    },
} as JsonStorageInterface;

export default jsonstorage;
