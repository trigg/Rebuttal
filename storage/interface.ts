import {
    type RoomUUID,
    type UserUUID,
    type v1_shared_message_real
} from "../protocols/iface/v1/shared.iface.ts"
import {
    type RoomStorage,
    type AccountStorage,
    type pluginData,
} from "./types.ts";



export interface StorageInterface {
    createAccount(user: AccountStorage, password: string): Promise<void>;
    createRoom(details: RoomStorage): Promise<void>;
    addNewMessage(message: v1_shared_message_real): Promise<void>;
    addGroupPermission(groupname: string, permission: string): Promise<void>;
    createGroup(groupname: string): Promise<void>;
    generateSignUp(group: string, invite: string): Promise<void>;


    getRoomByID(roomid: RoomUUID): Promise<RoomStorage | null>;
    getAccountByLogin(
        email: string,
        password: string,
    ): Promise<AccountStorage | null>;
    getAccountByID(userid: UserUUID): Promise<AccountStorage | null>;
    getAllRooms(): Promise<RoomStorage[]>;
    getAllAccounts(): Promise<AccountStorage[]>;
    getTextForRoom(uuid: RoomUUID, segment: number): Promise<v1_shared_message_real[]>;
    getTextRoomNewestSegment(uuid: RoomUUID): Promise<number>;
    getMessage(
        roomid: RoomUUID,
        messageid: number,
    ): Promise<v1_shared_message_real | null>;
    getAccountPermission(userid: UserUUID, permission: string): Promise<boolean>;
    getGroupPermission(groupname: string, permission: string): Promise<boolean>;
    getGroupPermissionList(groupname: string): Promise<string[]>;
    getGroups(): Promise<string[]>;
    getPluginData(plugin_name: string, key: string): Promise<string | null>;
    getAllPluginData(plugin_name: string): Promise<pluginData | null>;
    getLastMessageIdx(roomid: RoomUUID): Promise<number | null>;

    updateAccount(details: AccountStorage): Promise<void>;
    updateRoom(details: RoomStorage): Promise<void>;
    updateMessage(
        contents: v1_shared_message_real,
    ): Promise<void>;
    setAccountGroup(userid: UserUUID, groupname: string): Promise<void>;
    setAccountPassword(userid: UserUUID, password: string): Promise<void>;
    setPluginData(
        plugin_name: string,
        key: string,
        value: string,
    ): Promise<void>;

    removeAccount(userid: UserUUID): Promise<void>;
    removeRoom(roomid: RoomUUID): Promise<void>;
    removeMessage(roomid: RoomUUID, messageid: number): Promise<void>;
    removeGroupPermission(groupname: string, permission: string): Promise<void>;
    removeGroup(groupname: string): Promise<void>;
    expendSignUp(invite: string): Promise<string | null>;


    deletePluginData(plugin_name: string, key: string): Promise<void>;
    deleteAllPluginData(plugin_name: string): Promise<void>;
    exit(): Promise<void>;
}
