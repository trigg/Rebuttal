/**
 * Actual checks on client should be done in its own repo. This just needs to check the plugin layer works fine
 */

const rebuttal = require("../server.js")
const request = require('supertest')

describe("Webserver works", () => {
    beforeAll(async () => {
        // Create a server with made up config
        var config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: "https://localhost:9000/",
            plugins: [
                "webclient"
            ]
        }
        await rebuttal.create(config)
        // Don't save storage to disk for tests.
        rebuttal.storage.fileName = null
    });

    it('Web client answers index', async () => {
        const res = await request(rebuttal.app)
            .get('/')
            .send()
        expect(res.statusCode).toEqual(200)
    })
})