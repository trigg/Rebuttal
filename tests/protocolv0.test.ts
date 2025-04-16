/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { rebuttal, create_rebuttal } from '../server.ts';
import requestws from 'superwstest';
import iconv_lite from 'iconv-lite';
iconv_lite.encodingExists('foo');
import event, { Priority } from '../events.ts';
import assert from 'assert';

describe('protocol v0', () => {
    const admin_password = 'IHaveThisAmazingAdminPasswordForTesting';
    let rebuttal: rebuttal | null = null;

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
        await rebuttal?.storage.createAccount({
            id: '00000000-0000-1111-0000-000000000000',
            name: 'testadmin',
            email: 'test.admin@example.com',
            password: admin_password,
            group: 'admin',
        });
    });
    beforeEach((done) => {
        rebuttal?.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal?.close(done);
    });
    it('turns away clients using malformed JSON', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendText("{type:'message, error:'error;}")
            .expectClosed();
    });
    it("'login' passes", async () => {
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
                (reply) => reply.type === 'login' && reply.success == true,
            )
            .close()
            .expectClosed();
    });

    it("'login' fails with bad login", async () => {
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
                email: 'someone@example.com',
                password: 'iforgor',
                protocol: 'v1',
            })
            .expectJson(
                (reply) =>
                    reply.type === 'error' &&
                    reply.message === 'Permission denied',
            )
            .close()
            .expectClosed();
    });

    it("attempting 'create room' from protocol v1 without switching", async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'createroom',
                roomType: 'text',
                roomName: 'Testers chat',
            })
            .expectJson((reply) => reply.type === 'error')
            .expectClosed();
    });

    it("'signup' works", async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'signup',
                password: 'icanhaspassword',
                email: 'someone@example.com',
                userName: 'UserName',
                signUp: '00000000-0000-0000-0000-000000000000',
            })
            .expectJson((reply) => reply.type === 'refreshNow')
            .close()
            .expectClosed();
    });

    it("'signup' fails with bad signup", async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'signup',
                password: 'icanhaspassword',
                email: 'someone@example.com',
                userName: 'LetMeIn',
                signUp: 'thisisnotavalidsignup',
            })
            .expectJson((reply) => reply.type === 'error')
            .close()
            .expectClosed();
    });

    it("'signup' followed by 'login' works", async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'signup',
                password: 'icanhasbetterpassword',
                email: 'admin@example.com',
                userName: 'AdminUserName',
                signUp: '11111111-1111-1111-1111-111111111111',
            })
            .expectJson((reply) => reply.type === 'refreshNow')
            .sendJson({
                type: 'login',
                password: 'icanhasbetterpassword',
                email: 'admin@example.com',
                protocol: 'v1',
            })
            .expectJson(
                (reply) => reply.type === 'login' && reply.success == true,
            )
            .close()
            .expectClosed();
    });

    it('infinite signup', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'signup',
                password: 'icanhasbetterpassword',
                email: 'admin@example.com',
                userName: 'AdminUserName',
                signUp: 'signup',
            })
            .expectJson((reply) => reply.type === 'refreshNow')
            .sendJson({
                type: 'login',
                password: 'icanhasbetterpassword',
                email: 'admin@example.com',
                protocol: 'v1',
            })
            .expectJson(
                (reply) => reply.type === 'login' && reply.success == true,
            )
            .close()
            .expectClosed();
    });
    it('signup fails without enough information', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'signup',
                email: 'admin@example.com',
                userName: 'AdminUserName',
                signUp: 'signup',
            })
            .expectJson((reply) => reply.type === 'error')
            .close()
            .expectClosed();
    });
    it('login with unknown protocol fails', async () => {
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
                protocol: 'udp over https',
            })
            .expectJson((reply) => reply.type === 'error')
            .close()
            .expectClosed();
    });

    it('login with attempt to remain on protocol v0 fails', async () => {
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
                protocol: 'v0',
            })
            .expectJson((reply) => reply.type === 'error')
            .close()
            .expectClosed();
    });

    it('plugin may deny a valid signup', async () => {
        expect.assertions(0);
        event.listen('usercreate', Priority.EARLY, (e) => {
            e.cancelled = true;
        });
        assert(rebuttal !== null);

        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson(
                (reply) =>
                    reply.type === 'connect' && reply.protocols.includes('v1'),
            )
            .sendJson({
                type: 'signup',
                password: 'icanhasbetterpassword',
                email: 'admin@example.com',
                userName: 'AdminUserName',
                signUp: 'signup',
            })
            .expectJson((reply) => reply.type === 'error')
            .close()
            .expectClosed();
    });

    it('plugin may deny valid login', async () => {
        expect.assertions(0);
        event.listen('userauth', Priority.EARLY, (e) => {
            e.cancelled = true;
        });
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
            .expectJson((reply) => reply.type === 'error')
            .close()
            .expectClosed();
    });
});
