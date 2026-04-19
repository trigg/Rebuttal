/* eslint-disable @typescript-eslint/require-await */
// Async is a requirement for Storage Interface. maybe later we'll get async/await sorted here, but for now ignore it

import {
    type AccountStorage,
    type pluginData,
} from './types.ts';
import Sqlite, { type Database } from 'better-sqlite3';
import { type v1_shared_message_real } from '../protocols/v1/shared.ts';
import { type StorageInterface } from './interface.ts';

/* Minor differences exist */
interface sqlite_message {
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

interface sqlite_room {
    name: string,
    type: string,
    id: string,
    position: number,
}

interface sqlite_user {
    id: string,
    name: string,
    email: string,
    passwordHash: string,
    avatar: string | null,
    groupid: string,
    hidden: number,
}

function sqluser_to_user(in_user: sqlite_user) {
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
    const account: sqlite_user = {
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

function sqlmessage_to_message(in_msg: sqlite_message) {

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

function message_to_sqlmessage(in_msg: v1_shared_message_real) {
    const tags = JSON.stringify(in_msg.tags);
    if (in_msg.idx == null) {
        throw new Error("SQL Messages may not have a null index");
    }
    const message: sqlite_message = {
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

type SqliteStorageInterface = StorageInterface & {
    db: Database;
    file_name: string;
};

export async function sqlitestorage(file_name: string) {
    const db = Sqlite(file_name);
    db.exec(
        'CREATE TABLE IF NOT EXISTS user (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL,avatar TEXT,groupid TEXT NOT NULL,hidden INTEGER NOT NULL)',
    );
    db.exec(
        'CREATE TABLE IF NOT EXISTS room (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL, position INTEGER NOT NULL)',
    );
    db.exec(
        'CREATE TABLE IF NOT EXISTS messages (idx INTEGER NOT NULL , roomid TEXT NOT NULL, text TEXT, url TEXT, userid TEXT, username TEXT, type TEXT, tags TEXT, img TEXT)',
    );
    db.exec(
        'CREATE TABLE IF NOT EXISTS permission (perm TEXT NOT NULL, groupid TEXT NOT NULL)',
    );
    db.exec(
        'CREATE TABLE IF NOT EXISTS signup (groupid TEXT NOT NULL, id TEXT NOT NULL UNIQUE)',
    );
    db.exec(
        'CREATE TABLE IF NOT EXISTS plugin (plugin_name TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (plugin_name, key))',
    );
    const stmt_get_rooms_by_id: Sqlite.Statement<{ id: string }, sqlite_room> = db.prepare(
        'SELECT name, type, id, position FROM room WHERE id = @id',
    );
    const stmt_get_account_by_login: Sqlite.Statement<{ email: string }, sqlite_user> = db.prepare(
        'SELECT id, name, email, passwordHash, avatar, groupid, hidden FROM user WHERE email = @email',
    );
    const stmt_get_account_by_id: Sqlite.Statement<{ id: string }, sqlite_user> = db.prepare(
        'SELECT id, name, email, passwordHash, avatar, groupid, hidden FROM user WHERE id = @id',
    );
    const stmt_get_all_rooms: Sqlite.Statement<object, sqlite_room> = db.prepare('SELECT id, name, type, position FROM room');
    const stmt_get_all_accounts: Sqlite.Statement<object, sqlite_user> = db.prepare('SELECT id, name, email, passwordHash, avatar, groupid, hidden FROM user');
    const stmt_create_account: Sqlite.Statement<sqlite_user, void> = db.prepare(
        'INSERT INTO user (id,name,email,passwordHash,avatar,groupid,hidden) VALUES (@id, @name, @email, @passwordHash, @avatar, @groupid, @hidden)',
    );
    const stmt_create_room: Sqlite.Statement<sqlite_room, void> = db.prepare(
        'INSERT INTO room (id,name,type, position) VALUES (@id, @name, @type, @position)',
    );
    const stmt_update_account: Sqlite.Statement<sqlite_user, void> = db.prepare(
        'UPDATE user SET name = @name, avatar = @avatar, groupid = @groupid, hidden = @hidden, passwordHash = @passwordHash WHERE id = @id ',
    );
    const stmt_update_room: Sqlite.Statement<sqlite_room, void> = db.prepare(
        'UPDATE room SET name = @name, type = @type WHERE id = @id',
    );
    const stmt_remove_account: Sqlite.Statement<{ id: string }, void> = db.prepare(
        'DELETE FROM user WHERE id = @id',
    );
    const stmt_remove_room: Sqlite.Statement<{ id: string }, void> = db.prepare('DELETE FROM room where id = @id');
    const stmt_get_text_for_room: Sqlite.Statement<{ roomid: string, lower: number, upper: number }, sqlite_message> = db.prepare(
        'SELECT idx, roomid, text, url, userid, username, type, tags, img FROM messages WHERE roomid = @roomid AND idx BETWEEN @lower AND @upper ORDER BY idx ASC LIMIT 5',
    );
    const stmt_get_text_room_next_segment: Sqlite.Statement<{ roomid: string }, { count: number }> = db.prepare(
        'SELECT MAX(idx) AS `count`  FROM messages WHERE roomid = @roomid',
    );
    const stmt_add_new_message: Sqlite.Statement<sqlite_message, void> = db.prepare(
        'INSERT INTO messages (idx, roomid, text, url, userid, username, type, tags, img) VALUES (@idx, @roomid, @text, @url, @userid, @username, @type, @tags, @img)',
    );
    const stmt_update_message: Sqlite.Statement<sqlite_message, void> = db.prepare(
        'UPDATE messages SET text = @text, url = @url, type = @type, img = @img, userid = @userid, username = @username, tags = @tags WHERE roomid = @roomid and idx = @idx',
    );
    const stmt_get_group_permission: Sqlite.Statement<{ groupid: string, perm: string }, { groupid: string, perm: string }> = db.prepare(
        'SELECT perm, groupid FROM permission WHERE groupid = @groupid AND perm = @perm',
    );
    const stmt_get_group_permission_list: Sqlite.Statement<{ groupid: string }, { perm: string }> = db.prepare(
        'SELECT perm FROM permission WHERE groupid = @groupid',
    );
    const stmt_add_group_permission: Sqlite.Statement<{ perm: string, groupid: string }, void> = db.prepare(
        'INSERT INTO permission (perm, groupid) VALUES (@perm, @groupid)',
    );
    const stmt_remove_group_permission: Sqlite.Statement<{ groupid: string, perm: string }, void> = db.prepare(
        'DELETE FROM permission WHERE groupid = @groupid AND perm = @perm',
    );
    const stmt_set_account_group: Sqlite.Statement<{ groupid: string, id: string }, void> = db.prepare(
        'UPDATE user SET groupid = @groupid WHERE id = @id ',
    );
    const stmt_get_groups: Sqlite.Statement<object, { groupid: string }> = db.prepare(
        'SELECT DISTINCT groupid FROM permission',
    );
    const stmt_generate_signup: Sqlite.Statement<{ groupid: string, id: string }, void> = db.prepare(
        'INSERT INTO signup (groupid, id) VALUES (@groupid, @id)',
    );
    const stmt_get_signup: Sqlite.Statement<{ id: string }, { groupid: string, id: string }> = db.prepare(
        'SELECT groupid,id FROM signup WHERE id = @id',
    );
    const stmt_remove_signup: Sqlite.Statement<{ id: string }, void> = db.prepare(
        'DELETE FROM signup WHERE id = @id',
    );
    const stmt_get_plugin_data: Sqlite.Statement<{ plugin_name: string }, { key: string, value: string }> = db.prepare(
        'SELECT key, value FROM plugin WHERE plugin_name = @plugin_name',
    );
    const stmt_get_plugin_data_key: Sqlite.Statement<{ plugin_name: string, key: string }, { value: string }> = db.prepare(
        'SELECT value FROM plugin WHERE plugin_name = @plugin_name AND key = @key',
    );
    const stmt_set_plugin_data_key: Sqlite.Statement<{ plugin_name: string, key: string, value: string }, void> = db.prepare(
        'INSERT INTO plugin (plugin_name, key, value) VALUES (@plugin_name, @key, @value) ON CONFLICT(plugin_name,key) DO UPDATE SET value = @value',
    );
    const stmt_delete_plugin_data: Sqlite.Statement<{ plugin_name: string }, void> = db.prepare(
        'DELETE FROM plugin where plugin_name = @plugin_name',
    );
    const stmt_delete_plugin_data_key: Sqlite.Statement<{ plugin_name: string, key: string }, void> = db.prepare(
        'DELETE FROM plugin WHERE plugin_name = @plugin_name AND key = @key',
    );
    const stmt_get_message: Sqlite.Statement<{ roomid: string, idx: number }, sqlite_message> = db.prepare(
        'SELECT idx, roomid, text, url, userid, username, type, tags, img from messages WHERE roomid = @roomid and idx = @idx',
    );
    const storage: SqliteStorageInterface = {
        db,
        file_name,

        getRoomByID: async function (roomid: string) {
            const room = stmt_get_rooms_by_id.get({ id: roomid });
            if (!room) {
                return null;
            }
            return room;
        },

        getAccountByLogin: async function (email, _password) {
            const raw_user = stmt_get_account_by_login.get({ email });
            if (!raw_user) {
                return null;
            }
            return sqluser_to_user(raw_user);
        },

        getAccountByID: async function (userid) {
            const raw_user = stmt_get_account_by_id.get({ id: userid });
            if (!raw_user) {
                return null;
            }

            return sqluser_to_user(raw_user);
        },

        getAllRooms: async function () {
            const value = stmt_get_all_rooms.all([]);
            if (!value) {
                throw new Error("Invalid Data");
            }
            return value;
        },

        getAllAccounts: async function () {

            const users = stmt_get_all_accounts.all({});
            if (!users) {
                throw new Error("Invalid Storage");
            }
            return users.map((user) => {
                return sqluser_to_user(user);
            });
        },


        createAccount: async function (details: AccountStorage, _password: string) {
            stmt_create_account.run(user_to_sqluser(details));
        },


        createRoom: async function (details) {
            stmt_create_room.run(details);
        },

        updateAccount: async function (details) {
            stmt_update_account.run(user_to_sqluser(details));
        },

        updateRoom: async function (details) {
            stmt_update_room.run(details);
        },

        removeAccount: async function (userid) {
            stmt_remove_account.run({ id: userid });
        },

        removeRoom: async function (roomid) {
            stmt_remove_room.run({ id: roomid });
        },

        getTextForRoom: async function (uuid, segment) {
            const start = segment * 5;
            const end = (segment + 1) * 5;
            const a = stmt_get_text_for_room.all({ roomid: uuid, lower: start, upper: end })
                .map((message) => {
                    return sqlmessage_to_message(message);
                });
            if (!a) {
                throw new Error("Invalid Data")
            }
            return a;
        },

        getTextRoomNewestSegment: async function (_uuid) {
            throw new Error("unimplemented");
        },

        addNewMessage: async function (message) {
            stmt_add_new_message.run(message_to_sqlmessage(message));
        },

        getLastMessageIdx: async function (roomid) {
            const ret = stmt_get_text_room_next_segment.get({ roomid });
            if (!ret) {
                throw new Error('Unknown last message');
            }
            return ret['count'];
        },

        updateMessage: async function (contents) {
            stmt_update_message.run(message_to_sqlmessage(contents));
        },

        removeMessage: async function (_roomid, _messageid) {
            throw new Error("unimplemented");
        },

        getMessage: async function (roomid, messageid) {
            const a = stmt_get_message.get({ roomid, idx: messageid });
            if (a) {
                return sqlmessage_to_message(a);
            }
            return null;
        },

        getAccountPermission: async function (_userid, _permission) {
            throw new Error("unimplemented");
        },

        getGroupPermission: async function (groupid, perm) {
            const a = stmt_get_group_permission.all({ groupid, perm });
            if (!a) {
                return false;
            }
            return a.length > 0;
        },

        getGroupPermissionList: async function (groupid) {
            const list: string[] = [];
            const in_list =
                stmt_get_group_permission_list.all({ groupid });
            if (!in_list) {
                throw new Error('Undefined permission list from Sqlite');
            }

            for (const perm of in_list) {
                if (!('perm' in perm)) {
                    throw new Error('Unknown permission value from Sqlite');
                }
                list.push(perm.perm);
            }
            return list;
        },

        addGroupPermission: async function (groupid, perm) {
            stmt_add_group_permission.run({ perm, groupid });

        },

        removeGroupPermission: async function (groupid, perm) {
            stmt_remove_group_permission.run({ groupid, perm });
        },

        setAccountGroup: async function (userid, groupid) {
            stmt_set_account_group.run({ groupid, id: userid });
        },

        createGroup: async function (_groupname) {
            // NOOP
        },

        removeGroup: async function (groupname) {
            const list = await this.getGroupPermissionList(groupname);
            for (const perm of list) {
                await this.removeGroupPermission(groupname, perm);
            }
        },

        setAccountPassword: async function (_userid, _password) {
            throw new Error("unimplemented");
        },

        getGroups: async function () {
            const list: string[] = [];
            const ret = stmt_get_groups.all({});
            if (!ret) {
                throw new Error("Invalid Data")
            }
            for (const group of ret) {
                list.push(group.groupid);
            }
            return list;
        },

        generateSignUp: async function (groupid, uuid) {
            stmt_generate_signup.run({ groupid, id: uuid });
        },

        expendSignUp: async function (uuid) {

            const g = stmt_get_signup.get({ id: uuid });
            if (g) {
                stmt_remove_signup.run({ id: uuid });
                return g.groupid;
            }
            return null;
        },

        setPluginData: async function (plugin_name, key, value) {
            stmt_set_plugin_data_key.run({ plugin_name, key, value });
        },

        getPluginData: async function (plugin_name, key) {

            const data = stmt_get_plugin_data_key.get({ plugin_name, key });
            if (!data) {
                return null;
            }
            return data['value'];
        },

        getAllPluginData: async function (plugin_name) {
            const data = stmt_get_plugin_data.all({ plugin_name });
            if (!data) {
                throw new Error("Invalid Data");
            }
            const mixed_data: pluginData = {};
            for (const datum of data) {
                mixed_data[datum.key] = datum.value;
            }
            return mixed_data;
        },

        deletePluginData: async function (plugin_name, key) {
            stmt_delete_plugin_data_key.run({ plugin_name, key });
        },

        deleteAllPluginData: async function (plugin_name) {
            stmt_delete_plugin_data.run({ plugin_name });
        },

        exit: async function () {
            this.db.close();
        },
    }
    return storage;
};
export default sqlitestorage;
