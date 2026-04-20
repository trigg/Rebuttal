/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { rebuttal, create_rebuttal } from '../server.ts';
import requestws from 'superwstest';
import iconv_lite from 'iconv-lite';
import fs from 'fs';
import assert from 'assert';
import { type v1_shared_message_real, type v1_shared_room, type v1_shared_user } from '../protocols/iface/v1/shared.iface.ts';
import { expect } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { AccountStorage } from '../storage/types.ts';

iconv_lite.encodingExists('foo');

describe('protocol v1', () => {
    let rebuttal: rebuttal | null = null;
    const admin_password = 'IHaveThisAmazingAdminPasswordForTesting';
    const room_voice = {
        id: uuidv4(),
        name: 'voiceroom',
        type: 'voice',
        position: 3,
    };
    const room = {
        id: uuidv4(),
        name: 'testroom',
        type: 'text',
        position: 2,
    };
    const room_prefilled = {
        id: uuidv4(),
        name: 'fullroom',
        type: 'text',
        position: 1,
    };
    const user = {
        id: uuidv4(),
        name: 'testadmin',
        email: 'test.admin@example.com',
        password_hash: "",
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
        await rebuttal?.storage.createAccount(user, admin_password);
        await rebuttal?.storage.createRoom(room);
        await rebuttal?.storage.createRoom(room_voice);
        await rebuttal?.storage.createRoom(room_prefilled);

        for (let i = 0; i < 100; i++) {
            const message: v1_shared_message_real = {
                roomid: room_prefilled.id,
                userid: user.id,
                text: 'Message ' + i,
                username: user.name,
                tags: [],
                url: null,
                type: null,
                img: null,
                idx: null,
                width: null,
                height: null
            };
            await rebuttal?.storage.addNewMessage(message);
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateUsers' && reply.userList.length == 2,
                { timeout: 500 },
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { timeout: 500 },
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updatePerms' && reply.perms.length > 0,
                { timeout: 500 },
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { timeout: 500 },
            )
            .sendJson({
                type: 'message',
                filename: null,
                rawfile: null,
                roomid: room.id,
                message: { text: 'test text', tags: [], url: null },
            })
            .waitForJson(
                (reply) =>
                    reply.type == 'sendMessage' &&
                    reply.roomid == room.id &&
                    reply.message.text === 'test text',
                { timeout: 500 },
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { timeout: 500 },
            )
            .sendJson({
                type: 'message',
                roomid: room.id,
                message: { text: 'test text', tags: [], url: null },
                rawfile: fs.readFileSync('./tests/white.b64').toString(),
                filename: 'white.png',
            })
            .waitForJson(
                (reply) =>
                    reply.type == 'sendMessage' &&
                    reply.roomid == room.id &&
                    reply.message.text === 'test text' &&
                    reply.message.img.startsWith(
                        'uploads/' + user.id + '/whitepng',
                    ) &&
                    reply.message.width == 128 &&
                    reply.message.height == 128,
                { timeout: 500 },
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { timeout: 500 },
            )
            .sendJson({
                type: 'message',
                roomid: room.id,
                filename: null,
                rawfile: null,
                message: { text: 'test text', userid: uuidv4(), tags: [], url: null },
            })
            .waitForJson(
                (reply) =>
                    reply.type == 'sendMessage' &&
                    reply.roomid == room.id &&
                    reply.message.text === 'test text' &&
                    reply.message.userid == user.id,
                { timeout: 500 },
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
            .waitForJson((reply) => reply.type === 'invite', {

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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.messages.length > 0,
                { timeout: 500 },
            )
            .close()
            .expectClosed();
    });

    it('request historical chat', async () => {
        expect.hasAssertions();
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
            .waitForJson(
                // TODO This test is brittle, it accidentally checks the order of indexes in objects, which is not intended.
                (reply) => {
                    if (reply.type !== "updateText") {
                        return false;
                    }
                    expect(reply.messages[0]).toEqual({
                        roomid: room_prefilled.id,
                        userid: user.id,
                        text: 'Message 0',
                        username: user.name,
                        tags: [],
                        url: null,
                        type: null,
                        img: null,
                        idx: 0,
                        width: null,
                        height: null,
                    });
                    expect(reply.messages[4]).toEqual({
                        roomid: room_prefilled.id,
                        userid: user.id,
                        text: 'Message 4',
                        username: user.name,
                        tags: [],
                        url: null,
                        type: null,
                        img: null,
                        idx: 4,
                        width: null,
                        height: null,
                    });
                    return true;
                },
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .waitForJson((reply) => reply.type === 'joinRoom', {

                timeout: 1000,
            })
            .sendJson({ type: 'leaveroom', roomid: room_voice.id })
            .waitForJson((reply) => reply.type === 'leaveRoom', {

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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .waitForJson((reply) => reply.type === 'joinRoom', {

                timeout: 1000,
            })
            .sendJson({
                type: 'golive',
                livestate: true,
                livelabel: 'Terminal - yarn test',
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'golive' &&
                    reply.userid === user.id &&
                    reply.roomid === room_voice.id &&
                    reply.livestate &&
                    reply.livelabel == 'Terminal - yarn test',
                { timeout: 1000 },
            )
            .sendJson({ type: 'golive', livestate: false, livelabel: '' })
            .waitForJson(
                (reply) =>
                    reply.type === 'golive' &&
                    reply.userid === user.id &&
                    reply.roomid === room_voice.id &&
                    !reply.livestate,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .waitForJson((reply) => reply.type === 'joinRoom', {

                timeout: 1000,
            })
            .sendJson({
                type: 'golive',
                livestate: true,
                livelabel: 'Terminal - yarn test',
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'golive' &&
                    reply.userid === user.id &&
                    reply.roomid === room_voice.id &&
                    reply.livestate &&
                    reply.livelabel == 'Terminal - yarn test',
                { timeout: 1000 },
            )
            .sendJson({
                type: 'letmesee',
                touserid: user.id,
                message: true,
            })
            .waitForJson(
                (reply) =>
                    reply.type == 'letmesee' &&
                    reply.message == true,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 1000,
            })
            .sendJson({
                type: 'createroom',
                roomName: 'new_room',
                roomType: 'text',
                position: 42,
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length >= 4,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateUsers', {

                timeout: 1000,
            })
            .sendJson({
                type: 'createuser',
                userName: 'created_user',
                groupName: 'homunculus',
                email: 'organism@example.com',
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList[2].name === 'created_user',
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateUsers', {

                timeout: 1000,
            })
            .sendJson({
                type: 'updateuser',
                userName: 'cucumber',
                userid: user.id,
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList.filter(
                        (user: v1_shared_user) => user.name === 'cucumber',
                    ).length == 1,
                { timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('can remove user', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
        const kicking_user: AccountStorage = {
            id: uuidv4(),
            name: 'kickee',
            password_hash: '',
            email: 'kickee@example.com',
            group: 'none',
        };
        await rebuttal?.storage.createAccount(kicking_user, "kick987650");
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
                        password: '',
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList.filter((u: v1_shared_user) => u.name == 'kickee')
                        .length == 1,
                {

                    timeout: 1000,
                },
            )
            .sendJson({ type: 'removeuser', touserid: kicking_user.id, withvengence: false })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateUsers' &&
                    reply.userList.filter(
                        (user: v1_shared_user) => user.name === 'kickee',
                    ).length == 0,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 1000,
            })
            .sendJson({ type: 'removeroom', roomid: created_room_id })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' &&
                    reply.roomList.filter(
                        (room: v1_shared_room) => room.name === 'new_room',
                    ).length == 0,
                { timeout: 1000 },
            )
            .close()
            .expectClosed();
    });

    it('can update message text', async () => {
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { timeout: 500 },
            )
            .sendJson({
                type: 'updatemessage',
                message: {
                    text: 'test text',
                    idx: 0,
                    roomid: room_prefilled.id,
                },
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateText',
                { timeout: 1000 },
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
            .waitForJson(
                (reply) =>
                    reply.type === 'updateRooms' && reply.roomList.length > 0,
                { timeout: 500 },
            )
            .sendJson({
                type: 'removemessage',
                roomid: room_prefilled.id,
                messageid: 0,
                message: { text: 'test text' },
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateText' &&
                    reply.roomid === room_prefilled.id,
                {

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
            .waitForJson((reply) => reply.type === 'updateGroups', {

                timeout: 1000,
            })
            .sendJson({ type: 'creategroup', groupName: 'testgroup' })
            .sendJson({
                type: 'updategroup',
                groupName: 'testgroup',
                changes: [{ add: 'candoaloop' }, { add: 'canfly' }],
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateGroups' &&
                    'testgroup' in reply.groups &&
                    reply.groups['testgroup'].length == 2,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateGroups', {

                timeout: 1000,
            })
            .sendJson({ type: 'removegroup', groupName: 'testgroup' })
            .waitForJson(
                (reply) =>
                    reply.type === 'updateGroups' &&
                    !('testgroup' in reply.groups),
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateUsers', {

                timeout: 1000,
            })
            .sendJson({
                type: 'setusergroup',
                userid: user.id,
                groupName: 'user',
            })
            .waitForJson(
                (reply) =>
                    reply.type === 'updatePerms' && reply.perms.length == 2,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 1000,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .waitForJson((reply) => reply.type === 'joinRoom', {

                timeout: 1000,
            })
            .sendJson({ type: 'chatdev', video: true, audio: true })
            .waitForJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === true &&
                    reply.audio === true,
                { timeout: 1000 },
            )
            .sendJson({ type: 'chatdev', video: false, audio: true })
            .waitForJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === false &&
                    reply.audio === true,
                { timeout: 1000 },
            )
            .sendJson({ type: 'chatdev', video: true, audio: false })
            .waitForJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === true &&
                    reply.audio === false,
                { timeout: 1000 },
            )
            .sendJson({ type: 'chatdev', video: false, audio: false })
            .waitForJson(
                (reply) =>
                    reply.type === 'chatdev' &&
                    reply.video === false &&
                    reply.audio === false,
                { timeout: 1000 },
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
            .waitForJson((reply) => reply.type === 'updateRooms', {

                timeout: 500,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .waitForJson((reply) => reply.type === 'joinRoom', {

                timeout: 500,
            })
            .sendJson({ type: 'joinroom', roomid: room_voice.id })
            .sendJson({ type: 'talking', talking: true })
            .waitForJson(
                (reply) => reply.type === 'talking' && reply.talking === true,
                { timeout: 500 },
            )
            .sendJson({ type: 'talking', talking: false })
            .waitForJson(
                (reply) => reply.type === 'talking' && reply.talking === false,
                { timeout: 500 },
            )

            .close()
            .expectClosed();
    });
    // Window Input & Context menus are a big enough subject to require their own tests
});
