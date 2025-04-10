`use strict`;
const fs = require('fs');
const bcrypt = require('bcrypt');

/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 *
 * All data must be sanity checked in the core app.
 */
var jsonstorage = {
    storage: {},
    fileName: 'test.json',

    /**
     * Get room by UUID
     * @param {uuid} roomid
     * @returns room
     */
    getRoomByID: async function (roomid) {
        let retroom = null;
        for (let room of this.storage.rooms) {
            if (room.id == roomid) {
                retroom = room;
            }
        }
        return retroom;
    },

    /**
     * Get Account by login credentials
     * @param {string} email
     * @param {string} password
     * @returns
     */
    getAccountByLogin: async function (email, password) {
        let retuser = null;
        for (let user of this.storage.accounts) {
            if (
                user.email == email &&
                bcrypt.compareSync(password, user.password)
            ) {
                retuser = user;
            }
        }
        return retuser;
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {
        let retuser = null;
        for (let user of this.storage.accounts) {
            if (user.id === userid) {
                retuser = user;
            }
        }
        return retuser;
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: async function () {
        return this.storage.rooms;
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: async function () {
        return this.storage.accounts;
    },

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: async function (details) {
        details.password = bcrypt.hashSync(details.password, 10);

        this.storage.accounts.push(details);
        this.save();
    },

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: async function (details) {
        this.storage.rooms.push(details);
        this.save();
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: async function (userid, details) {
        await this.removeAccount(userid);
        details['id'] = userid;
        this.storage.accounts.push(details);
        this.save();
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: async function (roomid, details) {
        await this.removeRoom(roomid);
        details['id'] = roomid;
        this.storage.rooms.push(details);
        this.save();
    },

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: async function (userid) {
        var user = await this.getAccountByID(userid);
        var idx = this.storage.accounts.indexOf(user);
        this.storage.accounts.splice(idx, 1);
        this.save();
    },

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: async function (roomid) {
        var room = await this.getRoomByID(roomid);
        var idx = this.storage.rooms.indexOf(room);
        this.storage.rooms.splice(idx, 1);
        this.save();
    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid
     * @param {int} segment
     */
    getTextForRoom: async function (uuid, segment) {
        var start = segment * 5;
        var end = (segment + 1) * 5;
        if (!(uuid in this.storage.messages)) {
            return [];
        }
        return this.storage.messages[uuid].slice(start, end);
    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: async function (uuid) {
        if (uuid in this.storage.messages) {
            return Math.floor((this.storage.messages[uuid].length - 1) / 5);
        }
        return 0;
    },

    /**
     * Add a message to room
     *
     *
     * @param {uuid} roomid
     * @param {object} message
     */
    addNewMessage: async function (roomid, message) {
        if (!(roomid in this.storage.messages)) {
            this.storage.messages[roomid] = [];
        }
        var idx = this.storage.messages[roomid].length;
        message.idx = idx;
        message.roomid = roomid;
        this.storage.messages[roomid].push(message);
        this.save();
    },

    /**
     * Change contents of message
     * @param {uuid} roomid
     * @param {int} messageid
     * @param {object} contents
     */
    updateMessage: async function (roomid, messageid, contents) {
        this.storage.messages[roomid][messageid] = contents;
        this.save();
    },

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
    removeMessage: async function (roomid, messageid) {
        this.storage.messages[roomid][messageid]['text'] = '*Message Removed*';

        this.save();
    },

    getAccountPermission: async function (userid, permission) {
        var user = await this.getAccountByID(userid);
        if (!user) {
            return false;
        }
        return await this.getGroupPermission(user.group, permission);
    },

    getGroupPermission: async function (groupname, permission) {
        var permList = this.storage.permissions[groupname];
        if (permList == undefined) {
            permList = this.storage.permissions[groupname] = [];
        }
        if (permList.indexOf(permission) > -1) {
            return true;
        }
        return false;
    },

    getGroupPermissionList: async function (groupname) {
        return this.storage.permissions[groupname];
    },

    addGroupPermission: async function (groupname, permission) {
        var permList = this.storage.permissions[groupname];
        if (permList == undefined) {
            permList = this.storage.permissions[groupname] = [];
        }
        if (permList.indexOf(permission) == -1) {
            permList.push(permission);
            this.storage.permissions[groupname] = permList;
            this.save();
        }
    },

    removeGroupPermission: async function (groupname, permission) {
        var permList = this.storage.permissions[groupname];
        this.storage.permissions[groupname] = permList.filter(
            (p) => p !== permission,
        );
        this.save();
    },

    setAccountGroup: async function (userid, groupname) {
        var account = await this.getAccountByID(userid);
        account.group = groupname;
        await this.updateAccount(userid, account);
    },

    removeGroup: async function (groupname) {
        delete this.storage.permissions[groupname];
    },

    createGroup: async function (groupname) {
        this.storage.permissions[groupname] = [];
    },

    /**
     *
     * @returns List of group names
     */
    getGroups: async function () {
        return Object.keys(this.storage.permissions);
    },

    generateSignUp: async function (group, uuid) {
        this.storage.signUp[uuid] = group;
        this.save();
    },

    expendSignUp: async function (uuid) {
        if (uuid in this.storage.signUp) {
            var group = this.storage.signUp[uuid];
            delete this.storage.signUp[uuid];
            this.save();
            return group;
        }
        return null;
    },

    setAccountPassword: async function (userid, password) {
        var hash = bcrypt.hashSync(password, 10);
        (await this.getAccountByID(userid)).password = hash;
        this.save();
    },

    /**
     * Called at start of server
     */
    start: async function () {
        if (fs.existsSync(this.fileName)) {
            this.storage = JSON.parse(fs.readFileSync(this.fileName));
        } else {
            this.storage = {
                rooms: [],
                accounts: [],
                signUp: {},
                messages: {},
                permissions: {},
                plugin: {},
            };
        }
    },
    /**
     * Create or update a key-value pair of data.
     * @param {string} pluginName
     * @param {string} key
     * @param {string} value
     */
    setPluginData: async function (pluginName, key, value) {
        if (!(pluginName in this.storage.plugin)) {
            this.storage.plugin[pluginName] = {};
        }
        this.storage.plugin[pluginName][key] = value;
        this.save();
    },

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: async function (pluginName, key) {
        if (!(pluginName in this.storage.plugin)) {
            return null;
        }
        if (!(key in this.storage.plugin[pluginName])) {
            return null;
        }
        return this.storage.plugin[pluginName][key];
    },

    /**
     * Get all key/value pairs for a plugin
     * @param {string} pluginName
     * @returns associative array of key & values
     */
    getAllPluginData: async function (pluginName) {
        if (!(pluginName in this.storage.plugin)) {
            return {};
        }
        return this.storage.plugin[pluginName];
    },

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: async function (pluginName, key) {
        if (!(pluginName in this.storage.plugin)) {
            return;
        }
        this.storage.plugin[pluginName][key] = {};
        this.save();
    },

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: async function (pluginName) {
        this.storage.plugin[pluginName] = {};
        this.save();
    },

    /**
     * Not called by server. The storage plugin needs to ensure the integrity of the stored data on its own.
     */
    save: async function () {
        if (this.fileName !== null) {
            fs.writeFileSync(this.fileName, JSON.stringify(this.storage));
        }
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: async function () {
        this.save();
    },

    test_mode: async function () {
        this.fileName = null;
    },

    test_passalong: async function (f) {
        f();
    },
};
module.exports = jsonstorage;
