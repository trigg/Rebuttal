export interface AccountStorage {
    id: string;
    name: string;
    password?: string;
    avatar?: string;
    email: string;
    group: string;
    hidden?: boolean;
}

export interface MessageStorage {
    roomid: string;
    idx?: number;
    userid: string | null;
    username: string;
    text: string;
    tags: string[];
    url: string | null;
    type: string | null;
    img: string | null;
    width?: number;
    height?: number;
}

export interface RoomStorage {
    id: string;
    name: string;
    type: string;
}

export interface PermissionsStorage {
    [key: string]: string[];
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export interface StorageInterface {
    getRoomByID(roomid: string): Promise<RoomStorage | null>;
    getAccountByLogin(
        email: string,
        password: string,
    ): Promise<AccountStorage | null>;
    getAccountByID(userid: string): Promise<AccountStorage | null>;
    getAllRooms(): Promise<RoomStorage[]>;
    getAllAccounts(): Promise<AccountStorage[]>;
    createAccount(user: AccountStorage): Promise<void>;
    createRoom(details: RoomStorage): Promise<void>;
    updateAccount(userid: string, details: AccountStorage): Promise<void>;
    updateRoom(roomid: string, details: RoomStorage): Promise<void>;
    removeAccount(userid: string): Promise<void>;
    removeRoom(roomid: string): Promise<void>;
    getTextForRoom(uuid: string, segment: number): Promise<MessageStorage[]>;
    getTextRoomNewestSegment(uuid: string): Promise<number>;
    addNewMessage(roomid: string, message: MessageStorage): Promise<void>;
    updateMessage(
        roomid: string,
        messageid: number,
        contents: MessageStorage,
    ): Promise<void>;
    removeMessage(roomid: string, messageid: number): Promise<void>;
    getMessage(
        roomid: string,
        messageid: number,
    ): Promise<MessageStorage | null>;
    getAccountPermission(userid: string, permission: string): Promise<boolean>;
    getGroupPermission(groupname: string, permission: string): Promise<boolean>;
    getGroupPermissionList(groupname: string): Promise<string[]>;
    addGroupPermission(groupname: string, permission: string): Promise<void>;
    removeGroupPermission(groupname: string, permission: string): Promise<void>;
    removeGroup(groupname: string): Promise<void>;
    createGroup(groupname: string): Promise<void>;
    setAccountGroup(userid: string, groupname: string): Promise<void>;
    getGroups(): Promise<string[]>;
    generateSignUp(group: string, uuid: string): Promise<void>;
    expendSignUp(uuid: string): Promise<string | null>;
    setAccountPassword(userid: string, password: string): Promise<void>;
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
