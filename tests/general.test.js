const rebuttal = require("../server.js")
const requestws = require('superwstest')
const request = require('supertest')

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

describe("Webserver works", () => {

    it('Invite page answers', async () => {
        const res = await request(rebuttal.app)
            .get('/invite/index.html')
            .send()
        expect(res.statusCode).toEqual(200)
        expect('<title>Rebuttal Webapp</title>' in res.body)
    })

})

describe("Websocket based tests", () => {
    beforeEach((done) => {
        rebuttal.server.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal.server.close(done);
    });

    it('Connects to websocket and fails to auth with incorrect credentials', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'someone@example.com', password: 'iforgor', protocol: 'v1' })
            .expectJson((reply) => (reply.type === 'error' && reply.message === "Permission denied"))
            .close()
            .expectClosed();
    });

    it('Connects and fails to create a room list before login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false })
            .expectJson((reply) => (reply.type === 'connect' && reply.protocols.includes("v1")))
            .sendJson({ type: 'createroom', roomType: 'text', roomName: "Testers chat", protocol: 'v1' })
            .expectJson((reply) => (reply.type === 'error'))
            .close()
            .expectClosed();
    });

})
