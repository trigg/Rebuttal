`use strict`;
const mysql = require('mysql');
const storage = {
    sqlconn: null,
    storage: {},
    fileName: 'data.mysql',

    /**
     * Get room by UUID
     * @param {uuid} roomid 
     * @returns room
     */
    getRoomByID: function (roomid) {
    },

    /**
     * Get Account by login credentials
     * @param {string} email 
     * @param {string} password 
     * @returns 
     */
    getAccountByLogin: function (email, password) {
    },

    /**
     * Get Account by UUID
     * @param {uuid} userid 
     * @returns user
     */
    getAccountByID: function (userid) {
    },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: function () {
    },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     * 
     * @returns accounts
     */
    getAllAccounts: function () {
    },

    /**
     * Add new account to account list
     * @param {user} details 
     */
    createAccount: function (details) {
    },

    /**
     * Add new room to room list
     * @param {room} details 
     */
    createRoom: function (details) {
    },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * @param {uuid} userid 
     * @param {user} details 
     */
    updateAccount: function (userid, details) {
    },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid 
     * @param {room} details 
     */
    updateRoom: function (roomid, details) {
    },

    /**
     * Remove User Account
     * @param {uuid} userid 
     */
    removeAccount: function (userid) {
    },

    /**
     * Remove room
     * @param {uuid} roomid 
     */
    removeRoom: function (roomid) {
    },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid 
     * @param {int} segment 
     */
    getTextForRoom: function (uuid, segment) {
    },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid 
     */
    getTextRoomNewestSegment: function (uuid) {
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
    },

    /**
     * Change contents of message
     * @param {uuid} roomid 
     * @param {int} messageid 
     * @param {object} contents 
     */
    updateMessage: function (roomid, messageid, contents) {
    },

    /**
     * Remove message
     * @param {uuid} roomid 
     * @param {int} messageid 
     */
    removeMessage: function (roomid, messageid) {
    },

    getAccountPermission: function (userid, permission) {
    },

    getGroupPermission: function (groupname, permission) {
    },

    getGroupPermissionList: function (groupname) {
    },

    addGroupPermission: function (groupname, permission) {
    },

    removeGroupPermission: function (groupname, permission) {
    },

    setAccountGroup: function (userid, groupname) {
    },

    /**
     * 
     * @returns List of group names
     */
    getGroups: function () {
    },

    /**
     * Called at start of server
     */
    start: function () {
    },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: function () {
    },

    test_passalong: function (f) {
        f();
    }
}
export default storage;