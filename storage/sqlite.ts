/* eslint-disable @typescript-eslint/require-await */
// Async is a requirement for Storage Interface. maybe later we'll get async/await sorted here, but for now ignore it

import bcrypt from 'bcryptjs';
import {
    type AccountStorage,
    type pluginData,
} from './types.ts';
import Sqlite, { type Database } from 'better-sqlite3';
import { type v1_shared_message_real } from '../protocols/v1/shared.ts';
import { type StorageInterface } from './interface.ts';

/* Minor differences exist */
interface sqlite_message {
    idx: number,
    roomid: string,
    text: string | null,
    url: string | null,
    userid: string | null,
    username: string | null,
    type: string | null,
    tags: string | null,
    img: string | null,
}

interface sqlite_room {
    name: string,
    type: string,
    id: string,
}

interface sqlite_user {
    id: string,
    name: string,
    email: string,
    passwordHash: string,
    avatar: string | null,
    groupid: string,
    hidden: number,
}

function sqluser_to_user(in_user: sqlite_user) {
    const account: AccountStorage = {
        id: in_user.id,
        name: in_user.name,
        passwordHash: in_user.passwordHash,
        email: in_user.email,
        group: in_user.groupid,
        avatar: (in_user.avatar && in_user.avatar.length > 0) ? in_user.avatar : undefined,
        hidden: in_user.hidden == 1 ? true : false,
    };
    return account;
}

function user_to_sqluser(in_user: AccountStorage) {
    const account: sqlite_user = {
        id: in_user.id,
        name: in_user.name,
        passwordHash: in_user.passwordHash,
        email: in_user.email,
        groupid: in_user.group,
        avatar: (in_user.avatar && in_user.avatar.length > 0) ? in_user.avatar : null,
        hidden: in_user.hidden ? 1 : 0,
    }
    return account;
}

function sqlmessage_to_message(in_msg: sqlite_message) {

    const tags = JSON.parse(in_msg.tags ? in_msg.tags : "[]") as string[];

    const message: v1_shared_message_real = {
        roomid: in_msg.roomid,
        idx: in_msg.idx,
        text: in_msg.text ? in_msg.text : "",
        img: in_msg.img,
        url: in_msg.url,
        height: null,
        width: null,
        userid: in_msg.userid,
        tags,
        type: in_msg.type,
        username: in_msg.username ? in_msg.username : ""
    }
    return message;
}

function message_to_sqlmessage(in_msg: v1_shared_message_real) {
    const tags = JSON.stringify(in_msg.tags);
    if (in_msg.idx == null) {
        throw new Error("SQL Messages may not have a null index");
    }
    const message: sqlite_message = {
        idx: in_msg.idx,
        roomid: in_msg.roomid,
        text: in_msg.text,
        url: in_msg.url,
        userid: in_msg.userid,
        username: in_msg.username,
        type: in_msg.type,
        tags,
        img: in_msg.img,
    };
    return message;
}

