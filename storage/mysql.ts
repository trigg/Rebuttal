/* eslint-disable @typescript-eslint/require-await */
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { type pluginData, type AccountStorage, type RoomStorage } from './types.ts';
import { type v1_shared_message_real } from '../protocols/v1/shared.ts';
import { type StorageInterface } from './interface.ts';

type sql_message = {
    idx: number,
    roomid: string,
    text: string | null,
    url: string | null,
    userid: string | null,
    username: string | null,
    type: string | null,
    tags: string | null,
    img: string | null,
}

type sql_room = {
    name: string,
    type: string,
    id: string,
    position: number,
}

type sql_user = {
    id: string,
    name: string,
    email: string,
    passwordHash: string,
    avatar: string | null,
    groupid: string,
    hidden: number,
}

function sqluser_to_user(in_user: sql_user) {
    const account: AccountStorage = {
        id: in_user.id,
        name: in_user.name,
        passwordHash: in_user.passwordHash,
        email: in_user.email,
        group: in_user.groupid,
        avatar: (in_user.avatar && in_user.avatar.length > 0) ? in_user.avatar : undefined,
        hidden: in_user.hidden == 1 ? true : false,
    };
    return account;
}

function user_to_sqluser(in_user: AccountStorage) {
    const account: sql_user = {
        id: in_user.id,
        name: in_user.name,
        passwordHash: in_user.passwordHash,
        email: in_user.email,
        groupid: in_user.group,
        avatar: (in_user.avatar && in_user.avatar.length > 0) ? in_user.avatar : null,
        hidden: in_user.hidden ? 1 : 0,
    }
    return account;
}

function sqlmessage_to_message(in_msg: sql_message) {

    const tags = JSON.parse(in_msg.tags ? in_msg.tags : "[]") as string[];

    const message: v1_shared_message_real = {
        roomid: in_msg.roomid,
        idx: in_msg.idx,
        text: in_msg.text ? in_msg.text : "",
        img: in_msg.img,
        url: in_msg.url,
        height: null,
        width: null,
        userid: in_msg.userid,
        tags,
        type: in_msg.type,
        username: in_msg.username ? in_msg.username : ""
    }
    return message;
}

function room_to_sqlroom(in_room: RoomStorage) {
    const out_room: sql_room = {
        name: in_room.name,
        type: in_room.type,
        id: in_room.id,
        position: in_room.position,
    }
    return out_room;
}

function sqlroom_to_room(in_room: sql_room) {
    const out_room: RoomStorage = {
        id: in_room.id,
        name: in_room.name,
        type: in_room.type,
        position: in_room.position,
    }
    return out_room;
}

function message_to_sqlmessage(in_msg: v1_shared_message_real) {
    const tags = JSON.stringify(in_msg.tags);
    if (in_msg.idx == null) {
        throw new Error("SQL Messages may not have a null index");
    }
    const message: sql_message = {
        idx: in_msg.idx,
        roomid: in_msg.roomid,
        text: in_msg.text,
        url: in_msg.url,
        userid: in_msg.userid,
        username: in_msg.username,
        type: in_msg.type,
        tags,
        img: in_msg.img,
    };
    return message;
}

