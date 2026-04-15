import { type UserUUID, type RoomUUID } from "../protocols/v1/shared.ts";

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

export interface pluginData {
    [key: string]: string;
}

// Stupid, I know, but keeps the data together
export type string_list = string[];

export type bool = boolean;

export type idx = number;

export type str = string;