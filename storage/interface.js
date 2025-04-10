/* eslint-disable no-unused-vars */
const StorageInterface = {
    /**
     * Get room by UUID
     * @param {uuid} roomid
     * @returns room
     */
    getRoomByID: async function (roomid) {},

    /**
     * Get Account by login credentials
     * @param {string} email
     * @param {string} password
     * @returns
     */
    getAccountByLogin: async function (email, password) {},

    /**
     * Get Account by UUID
     * @param {uuid} userid
     * @returns user
     */
    getAccountByID: async function (userid) {},
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
    start: async function () {},

    /**
     * Called before server stops. Probably. Most likely. Don't bet on it though
     */
    exit: async function () {},

    test_mode: async function () {},

    test_passalong: async function (f) {},
};
module.exports = StorageInterface;