type SqliteStorageInterface = StorageInterface & {
    db: Database | null;
    fileName: string;
    prepare(): Promise<void>;
    createDatabase(): Promise<void>;
    stmtGetRoomsByID: Sqlite.Statement<{ id: string }, sqlite_room> | undefined,
    stmtGetAccountByLogin: Sqlite.Statement<{ email: string }, sqlite_user> | undefined,
    stmtGetAccountById: Sqlite.Statement<{ id: string }, sqlite_user> | undefined,
    stmtGetAllRooms: Sqlite.Statement<object, sqlite_room> | undefined,
    stmtGetAllAccounts: Sqlite.Statement<object, sqlite_user> | undefined,
    stmtCreateAccount: Sqlite.Statement<sqlite_user, void> | undefined,
    stmtCreateRoom: Sqlite.Statement<sqlite_room, void> | undefined,
    stmtUpdateAccount: Sqlite.Statement<sqlite_user, void> | undefined,
    stmtUpdateRoom: Sqlite.Statement<sqlite_room, void> | undefined,
    stmtRemoveAccount: Sqlite.Statement<{ id: string }, void> | undefined,
    stmtRemoveRoom: Sqlite.Statement<{ id: string }, void> | undefined,
    stmtGetTextForRoom: Sqlite.Statement<{ roomid: string, lower: number, upper: number }, sqlite_message> | undefined,
    stmtGetTextRoomNextSegment: Sqlite.Statement<{ roomid: string }, { count: number }> | undefined,
    stmtAddNewMessage: Sqlite.Statement<sqlite_message, void> | undefined,
    stmtUpdateMessage: Sqlite.Statement<sqlite_message, void> | undefined,
    stmtGetMessage: Sqlite.Statement<{ roomid: string, idx: number }, sqlite_message> | undefined,
    stmtGetGroupPermission: Sqlite.Statement<{ groupid: string, perm: string }, { groupid: string, perm: string }> | undefined
    stmtGetGroupPermissionList: Sqlite.Statement<{ groupid: string }, { perm: string }> | undefined
    stmtAddGroupPermission: Sqlite.Statement<{ perm: string, groupid: string }, void> | undefined
    stmtRemoveGroupPermission: Sqlite.Statement<{ groupid: string, perm: string }, void> | undefined
    stmtSetAccountGroup: Sqlite.Statement<{ groupid: string, id: string }, void> | undefined
    stmtGetGroups: Sqlite.Statement<object, { groupid: string }> | undefined
    stmtGenerateSignUp: Sqlite.Statement<{ groupid: string, id: string }, void> | undefined
    stmtGetSignUp: Sqlite.Statement<{ id: string }, { groupid: string, id: string }> | undefined
    stmtRemoveSignUp: Sqlite.Statement<{ id: string }, void> | undefined
    stmtGetPluginDataKey: Sqlite.Statement<{ pluginName: string, key: string }, { value: string }> | undefined
    stmtSetPluginDataKey: Sqlite.Statement<{ pluginName: string, key: string, value: string }, void> | undefined
    stmtGetPluginData: Sqlite.Statement<{ pluginName: string }, { key: string, value: string }> | undefined
    stmtDeletePluginDataKey: Sqlite.Statement<{ pluginName: string, key: string }, void> | undefined
    stmtDeletePluginData: Sqlite.Statement<{ pluginName: string }, void> | undefined
    stmtSetAccountPassword: Sqlite.Statement<{ passwordHash: string, id: string }, void> | undefined
};

/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 *
 * All data must be sanity checked in the core app.
 */
