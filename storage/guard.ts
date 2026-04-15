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
const checker = createCheckers(types_iface, types_v1_shared);

type GuardStorageInterface = StorageInterface & {
    inner: StorageInterface,
};

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
export function createStorageGuard(inner: StorageInterface): GuardStorageInterface {
    return {
        inner,

        getRoomByID: async function (roomid) {
            if (roomid != null) {
                is_string(roomid);
            }
            const value = await this.inner.getRoomByID(roomid);
            if (value == null) { return null; }
            is_room(value);
            return value;
        },

        getAccountByLogin: async function (email, password) {
            is_string(email); // To do, email shape validate
            is_string(password);
            const value = await this.inner.getAccountByLogin(email, "");
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
            const value = await this.inner.getAccountByID(userid);
            if (value == null) { return null; }
            is_user(value);
            return value;
        },

        getAllRooms: async function () {
            const value = await this.inner.getAllRooms();
            is_room_list(value);
            return value;
        },

        getAllAccounts: async function () {
            const value = await this.inner.getAllAccounts();
            is_user_list(value);
            return value;
        },

        createAccount: async function (details: AccountStorage, password: string) {
            is_user(details);
            is_string(password);
            if (password.length < 10) {
                throw new Error("User password MUST be longer then 9 letters");
            }
            details.passwordHash = bcrypt.hashSync(password, 10);
            await this.inner.createAccount(details, "");
        },

        createRoom: async function (details) {
            is_room(details);
            await this.inner.createRoom(details);
        },

        updateAccount: async function (details) {
            is_user(details);
            await this.inner.updateAccount(details);
        },

        updateRoom: async function (details) {
            is_room(details);
            await this.inner.updateRoom(details);
        },

        removeAccount: async function (userid) {
            is_string(userid);
            await this.inner.removeAccount(userid);
        },

        removeRoom: async function (roomid) {
            is_string(roomid);
            await this.inner.removeRoom(roomid);
        },

        getTextForRoom: async function (uuid, segment) {
            is_string(uuid);
            is_idx(segment);
            const ret = await this.inner.getTextForRoom(uuid, segment);
            is_message_list(ret);
            return ret;
        },

        getTextRoomNewestSegment: async function (uuid) {
            is_string(uuid);
            const ret = await this.inner.getTextRoomNewestSegment(uuid);
            is_idx(ret);
            return ret;
        },

        addNewMessage: async function (roomid, message) {
            is_string(roomid);
            is_message(message);
            const ret = await this.inner.addNewMessage(roomid, message);
            is_idx(ret);
            return ret;
        },

        updateMessage: async function (contents) {
            is_message(contents);
            await this.inner.updateMessage(contents);
        },

        removeMessage: async function (roomid, messageid) {
            is_string(roomid);
            is_idx(messageid);
            await this.inner.removeMessage(roomid, messageid);
        },

        getMessage: async function (roomid, messageid) {
            is_string(roomid);
            is_idx(messageid);
            const ret = await this.inner.getMessage(roomid, messageid);
            if (ret == null) {
                return null;
            }
            is_message(ret);
            return ret;
        },

        getAccountPermission: async function (userid, permission) {
            is_string(userid);
            is_string(permission);
            const ret = await this.inner.getAccountPermission(userid, permission);
            is_bool(ret);
            return ret;
        },

        getGroupPermission: async function (groupname, permission) {
            is_string(groupname);
            is_string(permission);
            const ret = await this.inner.getGroupPermission(groupname, permission);
            is_bool(ret);
            return ret;
        },

        getGroupPermissionList: async function (groupname) {
            is_string(groupname);
            const ret = await this.inner.getGroupPermissionList(groupname);
            is_string_list(ret);
            return ret;
        },

        addGroupPermission: async function (groupname, permission) {
            is_string(groupname)
            is_string(permission);
            await this.inner.addGroupPermission(groupname, permission);
        },

        removeGroupPermission: async function (groupname, permission) {
            is_string(groupname);
            is_string(permission);
            await this.inner.removeGroupPermission(groupname, permission);
        },

        setAccountGroup: async function (userid, groupname) {
            is_string(userid);
            is_string(groupname);
            await this.inner.setAccountGroup(userid, groupname);
        },

        removeGroup: async function (groupname) {
            is_string(groupname);
            await this.inner.removeGroup(groupname);
        },

        createGroup: async function (groupname) {
            is_string(groupname);
            await this.inner.createGroup(groupname);
        },

        getGroups: async function () {
            const ret = await this.inner.getGroups();
            is_string_list(ret);
            return ret;
        },

        generateSignUp: async function (group, uuid) {
            is_string(group);
            is_string(uuid);
            await this.inner.generateSignUp(group, uuid);
        },

        expendSignUp: async function (uuid) {
            is_string(uuid);
            const ret = await this.inner.expendSignUp(uuid);
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
            await this.inner.updateAccount(user);
        },

        setPluginData: async function (
            pluginName,
            key,
            value,
        ) {
            is_string(pluginName);
            is_string(key);
            is_string(value);
            await this.inner.setPluginData(pluginName, key, value);
        },

        getPluginData: async function (pluginName, key) {
            is_string(pluginName);
            is_string(key);
            const ret = await this.inner.getPluginData(pluginName, key);
            if (ret == null) { return null; }
            is_string(ret);
            return ret;
        },

        getAllPluginData: async function (pluginName) {
            is_string(pluginName);
            const ret = await this.inner.getAllPluginData(pluginName);
            is_plugin_data(ret);
            return ret;
        },

        deletePluginData: async function (pluginName, key) {
            is_string(pluginName);
            is_string(key);
            await this.inner.deletePluginData(pluginName, key);
        },

        deleteAllPluginData: async function (pluginName) {
            is_string(pluginName);
            await this.inner.deleteAllPluginData(pluginName);
        },

        start: async function () {
            await this.inner.start();
        },


        exit: async function () {
            await this.inner.exit();
        },

        test_mode: async function () {
            await this.inner.test_mode();
        },
    }
};
