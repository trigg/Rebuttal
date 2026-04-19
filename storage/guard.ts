import {
    type pluginData,
    type RoomStorage,
    type AccountStorage,
    type string_list,
    type bool,
    type idx,
    type str,
} from './types.ts';
import { type StorageInterface } from './interface.ts';
import { createCheckers } from 'ts-interface-checker';
import types_iface from './types-ti.ts';
import { type v1_shared_message_real } from '../protocols/v1/shared.ts';
import types_v1_shared from '../protocols/v1/shared-ti.ts';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { type config } from '../server.ts';
const checker = createCheckers(types_iface, types_v1_shared);

function is_message(input: unknown): input is v1_shared_message_real {
    checker.v1_shared_message_real.check(input);
    return true;
}

function is_message_list(input: unknown[]): input is v1_shared_message_real[] {
    for (const val of input) {
        checker.v1_shared_message_real.check(val);
    }
    return true;
}
function is_room(input: unknown): input is RoomStorage {
    checker.RoomStorage.check(input);
    return true;
}

function is_user(input: unknown): input is AccountStorage {
    checker.AccountStorage.check(input);
    return true;
}

function is_plugin_data(input: unknown): input is pluginData {
    checker.pluginData.check(input);
    return true;
}

function is_room_list(input: unknown[]): input is RoomStorage[] {
    for (const val of input) {
        checker.RoomStorage.check(val);
    }
    return true;
}

function is_user_list(input: unknown[]): input is AccountStorage[] {
    for (const val of input) {
        checker.AccountStorage.check(val);
    }
    return true;
}

function is_string_list(input: unknown): input is string_list {
    checker.string_list.check(input);
    return true;
}

function is_bool(input: unknown): input is bool {
    checker.bool.check(input);
    return true;
}

function is_idx(input: unknown): input is idx {
    checker.idx.check(input);
    return true;
}

function is_string(input: unknown): input is str {
    checker.str.check(input);
    return true;
}

/**
 * A Sanity checking layer between storage and server.
 * 
 * Saves writing (or typoing) the same checks for every storage medium
 */
