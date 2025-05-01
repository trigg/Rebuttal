/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
// Async is a requirement for Storage Interface. maybe later we'll get async/await sorted here, but for now ignore it

import bcrypt from 'bcrypt';
import {
    type RoomStorage,
    type MessageStorage,
    type StorageInterface,
    type AccountStorage,
} from './interface.ts';
import Sqlite, { type Database } from 'better-sqlite3';

type SqliteStorageInterface = StorageInterface & {
    db: Database | null;
    fileName: string;
    prepare(): Promise<void>;
    createDatabase(): Promise<void>;
    stmtGetRoomsByID:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetAccountByLogin:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetAccountById:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetAllRooms:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetAllAccounts:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtCreateAccount:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtCreateRoom:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtUpdateAccount:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtUpdateRoom:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtRemoveAccount:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtRemoveRoom:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetTextForRoom:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetTextRoomNextSegment:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtAddNewMessage:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtUpdateMessage:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetMessage:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetGroupPermission:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetGroupPermissionList:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtAddGroupPermission:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtRemoveGroupPermission:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtSetAccountGroup:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetGroups:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGenerateSignUp:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetSignUp:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtRemoveSignUp:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetPluginDataKey:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtSetPluginDataKey:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtGetPluginData:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtDeletePluginDataKey:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtDeletePluginData:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
    stmtSetAccountPassword:
        | Sqlite.Statement<unknown[], unknown>
        | Sqlite.Statement<[{}], unknown>
        | undefined;
};

/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 *
 * All data must be sanity checked in the core app.
 */
