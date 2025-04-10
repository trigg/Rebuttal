const StorageInterface = require('../storage/interface');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const jsonstorage = require('../storage/json.js');
const mysqlstorage = require('../storage/mysql.js');
const sqlitestorage = require('../storage/sqlite.js');

describe('Storage systems have a full interface', () => {
    it('JSON Storage matches interface', async () => {
        jsonstorage.test_mode();
        jsonstorage.start();
        for (const method in StorageInterface) {
            expect(jsonstorage).toHaveProperty(method);
            expect(typeof jsonstorage[method]).toBe(
                typeof StorageInterface[method],
            );
        }
    });

    it('Sqlite Storage matches interface', async () => {
        sqlitestorage.test_mode();
        sqlitestorage.start();
        for (const method in StorageInterface) {
            expect(sqlitestorage).toHaveProperty(method);
            expect(typeof sqlitestorage[method]).toBe(
                typeof StorageInterface[method],
            );
        }
    });

    /*it('MySQL Storage matches interface', async () => {
        mysqlstorage.test_mode()
        mysqlstorage.start()
        for (const method in StorageInterface) {
            expect(mysqlstorage).toHaveProperty(method)
            expect(typeof mysqlstorage[method]).toBe(typeof StorageInterface[method])
        }
    })*/
});

describe.each([
    ['json', jsonstorage],
    ['sqlite', sqlitestorage],
    //    ['mysql', mysqlstorage],
])('Storage handles data', (sname, storage) => {
    it('Storage ' + sname + ' holds user data correctly', () => {
        storage.test_passalong(async () => {
            var userUuid = uuidv4();
            var userUuid2 = uuidv4();
            var password = uuidv4();

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
            expect(
                (await storage.getAccountByID(userUuid)).password,
            ).not.toEqual((await storage.getAccountByID(userUuid2)).password);

            // Check user can login
            var returned_user = await storage.getAccountByLogin(
                'testuser@example.com',
                password,
            );
            expect(returned_user).toHaveProperty('name', 'test');
            expect(returned_user).toHaveProperty('id', userUuid);

            // Delete user
            await storage.removeAccount(userUuid);
            expect(await storage.getAccountByID(userUuid)).toBeNull();
            expect(await storage.getAllAccounts()).toMatchObject([
                {
                    email: 'toast@example.com',
                    group: 'user',
                    id: userUuid2,
                    name: 'toast',
                    password: expect.anything(),
                },
            ]);
        });
    });
    it('Storage ' + sname + ' holds plugin data correctly', async () => {
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
        var roomUuid = uuidv4();
        var userUuid = uuidv4();
        await storage.addNewMessage(roomUuid, {
            text: 'Some Message',
            userid: userUuid,
            username: 'userName',
            tags: {},
            url: 'null',
            type: 'null',
            img: 'null',
        });

        await storage.addNewMessage(roomUuid, {
            text: 'A different Message',
            userid: userUuid,
            username: 'userName',
            tags: {},
        });

        var segment = await storage.getTextRoomNewestSegment(roomUuid);
        var messages = await storage.getTextForRoom(roomUuid, segment);
        expect(messages).toMatchObject([
            {
                idx: 0,
                roomid: roomUuid,
                tags: {},
                text: 'Some Message',
                userid: userUuid,
                username: 'userName',
            },
            {
                idx: 1,
                roomid: roomUuid,
                tags: {},
                text: 'A different Message',
                userid: userUuid,
                username: 'userName',
            },
        ]);

        var oldmessage = messages[1];
        oldmessage.text = 'A whole new meaning';
        await storage.updateMessage(roomUuid, oldmessage.idx, oldmessage);
        messages = await storage.getTextForRoom(roomUuid, segment);

        expect(messages).toMatchObject([
            {
                idx: 0,
                roomid: roomUuid,
                tags: {},
                text: 'Some Message',
                userid: userUuid,
                username: 'userName',
            },
            {
                idx: 1,
                roomid: roomUuid,
                tags: {},
                text: 'A whole new meaning',
                userid: userUuid,
                username: 'userName',
            },
        ]);

        // Delete message
        await storage.removeMessage(roomUuid, messages[0].idx);

        messages = await storage.getTextForRoom(roomUuid, segment);

        expect(messages).toMatchObject([
            {
                idx: 0,
                text: '*Message Removed*',
            },
            {
                idx: 1,
                roomid: roomUuid,
                tags: {},
                text: 'A whole new meaning',
                userid: userUuid,
                username: 'userName',
            },
        ]);
    });
    it(
        'Storage ' + sname + " doesn't crash when dealing with invites",
        async () => {
            // Prove invites don't crash
            // This gets covered by invite.test.js
            var inviteUuid = uuidv4();
            await storage.generateSignUp('user', inviteUuid);
            expect(await storage.expendSignUp(inviteUuid)).toBe('user');
            expect(await storage.expendSignUp(uuidv4())).toBe(null);
        },
    );
    it('Storage ' + sname + ' holds group data correctly', async () => {
        var userUuid = uuidv4();
        await storage.addGroupPermission('admin', 'createRoom');
        await storage.createAccount({
            id: userUuid,
            name: 'adminname',
            email: 'adminperson@example.com',
            group: 'admin',
            password: 'something',
        });
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
        var userUuid = uuidv4();
        await storage.addGroupPermission('admin', 'createRoom');
        let user = {
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
        delete user.avatar;
        await storage.updateAccount(user.id, user);
        expect(await storage.getAccountByID(user.id)).not.toHaveProperty(
            'avatar',
        );
    });
    it('Storage ' + sname + ' holds room data correctly', async () => {
        var roomUuid = uuidv4();
        var roomUuid2 = uuidv4();
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

        await storage.updateRoom(roomUuid, { type: 'text', name: 'realroom' });
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
            expect(await storage.getAccountByID(uuidv4())).toBeNull();
        },
    );
    it('Storage ' + sname + ' return null for failed login', async () => {
        expect(await storage.getAccountByLogin('name', 'password')).toBeNull();
    });
    it(
        'Storage ' + sname + ' returns empty array for empty message segment',
        async () => {
            var roomUuid = uuidv4();
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
            expect(await storage.getTextRoomNewestSegment(uuidv4())).toBe(0);
        },
    );
    it(
        'Storage ' +
            sname +
            ' returns false when asked for non-existant users permission',
        async () => {
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
            expect(await storage.getGroupPermission('akira', 'canfly')).toEqual(
                false,
            );
        },
    );
    it('Storage ' + sname + ' can change account password', async () => {
        let userid = uuidv4();
        let userPassword1 = 'super1';
        let userPassword2 = 'super2';
        let userEmail = 'testuser1@example.com';

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

describe('Storage can successfully save to disk', () => {
    it('JSON can write to a file', async () => {
        jsonstorage.fileName = uuidv4() + '.testing.json';
        await jsonstorage.exit();
        expect(fs.statSync(jsonstorage.fileName).size).toBeGreaterThan(0);
        fs.rmSync(jsonstorage.fileName);
        jsonstorage.fileName = null;
    });

    it('Sqlite can write to a file', async () => {
        await sqlitestorage.exit();
        expect(fs.statSync(sqlitestorage.fileName).size).toBeGreaterThan(0);
        sqlitestorage.start();
    });
});

// TODO Message with URL

// TODO Message with Images

// TODO MySQL
