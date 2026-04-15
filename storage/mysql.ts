/* eslint-disable @typescript-eslint/require-await */
import mysql, { RowDataPacket } from 'mysql2/promise';
import process from 'node:process';
import { type StorageInterface } from './interface.ts';
import { AccountStorage, RoomStorage } from './types.ts';

interface sql_message {
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


type MySQLStorageInterface = StorageInterface & {
    creds: mysql.ConnectionOptions,
    conn: mysql.Connection | null,
    sqlGetRoomByID: string,
};

export const mysqlstorage: MySQLStorageInterface = {
    mysql_username: null,
    mysql_password: null,
    mysql_host: null,
    conn: null,

    sqlGetRoomByID: 'SELECT * FROM room WHERE id = ?',
    sqlGetAccountByLogin: 'SELECT * FROM user WHERE email = ?',
    sqlGetAccountById: 'SELECT * FROM user WHERE id = ?',
    sqlGetAllRooms: 'SELECT * FROM room',
    sqlGetAllAccounts: 'SELECT * FROM user',
    sqlCreateAccount:
        'INSERT INTO user (id,name,email,password,avatar,groupid,hidden) VALUES (?, ? ,?, ?, ?, ?, ?)',
    sqlCreateRoom: 'INSERT INTO room (id,name,type) VALUES (?, ?, ?)',
    sqlUpdateAccount:
        'UPDATE user SET name = ?, avatar = ?, groupid = ? WHERE id = ? ',
    sqlUpdateRoom: 'UPDATE room SET name = ?, type = ? WHERE id = ?',
    sqlRemoveAccount: 'DELETE FROM user WHERE id = ?',
    sqlRemoveRoom: 'DELETE FROM room where id = ?',
    sqlGetTextForRoom:
        'SELECT * FROM messages WHERE roomid = ? AND idx BETWEEN ? AND ? ORDER BY idx ASC LIMIT 5',
    sqlGetTextRoomNextSegment:
        'SELECT COUNT(idx) AS `count`  FROM messages WHERE roomid = ?',
    sqlAddNewMessage:
        'INSERT INTO messages (idx, roomid, text, url, userid, username, type, tags, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    sqlUpdateMessage:
        'UPDATE messages SET text=?, url=?, type=?, img=? WHERE roomid = ? and idx = ?',
    sqlGetGroupPermission:
        'SELECT * FROM permission WHERE groupid = ? AND perm = ?',
    sqlGetGroupPermissionList: 'SELECT perm FROM permission WHERE groupid = ?',
    sqlAddGroupPermission:
        'INSERT INTO permission (perm, groupid) VALUES (?, ?)',
    sqlRemoveGroupPermission:
        'DELETE FROM permission WHERE groupid = ? AND perm = ?',
    sqlSetAccountGroup: 'UPDATE user SET groupid = ? WHERE id = ?',
    sqlGetGroups: 'SELECT DISTINCT groupid FROM permission',
    sqlGenerateSignUp: 'INSERT INTO signup (groupid, id) VALUES (?, ?)',
    sqlGetSignUp: 'SELECT groupid,id FROM signup WHERE id = ?',
    sqlRemoveSignUp: 'DELETE FROM signup WHERE id = ?',
    sqlGetPluginDataKey:
        'SELECT value FROM plugin WHERE pluginName = ? AND key = ?',
    sqlSetPluginDataKey:
        'INSERT INTO plugin (pluginName, key, value) VALUES (?, ?, ?) ON CONFLICT(pluginName,key) DO UPDATE SET value = ?',
    sqlGetPluginData: 'SELECT key, value FROM plugin WHERE pluginName = ?',
    sqlDeletePluginDataKey:
        'DELETE FROM plugin WHERE pluginName = ? AND key = ?',
    sqlDeletePluginData: 'DELETE FROM plugin where pluginName = ?',

    /**
     * Get room by UUID
     * @param {uuid} roomid
     * @returns room
     */
    getRoomByID: async function (roomid) {
        if (!this.conn) { throw new Error("No database object") }
        try {
            const [rows] = await this.conn.execute<RowDataPacket[]>(
                this.sqlGetRoomByID,
                [roomid]
            );
            if (rows.length == 1) {
                return rows[0] as RoomStorage;
            }

        } catch (err) {
            console.log(err);
        }
        return null;
    },

    /**
     * Get Account by login credentials
     * @param {string} email
     * @param {string} password
     * @returns
     */
    getAccountByLogin: async function (email, _password) {
        if (!this.conn) { throw new Error("No database object") }
        try {
            const [rows] = await this.conn.execute<RowDataPacket[]>(this.sqlGetAccountByLogin, [email])
            if (rows.length == 1) {
                return rows[0] as AccountStorage;
            }
        } catch (err) {
            console.log(err);
        }
        return null;
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {
        if (!this.conn) { throw new Error("No database object") }
        try {
            const [rows] = await this.conn.execute<RowDataPacket[]>(this.sqlGetAccountById, [userid]);
            if (rows.length == 1) {
                return rows[0] as AccountStorage;
            }
        } catch (err) {
            console.log(err);
        }
        return null;
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: async function () {
        if (!this.conn) { throw new Error("No database object") }

    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: async function () {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: async function (details) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: async function (details) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: async function (userid, details) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: async function (roomid, details) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: async function (userid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: async function (roomid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid
     * @param {int} segment
     */
    getTextForRoom: async function (uuid, segment) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: async function (uuid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Add a message to room
     *
     *
     * @param {uuid} roomid
     * @param {object} message
     */
    addNewMessage: async function (roomid, message) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Change contents of message
     * @param {object} contents
     */
    updateMessage: async function (contents) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
    removeMessage: async function (roomid, messageid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    getMessage: async function (roomid, messageid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    getAccountPermission: async function (userid, permission) {
        if (!this.conn) { throw new Error("No database object") }

    },

    getGroupPermission: async function (groupname, permission) {
        if (!this.conn) { throw new Error("No database object") }

    },

    getGroupPermissionList: async function (groupname) {
        if (!this.conn) { throw new Error("No database object") }

    },

    addGroupPermission: async function (groupname, permission) {
        if (!this.conn) { throw new Error("No database object") }

    },

    removeGroupPermission: async function (groupname, permission) {
        if (!this.conn) { throw new Error("No database object") }

    },

    removeGroup: async function (groupname) {
        if (!this.conn) { throw new Error("No database object") }

    },

    createGroup: async function (groupname) {
        if (!this.conn) { throw new Error("No database object") }

    },

    setAccountGroup: async function (userid, groupname) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     *
     * @returns List of group names
     */
    getGroups: async function () {
        if (!this.conn) { throw new Error("No database object") }

    },

    generateSignUp: async function (group, uuid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    expendSignUp: async function (uuid) {
        if (!this.conn) { throw new Error("No database object") }

    },

    setAccountPassword: async function (userid, password) {
        throw new Error("Not implemented");
    },

    /**
     * Create or update a key-value pair of data.
     * @param {string} pluginName
     * @param {string} key
     * @param {string} value
     */
    setPluginData: async function (pluginName, key, value) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: async function (pluginName, key) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Get all key/value pairs for a plugin
     * @param {string} pluginName
     * @returns associative array of key & values
     */
    getAllPluginData: async function (pluginName) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: async function (pluginName, key) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: async function (pluginName) {
        if (!this.conn) { throw new Error("No database object") }

    },

    /**
     * Called at start of server
     */
    start: async function () {
        this.conn = await mysql.createConnection(this.creds);
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: async function () { },

    test_mode: async function () {
        this.creds = {
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            user: process.env.DB_PASSWORD,
            password: process.env.DB_USER,
        }
    },

};

export default mysqlstorage;
