const rebuttal = require("../server.js")
const requestws = require('superwstest')
const iconv_lite = require('iconv-lite');
iconv_lite.encodingExists('foo')

describe("Protocol v0", () => {
    var admin_password = "IHaveThisAmazingAdminPasswordForTesting";

    beforeAll(async () => {
        var config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: "https://localhost:9000/",
            infinitesignup: 'user',
        }
        await rebuttal.create(config)


        // Don't save storage to disk for tests.
        rebuttal.storage.fileName = null
        await rebuttal.storage.generateSignUp('user', '00000000-0000-0000-0000-000000000000')
        await rebuttal.storage.generateSignUp('admin', '11111111-1111-1111-1111-111111111111')
        await rebuttal.storage.createAccount({
            id: '00000000-0000-1111-0000-000000000000',
            name: 'testadmin',
            email: 'test.admin@example.com',
            password: admin_password,
            group: 'admin',
        });
    });

    beforeEach((done) => {
        rebuttal.server.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal.server.close(done);
    });
    it('\'login\' passes', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'test.admin@example.com', password: admin_password, protocol: 'v1' })
            .expectJson((reply) => (reply.type === 'login' && reply.success == true))
            .close()
            .expectClosed();
    });

    it('\'login\' fails with bad login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'someone@example.com', password: 'iforgor', protocol: 'v1' })
            .expectJson((reply) => (reply.type === 'error' && reply.message === "Permission denied"))
            .close()
            .expectClosed();
    });

    it('attempting \'create room\' from protocol v1 without switching', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'createroom', roomType: 'text', roomName: "Testers chat" })
            .expectJson((reply) => (reply.type === 'error'))
            .expectClosed();
    });

    it('\'signup\' works', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'signup', password: 'icanhaspassword', email: "someone@example.com", userName: "UserName", signUp: "00000000-0000-0000-0000-000000000000" })
            .expectJson((reply) => (reply.type === 'refreshNow'))
            .close()
            .expectClosed();
    })

    it('\'signup\' fails with bad signup', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'signup', password: 'icanhaspassword', email: "someone@example.com", userName: "LetMeIn", signUp: "thisisnotavalidsignup" })
            .expectJson((reply) => (reply.type === 'error'))
            .close()
            .expectClosed();
    })

    it('\'signup\' followed by \'login\' works', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'signup', password: 'icanhasbetterpassword', email: "admin@example.com", userName: "AdminUserName", signUp: '11111111-1111-1111-1111-111111111111' })
            .expectJson((reply) => (reply.type === 'refreshNow'))
            .sendJson({ type: 'login', password: 'icanhasbetterpassword', email: 'admin@example.com', protocol: "v1" })
            .expectJson((reply) => (reply.type === 'login' && reply.success == true))
            .close()
            .expectClosed();
    })

})
