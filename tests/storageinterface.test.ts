import { jsonstorage } from '../storage/json.ts';
import { mysqlstorage } from '../storage/mysql.ts';
import { sqlitestorage } from '../storage/sqlite.ts';
import { create_storage_guard } from '../storage/guard.ts';

import { v4 as uuidv4 } from 'uuid';
import { StorageInterface } from '../storage/interface.ts';

let databasecouter = 0;

const backends_to_test: [string, () => Promise<StorageInterface>][] = [
    ['json', () => { return jsonstorage(null) }],
    ['sqlite', () => { return sqlitestorage("") }],
];

if (process.env.TEST_MYSQL) {
    backends_to_test.push(
        ['mysql', () => { databasecouter++; return mysqlstorage('test', 'test', 'test' + databasecouter, '127.0.0.1', true) }]
    );
}


describe.each(backends_to_test)('storage handles data', (sname, storage_promise) => {
    it('Storage ' + sname + ' holds user data correctly', async () => {
        expect.assertions(8);
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });


        const user_uuid = uuidv4();
        const user_uuid2 = uuidv4();
        const password: string = uuidv4();

        // Create user
        await storage.createAccount({
            id: user_uuid,
            name: 'test',
            passwordHash: '',
            email: 'testuser@example.com',
            group: 'user',
        }, password);

        await storage.createAccount({
            id: user_uuid2,
            name: 'toast',
            passwordHash: "",
            email: 'toast@example.com',
            group: 'user',
        }, password);

        const u1 = await storage.getAccountByID(user_uuid);
        const u2 = await storage.getAccountByID(user_uuid2);
        expect(u1).not.toBeNull();
        expect(u2).not.toBeNull();
        if (u1 == null || u2 == null) {
            throw new Error("Somehow null returned");
        }

        // Users with the same password CANNOT match hashes
        expect(u1.passwordHash).not.toEqual(
            u2.passwordHash,
        );

        // Check user can login
        const returned_user = await storage.getAccountByLogin(
            'testuser@example.com',
            password,
        );
        expect(returned_user).toHaveProperty('name', 'test');
        expect(returned_user).toHaveProperty('id', user_uuid);

        // Delete user
        await storage.removeAccount(user_uuid);
        expect(await storage.getAccountByID(user_uuid)).toBeNull();
        expect(await storage.getAccountByID(user_uuid2)).toHaveProperty(
            'name',
            'toast',
        );
        expect(await storage.getAllAccounts()).toMatchObject([
            {
                email: 'toast@example.com',
                group: 'user',
                id: user_uuid2,
                name: 'toast',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                passwordHash: expect.anything(),
            },
        ]);
        await storage.exit();
    });
    it('Storage ' + sname + ' holds plugin data correctly', async () => {
        expect.assertions(7);
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });


        // Twiddle plugin to see if it keeps sane
        await storage.setPluginData('testPlugin', 'key1', 'value1');
        await storage.setPluginData('testPlugin', 'key2', 'value2');
        await storage.setPluginData('notATestPlugin', 'key1', 'notvalue1');

        expect(await storage.getPluginData('testPlugin', 'key1')).toBe(
            'value1',
        );
        expect(await storage.getPluginData('testPlugin', 'key2')).toBe(
            'value2',
        );
        expect(await storage.getAllPluginData('notATestPlugin')).toMatchObject({
            key1: 'notvalue1',
        });

        await storage.setPluginData('testPlugin', 'key2', 'updatedValue');
        await storage.deleteAllPluginData('notATestPlugin');

        expect(await storage.getAllPluginData('testPlugin')).toMatchObject({
            key1: 'value1',
            key2: 'updatedValue',
        });
        expect(await storage.getAllPluginData('notATestPlugin')).toMatchObject(
            {},
        );
        expect(await storage.getAllPluginData('zero')).toMatchObject({});
        await storage.deletePluginData('zero', 'zero');

        await storage.deletePluginData('testPlugin', 'key1');
        expect(await storage.getAllPluginData('testPlugin')).toMatchObject({
            key2: 'updatedValue',
        });
        await storage.exit();
    });
    it('Storage ' + sname + ' holds message data correctly', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(36)
        const room_uuid = uuidv4();
        const user_uuid = uuidv4();
        for (let count = 0; count < 20; count++) {
            await storage.addNewMessage({
                roomid: room_uuid,
                text: ' Message ' + count,
                userid: user_uuid,
                username: 'userName',
                tags: [],
                url: null,
                type: null,
                img: null,
                idx: null,
                width: null,
                height: null
            });
        }

        const segment = await storage.getTextRoomNewestSegment(room_uuid);
        expect(segment).toBe(3);
        let messages = await storage.getTextForRoom(room_uuid, segment);
        expect(messages).toHaveLength(5);
        for (const message of messages) {
            expect(message.userid).toBe(user_uuid);
            expect(message.text).toContain(' Message ');
            expect(message.url).toBeFalsy();
            expect(message.type).toBeFalsy();
            expect(message.img).toBeFalsy();
        }

        const oldmessage = messages[1];
        oldmessage.text = 'A whole new meaning';
        expect(oldmessage.idx).not.toBe(undefined);
        expect(oldmessage.idx).not.toBeNull();

        await storage.updateMessage(
            oldmessage,
        );
        messages = await storage.getTextForRoom(room_uuid, segment);

        expect(messages[1]).toMatchObject({
            idx: 16,
            roomid: room_uuid,
            tags: [],
            text: 'A whole new meaning',
            userid: user_uuid,
            username: 'userName',
            url: null,
            img: null,
            type: null,
        });

        // Delete message

        expect(messages[0].idx).not.toBeNull();
        await storage.removeMessage(room_uuid, messages[0].idx as number);

        messages = await storage.getTextForRoom(room_uuid, segment);

        expect(messages[1]).toMatchObject({
            idx: 16,
            roomid: room_uuid,
            tags: [],
            text: 'A whole new meaning',
            userid: user_uuid,
            username: 'userName',
        });
        expect(messages[0]).toMatchObject({
            idx: 15,
            text: '*Message Removed*',
            userid: null,
        });

        expect(await storage.getMessage(uuidv4(), 0)).toBeNull();
        expect(await storage.getMessage(room_uuid, 10000)).toBeNull();
        expect(await storage.getMessage(room_uuid, 15)).toMatchObject({
            text: '*Message Removed*',
            userid: null,
        });
        await storage.exit();
    });
    it('Storage ' + sname + ' correctly handles invites', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(2);
        // Prove invites don't crash
        // This gets covered by invite.test.js
        const invite_uuid = uuidv4();
        await storage.generateSignUp('user', invite_uuid);
        expect(await storage.expendSignUp(invite_uuid)).toBe('user');
        expect(await storage.expendSignUp(uuidv4())).toBe(null);
        await storage.exit();
    });
    it('Storage ' + sname + ' holds group data correctly', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(12);
        const user_uuid = uuidv4();
        await storage.addGroupPermission('admin', 'createRoom');
        await storage.createAccount({
            id: user_uuid,
            name: 'adminname',
            email: 'adminperson@example.com',
            group: 'admin',
            passwordHash: '',
        }, 'somethinglonger');
        expect(await storage.getAccountByID(user_uuid)).toHaveProperty(
            'group',
            'admin',
        );
        expect(await storage.getGroupPermission('admin', 'createRoom')).toBe(
            true,
        );
        expect(await storage.getAccountPermission(user_uuid, 'createRoom')).toBe(
            true,
        );
        // Check permissions
        await storage.addGroupPermission('newgroup', 'canjumpslightlyhigher');
        await storage.setAccountGroup(user_uuid, 'newgroup');
        expect(await storage.getAccountByID(user_uuid)).toMatchObject({
            group: 'newgroup',
        });
        expect(await storage.getGroupPermissionList('newgroup')).toMatchObject([
            'canjumpslightlyhigher',
        ]);
        await storage.addGroupPermission('newgroup', 'cansitdown');
        await storage.addGroupPermission('oldgroup', 'canthrow');
        expect(await storage.getGroupPermission('newgroup', 'cansitdown')).toBe(
            true,
        );
        expect(await storage.getGroupPermission('newgroup', 'canthrow')).toBe(
            false,
        );
        expect(await storage.getGroupPermission('oldgroup', 'canthrow')).toBe(
            true,
        );

        expect(await storage.getGroups()).toMatchObject([
            'admin',
            'newgroup',
            'oldgroup',
        ]);

        await storage.removeGroupPermission('newgroup', 'cansitdown');

        expect(await storage.getGroupPermissionList('newgroup')).toMatchObject([
            'canjumpslightlyhigher',
        ]);

        await storage.addGroupPermission('newgroup', 'canjumpslightlyhigher');

        expect(await storage.getGroupPermissionList('newgroup')).toMatchObject([
            'canjumpslightlyhigher',
        ]);

        await storage.removeGroup('newgroup');
        expect(await storage.getGroups()).toMatchObject(['admin', 'oldgroup']);
        await storage.exit();
    });

    it('Storage ' + sname + ' updates account details', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        const user_uuid = uuidv4();
        await storage.addGroupPermission('admin', 'createRoom');
        const user = {
            id: user_uuid,
            name: 'adminname',
            email: 'adminperson2@example.com',
            group: 'admin',
            passwordHash: '',
            avatar: './img/test.png',
            hidden: true,
        };
        await storage.createAccount(user, 'somethinglonger');
        user.name = 'notanadmin';
        await storage.updateAccount(user);
        expect(await storage.getAccountByID(user.id)).toMatchObject({
            name: 'notanadmin',
        });
        await storage.exit();
    });
    it('Storage ' + sname + ' holds room data correctly', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(5);
        const room_uuid = uuidv4();
        const room_uuid2 = uuidv4();
        // Test room operations
        await storage.createRoom({
            id: room_uuid,
            name: 'testroom',
            type: 'text',
            position: 5,
        });
        expect(await storage.getRoomByID(room_uuid)).toMatchObject({
            id: room_uuid,
            name: 'testroom',
            type: 'text',
            position: 5,
        });

        await storage.updateRoom({
            type: 'text',
            name: 'realroom',
            id: room_uuid,
            position: 4,
        });
        expect(await storage.getRoomByID(room_uuid)).toMatchObject({
            id: room_uuid,
            name: 'realroom',
            type: 'text',
        });

        await storage.createRoom({
            id: room_uuid2,
            name: 'testroomtoo',
            type: 'text',
            position: 10,
        });

        expect(await storage.getAllRooms()).toMatchObject([
            {
                id: room_uuid,
                name: 'realroom',
                type: 'text',
            },
            {
                id: room_uuid2,
                name: 'testroomtoo',
                type: 'text',
            },
        ]);

        // Delete room
        await storage.removeRoom(room_uuid);
        expect(await storage.getRoomByID(room_uuid)).toBeNull();
        expect(await storage.getAllRooms()).toMatchObject([
            {
                id: room_uuid2,
                name: 'testroomtoo',
                type: 'text',
            },
        ]);
        await storage.exit();
    });
    it('Storage ' + sname + ' returns null for non-existant user id', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        expect(await storage.getAccountByID(uuidv4())).toBeNull();
        await storage.exit();
    });
    it('Storage ' + sname + ' return null for failed login', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        expect(await storage.getAccountByLogin('name', 'password999')).toBeNull();
        await storage.exit();
    });
    it('Storage ' + sname + ' returns empty array for empty message segment', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        const room_uuid = uuidv4();
        await storage.createRoom({
            id: room_uuid,
            name: 'testroom',
            type: 'text',
            position: 11,
        });
        expect(await storage.getTextForRoom(room_uuid, 9001)).toEqual(
            expect.arrayContaining([]),
        );
        await storage.exit();
    });
    it('Storage ' + sname + ' returns segment zero when asked for newest segment of non-existant room', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        const seg = await storage.getTextRoomNewestSegment(uuidv4());
        expect(seg).toBe(0);
        await storage.exit();
    });
    it('Storage ' + sname + ' returns false when asked for non-existant users permission', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        expect(await storage.getAccountPermission(uuidv4(), 'canfly')).toBe(
            false,
        );
        await storage.exit();
    },
    );
    it('Storage ' + sname + ' returns empty array when asked for permission list for non-existant group', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        expect(await storage.getGroupPermissionList('akira')).toEqual(
            expect.arrayContaining([]),
        );
        await storage.exit();
    },
    );
    it('Storage ' + sname + ' returns false when asked if non-existant group has a permission', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(1);
        expect(await storage.getGroupPermission('akira', 'canfly')).toEqual(
            false,
        );
        await storage.exit();
    });
    it('Storage ' + sname + ' can change account password', async () => {
        expect.assertions(5);
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        const userid = uuidv4();
        const user_password1 = 'super1passplz';
        const user_password2 = 'super2passplz';
        const user_email = 'testuser1@example.com';
        await storage.createAccount({
            id: userid,
            name: 'test1',
            passwordHash: '',
            email: user_email,
            group: 'user',
        }, user_password1);
        const u1 = await storage.getAccountByLogin(user_email, user_password1);
        expect(u1).not.toBeNull();
        expect(u1).toMatchObject({ id: userid });
        expect(
            await storage.getAccountByLogin(user_email, user_password2),
        ).toBeNull();

        await storage.setAccountPassword(userid, user_password2);

        expect(
            await storage.getAccountByLogin(user_email, user_password2),
        ).toMatchObject({
            id: userid,
        });
        expect(
            await storage.getAccountByLogin(user_email, user_password1),
        ).toBeNull();
        await storage.exit();

    });
    it('Storage ' + sname + ' returns null for unknown plugin data', async () => {
        const storage = create_storage_guard(await storage_promise(), {
            storage: 'json',
            plugins: []
        });
        expect.assertions(2);
        await storage.setPluginData('webclient', 'realdata', '1');
        expect(
            await storage.getPluginData('fakeplugin', 'fakeindex'),
        ).toBeNull();
        expect(
            await storage.getPluginData('webclient', 'fakedata'),
        ).toBeNull();
        await storage.exit();
    });
});