export async function mysqlstorage(user: string, password: string, database: string, host: string, wipe: boolean) {
    const cred = {
        host,
        user,
        password,
    };
    const conn = await mysql.createConnection(cred);
    conn.config.namedPlaceholders = true;

    async function create_tables() {
        /* Create tables */
        if (wipe) {
            await conn.execute("DROP DATABASE " + database);
        }

        console.log("Creating Database : " + database);
        const stmts = [
            "CREATE DATABASE IF NOT EXISTS  " + database,
            "USE " + database,
            "CREATE TABLE IF NOT EXISTS user (id UUID NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL,avatar TEXT,groupid TEXT NOT NULL,hidden BOOL NOT NULL)",
            'CREATE TABLE IF NOT EXISTS messages (idx INTEGER NOT NULL , roomid UUID NOT NULL, text TEXT, url TEXT, userid UUID, username TEXT, type TEXT, tags TEXT, img TEXT)',
            'CREATE TABLE IF NOT EXISTS room (id UUID NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL, position INT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS permission (perm TEXT NOT NULL, groupid TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS signup (groupid TEXT NOT NULL, id TEXT NOT NULL UNIQUE)',
            'CREATE TABLE IF NOT EXISTS plugin (plugin_name VARCHAR(255) NOT NULL, keyName VARCHAR(255) NOT NULL, value MEDIUMTEXT NOT NULL, PRIMARY KEY (plugin_name, keyName))'

        ];
        for (const stmt of stmts) {
            await conn.execute(stmt);
        }
    }
    await create_tables();
    /* TODO Later Migration steps */

    const storage: StorageInterface = {
        getRoomByID: async function (id: string) {
            const [rows] = await conn.execute<RowDataPacket[]>(
                'SELECT * FROM room WHERE id = :id',
                { id }
            );
            if (rows.length == 1) {
                return sqlroom_to_room(rows[0] as sql_room);
            }
            return null;
        },

        getAccountByLogin: async function (email: string, _password: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM user WHERE email = :email', { email })
            if (rows.length == 1) {
                return sqluser_to_user(rows[0] as sql_user);
            }
            return null;
        },

        getAccountByID: async function (id: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM user WHERE id = :id', { id });
            if (rows.length == 1) {
                return sqluser_to_user(rows[0] as sql_user);
            }
            return null;
        },

        getAllRooms: async function () {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM room');
            console.log(rows);
            return rows.map((room) => {
                return sqlroom_to_room(room as sql_room)
            });
        },

        getAllAccounts: async function () {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM user');
            return rows.map((user) => {
                return sqluser_to_user(user as sql_user)
            });
        },

        createAccount: async function (details: AccountStorage, _password: string) {
            await conn.execute('INSERT INTO user' +
                '( id,  name,  email,  passwordHash,  avatar,  groupid,  hidden) VALUES' +
                '(:id, :name ,:email, :passwordHash, :avatar, :groupid, :hidden)',
                user_to_sqluser(details)
            );
        },

        createRoom: async function (details: RoomStorage) {
            await conn.execute('INSERT INTO room (id,name,type,position) VALUES (:id, :name, :type, :position)', room_to_sqlroom(details));
        },

        updateAccount: async function (details: AccountStorage) {
            await conn.execute('UPDATE user SET name = :name, avatar = :avatar, groupid = :groupid, passwordHash = :passwordHash, hidden = :hidden WHERE id = :id ', user_to_sqluser(details));
        },

        updateRoom: async function (details: RoomStorage) {
            await conn.execute('UPDATE room SET name = :name, type = :type, position = :position WHERE id = :id', room_to_sqlroom(details));
        },

        removeAccount: async function (id: string) {
            await conn.execute('DELETE FROM user WHERE id = :id', { id });
        },

        removeRoom: async function (id: string) {
            await conn.execute('DELETE FROM room where id = :id', { id });
        },

        getTextForRoom: async function (id: string, segment: number) {
            const start = segment * 5;
            const end = (segment + 1) * 5;
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM messages WHERE roomid = :id AND idx BETWEEN :start AND :end ORDER BY idx ASC LIMIT 5', { id, start, end })
            return rows.map((message) => {
                return sqlmessage_to_message(message as sql_message);
            })
        },

        getTextRoomNewestSegment: async function (_id: string) {
            throw new Error("unimplemented");
        },

        addNewMessage: async function (message: v1_shared_message_real) {
            await conn.execute('INSERT INTO messages (idx, roomid, text, url, userid, username, type, tags, img) VALUES (:idx, :roomid, :text, :url, :userid, :username, :type, :tags, :img)', message_to_sqlmessage(message));
        },

        getLastMessageIdx: async function (id) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT MAX(idx) AS `count`  FROM messages WHERE roomid = :id', { id })
            if (rows.length == 1) {
                return rows[0]['count'] as number;
            }
            throw new Error("Invalid Data");
        },

        updateMessage: async function (contents: v1_shared_message_real) {
            await conn.execute('UPDATE messages SET text=:text, url=:url, type=:type, img=:img, userid=:userid, tags=:tags WHERE roomid = :roomid and idx = :idx', message_to_sqlmessage(contents));
        },

        removeMessage: async function (_roomid: string, _messageid: number) {
            throw new Error("unimplemented");
        },

        getMessage: async function (id: string, idx: number) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT * FROM messages WHERE roomid = :id AND idx = :idx', { id, idx });
            if (rows.length == 1) {
                return sqlmessage_to_message(rows[0] as sql_message);
            }
            return null;
        },

        getAccountPermission: async function (_id: string, _perm: string) {
            throw new Error("unimplemented");
        },

        getGroupPermission: async function (group: string, perm: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT perm FROM permission WHERE groupid = :group AND perm = :perm', { group, perm });
            if (rows.length == 1) {
                return true;
            }
            return false;
        },

        getGroupPermissionList: async function (group: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT perm FROM permission WHERE groupid = :group', { group });
            console.log(rows);
            return rows.map((row) => { return row.perm as string });
        },

        addGroupPermission: async function (group: string, perm: string) {
            await conn.execute('INSERT INTO permission (perm, groupid) VALUES (:perm, :group)', { group, perm });
        },

        removeGroupPermission: async function (group: string, perm: string) {
            await conn.execute('DELETE FROM permission WHERE groupid = :group AND perm = :perm', { group, perm });
        },

        removeGroup: async function (group: string) {
            const list = await this.getGroupPermissionList(group);
            for (const perm of list) {
                await this.removeGroupPermission(group, perm);
            }
        },

        createGroup: async function (_group: string) {
            // Noop

        },

        setAccountGroup: async function (id: string, group: string) {
            await conn.execute('UPDATE user SET groupid = :group WHERE id = :id', { id, group });
        },

        getGroups: async function () {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT DISTINCT groupid FROM permission');
            return rows.map((row) => { return row.groupid as string });
        },

        generateSignUp: async function (group: string, id: string) {
            await conn.execute('INSERT INTO signup (groupid, id) VALUES (:group, :id)', { group, id });
        },

        expendSignUp: async function (id: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT groupid,id FROM signup WHERE id = :id', { id });
            if (rows.length == 1) {
                await conn.execute('DELETE FROM signup WHERE id = :id', { id });
                return rows[0]['groupid'] as string;
            }
            return null;
        },

        setAccountPassword: async function (_id: string, _password: string) {
            throw new Error("Not implemented");
        },

        setPluginData: async function (plugin_name: string, key: string, value: string) {
            await conn.execute('REPLACE INTO plugin (plugin_name, keyName, value) VALUES (:plugin_name, :key, :value)', { plugin_name, key, value });
        },

        getPluginData: async function (plugin_name: string, key: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT value FROM plugin WHERE plugin_name = :plugin_name AND keyName = :key', { plugin_name, key });
            if (rows.length == 1) {
                return rows[0]['value'] as string;
            }
            return null;
        },

        getAllPluginData: async function (plugin_name: string) {
            const [rows] = await conn.execute<RowDataPacket[]>('SELECT keyName, value FROM plugin WHERE plugin_name = :plugin_name', { plugin_name });
            const ret: pluginData = {}
            for (const row of rows) {
                const key = row.keyName as string;
                ret[key] = row.value as string;
            }
            return ret;
        },

        deletePluginData: async function (plugin_name: string, key: string) {
            await conn.execute('DELETE FROM plugin WHERE plugin_name = :plugin_name AND keyName = :key', { plugin_name, key });
        },


        deleteAllPluginData: async function (plugin_name: string) {
            await conn.execute('DELETE FROM plugin where plugin_name = :plugin_name', { plugin_name });
        },

        exit: async function () { conn.destroy() },


    }
    return storage;
}

export default mysqlstorage;
