const rebuttal = require('../server.js');
const requestws = require('superwstest');
const iconv_lite = require('iconv-lite');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
iconv_lite.encodingExists('foo');

describe('Protocol v1', () => {
    var admin_password = 'IHaveThisAmazingAdminPasswordForTesting';
    var room_voice = {
        id: uuidv4(),
        name: 'voiceroom',
        type: 'voice',
    };
    var room = {
        id: uuidv4(),
        name: 'testroom',
        type: 'text',
    };
    var room_prefilled = {
        id: uuidv4(),
        name: 'fullroom',
        type: 'text',
    };
    var user = {
        id: uuidv4(),
        name: 'testadmin',
        email: 'test.admin@example.com',
        password: admin_password,
        group: 'admin',
    };
    beforeAll(async () => {
        var config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: 'https://localhost:9000/',
            infinitesignup: 'user',
        };
        await rebuttal.create(config);

        // Don't save storage to disk for tests.
        rebuttal.storage.fileName = null;
        await rebuttal.storage.generateSignUp(
            'user',
            '00000000-0000-0000-0000-000000000000',
        );
        await rebuttal.storage.generateSignUp(
            'admin',
            '11111111-1111-1111-1111-111111111111',
        );
        await rebuttal.storage.createAccount(user);
        await rebuttal.storage.createRoom(room);
        await rebuttal.storage.createRoom(room_voice);
        await rebuttal.storage.createRoom(room_prefilled);

        for (var i = 0; i < 100; i++) {
            let message = {
                userid: user.id,
                text: 'Message ' + i,
                username: user.name,
                tags: {},
            };
            await rebuttal.storage.addNewMessage(room_prefilled.id, message);
        }
    });

    beforeEach((done) => {
        rebuttal.server.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal.server.close(done);
    });
    it('Userlist sent after login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateUsers' && reply.userList.length == 2,
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    // TODO Compare actually existant rooms. Somehow github testing gets a different answer to local...
    it('Roomlist sent after login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    it('User permissions are sent after login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updatePerms' && reply.perms.length > 0,
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    it('Sending a message to a text room', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { skip: true },
            )
            .sendJson({
                type: 'message',
                roomid: room.id,
                message: { text: 'test text' },
            })
            .expectJson(
                (reply) =>
                    reply.type == 'sendMessage' &&
                    reply.roomid == room.id &&
                    reply.message.text === 'test text',
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    it('Sending an image to a text room', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { skip: true },
            )
            .sendJson({
                type: 'message',
                roomid: room.id,
                message: { text: 'test text' },
                rawfile: fs.readFileSync('./tests/white.b64').toString(),
                filename: 'white.png',
            })
            .expectJson(
                (reply) =>
                    reply.type == 'sendMessage' &&
                    reply.roomid == room.id &&
                    reply.message.text === 'test text' &&
                    reply.message.img.startsWith(
                        'uploads/' + user.id + '/whitepng',
                    ) &&
                    reply.message.width == 128 &&
                    reply.message.height == 128,
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    it('Sending a message with an intentionally wrong userid is overridden', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { skip: true },
            )
            .sendJson({
                type: 'message',
                roomid: room.id,
                message: { text: 'test text', userid: 4000 },
            })
            .expectJson(
                (reply) =>
                    reply.type == 'sendMessage' &&
                    reply.roomid == room.id &&
                    reply.message.text === 'test text' &&
                    reply.message.userid == user.id,
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    it('Generate invite', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'login' && reply.success)
            .sendJson({ type: 'invite', groupName: 'user' })
            .expectJson((reply) => reply.type === 'invite', {
                skip: true,
                timeout: 500,
            })
            .close()
            .expectClosed();
    });

    it('Request most recent chat', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'login')
            .sendJson({
                type: 'getmessages',
                roomid: room_prefilled.id,
                segment: null,
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.roomid === room_prefilled.id &&
                    reply.segment > 0 &&
                    reply.messages.length > 0,
                { skip: true },
            )
            .close()
            .expectClosed();
    });

    it('Request historical chat', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'login')
            .sendJson({
                type: 'getmessages',
                roomid: room_prefilled.id,
                segment: 0,
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.roomid === room_prefilled.id &&
                    reply.segment === 0 &&
                    JSON.stringify(reply.messages[0]) ==
                        JSON.stringify({
                            userid: user.id,
                            text: 'Message 0',
                            username: user.name,
                            tags: {},
                            idx: 0,
                            roomid: room_prefilled.id,
                        }) &&
                    JSON.stringify(reply.messages[4]) ==
                        JSON.stringify({
                            userid: user.id,
                            text: 'Message 4',
                            username: user.name,
                            tags: {},
                            idx: 4,
                            roomid: room_prefilled.id,
                        }),
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Join, check, and leave a voice room', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'joinRoom', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'leaveroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'leaveRoom', {
                skip: true,
                timeout: 1000,
            })
            .close()
            .expectClosed();
    });

    it('Can initiate a livestream', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'joinRoom', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({
                type: 'golive',
                livestate: true,
                livelabel: 'Terminal - yarn test',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'golive' &&
                    reply.userid === user.id &&
                    reply.roomid === room_voice.id &&
                    reply.livestate &&
                    reply.livelabel == 'Terminal - yarn test',
                { skip: true, timeout: 1000 },
            )
            .sendJson({ type: 'golive', livestate: false, livelabel: '' })
            .expectJson(
                (reply) =>
                    reply.type === 'golive' &&
                    reply.userid === user.id &&
                    reply.roomid === room_voice.id &&
                    !reply.livestate,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can request viewing of a stream', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'joinRoom', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({
                type: 'golive',
                livestate: true,
                livelabel: 'Terminal - yarn test',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'golive' &&
                    reply.userid === user.id &&
                    reply.roomid === room_voice.id &&
                    reply.livestate &&
                    reply.livelabel == 'Terminal - yarn test',
                { skip: true, timeout: 1000 },
            )
            .sendJson({
                type: 'letmesee',
                touserid: user.id,
                message: 'test webrtc message',
            })
            .expectJson(
                (reply) =>
                    reply.type == 'letmesee' &&
                    reply.message == 'test webrtc message',
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can create room', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({
                type: 'createroom',
                roomName: 'new_room',
                roomType: 'text',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length === 4,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can create user', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateUsers', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({
                type: 'createuser',
                userName: 'created_user',
                groupName: 'homunculus',
                email: 'organism@example.com',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList[2].name === 'created_user',
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can rename user', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateUsers', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({
                type: 'updateuser',
                userName: 'cucumber',
                userid: user.id,
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList.filter((user) => user.name === 'cucumber')
                        .length == 1,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can remove user', async () => {
        let created_user_id = (await rebuttal.storage.getAllAccounts()).filter(
            (user) => user.name === 'created_user',
        )[0].id;
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateUsers', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'removeuser', touserid: created_user_id })
            .expectJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList.filter(
                        (user) => user.name === 'created_user',
                    ).length == 0,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can remove room', async () => {
        let created_room_id = (await rebuttal.storage.getAllRooms()).filter(
            (room) => room.name === 'new_room',
        )[0].id;
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'removeroom', roomid: created_room_id })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' &&
                    reply.roomList.filter((room) => room.name === 'new_room')
                        .length == 0,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can update message', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { skip: true },
            )
            .sendJson({
                type: 'updatemessage',
                roomid: room_prefilled.id,
                messageid: 0,
                message: { text: 'test text' },
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.roomid === room_prefilled.id,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can remove message', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { skip: true },
            )
            .sendJson({
                type: 'removemessage',
                roomid: room_prefilled.id,
                messageid: 0,
                message: { text: 'test text' },
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.roomid === room_prefilled.id,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can create and update usergroup', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateGroups', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'creategroup', groupName: 'testgroup' })
            .sendJson({
                type: 'updategroup',
                groupName: 'testgroup',
                changes: [{ add: 'candoaloop' }, { add: 'canfly' }],
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updateGroups' &&
                    'testgroup' in reply.groups &&
                    reply.groups['testgroup'].length == 2,
                { skip: true, timeout: 1000 },
            )

            .close()
            .expectClosed();
    });

    it('Can remove usergroup', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateGroups', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'removegroup', groupName: 'testgroup' })
            .expectJson(
                (reply) =>
                    reply.type === 'updateGroups' &&
                    !('testgroup' in reply.groups),
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can set usergroup', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateUsers', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({
                type: 'setusergroup',
                userid: user.id,
                groupName: 'user',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'updatePerms' && reply.perms.length == 2,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can change chat device states', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'joinRoom', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'chatdev', video: true, audio: true })
            .expectJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === true &&
                    reply.audio === true,
                { skip: true, timeout: 1000 },
            )
            .sendJson({ type: 'chatdev', video: false, audio: true })
            .expectJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === false &&
                    reply.audio === true,
                { skip: true, timeout: 1000 },
            )
            .sendJson({ type: 'chatdev', video: true, audio: false })
            .expectJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === true &&
                    reply.audio === false,
                { skip: true, timeout: 1000 },
            )
            .sendJson({ type: 'chatdev', video: false, audio: false })
            .expectJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === false &&
                    reply.audio === false,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('Can toggle talking state', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'login',
                email: 'test.admin@example.com',
                password: admin_password,
                protocol: 'v1',
            })
            .expectJson((reply) => reply.type === 'updateRooms', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'joinRoom', {
                skip: true,
                timeout: 1000,
            })
            .sendJson({ type: 'talking', message: true })
            .expectJson(
                (reply) => reply.type === 'talking' && reply.message === true,
                { skip: true, timeout: 1000 },
            )
            .sendJson({ type: 'talking', message: false })
            .expectJson(
                (reply) => reply.type === 'talking' && reply.message === false,
                { skip: true, timeout: 1000 },
            )

            .close()
            .expectClosed();
    });
    // Window Input & Context menus are a big enough subject to require their own tests
});
