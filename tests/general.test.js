const rebuttal = require("../server.js")
const requestws = require('superwstest')
const request = require('supertest')

describe("Webserver works", () => {
    beforeEach(async () => {
        // Create a server with made up config
        var config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: "https://localhost:9000/"
        }
        await rebuttal.create(config)
        // Don't save storage to disk for tests.
        rebuttal.storage.fileName = null
    })


    it('Invite page answers', async () => {
        const res = await request(rebuttal.app)
            .get('/invite/index.html')
            .send()
        expect(res.statusCode).toEqual(200)
        expect('<title>Rebuttal Webapp</title>' in res.body)
    })
})
