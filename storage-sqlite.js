`use strict`;
const sqlite = require('better-sqlite3');
const { v4: uuidv4 } = require("uuid");
const bcrypt = require('bcrypt');

/**
 * Be aware that sanity checking data is NOT to be done in the storage modules.
 * 
 * All data must be sanity checked in the core app.
 */
var storage = {
    db: null,
    fileName: "data.sqlite",
    sqlGetRoomsByID: 'SELECT * FROM room WHERE id = ?',
    sqlGetAccountByLogin: 'SELECT * FROM user WHERE email = ?',
    sqlGetAccountById: 'SELECT * FROM user WHERE id = ?',
    sqlGetAllRooms: 'SELECT * FROM room',
    sqlGetAllAccounts: 'SELECT * FROM user',
    sqlCreateAccount: 'INSERT INTO user (id,name,email,password,avatar,groupid,hidden) VALUES (?, ? ,?, ?, ?, ?, ?)',
    sqlCreateRoom: 'INSERT INTO room (id,name,type) VALUES (?, ?, ?)',
    sqlUpdateAccount: 'UPDATE user SET name = ?, avatar = ?, groupid = ? WHERE id = ? ',
    sqlUpdateRoom: 'UPDATE room SET name = ?, type = ? WHERE id = ?',
    sqlRemoveAccount: 'DELETE FROM user WHERE id = ?',
    sqlRemoveRoom: 'DELETE FROM room where id = ?',
    sqlGetTextForRoom: 'SELECT * FROM messages WHERE roomid = ? AND idx BETWEEN ? AND ? ORDER BY idx ASC LIMIT 5',
    sqlGetTextRoomNextSegment: 'SELECT COUNT(idx) AS `count`  FROM messages WHERE roomid = ?',
    sqlAddNewMessage: 'INSERT INTO messages (idx, roomid, text, url, userid, username, type, tags, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    sqlUpdateMessage: 'UPDATE messages SET text=?, url=?, type=?, img=? WHERE roomid = ? and idx = ?',
    sqlGetGroupPermission: 'SELECT * FROM permission WHERE groupid = ? AND perm = ?',
    sqlGetGroupPermissionList: 'SELECT perm FROM permission WHERE groupid = ?',
    sqlAddGroupPermission: 'INSERT INTO permission (perm, groupid) VALUES (?, ?)',
    sqlRemoveGroupPermission: 'DELETE FROM permission WHERE groupid = ? AND perm = ?',
    sqlSetAccountGroup: 'UPDATE user SET groupid = ? WHERE id = ?',
    sqlGetGroups: 'SELECT DISTINCT groupid FROM permission',
    sqlGenerateSignUp: 'INSERT INTO signup (groupid, id) VALUES (?, ?)',
    sqlGetSignUp: 'SELECT groupid,id FROM signup WHERE id = ?',
    sqlRemoveSignUp: 'DELETE FROM signup WHERE id = ?',

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

    coerceUser: function (user) {
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
    getRoomByID: function (roomid) {
        var room = this.stmtGetRoomsByID.get([roomid]);
        return room;
    },

    /**
     * Get Account by login credentials
     * @param {string} email 
     * @param {string} password 
     * @returns 
     */
    getAccountByLogin: function (email, password) {
        var user = this.stmtGetAccountByLogin.get([email]);
        if (!user) { return null; }
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
    getAccountByID: function (userid) {
        var user = this.stmtGetAccountById.get(userid);
        return this.coerceUser(user);
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: function () {
        return this.stmtGetAllRooms.all();;
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     * 
     * @returns accounts
     */
    getAllAccounts: function () {
        var a = this.stmtGetAllAccounts.all();
        a.forEach(user => {
            this.coerceUser(user);
        });
        return a;
    },

    /**
     * Add new account to account list
     * @param {user} details 
     */
    createAccount: function (details) {
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
            details.hidden ? 1 : 0
        )
    },

    /**
     * Add new room to room list
     * @param {room} details 
     */
    createRoom: function (details) {
        this.stmtCreateRoom.run(details.id, details.name, details.type);
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * 
     * Do not pass in details.password if you want to keep current password
     * @param {uuid} userid 
     * @param {user} details 
     */
    updateAccount: function (userid, details) {
        this.stmtUpdateAccount.run(details.name, details.avatar ? details.avatar : null, details.group, userid);
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid 
     * @param {room} details 
     */
    updateRoom: function (roomid, details) {
        this.stmtUpdateRoom.run(details.name, details.type, roomid);
    },

    /**
     * Remove User Account
     * @param {uuid} userid 
     */
    removeAccount: function (userid) {
        this.stmtRemoveAccount.run(userid);
    },

    /**
     * Remove room
     * @param {uuid} roomid 
     */
    removeRoom: function (roomid) {
        this.stmtRemoveRoom.run(roomid);
    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid 
     * @param {int} segment 
     */
    getTextForRoom: function (uuid, segment) {
        var start = segment * 5;
        var end = (segment + 1) * 5;
        var a = this.stmtGetTextForRoom.all(uuid, start, end);
        a.forEach(msg => {
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
        })
        return a;
    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid 
     */
    getTextRoomNewestSegment: function (uuid) {
        var a = this.stmtGetTextRoomNextSegment.get(uuid);
        var last = Math.floor((a.count - 1) / 5);
        if (last < 0) { last = 0 }
        return last;
    },

    /**
     * Add a message to room
     * 
     * 
     * @param {uuid} roomid 
     * @param {object} message 
     */
    addNewMessage: function (roomid, message) {
        var idx = this.stmtGetTextRoomNextSegment.get(roomid);
        this.stmtAddNewMessage.run(idx.count,
            roomid,
            message.text,
            message.url ? message.url : null,
            message.userid ? message.userid : null,
            message.username ? message.username : null,
            message.type ? message.type : null,
            JSON.stringify(message.tags),
            message.img ? message.img : null
        );
    },

    /**
     * Change contents of message
     * @param {uuid} roomid 
     * @param {int} messageid 
     * @param {object} contents 
     */
    updateMessage: function (roomid, messageid, contents) {
        this.stmtUpdateMessage.run(contents.text, contents.url, contents.type, contents.img, roomid, messageid);
    },

    /**
     * Remove message
     * @param {uuid} roomid 
     * @param {int} messageid 
     */
    removeMessage: function (roomid, messageid) {
        this.updateMessage(roomid, messageid, '*Message Removed*');
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
        var a = this.stmtGetGroupPermission.all(groupname, permission);
        return a.length > 0;
    },

    getGroupPermissionList: function (groupname) {
        var list = [];

        this.stmtGetGroupPermissionList.all(groupname).forEach(
            perm => {
                list.push(perm.perm);
            }
        )
        return list;
    },

    addGroupPermission: function (groupname, permission) {
        this.stmtAddGroupPermission.run(permission, groupname);
    },

    removeGroupPermission: function (groupname, permission) {
        this.stmtRemoveGroupPermission(groupname, permission);
    },

    setAccountGroup: function (userid, groupname) {
        this.stmtSetAccountGroup(groupname, userid);
    },

    setAccountPassword: function (userid, password) {
        hash = bcrypt.hashSync(password, 10);
        this.stmtSetAccountPassword.run(hash, userid);
    },

    /**
     * 
     * @returns List of group names
     */
    getGroups: function () {
        var list = []
        this.stmtGetGroups.all().forEach(group => {
            list.push(group.groupid);
        });
        return list;
    },

    generateSignUp: function (group, uuid) {
        this.stmtGenerateSignUp.run(group, uuid);
    },

    expendSignUp: function (uuid) {
        var g = this.stmtGetSignUp.get(uuid);
        if (g) {
            this.stmtRemoveSignUp.run(uuid);
            return g.groupid;
        }
        return null;
    },

    /**
     * Called at start of server
     */
    start: function () {
        this.db = sqlite(this.fileName);
        this.prepare();
        var user = this.getAllAccounts();

        if (user.length == 0) {
            this.createDatabase();
        }
    },

    createDatabase: function () {
        console.log("CREATING DATABASE");
        this.db.exec('CREATE TABLE user (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,avatar TEXT,groupid TEXT NOT NULL,hidden INTEGER NOT NULL)');
        this.db.exec('CREATE TABLE room (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL)');
        this.db.exec('CREATE TABLE messages (idx INTEGER NOT NULL , roomid TEXT NOT NULL, text TEXT, url TEXT, userid TEXT, username TEXT, type TEXT, tags TEXT, img TEXT)');
        this.db.exec('CREATE TABLE permission (perm TEXT NOT NULL, groupid TEXT NOT NULL)');
        this.db.exec('CREATE TABLE signup (groupid TEXT NOT NULL, id TEXT NOT NULL UNIQUE)');

        var password = uuidv4();
        console.log("Created Root account.");
        console.log("Pass : " + password);

        var hash = bcrypt.hashSync(password, 10);

        this.db.prepare('INSERT INTO user (id, name, email, password, groupid, hidden) VALUES (?, ?, ?, ?, ?, ?)')
            .run('1', 'root', 'root', hash, 'admin', 1);

        [
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
        ].forEach(perm => {
            this.db.prepare("INSERT INTO permission ( perm, groupid ) VALUES (?, 'admin') ").run(perm);
        });

        [
            "joinVoiceRoom",
            "sendMessage"
        ].forEach(perm => {
            this.db.prepare("INSERT INTO permission ( perm, groupid ) VALUES (?, 'user') ").run(perm);
        });

    },

    prepare: function () {
        try {
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
            this.stmtGetTextRoomNextSegment = this.db.prepare(this.sqlGetTextRoomNextSegment);
            this.stmtAddNewMessage = this.db.prepare(this.sqlAddNewMessage);
            this.stmtUpdateMessage = this.db.prepare(this.sqlUpdateMessage);
            this.stmtGetGroupPermission = this.db.prepare(this.sqlGetGroupPermission);
            this.stmtGetGroupPermissionList = this.db.prepare(this.sqlGetGroupPermissionList);
            this.stmtAddGroupPermission = this.db.prepare(this.sqlAddGroupPermission);
            this.stmtRemoveGroupPermission = this.db.prepare(this.sqlRemoveGroupPermission);
            this.stmtSetAccountGroup = this.db.prepare(this.sqlSetAccountGroup);
            this.stmtGetGroups = this.db.prepare(this.sqlGetGroups);
            this.stmtGenerateSignUp = this.db.prepare(this.sqlGenerateSignUp);
            this.stmtGetSignUp = this.db.prepare(this.sqlGetSignUp);
            this.stmtRemoveSignUp = this.db.prepare(this.sqlRemoveSignUp);
        } catch (err) {
            console.log(err);
            this.createDatabase();
            this.prepare();
        }
    },

    /**
     * Not called by server. The storage plugin needs to ensure the integrity of the stored data on its own.
     */
    save: function () {
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: function () {
        sqlite.close();
    }
}
module.exports = storage;