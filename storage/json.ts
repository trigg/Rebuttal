/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs';
import {
    type RoomStorage,
    type AccountStorage,
    type PermissionsStorage,
    type pluginData,
} from './types.ts';
import { type v1_shared_message_real } from '../protocols/v1/shared.ts';
import { type StorageInterface } from './interface.ts';

interface internalStorage {
    rooms: RoomStorage[];
    accounts: AccountStorage[];
    signUp: signUps;
    messages: RoomMessages;
    permissions: PermissionsStorage;
    plugin: plugins;
}

export interface RoomMessages {
    [key: string]: v1_shared_message_real[];
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

export async function jsonstorage(fileName: string | null) {
    let storage = {
        rooms: new Array<RoomStorage>(),
        accounts: new Array<AccountStorage>(),
        signUp: {},
        messages: {} as RoomMessages,
        permissions: {},
        plugin: {},
    } as internalStorage
    if (fileName) {
        if (fs.existsSync(fileName)) {
            storage = JSON.parse(
                fs.readFileSync(fileName).toString(),
            ) as internalStorage;
        } else {
            console.log("No file");
        }
    }
    const save = async function () {
        if (fileName !== null) {
            fs.writeFileSync(
                fileName,
                JSON.stringify(storage),
            );
        }
    };

    const jsonstorage: StorageInterface = {
        getRoomByID: async function (roomid) {
            let retroom = null;
            for (const room of storage.rooms) {
                if (room.id == roomid) {
                    retroom = room;
                }
            }
            return retroom;
        },

        getAccountByLogin: async function (email, _password) {
            for (const user of storage.accounts) {
                if (!user.passwordHash || user.passwordHash.length < 2) {
                    continue;
                }
                if (user.email == email) {
                    return user;
                }
            }
            return null;
        },

        getAccountByID: async function (userid) {
            let retuser = null;
            for (const user of storage.accounts) {
                if (user.id === userid) {
                    retuser = user;
                }
            }
            return retuser;
        },
        getAllRooms: async function () {
            return storage.rooms;
        },

        getAllAccounts: async function () {
            return storage.accounts;
        },

        createAccount: async function (details: AccountStorage, _password: string) {
            storage.accounts.push(details);
            await save();
        },

        createRoom: async function (details) {
            storage.rooms.push(details);
            await save();
        },

        updateAccount: async function (details) {
            await this.removeAccount(details.id);
            storage.accounts.push(details);
            await save();
        },

        updateRoom: async function (details) {
            await this.removeRoom(details.id);
            storage.rooms.push(details);
            await save();
        },

        removeAccount: async function (userid) {
            const user = await this.getAccountByID(userid);
            if (user) {
                const idx = storage.accounts.indexOf(user);
                storage.accounts.splice(idx, 1);
                await save();
            }
        },

        removeRoom: async function (roomid) {
            const room = await this.getRoomByID(roomid);
            if (room) {
                const idx = storage.rooms.indexOf(room);
                storage.rooms.splice(idx, 1);
                await save();
            }
        },

        getTextForRoom: async function (uuid, segment) {
            const start = segment * 5;
            const end = (segment + 1) * 5;
            if (!(uuid in storage.messages)) {
                return [];
            }
            return storage.messages[uuid].slice(start, end);
        },

        getTextRoomNewestSegment: async function (uuid) {
            throw new Error("unimplemented");
        },

        addNewMessage: async function (message) {
            if (!(message.roomid in storage.messages)) {
                storage.messages[message.roomid] = [];
            }
            storage.messages[message.roomid].push(message);
            await save();
        },

        getLastMessageIdx: async function (roomid) {
            if (!(roomid in storage.messages)) {
                storage.messages[roomid] = [];
            }
            return storage.messages[roomid].length - 1;
        },

        updateMessage: async function (contents) {
            if (contents.idx === null) {
                throw new Error("Invalid idx in messageUpdate");
            }
            storage.messages[contents.roomid][contents.idx] = contents;
            await save();
        },

        removeMessage: async function (_roomid, _messageid) {
            throw new Error("unimplemented");
        },

        getMessage: async function (roomid, messageid) {
            if (!(roomid in storage.messages)) {
                return null;
            }
            if (!(messageid in storage.messages[roomid])) {
                return null;
            }
            return storage.messages[roomid][messageid];
        },

        getAccountPermission: async function (userid, permission) {
            const user = await this.getAccountByID(userid);
            if (!user) {
                return false;
            }
            return await this.getGroupPermission(user.group, permission);
        },

        getGroupPermission: async function (groupname, permission) {
            let permList = storage.permissions[groupname];
            if (permList == undefined) {
                permList = storage.permissions[groupname] = [];
            }
            if (permList.indexOf(permission) > -1) {
                return true;
            }
            return false;
        },

        getGroupPermissionList: async function (groupname) {
            if (!(groupname in storage.permissions)) {
                return [];
            }
            return storage.permissions[groupname];
        },

        addGroupPermission: async function (groupname, permission) {
            if (!(groupname in storage.permissions)) {
                storage.permissions[groupname] = [];
            }
            const permList = storage.permissions[groupname];
            if (permList.indexOf(permission) == -1) {
                permList.push(permission);
                storage.permissions[groupname] = permList;
                await save();
            }
        },

        removeGroupPermission: async function (groupname, permission) {
            const permList = storage.permissions[groupname];
            storage.permissions[groupname] = permList.filter(
                (p) => p !== permission,
            );
            await save();
        },

        setAccountGroup: async function (userid, groupname) {
            const account = await this.getAccountByID(userid);
            if (account) {
                account.group = groupname;
                await this.updateAccount(account);
            }
        },

        removeGroup: async function (groupname) {
            delete storage.permissions[groupname];
        },

        createGroup: async function (groupname) {
            storage.permissions[groupname] = [];
        },

        getGroups: async function () {
            return Object.keys(storage.permissions);
        },

        generateSignUp: async function (group, uuid) {
            storage.signUp[uuid] = group;
            await save();
        },

        expendSignUp: async function (uuid) {
            if (uuid in storage.signUp) {
                const group = storage.signUp[uuid];
                delete storage.signUp[uuid];
                await save();
                return group;
            }
            return null;
        },

        setAccountPassword: async function (_userid, _password) {
            throw new Error("Unimplemented");
        },

        setPluginData: async function (
            pluginName,
            key,
            value,
        ) {
            if (!(pluginName in storage.plugin)) {
                storage.plugin[pluginName] = {};
            }
            storage.plugin[pluginName][key] = value;
            await save();
        },

        getPluginData: async function (pluginName, key) {
            if (!(pluginName in storage.plugin)) {
                return null;
            }
            if (!(key in storage.plugin[pluginName])) {
                return null;
            }
            return storage.plugin[pluginName][key];
        },

        getAllPluginData: async function (pluginName) {
            if (!(pluginName in storage.plugin)) {
                return {};
            }
            return storage.plugin[pluginName];
        },

        deletePluginData: async function (pluginName, key) {
            if (!(pluginName in storage.plugin)) {
                return;
            }
            delete storage.plugin[pluginName][key];
            await save();
        },

        deleteAllPluginData: async function (pluginName) {
            storage.plugin[pluginName] = {};
            await save();
        },

        exit: async function () {
            await save();
        },

    }
    return jsonstorage;
};
