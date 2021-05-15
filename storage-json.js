`use strict`;
const { group } = require('console');
const fs = require('fs');
/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 * 
 * All data must be sanity checked in the core app.
 */
var storage = {
    storage: {},
    fileName: "data.json",

    /**
     * Get room by UUID
     * @param {uuid} roomid 
     * @returns room
     */
    getRoomByID: function (roomid) {
        let retroom = null;
        this.storage.rooms.forEach(room => {
            if (room.id == roomid) {
                retroom = room;
            }
        })
        return retroom;
    },

    /**
     * Get Account by login credentials
     * @param {string} email 
     * @param {string} password 
     * @returns 
     */
    getAccountByLogin: function (email, password) {
        let retuser = null;
        this.storage.accounts.forEach(user => {
            if (user.email == email && user.password == password) {
                retuser = user;
            }
        })
        return retuser;
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid 
     * @returns user
     */
    getAccountByID: function (userid) {
        let retuser = null;
        this.storage.accounts.forEach(user => {
            if (user.id === userid) {
                retuser = user;
            }
        })
        return retuser;
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: function () {
        return this.storage.rooms;
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     * 
     * @returns accounts
     */
    getAllAccounts: function () {
        return this.storage.accounts;
    },

    /**
     * Add new account to account list
     * @param {user} details 
     */
    createAccount: function (details) {
        this.storage.accounts.push(details);
        this.save();
    },

    /**
     * Add new room to room list
     * @param {room} details 
     */
    createRoom: function (details) {
        this.storage.rooms.push(details);
        this.save();
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * @param {uuid} userid 
     * @param {user} details 
     */
    updateAccount: function (userid, details) {
        var user = this.getAccountById(userid);
        this.removeAccount(userid);
        this.storage.accounts.add(details);
        this.save();
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid 
     * @param {room} details 
     */
    updateRoom: function (roomid, details) {
        var room = this.getAccountById(roomid);
        this.removeRoom(roomid);
        this.storage.rooms.add(details);
        this.save();
    },

    /**
     * Remove User Account
     * @param {uuid} userid 
     */
    removeAccount: function (userid) {
        var user = this.getAccountByID(userid);
        var idx = this.storage.accounts.indexOf(user);
        this.storage.accounts.splice(idx, 1);
        this.save();
    },

    /**
     * Remove room
     * @param {uuid} roomid 
     */
    removeRoom: function (roomid) {
        var room = this.getRoomByID(userid);
        var idx = this.storage.accounts.indexOf(user);
        this.storage.accounts.splice(idx, 1);
        this.save();
    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid 
     * @param {int} segment 
     */
    getTextForRoom: function (uuid, segment) {
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
    getTextRoomNewestSegment: function (uuid) {
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
     * @param {uuid} userid 
     * @param {object} message 
     */
    addNewMessage: function (roomid, userid, message) {
        if (!(roomid in this.storage.messages)) {
            this.storage.messages[roomid] = []
        }
        message.userid = userid;
        this.storage.messages[roomid].push(message);
        this.save();
    },

    /**
     * Change contents of message
     * @param {uuid} roomid 
     * @param {int} messageid 
     * @param {object} contents 
     */
    updateMessage: function (roomid, messageid, contents) {
        this.storage.messages[roomid][messageid] = contents;
        this.save();
    },

    /**
     * Remove message
     * @param {uuid} roomid 
     * @param {int} messageid 
     */
    removeMessage: function (roomid, messageid) {
        this.storage.messages[roomid][messageid] = { text: '*Message Removed*', id: 0 };
        this.save();
    },

    getAccountPermission: function (userid, permission) {
        if (!userid) {
            return false;
        }
        var user = this.getAccountByID(userid);
        if (!user) { return false; }
        return this.getGroupPermission(user.group, permission);
    },

    getGroupPermission: function (groupname, permission) {
        var permList = this.storage.permissions[groupname];
        if (permList.indexOf(permission) > -1) {
            return true;
        }
        return false;
    },

    getGroupPermissionList: function (groupname) {
        return this.storage.permissions[groupname];
    },

    addGroupPermission: function (groupname, permission) {
        var permList = this.storage.permissions[groupname];
        if (permList.indexOf(permission) == -1) {
            permList.push(permission);
            this.storage.permissions[groupname] = permList;
            this.save();
        }
    },

    removeGroupPermission: function (groupname, permission) {
        var permList = this.storage.permissions[groupname];
        if (permList.indexOf(permission) > -1) {
            permList.push(permission);
            this.storage.permissions[groupname] = permList;
            this.save();
        }
    },

    setAccountGroup: function (userid, groupname) {
        var account = this.getAccountByID(userid);
        account.group = groupname;
        this.updateAccount(userid, account);
    },

    /**
     * 
     * @returns List of group names
     */
    getGroups: function () {
        return Object.keys(this.storage.permissions);
    },

    generateSignUp: function (group, uuid) {
        this.storage.signUp[uuid] = group;
        this.save();
    },

    expendSignUp: function (uuid) {
        if (uuid in this.storage.signUp) {
            var group = this.storage.signUp[uuid];
            delete this.storage.signUp[uuid];
            this.save();
            return group;
        }
        return null;
    },

    /**
     * Called at start of server
     */
    start: function () {
        if (fs.existsSync(this.fileName)) {
            this.storage = JSON.parse(
                fs.readFileSync(this.fileName)
            );
        } else {
            this.storage = {
                'rooms': [],
                'accounts': [{
                    "id": "1",
                    "name": "root",
                    "password": "iamroot",
                    "email": "root",
                    "group": "admin",
                    "hidden": true
                },],
                "signUp": {},
                'messages': {},
                'permissions': {
                    "admin": [
                        'createRoom',
                        'createUser',
                        'renameRoom',
                        'renameUser',
                        'renameServer',
                        'removeRoom',
                        'removeUser',
                        'inviteUser',
                        'joinVoiceRoom',
                        "sendMessage",
                        "setUserGroup",
                        "setGroupPerm",
                        "changeMessage",
                        "noInviteFor",
                        "inviteUserAny"
                    ],
                    "moderator": [
                        "renameRoom",
                        "inviteUser",
                        "joinVoiceRoom",
                        "sendMessage",
                        "noInviteFor",
                    ],
                    "user": [
                        "joinVoiceRoom",
                        "sendMessage"
                    ]
                }
            }
        }
    },

    /**
     * Not called by server. The storage plugin needs to ensure the integrity of the stored data on its own.
     */
    save: function () {
        fs.writeFileSync(this.fileName, JSON.stringify(this.storage));
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: function () {
        this.save();
    }
}
module.exports = storage;