export const sqlitestorage: SqliteStorageInterface = {
    db: null,
    fileName: 'data/data.sqlite',
    stmtGetRoomsByID: undefined,
    stmtGetAccountByLogin: undefined,
    stmtGetAccountById: undefined,
    stmtGetAllRooms: undefined,
    stmtGetAllAccounts: undefined,
    stmtCreateAccount: undefined,
    stmtCreateRoom: undefined,
    stmtUpdateAccount: undefined,
    stmtUpdateRoom: undefined,
    stmtRemoveAccount: undefined,
    stmtRemoveRoom: undefined,
    stmtGetTextForRoom: undefined,
    stmtGetTextRoomNextSegment: undefined,
    stmtAddNewMessage: undefined,
    stmtUpdateMessage: undefined,
    stmtGetMessage: undefined,
    stmtGetGroupPermission: undefined,
    stmtGetGroupPermissionList: undefined,
    stmtAddGroupPermission: undefined,
    stmtRemoveGroupPermission: undefined,
    stmtSetAccountGroup: undefined,
    stmtGetGroups: undefined,
    stmtGenerateSignUp: undefined,
    stmtGetSignUp: undefined,
    stmtRemoveSignUp: undefined,
    stmtGetPluginDataKey: undefined,
    stmtSetPluginDataKey: undefined,
    stmtGetPluginData: undefined,
    stmtDeletePluginDataKey: undefined,
    stmtDeletePluginData: undefined,
    stmtSetAccountPassword: undefined,

    /**
     * Get room by UUID
     * @param {uuid} roomid
     * @returns room
     */
    getRoomByID: async function (roomid: string) {
        const room = sqlitestorage.stmtGetRoomsByID?.get({ id: roomid });
        if (!room) {
            return null;
        }
        return room;
    },

    /**
     * Get Account by login credentials
     * @param {string} email
     * @param {string} password
     * @returns
     */
    getAccountByLogin: async function (email, _password) {
        const raw_user = this.stmtGetAccountByLogin?.get({ email });
        if (!raw_user) {
            return null;
        }
        return sqluser_to_user(raw_user);
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {
        const raw_user = this.stmtGetAccountById?.get({ id: userid });
        if (!raw_user) {
            return null;
        }

        return sqluser_to_user(raw_user);
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: async function () {
        const value = this.stmtGetAllRooms?.all([]);
        if (!value) {
            throw new Error("Invalid Data");
        }
        return value;
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: async function () {

        const users = this.stmtGetAllAccounts?.all({});
        if (!users) {
            throw new Error("Invalid Storage");
        }
        return users.map((user) => {
            return sqluser_to_user(user);
        });
    },

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: async function (details: AccountStorage, _password: string) {
        this.stmtCreateAccount?.run(user_to_sqluser(details));
    },

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: async function (details) {
        this.stmtCreateRoom?.run(details);
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     *
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: async function (details) {
        this.stmtUpdateAccount?.run(user_to_sqluser(details));
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: async function (details) {
        this.stmtUpdateRoom?.run(details);
    },

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: async function (userid) {
        this.stmtRemoveAccount?.run({ id: userid });
    },

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: async function (roomid) {
        this.stmtRemoveRoom?.run({ id: roomid });
    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid
     * @param {int} segment
     */
    getTextForRoom: async function (uuid, segment) {
        const start = segment * 5;
        const end = (segment + 1) * 5;
        const a = this.stmtGetTextForRoom
            ?.all({ roomid: uuid, lower: start, upper: end })
            .map((message) => {
                return sqlmessage_to_message(message);
            });
        if (!a) {
            throw new Error("Invalid Data")
        }
        return a;
    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: async function (uuid) {
        const ret = this.stmtGetTextRoomNextSegment?.get({ roomid: uuid });
        if (!ret) {
            throw new Error("Invalid Data");
        }
        const a = ret['count'];
        let last = Math.floor((a - 1) / 5);
        if (last < 0 || isNaN(last)) {
            last = 0;
        }
        return last;
    },

    /**
     * Add a message to room
     *
     * @param {uuid} roomid
     * @param {object} message
     */
    addNewMessage: async function (roomid, message) {

        const ret = this.stmtGetTextRoomNextSegment?.get({ roomid });
        if (!ret) {
            throw new Error('Unknown last message');
        }
        const idx: number = ret['count'] + 1;
        message.idx = idx;
        this.stmtAddNewMessage?.run(message_to_sqlmessage(message));
        return idx;
    },

    /**
     * Change contents of message
     * @param {object} contents
     */
    updateMessage: async function (contents) {
        this.stmtUpdateMessage?.run(message_to_sqlmessage(contents));
    },

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
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
        const a = this.stmtGetMessage?.get({ roomid, idx: messageid });
        if (a) {
            return sqlmessage_to_message(a);
        }
        return null;
    },

    getAccountPermission: async function (userid, permission) {
        const user = await this.getAccountByID(userid);
        if (!user) {
            return false;
        }
        return await this.getGroupPermission(user.group, permission);
    },

    getGroupPermission: async function (groupid, perm) {
        const a = this.stmtGetGroupPermission?.all({ groupid, perm });
        if (!a) {
            return false;
        }
        return a.length > 0;
    },

    getGroupPermissionList: async function (groupid) {
        const list: string[] = [];
        const in_list =
            this.stmtGetGroupPermissionList?.all({ groupid });
        if (!in_list) {
            throw new Error('Undefined permission list from Sqlite');
        }

        for (const perm of in_list) {
            if (!('perm' in perm)) {
                throw new Error('Unknown permission value from Sqlite');
            }
            list.push(perm.perm);
        }
        return list;
    },

    addGroupPermission: async function (groupid, perm) {
        if ((await this.getGroupPermission(groupid, perm)) === false) {
            this.stmtAddGroupPermission?.run({ perm, groupid });
        }
    },

    removeGroupPermission: async function (groupid, perm) {
        this.stmtRemoveGroupPermission?.run({ groupid, perm });
    },

    setAccountGroup: async function (userid, groupid) {
        this.stmtSetAccountGroup?.run({ groupid, id: userid });
    },

    createGroup: async function (_groupname) {
        // NOOP
    },

    removeGroup: async function (groupname) {
        const list = await this.getGroupPermissionList(groupname);
        for (const perm of list) {
            await this.removeGroupPermission(groupname, perm);
        }
    },

    setAccountPassword: async function (userid, password) {
        const passwordHash = bcrypt.hashSync(password, 10);
        this.stmtSetAccountPassword?.run({ passwordHash, id: userid });
    },

    /**
     *
     * @returns List of group names
     */
    getGroups: async function () {
        const list: string[] = [];
        const ret = this.stmtGetGroups?.all({});
        if (!ret) {
            throw new Error("Invalid Data")
        }
        for (const group of ret) {
            list.push(group.groupid);
        }
        return list;
    },

    generateSignUp: async function (groupid, uuid) {
        this.stmtGenerateSignUp?.run({ groupid, id: uuid });
    },

    expendSignUp: async function (uuid) {

        const g = this.stmtGetSignUp?.get({ id: uuid });
        if (g) {
            this.stmtRemoveSignUp?.run({ id: uuid });
            return g.groupid;
        }
        return null;
    },

    /**
     * Create or update a key-value pair of data.
     * @param {string} pluginName
     * @param {string} key
     * @param {string} value
     */
    setPluginData: async function (pluginName, key, value) {
        this.stmtSetPluginDataKey?.run({ pluginName, key, value });
    },

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: async function (pluginName, key) {

        const data = this.stmtGetPluginDataKey?.get({ pluginName, key });
        if (!data) {
            return null;
        }
        return data['value'];
    },

    /**
     * Get all key/value pairs for a plugin
     * @param {string} pluginName
     * @returns associative array of key & values
     */
    getAllPluginData: async function (pluginName) {
        const data = this.stmtGetPluginData?.all({ pluginName });
        if (!data) {
            throw new Error("Invalid Data");
        }
        const mixed_data: pluginData = {};
        for (const datum of data) {
            mixed_data[datum.key] = datum.value;
        }
        return mixed_data;
    },

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: async function (pluginName, key) {
        this.stmtDeletePluginDataKey?.run({ pluginName, key });
    },

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: async function (pluginName) {
        this.stmtDeletePluginData?.run({ pluginName });
    },

    /**
     * Called at start of server
     */
    start: async function () {
        this.db = Sqlite(this.fileName);
        await sqlitestorage.prepare();
    },

    createDatabase: async function () {
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS user (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL,avatar TEXT,groupid TEXT NOT NULL,hidden INTEGER NOT NULL)',
        );
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS room (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL)',
        );
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS messages (idx INTEGER NOT NULL , roomid TEXT NOT NULL, text TEXT, url TEXT, userid TEXT, username TEXT, type TEXT, tags TEXT, img TEXT)',
        );
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS permission (perm TEXT NOT NULL, groupid TEXT NOT NULL)',
        );
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS signup (groupid TEXT NOT NULL, id TEXT NOT NULL UNIQUE)',
        );
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS plugin (pluginName TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (pluginName, key))',
        );
    },

    prepare: async function () {
        await this.createDatabase();
        this.stmtGetRoomsByID = this.db?.prepare(
            'SELECT name, type, id FROM room WHERE id = @id',
        );
        this.stmtGetAccountByLogin = this.db?.prepare(
            'SELECT id, name, email, passwordHash, avatar, groupid, hidden FROM user WHERE email = @email',
        );
        this.stmtGetAccountById = this.db?.prepare(
            'SELECT id, name, email, passwordHash, avatar, groupid, hidden FROM user WHERE id = @id',
        );
        this.stmtGetAllRooms = this.db?.prepare('SELECT id, name, type FROM room');
        this.stmtGetAllAccounts = this.db?.prepare('SELECT id, name, email, passwordHash, avatar, groupid, hidden FROM user');
        this.stmtCreateAccount = this.db?.prepare(
            'INSERT INTO user (id,name,email,passwordHash,avatar,groupid,hidden) VALUES (@id, @name, @email, @passwordHash, @avatar, @groupid, @hidden)',
        );
        this.stmtCreateRoom = this.db?.prepare(
            'INSERT INTO room (id,name,type) VALUES (@id, @name, @type)',
        );
        this.stmtUpdateAccount = this.db?.prepare(
            'UPDATE user SET name = @name, avatar = @avatar, groupid = @groupid, hidden = @hidden, passwordHash = @passwordHash WHERE id = @id ',
        );
        this.stmtUpdateRoom = this.db?.prepare(
            'UPDATE room SET name = @name, type = @type WHERE id = @id',
        );
        this.stmtRemoveAccount = this.db?.prepare(
            'DELETE FROM user WHERE id = @id',
        );
        this.stmtRemoveRoom = this.db?.prepare('DELETE FROM room where id = @id');
        this.stmtGetTextForRoom = this.db?.prepare(
            'SELECT idx, roomid, text, url, userid, username, type, tags, img FROM messages WHERE roomid = @roomid AND idx BETWEEN @lower AND @upper ORDER BY idx ASC LIMIT 5',
        );
        this.stmtGetTextRoomNextSegment = this.db?.prepare(
            'SELECT MAX(idx) AS `count`  FROM messages WHERE roomid = @roomid',
        );
        this.stmtAddNewMessage = this.db?.prepare(
            'INSERT INTO messages (idx, roomid, text, url, userid, username, type, tags, img) VALUES (@idx, @roomid, @text, @url, @userid, @username, @type, @tags, @img)',
        );
        this.stmtUpdateMessage = this.db?.prepare(
            'UPDATE messages SET text = @text, url = @url, type = @type, img = @img, userid = @userid, username = @username, tags = @tags WHERE roomid = @roomid and idx = @idx',
        );
        this.stmtGetGroupPermission = this.db?.prepare(
            'SELECT perm, groupid FROM permission WHERE groupid = @groupid AND perm = @perm',
        );
        this.stmtGetGroupPermissionList = this.db?.prepare(
            'SELECT perm FROM permission WHERE groupid = @groupid',
        );
        this.stmtAddGroupPermission = this.db?.prepare(
            'INSERT INTO permission (perm, groupid) VALUES (@perm, @groupid)',
        );
        this.stmtRemoveGroupPermission = this.db?.prepare(
            'DELETE FROM permission WHERE groupid = @groupid AND perm = @perm',
        );
        this.stmtSetAccountGroup = this.db?.prepare(
            'UPDATE user SET groupid = @groupid WHERE id = @id ',
        );
        this.stmtGetGroups = this.db?.prepare(
            'SELECT DISTINCT groupid FROM permission',
        );
        this.stmtGenerateSignUp = this.db?.prepare(
            'INSERT INTO signup (groupid, id) VALUES (@groupid, @id)',
        );
        this.stmtGetSignUp = this.db?.prepare(
            'SELECT groupid,id FROM signup WHERE id = @id',
        );
        this.stmtRemoveSignUp = this.db?.prepare(
            'DELETE FROM signup WHERE id = @id',
        );
        this.stmtGetPluginData = this.db?.prepare(
            'SELECT key, value FROM plugin WHERE pluginName = @pluginName',
        );
        this.stmtGetPluginDataKey = this.db?.prepare(
            'SELECT value FROM plugin WHERE pluginName = @pluginName AND key = @key',
        );
        this.stmtSetPluginDataKey = this.db?.prepare(
            'INSERT INTO plugin (pluginName, key, value) VALUES (@pluginName, @key, @value) ON CONFLICT(pluginName,key) DO UPDATE SET value = @value',
        );
        this.stmtDeletePluginData = this.db?.prepare(
            'DELETE FROM plugin where pluginName = @pluginName',
        );
        this.stmtDeletePluginDataKey = this.db?.prepare(
            'DELETE FROM plugin WHERE pluginName = @pluginName AND key = @key',
        );
        this.stmtSetAccountPassword = this.db?.prepare(
            'UPDATE user SET passwordHash = @passwordHash WHERE id = @id',
        );
        this.stmtGetMessage = this.db?.prepare(
            'SELECT idx, roomid, text, url, userid, username, type, tags, img from messages WHERE roomid = @roomid and idx = @idx',
        );
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: async function () {
        this.db?.close();
    },

    test_mode: async function () {
        this.fileName = '';
    },

};
export default sqlitestorage;
