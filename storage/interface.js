/* eslint-disable no-unused-vars */
const StorageInterface = {
    /**
     * Get room by UUID
     * @param {uuid} roomid
     * @returns room
     */
    getRoomByID: function (roomid) { },

    /**
     * Get Account by login credentials
     * @param {string} email
     * @param {string} password
     * @returns
     */
    getAccountByLogin: function (email, password) { },

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: function (userid) { },
    /**
     * Get list of all rooms
     * @returns rooms
     */
    getAllRooms: function () { },
    /**
     * Get all accounts. This should NOT return password. Really. It shouldn't
     *
     * @returns accounts
     */
    getAllAccounts: function () { },

    /**
     * Add new account to account list
     * @param {user} details
     */
    createAccount: function (details) { },

    /**
     * Add new room to room list
     * @param {room} details
     */
    createRoom: function (details) { },

    /**
     * Replace account details with new details. Ensure UUID Matches as sanity checking IS NOT DONE HERE
     * @param {uuid} userid
     * @param {user} details
     */
    updateAccount: function (userid, details) { },

    /**
     * Replace room details with new details. Ensure UUIDs match!
     * @param {uuid} roomid
     * @param {room} details
     */
    updateRoom: function (roomid, details) { },

    /**
     * Remove User Account
     * @param {uuid} userid
     */
    removeAccount: function (userid) { },

    /**
     * Remove room
     * @param {uuid} roomid
     */
    removeRoom: function (roomid) { },

    /**
     * Get a segment of conversation for room.
     * @param {uuid} roomid
     * @param {int} segment
     */
    getTextForRoom: function (uuid, segment) { },

    /**
     * Get newest, possibly incomplete, segment
     * @param {uuid} uuid
     */
    getTextRoomNewestSegment: function (uuid) { },

    /**
     * Add a message to room
     *
     *
     * @param {uuid} roomid
     * @param {object} message
     */
    addNewMessage: function (roomid, message) { },

    /**
     * Change contents of message
     * @param {uuid} roomid
     * @param {int} messageid
     * @param {object} contents
     */
    updateMessage: function (roomid, messageid, contents) { },

    /**
     * Remove message
     * @param {uuid} roomid
     * @param {int} messageid
     */
    removeMessage: function (roomid, messageid) { },

    getAccountPermission: function (userid, permission) { },

    getGroupPermission: function (groupname, permission) { },

    getGroupPermissionList: function (groupname) { },

    addGroupPermission: function (groupname, permission) { },

    removeGroupPermission: function (groupname, permission) { },

    setAccountGroup: function (userid, groupname) { },

    /**
     *
     * @returns List of group names
     */
    getGroups: function () { },

    generateSignUp: function (group, uuid) { },

    expendSignUp: function (uuid) { },

    setAccountPassword: function (userid, password) { },

    /**
     * Create or update a key-value pair of data.
     * @param {string} pluginName
     * @param {string} key
     * @param {string} value
     */
    setPluginData: function (pluginName, key, value) { },

    /**
     * Get the value of plugin data for a specific key
     * @param {string} pluginName
     * @param {string} key
     * @returns a string value
     */
    getPluginData: function (pluginName, key) { },

    /**
     * Get all key/value pairs for a plugin
     * @param {string} pluginName
     * @returns associative array of key & values
     */
    getAllPluginData: function (pluginName) { },

    /**
     * Delete one key/value pair from plugin data
     * @param {string} pluginName
     * @param {string} key
     */
    deletePluginData: function (pluginName, key) { },

    /**
     * Delete all plugin data for a plugin
     * @param {string} pluginName
     */
    deleteAllPluginData: function (pluginName) { },

    /**
     * Called at start of server
     */
    start: function () { },

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: function () { },

    test_mode: function () { },

    test_passalong: function (f) { },
}


module.exports = StorageInterface