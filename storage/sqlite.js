`use strict`;
const sqlite = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('fs');

/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 *
 * All data must be sanity checked in the core app.
 */
var sqlitestorage = {
    db: null,
    fileName: 'data.sqlite',
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
    sqlSetAccountPassword: 'UPDATE user SET password = ? WHERE id = ?',

    stmtGetRoomsByID: null,
    stmtGetAccountByLogin: null,
    stmtGetAccountById: null,
    stmtGetAllRooms: null,
    stmtGetAllAccounts: null,
    stmtCreateAccount: null,
    stmtCreateRoom: null,
    stmtUpdateAccount: null,
    stmtUpdateRoom: null,
    stmtRemoveAccount: null,
    stmtRemoveRoom: null,
    stmtGetTextForRoom: null,
    stmtGetTextRoomNextSegment: null,
    stmtAddNewMessage: null,
    stmtUpdateMessage: null,
    stmtGetGroupPermission: null,
    stmtGetGroupPermissionList: null,
    stmtAddGroupPermission: null,
    stmtRemoveGroupPermission: null,
    stmtSetAccountGroup: null,
    stmtGetGroups: null,
    stmtGenerateSignUp: null,
    stmtGetSignUp: null,
    stmtRemoveSignUp: null,
    stmtGetPluginDataKey: null,
    stmtSetPluginDataKey: null,
    stmtGetPluginData: null,
    stmtDeletePluginDataKey: null,
    stmtDeletePluginData: null,
    stmtSetAccountPassword: null,

    coerceUser: async function (user) {
        user.group = user.groupid;
        delete user.groupid;
        if (user.avatar === null) {
            delete user.avatar;
        }
        user.hidden = user.hidden > 0 ? true : false;
        return user;
    },

    /**
     * Get room by UUID
     * @param {uuid} roomid
     * @returns room
     */
    getRoomByID: async function (roomid) {
        var room = this.stmtGetRoomsByID.get([roomid]);
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
        var user = this.stmtGetAccountByLogin.get([email]);
        if (!user) {
            return null;
        }
        // SQL would not accept 'group' as field name
        if (bcrypt.compareSync(password, user.password)) {
            return this.coerceUser(user);
        }
        return null;
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {
        var user = this.stmtGetAccountById.get(userid);
        if (!user) {
            return null;
        }
        return this.coerceUser(user);
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: async function () {
        return this.stmtGetAllRooms.all();
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: async function () {
        var a = this.stmtGetAllAccounts.all();
        for (let user of a) {
            this.coerceUser(user);
        }
        return a;
    },

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: async function (details) {
        //id,name,email,password,avatar,groupid
        var hash = bcrypt.hashSync(details.password, 10);
        if (!('hidden' in details)) {
            details.hidden = false;
        }
        this.stmtCreateAccount.run(
            details.id,
            details.name,
            details.email,
            hash,
            details.avatar ? details.avatar : null,
            details.group,
            details.hidden ? 1 : 0,
        );
    },

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: async function (details) {
        this.stmtCreateRoom.run(details.id, details.name, details.type);
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     *
     * Do not pass in details.password if you want to keep current password
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: async function (userid, details) {
        this.stmtUpdateAccount.run(
            details.name,
            details.avatar ? details.avatar : null,
            details.group,
            userid,
        );
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: async function (roomid, details) {
        this.stmtUpdateRoom.run(details.name, details.type, roomid);
    },

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: async function (userid) {
        this.stmtRemoveAccount.run(userid);
    },

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: async function (roomid) {
        this.stmtRemoveRoom.run(roomid);
    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid
     * @param {int} segment
     */
    getTextForRoom: async function (uuid, segment) {
        var start = segment * 5;
        var end = (segment + 1) * 5;
        var a = this.stmtGetTextForRoom.all(uuid, start, end);
        for (let msg of a) {
            if (msg.url === 'null' || msg.url === null) {
                delete msg.url;
            }
            if (msg.type === 'null' || msg.type === null) {
                delete msg.type;
            }
            if (msg.img === 'null' || msg.img === null) {
                delete msg.img;
            }
            msg.tags = JSON.parse(msg.tags);
        }
        a.idx = a.id;
        a.id = undefined;
        return a;
    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: async function (uuid) {
        var a = this.stmtGetTextRoomNextSegment.get(uuid);
        var last = Math.floor((a.count - 1) / 5);
        if (last < 0) {
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
        var idx = this.stmtGetTextRoomNextSegment.get(roomid);
        this.stmtAddNewMessage.run(
            idx.count,
            roomid,
            message.text,
            message.url ? message.url : null,
            message.userid ? message.userid : null,
            message.username ? message.username : null,
            message.type ? message.type : null,
            JSON.stringify(message.tags),
            message.img ? message.img : null,
        );
    },

    /**
     * Change contents of message
     * @param {uuid} roomid
     * @param {int} messageid
     * @param {object} contents
     */
    updateMessage: async function (roomid, messageid, contents) {
        this.stmtUpdateMessage.run(
            contents.text,
            contents.url ? contents.url : null,
            contents.type ? contents.type : null,
            contents.img ? contents.img : null,
            roomid,
            messageid,
        );
    },

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
    removeMessage: async function (roomid, messageid) {
        this.updateMessage(roomid, messageid, { text: '*Message Removed*' });
    },

    getAccountPermission: async function (userid, permission) {
        var user = await this.getAccountByID(userid);
        if (!user) {
            return false;
        }
        return await this.getGroupPermission(user.group, permission);
    },

    getGroupPermission: async function (groupname, permission) {
        var a = this.stmtGetGroupPermission.all(groupname, permission);
        return a.length > 0;
    },

    getGroupPermissionList: async function (groupname) {
        var list = [];

        for (let perm of this.stmtGetGroupPermissionList.all(groupname)) {
            list.push(perm.perm);
        }
        return list;
    },

    addGroupPermission: async function (groupname, permission) {
        if ((await this.getGroupPermission(groupname, permission)) === false) {
            this.stmtAddGroupPermission.run(permission, groupname);
        }
    },

    removeGroupPermission: async function (groupname, permission) {
        this.stmtRemoveGroupPermission.run(groupname, permission);
    },

    setAccountGroup: async function (userid, groupname) {
        this.stmtSetAccountGroup.run(groupname, userid);
    },

    createGroup: async function (groupname) {
        // NOOP
    },

    removeGroup: async function (groupname) {
        var list = await this.getGroupPermissionList(groupname);
        for (var perm of list) {
            await this.removeGroupPermission(groupname, perm);
        }
    },

    setAccountPassword: async function (userid, password) {
        var hash = bcrypt.hashSync(password, 10);
        this.stmtSetAccountPassword.run(hash, userid);
    },

    /**
     *
     * @returns List of group names
     */
    getGroups: async function () {
        var list = [];
        for (let group of this.stmtGetGroups.all()) {
            list.push(group.groupid);
        }
        return list;
    },

    generateSignUp: async function (group, uuid) {
        this.stmtGenerateSignUp.run(group, uuid);
    },

    expendSignUp: async function (uuid) {
        var g = this.stmtGetSignUp.get(uuid);
        if (g) {
            this.stmtRemoveSignUp.run(uuid);
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
        this.stmtSetPluginDataKey.run(pluginName, key, value, value);
    },

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: async function (pluginName, key) {
        var data = this.stmtGetPluginDataKey.get(pluginName, key);
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
        var data = this.stmtGetPluginData.all(pluginName);
        var ret = {};
        for (let row of data) {
            ret[row['key']] = row['value'];
        }
        return ret;
    },

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: async function (pluginName, key) {
        this.stmtDeletePluginDataKey.run(pluginName, key);
    },

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: async function (pluginName) {
        this.stmtDeletePluginData.run(pluginName);
    },

    /**
     * Called at start of server
     */
    start: async function () {
        // If we're in testing mode, delete the file first.
        if (
            this.fileName == 'test_mode.sqlite' &&
            fs.existsSync(this.fileName)
        ) {
            fs.unlinkSync(this.fileName);
        }
        this.db = sqlite(this.fileName);
        this.prepare();
    },

    createDatabase: async function () {
        console.log('CREATING DATABASE');
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS user (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,avatar TEXT,groupid TEXT NOT NULL,hidden INTEGER NOT NULL)',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS room (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL)',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS messages (idx INTEGER NOT NULL , roomid TEXT NOT NULL, text TEXT, url TEXT, userid TEXT, username TEXT, type TEXT, tags TEXT, img TEXT)',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS permission (perm TEXT NOT NULL, groupid TEXT NOT NULL)',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS signup (groupid TEXT NOT NULL, id TEXT NOT NULL UNIQUE)',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS plugin (pluginName TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (pluginName, key))',
        );
    },

    prepare: async function () {
        this.createDatabase();

        this.stmtGetRoomsByID = this.db.prepare(this.sqlGetRoomsByID);
        this.stmtGetAccountByLogin = this.db.prepare(this.sqlGetAccountByLogin);
        this.stmtGetAccountById = this.db.prepare(this.sqlGetAccountById);
        this.stmtGetAllRooms = this.db.prepare(this.sqlGetAllRooms);
        this.stmtGetAllAccounts = this.db.prepare(this.sqlGetAllAccounts);
        this.stmtCreateAccount = this.db.prepare(this.sqlCreateAccount);
        this.stmtCreateRoom = this.db.prepare(this.sqlCreateRoom);
        this.stmtUpdateAccount = this.db.prepare(this.sqlUpdateAccount);
        this.stmtUpdateRoom = this.db.prepare(this.sqlUpdateRoom);
        this.stmtRemoveAccount = this.db.prepare(this.sqlRemoveAccount);
        this.stmtRemoveRoom = this.db.prepare(this.sqlRemoveRoom);
        this.stmtGetTextForRoom = this.db.prepare(this.sqlGetTextForRoom);
        this.stmtGetTextRoomNextSegment = this.db.prepare(
            this.sqlGetTextRoomNextSegment,
        );
        this.stmtAddNewMessage = this.db.prepare(this.sqlAddNewMessage);
        this.stmtUpdateMessage = this.db.prepare(this.sqlUpdateMessage);
        this.stmtGetGroupPermission = this.db.prepare(
            this.sqlGetGroupPermission,
        );
        this.stmtGetGroupPermissionList = this.db.prepare(
            this.sqlGetGroupPermissionList,
        );
        this.stmtAddGroupPermission = this.db.prepare(
            this.sqlAddGroupPermission,
        );
        this.stmtRemoveGroupPermission = this.db.prepare(
            this.sqlRemoveGroupPermission,
        );
        this.stmtSetAccountGroup = this.db.prepare(this.sqlSetAccountGroup);
        this.stmtGetGroups = this.db.prepare(this.sqlGetGroups);
        this.stmtGenerateSignUp = this.db.prepare(this.sqlGenerateSignUp);
        this.stmtGetSignUp = this.db.prepare(this.sqlGetSignUp);
        this.stmtRemoveSignUp = this.db.prepare(this.sqlRemoveSignUp);
        this.stmtGetPluginData = this.db.prepare(this.sqlGetPluginData);
        this.stmtGetPluginDataKey = this.db.prepare(this.sqlGetPluginDataKey);
        this.stmtSetPluginDataKey = this.db.prepare(this.sqlSetPluginDataKey);
        this.stmtDeletePluginData = this.db.prepare(this.sqlDeletePluginData);
        this.stmtDeletePluginDataKey = this.db.prepare(
            this.sqlDeletePluginDataKey,
        );
        this.stmtSetAccountPassword = this.db.prepare(
            this.sqlSetAccountPassword,
        );
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: async function () {
        this.db.close();
    },

    test_mode: async function () {
        this.fileName = 'test_mode.sqlite';
    },

    test_passalong: async function (f) {
        f();
    },
};
module.exports = sqlitestorage;
