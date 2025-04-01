/**
 * Actual checks on client should be done in its own repo. This just needs to check the plugin layer works fine
 */

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
    url: "https://localhost:9000/",
    plugins: [
        "webclient"
    ]
}
rebuttal.create(config)
// Don't save storage to disk for tests.
rebuttal.storage.fileName = null

describe("Webserver works", () => {
    it('Web client answers index', async () => {
        const res = await request(rebuttal.app)
            .get('/')
            .send()
        expect(res.statusCode).toEqual(200)
    })
})