export const sqlitestorage: SqliteStorageInterface = {
    db: null,
    fileName: 'data.sqlite',
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
        const room = sqlitestorage.stmtGetRoomsByID?.get([
            roomid,
        ]) as RoomStorage;
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
    getAccountByLogin: async function (email, password) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw_user: any = this.stmtGetAccountByLogin?.get([email]);
        if (!raw_user) {
            return null;
        }
        raw_user.group = raw_user.groupid;
        const user = raw_user as AccountStorage;
        if (!user.password) {
            return null;
        }
        // SQL would not accept 'group' as field name
        if (bcrypt.compareSync(password, user.password)) {
            return user;
        }
        return null;
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw_user: any = this.stmtGetAccountById?.get(userid);
        if (!raw_user) {
            return null;
        }
        raw_user.group = raw_user.groupid;
        const user = raw_user as AccountStorage;
        return user;
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: async function () {
        return this.stmtGetAllRooms?.all([]) as RoomStorage[];
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: async function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = this.stmtGetAllAccounts?.all([]).filter((user: any) => {
            user.group = user.groupid;
            delete user.groupid;
            return true;
        }) as AccountStorage[];
        return users;
    },

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: async function (details: AccountStorage) {
        if (!details.password) {
            throw new Error('user must have a password');
        }
        const hash = bcrypt.hashSync(details.password, 10);
        if (!('hidden' in details)) {
            details.hidden = false;
        }
        this.stmtCreateAccount?.run([
            details.id,
            details.name,
            details.email,
            hash,
            details.avatar ? details.avatar : null,
            details.group,
            details.hidden ? 1 : 0,
        ]);
    },

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: async function (details) {
        this.stmtCreateRoom?.run([details.id, details.name, details.type]);
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     *
     * Do not pass in details.password if you want to keep current password
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: async function (userid, details) {
        this.stmtUpdateAccount?.run([
            details.name,
            details.avatar ? details.avatar : null,
            details.group,
            userid,
        ]);
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: async function (roomid, details) {
        this.stmtUpdateRoom?.run([details.name, details.type, roomid]);
    },

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: async function (userid) {
        this.stmtRemoveAccount?.run([userid]);
    },

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: async function (roomid) {
        this.stmtRemoveRoom?.run([roomid]);
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
            ?.all([uuid, start, end])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((message: any) => {
                message.tags = JSON.parse(message.tags);
                return true;
            }) as MessageStorage[];

        return a;
    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: async function (uuid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ret: any = this.stmtGetTextRoomNextSegment?.get([uuid]); // Gets the highest message index for room
        const a = ret['count'];
        console.log(ret);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ret: any = this.stmtGetTextRoomNextSegment?.get([roomid]);
        if (!ret) {
            throw new Error('Unknown last message');
        }
        const idx = ret['count'];
        this.stmtAddNewMessage?.run([
            idx + 1,
            roomid,
            message.text,
            message.url ? message.url : null,
            message.userid ? message.userid : null,
            message.username ? message.username : null,
            message.type ? message.type : null,
            JSON.stringify(message.tags),
            message.img ? message.img : null,
        ]);
    },

    /**
     * Change contents of message
     * @param {uuid} roomid
     * @param {int} messageid
     * @param {object} contents
     */
    updateMessage: async function (roomid, messageid, contents) {
        this.stmtUpdateMessage?.run([
            contents.text,
            contents.url ? contents.url : null,
            contents.type ? contents.type : null,
            contents.img ? contents.img : null,
            contents.userid ? contents.userid : null,
            roomid,
            messageid,
        ]);
    },

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
    removeMessage: async function (roomid, messageid) {
        await this.updateMessage(roomid, messageid, {
            text: '*Message Removed*',
            userid: null,
        } as MessageStorage);
    },

    getMessage: async function (roomid, messageid) {
        const a = this.stmtGetMessage?.get([roomid, messageid]);
        if (a) {
            return a as MessageStorage;
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

    getGroupPermission: async function (groupname, permission) {
        const a = this.stmtGetGroupPermission?.all([groupname, permission]);
        if (!a) {
            return false;
        }
        return a.length > 0;
    },

    getGroupPermissionList: async function (groupname) {
        const list: string[] = [];
        const in_list: unknown[] | undefined =
            this.stmtGetGroupPermissionList?.all([groupname]);
        if (!in_list) {
            throw new Error('Undefined permission list from Sqlite');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const perm of in_list as any[]) {
            if (!('perm' in perm)) {
                throw new Error('Unknown permission value from Sqlite');
            }
            list.push(perm.perm);
        }
        return list;
    },

    addGroupPermission: async function (groupname, permission) {
        if ((await this.getGroupPermission(groupname, permission)) === false) {
            this.stmtAddGroupPermission?.run([permission, groupname]);
        }
    },

    removeGroupPermission: async function (groupname, permission) {
        this.stmtRemoveGroupPermission?.run([groupname, permission]);
    },

    setAccountGroup: async function (userid, groupname) {
        this.stmtSetAccountGroup?.run([groupname, userid]);
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const hash = bcrypt.hashSync(password, 10);
        this.stmtSetAccountPassword?.run([hash, userid]);
    },

    /**
     *
     * @returns List of group names
     */
    getGroups: async function () {
        const list: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const group of this.stmtGetGroups?.all([]) as any[]) {
            list.push(group.groupid);
        }
        return list;
    },

    generateSignUp: async function (group, uuid) {
        this.stmtGenerateSignUp?.run([group, uuid]);
    },

    expendSignUp: async function (uuid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = this.stmtGetSignUp?.get([uuid]) as any;
        if (g) {
            this.stmtRemoveSignUp?.run(uuid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
        this.stmtSetPluginDataKey?.run([pluginName, key, value, value]);
    },

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: async function (pluginName, key) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = this.stmtGetPluginDataKey?.get([pluginName, key]) as any;
        if (!data) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return data['value'];
    },

    /**
     * Get all key/value pairs for a plugin
     * @param {string} pluginName
     * @returns associative array of key & values
     */
    getAllPluginData: async function (pluginName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = this.stmtGetPluginData?.all(pluginName) as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ret: any = {};
        for (const row of data) {
            const index = row['key'] as string;
            ret[index] = row['value'];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return ret;
    },

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: async function (pluginName, key) {
        this.stmtDeletePluginDataKey?.run([pluginName, key]);
    },

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: async function (pluginName) {
        this.stmtDeletePluginData?.run([pluginName]);
    },

    /**
     * Called at start of server
     */
    start: async function () {
        this.db = Sqlite(this.fileName);
        await sqlitestorage.prepare();
    },

    createDatabase: async function () {
        console.log('CREATING DATABASE');
        this.db?.exec(
            'CREATE TABLE IF NOT EXISTS user (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,avatar TEXT,groupid TEXT NOT NULL,hidden INTEGER NOT NULL)',
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
            'SELECT * FROM room WHERE id = ?',
        );
        this.stmtGetAccountByLogin = this.db?.prepare(
            'SELECT * FROM user WHERE email = ?',
        );
        this.stmtGetAccountById = this.db?.prepare(
            'SELECT * FROM user WHERE id = ?',
        );
        this.stmtGetAllRooms = this.db?.prepare('SELECT * FROM room');
        this.stmtGetAllAccounts = this.db?.prepare('SELECT * FROM user');
        this.stmtCreateAccount = this.db?.prepare(
            'INSERT INTO user (id,name,email,password,avatar,groupid,hidden) VALUES (?, ? ,?, ?, ?, ?, ?)',
        );
        this.stmtCreateRoom = this.db?.prepare(
            'INSERT INTO room (id,name,type) VALUES (?, ?, ?)',
        );
        this.stmtUpdateAccount = this.db?.prepare(
            'UPDATE user SET name = ?, avatar = ?, groupid = ? WHERE id = ? ',
        );
        this.stmtUpdateRoom = this.db?.prepare(
            'UPDATE room SET name = ?, type = ? WHERE id = ?',
        );
        this.stmtRemoveAccount = this.db?.prepare(
            'DELETE FROM user WHERE id = ?',
        );
        this.stmtRemoveRoom = this.db?.prepare('DELETE FROM room where id = ?');
        this.stmtGetTextForRoom = this.db?.prepare(
            'SELECT * FROM messages WHERE roomid = ? AND idx BETWEEN ? AND ? ORDER BY idx ASC LIMIT 5',
        );
        this.stmtGetTextRoomNextSegment = this.db?.prepare(
            'SELECT MAX(idx) AS `count`  FROM messages WHERE roomid = ?',
        );
        this.stmtAddNewMessage = this.db?.prepare(
            'INSERT INTO messages (idx, roomid, text, url, userid, username, type, tags, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        );
        this.stmtUpdateMessage = this.db?.prepare(
            'UPDATE messages SET text=?, url=?, type=?, img=?, userid = ? WHERE roomid = ? and idx = ?',
        );
        this.stmtGetGroupPermission = this.db?.prepare(
            'SELECT * FROM permission WHERE groupid = ? AND perm = ?',
        );
        this.stmtGetGroupPermissionList = this.db?.prepare(
            'SELECT perm FROM permission WHERE groupid = ?',
        );
        this.stmtAddGroupPermission = this.db?.prepare(
            'INSERT INTO permission (perm, groupid) VALUES (?, ?)',
        );
        this.stmtRemoveGroupPermission = this.db?.prepare(
            'DELETE FROM permission WHERE groupid = ? AND perm = ?',
        );
        this.stmtSetAccountGroup = this.db?.prepare(
            'UPDATE user SET groupid = ? WHERE id = ?',
        );
        this.stmtGetGroups = this.db?.prepare(
            'SELECT DISTINCT groupid FROM permission',
        );
        this.stmtGenerateSignUp = this.db?.prepare(
            'INSERT INTO signup (groupid, id) VALUES (?, ?)',
        );
        this.stmtGetSignUp = this.db?.prepare(
            'SELECT groupid,id FROM signup WHERE id = ?',
        );
        this.stmtRemoveSignUp = this.db?.prepare(
            'DELETE FROM signup WHERE id = ?',
        );
        this.stmtGetPluginData = this.db?.prepare(
            'SELECT key, value FROM plugin WHERE pluginName = ?',
        );
        this.stmtGetPluginDataKey = this.db?.prepare(
            'SELECT value FROM plugin WHERE pluginName = ? AND key = ?',
        );
        this.stmtSetPluginDataKey = this.db?.prepare(
            'INSERT INTO plugin (pluginName, key, value) VALUES (?, ?, ?) ON CONFLICT(pluginName,key) DO UPDATE SET value = ?',
        );
        this.stmtDeletePluginData = this.db?.prepare(
            'DELETE FROM plugin where pluginName = ?',
        );
        this.stmtDeletePluginDataKey = this.db?.prepare(
            'DELETE FROM plugin WHERE pluginName = ? AND key = ?',
        );
        this.stmtSetAccountPassword = this.db?.prepare(
            'UPDATE user SET password = ? WHERE id = ?',
        );
        this.stmtGetMessage = this.db?.prepare(
            'SELECT * from messages WHERE roomid = ? and idx = ?',
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

    test_passalong: async function (f) {
        f();
    },
};
export default sqlitestorage;
