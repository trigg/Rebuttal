import { type RoomUUID, type UserUUID, type v1_shared_message_real } from "../protocols/v1/shared.ts"

export interface AccountStorage {
    id: UserUUID;
    name: string;
    passwordHash: string;
    avatar?: string;
    email: string;
    group: string;
    hidden?: boolean;
}

export interface RoomStorage {
    id: RoomUUID;
    name: string;
    type: string;
}

export interface PermissionsStorage {
    [key: string]: string[];
}

export interface StorageInterface {
    getRoomByID(roomid: RoomUUID): Promise<RoomStorage | null>;
    getAccountByLogin(
        email: string,
        password: string,
    ): Promise<AccountStorage | null>;
    getAccountByID(userid: UserUUID): Promise<AccountStorage | null>;
    getAllRooms(): Promise<RoomStorage[]>;
    getAllAccounts(): Promise<AccountStorage[]>;
    createAccount(user: AccountStorage, password: string): Promise<void>;
    createRoom(details: RoomStorage): Promise<void>;
    updateAccount(userid: UserUUID, details: AccountStorage): Promise<void>;
    updateRoom(roomid: RoomUUID, details: RoomStorage): Promise<void>;
    removeAccount(userid: UserUUID): Promise<void>;
    removeRoom(roomid: RoomUUID): Promise<void>;
    getTextForRoom(uuid: RoomUUID, segment: number): Promise<v1_shared_message_real[]>;
    getTextRoomNewestSegment(uuid: RoomUUID): Promise<number>;
    addNewMessage(roomid: RoomUUID, message: v1_shared_message_real): Promise<number>;
    updateMessage(
        roomid: RoomUUID,
        messageid: number,
        contents: v1_shared_message_real,
    ): Promise<void>;
    removeMessage(roomid: RoomUUID, messageid: number): Promise<void>;
    getMessage(
        roomid: RoomUUID,
        messageid: number,
    ): Promise<v1_shared_message_real | null>;
    getAccountPermission(userid: UserUUID, permission: string): Promise<boolean>;
    getGroupPermission(groupname: string, permission: string): Promise<boolean>;
    getGroupPermissionList(groupname: string): Promise<string[]>;
    addGroupPermission(groupname: string, permission: string): Promise<void>;
    removeGroupPermission(groupname: string, permission: string): Promise<void>;
    removeGroup(groupname: string): Promise<void>;
    createGroup(groupname: string): Promise<void>;
    setAccountGroup(userid: UserUUID, groupname: string): Promise<void>;
    getGroups(): Promise<string[]>;
    generateSignUp(group: string, invite: string): Promise<void>;
    expendSignUp(invite: string): Promise<string | null>;
    setAccountPassword(userid: UserUUID, password: string): Promise<void>;
    setPluginData(
        pluginName: string,
        key: string,
        value: string,
    ): Promise<void>;
    getPluginData(pluginName: string, key: string): Promise<string>;
    getAllPluginData(pluginName: string): Promise<object | null>;
    deletePluginData(pluginName: string, key: string): Promise<void>;
    deleteAllPluginData(pluginName: string): Promise<void>;

    start(): Promise<void>;
    exit(): Promise<void>;

    test_mode(): Promise<void>;

    test_passalong(f: () => void): Promise<void>;
}
