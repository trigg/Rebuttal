const rebuttal = require("../server.js")
const requestws = require('superwstest')
const iconv_lite = require('iconv-lite');
const fs = require('fs');
const { v4: uuidv4 } = require("uuid");
iconv_lite.encodingExists('foo')

describe("Protocol v1", () => {
    var admin_password = "IHaveThisAmazingAdminPasswordForTesting";
    var room = {
        id: uuidv4(),
        name: 'testroom',
        type: 'voice',
    }
    var user = {
        id: uuidv4(),
        name: 'testadmin',
        email: 'test.admin@example.com',
        password: admin_password,
        group: 'admin',
    }
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
        await rebuttal.storage.createAccount(user)
        await rebuttal.storage.createRoom(room)
    });

    beforeEach((done) => {
        rebuttal.server.listen(0, 'localhost', done);
    });

    afterEach((done) => {
        rebuttal.server.close(done);
    });
    it('Userlist sent after login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false, skip: true, timeout: 1000 })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'test.admin@example.com', password: admin_password, protocol: 'v1' })
            .expectJson((reply) => (reply.type === "updateUsers" && reply.userList.length == 2), { skip: true })
            .close()
            .expectClosed();
    });

    it('Roomlist sent after login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false, skip: true, timeout: 100000 })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'test.admin@example.com', password: admin_password, protocol: 'v1' })
            .expectJson((reply) => (reply.type === "updateRooms" && reply.roomList.length == 1), { skip: true })
            .close()
            .expectClosed();
    });

    it('User permissions are sent after login', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false, skip: true, timeout: 100000 })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'test.admin@example.com', password: admin_password, protocol: 'v1' })
            .expectJson((reply) => (reply.type === "updatePerms" && reply.perms.length > 0), { skip: true })
            .close()
            .expectClosed();
    });

    it('Sending a message to a text room', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false, skip: true, timeout: 100000 })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'test.admin@example.com', password: admin_password, protocol: 'v1' })
            .expectJson((reply) => (reply.type === "updateRooms" && reply.roomList.length > 0), { skip: true })
            .sendJson({ type: 'message', roomid: room.id, message: { text: 'test text' } })
            .expectJson((reply) => (reply.type == "sendMessage" && reply.roomid == room.id && reply.message.text === 'test text'), { skip: true })
            .close()
            .expectClosed();
    });

    it('Sending an image to a text room', async () => {
        await requestws(rebuttal.server)
            .ws('/ipc', { rejectUnauthorized: false, skip: true, timeout: 100000 })
            .expectJson((reply) => (reply.type === "connect" && reply.protocols.includes("v1")))
            .sendJson({ type: 'login', email: 'test.admin@example.com', password: admin_password, protocol: 'v1' })
            .expectJson((reply) => (reply.type === "updateRooms" && reply.roomList.length > 0), { skip: true })
            .sendJson({ type: 'message', roomid: room.id, message: { text: 'test text' }, rawfile: fs.readFileSync("./tests/white.b64").toString(), filename: "white.png" })
            .expectJson((reply) => (reply.type == "sendMessage" && reply.roomid == room.id && reply.message.text === 'test text' && reply.message.img.startsWith('uploads/' + user.id + "/whitepng") && reply.message.width == 128 && reply.message.height == 128), { skip: true })
            .close()
            .expectClosed();
    })
})
