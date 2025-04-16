import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

import jsonstorage from '../storage/json.ts';
//import mysqlstorage from '../storage/mysql';
import sqlitestorage from '../storage/sqlite.ts';

describe.each([
    ['json', jsonstorage],
    ['sqlite', sqlitestorage],
    //    ['mysql', mysqlstorage],
])('storage handles data', (sname, storage) => {
    it('Storage ' + sname + ' holds user data correctly', async () => {
        expect.hasAssertions();
        await storage.test_mode();
        await storage.start();
        const userUuid = uuidv4();
        const userUuid2 = uuidv4();
        const password = uuidv4();

        // Create user
        await storage.createAccount({
            id: userUuid,
            name: 'test',
            password,
            email: 'testuser@example.com',
            group: 'user',
        });

        await storage.createAccount({
            id: userUuid2,
            name: 'toast',
            password,
            email: 'toast@example.com',
            group: 'user',
        });

        // Users with the same password CANNOT match hashes
        expect((await storage.getAccountByID(userUuid))?.password).not.toEqual(
            (await storage.getAccountByID(userUuid2))?.password,
        );

        // Check user can login
        const returned_user = await storage.getAccountByLogin(
            'testuser@example.com',
            password,
        );
        expect(returned_user).toHaveProperty('name', 'test');
        expect(returned_user).toHaveProperty('id', userUuid);

        // Delete user
        await storage.removeAccount(userUuid);
        expect(await storage.getAccountByID(userUuid)).toBeNull();
        expect(await storage.getAccountByID(userUuid2)).toHaveProperty(
            'name',
            'toast',
        );
        expect(await storage.getAllAccounts()).toMatchObject([
            {
                email: 'toast@example.com',
                group: 'user',
                id: userUuid2,
                name: 'toast',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                password: expect.anything(),
            },
        ]);
    });
    it('Storage ' + sname + ' holds plugin data correctly', async () => {
        expect.hasAssertions();
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
    });
    it('Storage ' + sname + ' holds message data correctly', async () => {
        expect.hasAssertions();
        const roomUuid = uuidv4();
        const userUuid = uuidv4();
        for (let count = 0; count < 20; count++) {
            await storage.addNewMessage(roomUuid, {
                roomid: roomUuid,
                text: ' Message ' + count,
                userid: userUuid,
                username: 'userName',
                tags: [],
                url: null,
                type: null,
                img: null,
            });
        }

        const segment = await storage.getTextRoomNewestSegment(roomUuid);
        expect(segment).toBe(3);
        let messages = await storage.getTextForRoom(roomUuid, segment);
        expect(messages).toHaveLength(5);
        for (const message of messages) {
            expect(message.userid).toBe(userUuid);
            expect(message.text).toContain(' Message ');
            expect(message.url).toBeFalsy();
            expect(message.type).toBeFalsy();
            expect(message.img).toBeFalsy();
        }

        const oldmessage = messages[1];
        oldmessage.text = 'A whole new meaning';
        expect(oldmessage.idx).not.toBe(undefined);
        await storage.updateMessage(
            roomUuid,
            oldmessage.idx as number,
            oldmessage,
        );
        messages = await storage.getTextForRoom(roomUuid, segment);

        expect(messages[1]).toMatchObject({
            idx: 16,
            roomid: roomUuid,
            tags: [],
            text: 'A whole new meaning',
            userid: userUuid,
            username: 'userName',
            url: null,
            img: null,
            type: null,
        });

        // Delete message

        expect(messages[0].idx).not.toBe(undefined);
        await storage.removeMessage(roomUuid, messages[0].idx as number);

        messages = await storage.getTextForRoom(roomUuid, segment);

        expect(messages[1]).toMatchObject({
            idx: 16,
            roomid: roomUuid,
            tags: [],
            text: 'A whole new meaning',
            userid: userUuid,
            username: 'userName',
        });
        expect(messages[0]).toMatchObject({
            idx: 15,
            text: '*Message Removed*',
            userid: null,
        });

        expect(await storage.getMessage(uuidv4(), 0)).toBeNull();
        expect(await storage.getMessage(roomUuid, 10000)).toBeNull();
        expect(await storage.getMessage(roomUuid, 15)).toMatchObject({
            text: '*Message Removed*',
            userid: null,
        });
    });
    it('Storage ' + sname + ' correctly handles invites', async () => {
        expect.assertions(2);
        // Prove invites don't crash
        // This gets covered by invite.test.js
        const inviteUuid = uuidv4();
        await storage.generateSignUp('user', inviteUuid);
        expect(await storage.expendSignUp(inviteUuid)).toBe('user');
        expect(await storage.expendSignUp(uuidv4())).toBe(null);
    });
    it('Storage ' + sname + ' holds group data correctly', async () => {
        expect.assertions(12);
        const userUuid = uuidv4();
        await storage.addGroupPermission('admin', 'createRoom');
        await storage.createAccount({
            id: userUuid,
            name: 'adminname',
            email: 'adminperson@example.com',
            group: 'admin',
            password: 'something',
        });
        expect(await storage.getAccountByID(userUuid)).toHaveProperty(
            'group',
            'admin',
        );
        expect(await storage.getGroupPermission('admin', 'createRoom')).toBe(
            true,
        );
        expect(await storage.getAccountPermission(userUuid, 'createRoom')).toBe(
            true,
        );
        // Check permissions
        await storage.addGroupPermission('newgroup', 'canjumpslightlyhigher');
        await storage.setAccountGroup(userUuid, 'newgroup');
        expect(await storage.getAccountByID(userUuid)).toMatchObject({
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
    });

    it('Storage ' + sname + ' updates account details', async () => {
        expect.assertions(1);
        const userUuid = uuidv4();
        await storage.addGroupPermission('admin', 'createRoom');
        const user = {
            id: userUuid,
            name: 'adminname',
            email: 'adminperson2@example.com',
            group: 'admin',
            password: 'something',
            avatar: './img/test.png',
            hidden: true,
        };
        await storage.createAccount(user);
        user.name = 'notanadmin';
        await storage.updateAccount(user.id, user);
        expect(await storage.getAccountByID(user.id)).toMatchObject({
            name: 'notanadmin',
        });
    });
    it('Storage ' + sname + ' holds room data correctly', async () => {
        expect.assertions(5);
        const roomUuid = uuidv4();
        const roomUuid2 = uuidv4();
        // Test room operations
        await storage.createRoom({
            id: roomUuid,
            name: 'testroom',
            type: 'text',
        });
        expect(await storage.getRoomByID(roomUuid)).toMatchObject({
            id: roomUuid,
            name: 'testroom',
            type: 'text',
        });

        await storage.updateRoom(roomUuid, {
            type: 'text',
            name: 'realroom',
            id: roomUuid,
        });
        expect(await storage.getRoomByID(roomUuid)).toMatchObject({
            id: roomUuid,
            name: 'realroom',
            type: 'text',
        });

        await storage.createRoom({
            id: roomUuid2,
            name: 'testroomtoo',
            type: 'text',
        });

        expect(await storage.getAllRooms()).toMatchObject([
            {
                id: roomUuid,
                name: 'realroom',
                type: 'text',
            },
            {
                id: roomUuid2,
                name: 'testroomtoo',
                type: 'text',
            },
        ]);

        // Delete room
        await storage.removeRoom(roomUuid);
        expect(await storage.getRoomByID(roomUuid)).toBeNull();
        expect(await storage.getAllRooms()).toMatchObject([
            {
                id: roomUuid2,
                name: 'testroomtoo',
                type: 'text',
            },
        ]);
    });
    it(
        'Storage ' + sname + ' returns null for non-existant user id',
        async () => {
            expect.assertions(1);

            expect(await storage.getAccountByID(uuidv4())).toBeNull();
        },
    );
    it('Storage ' + sname + ' return null for failed login', async () => {
        expect.assertions(1);

        expect(await storage.getAccountByLogin('name', 'password')).toBeNull();
    });
    it(
        'Storage ' + sname + ' returns empty array for empty message segment',
        async () => {
            expect.assertions(1);

            const roomUuid = uuidv4();
            await storage.createRoom({
                id: roomUuid,
                name: 'testroom',
                type: 'text',
            });
            expect(await storage.getTextForRoom(roomUuid, 9001)).toEqual(
                expect.arrayContaining([]),
            );
        },
    );
    it(
        'Storage ' +
            sname +
            ' returns segment zero when asked for newest segment of non-existant room',
        async () => {
            expect.assertions(1);
            const seg = await storage.getTextRoomNewestSegment(uuidv4());
            expect(seg).toBe(0);
        },
    );
    it(
        'Storage ' +
            sname +
            ' returns false when asked for non-existant users permission',
        async () => {
            expect.assertions(1);

            expect(await storage.getAccountPermission(uuidv4(), 'canfly')).toBe(
                false,
            );
        },
    );
    it(
        'Storage ' +
            sname +
            ' returns empty array when asked for permission list for non-existant group',
        async () => {
            expect.assertions(1);

            expect(await storage.getGroupPermissionList('akira')).toEqual(
                expect.arrayContaining([]),
            );
        },
    );
    it(
        'Storage ' +
            sname +
            ' returns false when asked if non-existant group has a permission',
        async () => {
            expect.assertions(1);

            expect(await storage.getGroupPermission('akira', 'canfly')).toEqual(
                false,
            );
        },
    );
    it('Storage ' + sname + ' can change account password', async () => {
        expect.assertions(4);

        const userid = uuidv4();
        const userPassword1 = 'super1';
        const userPassword2 = 'super2';
        const userEmail = 'testuser1@example.com';

        await storage.createAccount({
            id: userid,
            name: 'test1',
            password: userPassword1,
            email: userEmail,
            group: 'user',
        });

        expect(
            await storage.getAccountByLogin(userEmail, userPassword1),
        ).toMatchObject({
            id: userid,
        });
        expect(
            await storage.getAccountByLogin(userEmail, userPassword2),
        ).toBeNull();

        await storage.setAccountPassword(userid, userPassword2);

        expect(
            await storage.getAccountByLogin(userEmail, userPassword2),
        ).toMatchObject({
            id: userid,
        });
        expect(
            await storage.getAccountByLogin(userEmail, userPassword1),
        ).toBeNull();
    });
    it(
        'Storage ' + sname + ' returns null for unknown plugin data',
        async () => {
            expect.assertions(2);

            await storage.setPluginData('webclient', 'realdata', '1');
            expect(
                await storage.getPluginData('fakeplugin', 'fakeindex'),
            ).toBeNull();
            expect(
                await storage.getPluginData('webclient', 'fakedata'),
            ).toBeNull();
        },
    );
});

describe('storage can successfully save to disk', () => {
    it('json can write to a file', async () => {
        expect.assertions(1);

        jsonstorage.fileName = uuidv4() + '.testing.json';
        await jsonstorage.exit();
        expect(fs.statSync(jsonstorage.fileName).size).toBeGreaterThan(0);
        fs.rmSync(jsonstorage.fileName);
        jsonstorage.fileName = null;
    });
});

// TODO Message with URL

// TODO Message with Images

// TODO MySQL
