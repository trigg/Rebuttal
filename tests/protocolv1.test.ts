/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { rebuttal, create_rebuttal, type User, type Room } from '../server.ts';
import requestws from 'superwstest';
import iconv_lite from 'iconv-lite';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MessageStorage } from '../storage/interface.ts';
import assert from 'assert';

iconv_lite.encodingExists('foo');

describe('protocol v1', () => {
    let rebuttal: rebuttal | null = null;
    const admin_password = 'IHaveThisAmazingAdminPasswordForTesting';
    const room_voice = {
        id: uuidv4(),
        name: 'voiceroom',
        type: 'voice',
    };
    const room = {
        id: uuidv4(),
        name: 'testroom',
        type: 'text',
    };
    const room_prefilled = {
        id: uuidv4(),
        name: 'fullroom',
        type: 'text',
    };
    const user = {
        id: uuidv4(),
        name: 'testadmin',
        email: 'test.admin@example.com',
        password: admin_password,
        group: 'admin',
    };
    beforeAll(async () => {
        const config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: 'https://localhost:9000/',
            infinitesignup: 'user',
            plugins: [],
            test_mode: true,
        };
        rebuttal = await create_rebuttal(config);

        // Don't save storage to disk for tests.
        await rebuttal?.storage.generateSignUp(
            'user',
            '00000000-0000-0000-0000-000000000000',
        );
        await rebuttal?.storage.generateSignUp(
            'admin',
            '11111111-1111-1111-1111-111111111111',
        );
        await rebuttal?.storage.createAccount(user);
        await rebuttal?.storage.createRoom(room);
        await rebuttal?.storage.createRoom(room_voice);
        await rebuttal?.storage.createRoom(room_prefilled);

        for (let i = 0; i < 100; i++) {
            const message: MessageStorage = {
                roomid: room_prefilled.id,
                userid: user.id,
                text: 'Message ' + i,
                username: user.name,
                tags: [],
                url: null,
                type: null,
                img: null,
            };
            await rebuttal?.storage.addNewMessage(room_prefilled.id, message);
        }
    });

    beforeEach((done) => {
        rebuttal?.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal?.close(done);
    });
    it('userlist sent after login', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    // TODO Compare actually existant rooms. Somehow github testing gets a different answer to local...
    it('roomlist sent after login', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('user permissions are sent after login', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('sending a message to a text room', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('sending an image to a text room', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('sending a message with an intentionally wrong userid is overridden', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('generate invite', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('request most recent chat', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('request historical chat', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                // TODO This test is brittle, it accidentally checks the order of indexes in objects, which is not intended.
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.roomid === room_prefilled.id &&
                    reply.segment === 0 &&
                    JSON.stringify(reply.messages[0]) ==
                        JSON.stringify({
                            roomid: room_prefilled.id,
                            userid: user.id,
                            text: 'Message 0',
                            username: user.name,
                            tags: [],
                            url: null,
                            type: null,
                            img: null,
                            idx: 0,
                        }) &&
                    JSON.stringify(reply.messages[4]) ==
                        JSON.stringify({
                            roomid: room_prefilled.id,
                            userid: user.id,
                            text: 'Message 4',
                            username: user.name,
                            tags: [],
                            url: null,
                            type: null,
                            img: null,
                            idx: 4,
                        }),
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('join, check, and leave a voice room', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can initiate a livestream', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can request viewing of a stream', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can create room', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                    reply.type === 'updateRooms' && reply.roomList.length >= 4,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('can create user', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can rename user', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                    reply.userList.filter(
                        (user: User) => user.name === 'cucumber',
                    ).length == 1,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('can remove user', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
        const kicking_user = {
            id: uuidv4(),
            name: 'kickee',
            password: 'kickee',
            email: 'kickee@example.com',
            group: 'none',
        };
        await rebuttal?.storage.createAccount(kicking_user);
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .exec(async () => {
                assert(rebuttal !== null);
                await requestws(rebuttal.server)
                    .ws('/ipc', { rejectUnauthorized: false })
                    .expectJson(
                        (reply) =>
                            reply.type === 'connect' &&
                            reply.protocols.includes('v1'),
                    )
                    .sendJson({
                        type: 'login',
                        email: kicking_user.email,
                        password: kicking_user.password,
                        protocol: 'v1',
                    })
                    .expectClosed();
            })
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
                    reply.type === 'updateUsers' &&
                    reply.userList.filter((u: User) => u.name == 'kickee')
                        .length == 1,
                {
                    skip: true,
                    timeout: 1000,
                },
            )
            .sendJson({ type: 'removeuser', touserid: kicking_user.id })
            .expectJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList.filter(
                        (user: User) => user.name === 'kickee',
                    ).length == 0,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('can remove room', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
        const created_room_id = (await rebuttal.storage.getAllRooms()).filter(
            (room) => room.name === 'new_room',
        )[0].id;
        await requestws(rebuttal?.server)
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
                    reply.roomList.filter(
                        (room: Room) => room.name === 'new_room',
                    ).length == 0,
                { skip: true, timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('can update message', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
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

    it('can remove message', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                { skip: true, timeout: 500 },
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
                {
                    skip: true,
                    timeout: 1000,
                },
            )
            .close()
            .expectClosed();
    });

    it('can create and update usergroup', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can remove usergroup', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can set usergroup', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can change chat device states', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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

    it('can toggle talking state', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
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
                timeout: 500,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .expectJson((reply) => reply.type === 'joinRoom', {
                skip: true,
                timeout: 500,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .sendJson({ type: 'talking', talking: true })
            .expectJson(
                (reply) => reply.type === 'talking' && reply.talking === true,
                { skip: true, timeout: 500 },
            )
            .sendJson({ type: 'talking', talking: false })
            .expectJson(
                (reply) => reply.type === 'talking' && reply.talking === false,
                { skip: true, timeout: 500 },
            )

            .close()
            .expectClosed();
    });
    // Window Input & Context menus are a big enough subject to require their own tests
});
