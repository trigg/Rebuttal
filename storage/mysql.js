`use strict`;
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const mysqlstorage = {
    mysql_username: null,
    mysql_password: null,
    mysql_host: null,
    mysql_database: null,

    sqlGetRoomsByID: 'SELECT * FROM room WHERE id = ?',
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
        return this.conn.execute(
            this.sqlGetRoomsByID,
            [roomid],
            (err, rows) => {
                if (err) {
                    throw err;
                }
                if (rows && rows.length == 1) {
                    return rows[0];
                }
            },
        );
    },

    /**
     * Get Account by login credentials
     * @param {string} email
     * @param {string} password
     * @returns
     */
    getAccountByLogin: async function (email, password) {
        this.conn.execute(this.sqlGetAccountByLogin, [email], (err, rows) => {
            if (rows && rows.length == 1) {
                if (bcrypt.compareSync(password, rows[0]['password'])) {
                    return this.coerceUser(rows[0]);
                }
            }
            return null;
        });
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {
        this.conn.execute(this.sqlGetAccountById, [userid], (err, rows) => {
            if (err) {
                throw err;
            }
            if (rows && rows.length == 1) {
                return rows[0];
            }
        });
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: async function () {},
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: async function () {},

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: async function (details) {},

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: async function (details) {},

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: async function (userid, details) {},

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: async function (roomid, details) {},

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: async function (userid) {},

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: async function (roomid) {},

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid
     * @param {int} segment
     */
    getTextForRoom: async function (uuid, segment) {},

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: async function (uuid) {},

    /**
     * Add a message to room
     *
     *
     * @param {uuid} roomid
     * @param {object} message
     */
    addNewMessage: async function (roomid, message) {},

    /**
     * Change contents of message
     * @param {uuid} roomid
     * @param {int} messageid
     * @param {object} contents
     */
    updateMessage: async function (roomid, messageid, contents) {},

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
    removeMessage: async function (roomid, messageid) {},

    getAccountPermission: async function (userid, permission) {},

    getGroupPermission: async function (groupname, permission) {},

    getGroupPermissionList: async function (groupname) {},

    addGroupPermission: async function (groupname, permission) {},

    removeGroupPermission: async function (groupname, permission) {},

    removeGroup: async function (groupname) {},

    createGroup: async function (groupname) {},

    setAccountGroup: async function (userid, groupname) {},

    /**
     *
     * @returns List of group names
     */
    getGroups: async function () {},

    generateSignUp: async function (group, uuid) {},

    expendSignUp: async function (uuid) {},

    setAccountPassword: async function (userid, password) {},

    /**
     * Create or update a key-value pair of data.
     * @param {string} pluginName
     * @param {string} key
     * @param {string} value
     */
    setPluginData: async function (pluginName, key, value) {},

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: async function (pluginName, key) {},

    /**
     * Get all key/value pairs for a plugin
     * @param {string} pluginName
     * @returns associative array of key & values
     */
    getAllPluginData: async function (pluginName) {},

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: async function (pluginName, key) {},

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: async function (pluginName) {},

    /**
     * Called at start of server
     */
    start: async function () {
        this.conn = mysql.createConnection({
            host: this.mysql_host,
            user: this.mysql_username,
            password: this.mysql_password,
        }).await;
        console.log(
            'Connecting DB : ' +
                this.mysql_host +
                ' uN : ' +
                this.mysql_username +
                ' pW : ' +
                this.mysql_password +
                ' DB : ' +
                this.mysql_password,
        );
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: async function () {},

    test_mode: async function () {
        this.mysql_database = process.env.DB_DATABASE;
        this.mysql_host = process.env.DB_HOST;
        this.mysql_password = process.env.DB_PASSWORD;
        this.mysql_username = process.env.DB_USER;
    },

    test_passalong: async function (f) {
        f();
    },
};
module.exports = mysqlstorage;