export function createStorageGuard(inner: StorageInterface, server_config: config): StorageInterface {

    function defaultAvatar(details: AccountStorage) {
        const fallback = server_config.gravatarfallback ? server_config.gravatarfallback : "monsterid"
        if (!details.avatar) {
            const gravatarHash = crypto.createHash("sha256")
                .update(details.email.trim().toLowerCase())
                .digest('hex');
            const gravatarurl = "https://0.gravatar.com/avatar/" + gravatarHash + "?s=128&d=" + fallback;
            details.avatar = gravatarurl;
        }
    }
    return {

        getRoomByID: async function (roomid) {
            if (roomid != null) {
                is_string(roomid);
            }
            const value = await inner.getRoomByID(roomid);
            if (value == null) { return null; }
            is_room(value);
            return value;
        },

        getAccountByLogin: async function (email, password) {
            is_string(email); // To do, email shape validate
            is_string(password);
            if (password.length < 10) {
                throw new Error("User password MUST be longer then 9 letters");
            }
            const value = await inner.getAccountByLogin(email, "");
            if (value == null) {
                return null;
            }
            is_user(value);
            /* Actual check that the login is valid. Saves doing it wrong in each storage */
            if (
                value.email == email &&
                bcrypt.compareSync(password, value.passwordHash)
            ) {
                return value;
            }
            return null;
        },

        getAccountByID: async function (userid) {
            is_string(userid);
            const value = await inner.getAccountByID(userid);
            if (value == null) { return null; }
            is_user(value);
            return value;
        },

        getAllRooms: async function () {
            const value = await inner.getAllRooms();
            is_room_list(value);
            /* Sorting needs to be consistent */
            value.sort((a, b) => a.position - b.position);

            return value;
        },

        getAllAccounts: async function () {
            const value = await inner.getAllAccounts();
            is_user_list(value);
            return value;
        },

        createAccount: async function (details: AccountStorage, password: string) {
            is_user(details);
            is_string(password);
            if (password.length < 10) {
                throw new Error("User password MUST be longer then 9 letters");
            }
            if (details.name.length < 3) {
                throw new Error("User name MUST be longer than 2 characters");
            }
            details.passwordHash = bcrypt.hashSync(password, 10);
            defaultAvatar(details);
            await inner.createAccount(details, "");
        },

        createRoom: async function (details) {
            is_room(details);
            await inner.createRoom(details);
        },

        updateAccount: async function (details) {
            is_user(details);
            if (details.name.length < 3) {
                throw new Error("User name MUST be longer than 2 characters");
            }
            defaultAvatar(details);
            await inner.updateAccount(details);
        },

        updateRoom: async function (details) {
            is_room(details);
            await inner.updateRoom(details);
        },

        removeAccount: async function (userid) {
            is_string(userid);
            await inner.removeAccount(userid);
        },

        removeRoom: async function (roomid) {
            is_string(roomid);
            await inner.removeRoom(roomid);
        },

        getTextForRoom: async function (uuid, segment) {
            is_string(uuid);
            is_idx(segment);
            const ret = await inner.getTextForRoom(uuid, segment);
            is_message_list(ret);
            return ret;
        },

        getTextRoomNewestSegment: async function (uuid) {
            is_string(uuid);
            const value = await this.getLastMessageIdx(uuid);
            if (value === null || value <= 0) {
                return 0;
            }
            return Math.floor((value - 1) / 5);
        },

        addNewMessage: async function (message) {
            is_message(message);
            if (!message.roomid) {
                throw new Error("Invalid new message without roomid");
            }

            const roomid = message.roomid;
            const idx: number | null = await inner.getLastMessageIdx(roomid);
            if (idx == null) {
                message.idx = 0;
            } else {
                message.idx = idx + 1;
            }
            await inner.addNewMessage(message);
        },

        getLastMessageIdx: async function (id) {
            is_string(id);
            const val = await inner.getLastMessageIdx(id);
            if (val == null) { return null; }
            is_idx(val);
            return val;
        },

        updateMessage: async function (contents) {
            is_message(contents);
            await inner.updateMessage(contents);
        },

        removeMessage: async function (roomid, messageid) {
            await this.updateMessage({
                text: '*Message Removed*',
                userid: null,
                roomid: roomid,
                idx: messageid,
                img: null,
                url: null,
                height: null,
                width: null,
                tags: [],
                type: null,
                username: ''
            });
        },

        getMessage: async function (roomid, messageid) {
            is_string(roomid);
            is_idx(messageid);
            const ret = await inner.getMessage(roomid, messageid);
            if (ret == null) {
                return null;
            }
            is_message(ret);
            return ret;
        },

        getAccountPermission: async function (userid, permission) {
            is_string(userid);
            is_string(permission);
            const user = await this.getAccountByID(userid);
            if (!user) {
                return false;
            }
            const ret = await this.getGroupPermission(user.group, permission);
            is_bool(ret);
            return ret;
        },

        getGroupPermission: async function (groupname, permission) {
            is_string(groupname);
            is_string(permission);
            const ret = await inner.getGroupPermission(groupname, permission);
            is_bool(ret);
            return ret;
        },

        getGroupPermissionList: async function (groupname) {
            is_string(groupname);
            const ret = await inner.getGroupPermissionList(groupname);
            is_string_list(ret);
            return ret;
        },

        addGroupPermission: async function (groupname, permission) {
            is_string(groupname)
            is_string(permission);
            if ((await this.getGroupPermission(groupname, permission)) === false) {

                await inner.addGroupPermission(groupname, permission);
            }
        },

        removeGroupPermission: async function (groupname, permission) {
            is_string(groupname);
            is_string(permission);
            await inner.removeGroupPermission(groupname, permission);
        },

        setAccountGroup: async function (userid, groupname) {
            is_string(userid);
            is_string(groupname);
            await inner.setAccountGroup(userid, groupname);
        },

        removeGroup: async function (groupname) {
            is_string(groupname);
            await inner.removeGroup(groupname);
        },

        createGroup: async function (groupname) {
            is_string(groupname);
            await inner.createGroup(groupname);
        },

        getGroups: async function () {
            const ret = await inner.getGroups();
            console.log(ret);
            is_string_list(ret);
            return ret;
        },

        generateSignUp: async function (group, uuid) {
            is_string(group);
            is_string(uuid);
            await inner.generateSignUp(group, uuid);
        },

        expendSignUp: async function (uuid) {
            is_string(uuid);
            const ret = await inner.expendSignUp(uuid);
            if (ret == null) { return null; }
            is_string(ret);
            return ret;
        },

        setAccountPassword: async function (userid, password) {
            is_string(userid);
            is_string(password);
            if (password.length < 10) {
                throw new Error("User password MUST be longer then 9 letters");
            }
            const user = await this.getAccountByID(userid);
            if (user == null) {
                return;
            }
            user.passwordHash = bcrypt.hashSync(password, 10);
            await inner.updateAccount(user);
        },

        setPluginData: async function (
            pluginName,
            key,
            value,
        ) {
            is_string(pluginName);
            is_string(key);
            is_string(value);
            await inner.setPluginData(pluginName, key, value);
        },

        getPluginData: async function (pluginName, key) {
            is_string(pluginName);
            is_string(key);
            const ret = await inner.getPluginData(pluginName, key);
            if (ret == null) { return null; }
            is_string(ret);
            return ret;
        },

        getAllPluginData: async function (pluginName) {
            is_string(pluginName);
            const ret = await inner.getAllPluginData(pluginName);
            is_plugin_data(ret);
            return ret;
        },

        deletePluginData: async function (pluginName, key) {
            is_string(pluginName);
            is_string(key);
            await inner.deletePluginData(pluginName, key);
        },

        deleteAllPluginData: async function (pluginName) {
            is_string(pluginName);
            await inner.deleteAllPluginData(pluginName);
        },

        exit: async function () {
            await inner.exit();
        }
    }
};
