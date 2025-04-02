const rebuttal = require("../server.js")
const requestws = require('superwstest')

// Create a server with made up config
var config = {
    storage: 'json',
    port: 9000,
    servername: 'testing server',
    serverimg: 'img/server.png',
    gravatarfallback: 'monsterid',
    url: "https://localhost:9000/"
}
rebuttal.create(config)

// Don't save storage to disk for tests.
rebuttal.storage.fileName = null
rebuttal.storage.generateSignUp('user', '00000000-0000-0000-0000-000000000000')
rebuttal.storage.generateSignUp('admin', '11111111-1111-1111-1111-111111111111')

describe("Invites", () => {

    beforeEach((done) => {
        rebuttal.server.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal.server.close(done);
    });

    it('Valid invite works', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'signup', password: 'icanhaspassword', email: "someone@example.com", userName: "UserName", signUp: "00000000-0000-0000-0000-000000000000" })
            .expectJson((reply) => (reply.type === 'refreshNow'))
            .close()
            .expectClosed();
    })


    it('Invalid invite fails', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'signup', password: 'icanhaspassword', email: "someone@example.com", userName: "LetMeIn", signUp: "thisisnotavalidsignup" })
            .expectJson((reply) => (reply.type === 'error'))
            .close()
            .expectClosed();
    })

    it('Admin signup, deletes self, gets kicked', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'signup', password: 'icanhasbetterpassword', email: "admin@example.com", userName: "AdminUserName", signUp: '11111111-1111-1111-1111-111111111111' })
            .expectJson((reply) => (reply.type === 'refreshNow'))
            .sendJson({ type: 'login', password: 'icanhasbetterpassword', email: 'admin@example.com', protocol: "v1" })
            .expectJson((reply) => (reply.type === 'login' && reply.success == true))
            .sendJson({ type: 'removeuser', touserid: null })
            .expectClosed();

    })
})
