const {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} = require('@jest/globals');
const rebuttal = require('../server.js');
const request = require('supertest');
const fs = require('fs');

describe('webserver works', () => {
    var test_moved_uploads = false;
    beforeAll(() => {
        if (fs.existsSync('uploads')) {
            if (!fs.existsSync('uploads-nottesting')) {
                fs.renameSync('uploads', 'uploads-nottesting');
                test_moved_uploads = true;
            } else {
                console.log(
                    'Uploads and backed up uploads exist. Skipping some tests',
                );
            }
        }
    });
    afterAll(() => {
        if (test_moved_uploads && fs.existsSync('uploads-nottesting')) {
            if (fs.existsSync('uploads')) {
                fs.rmSync('uploads', { recursive: true, force: true });
            }
            fs.renameSync('uploads-nottesting', 'uploads');
        }
    });
    beforeEach(async () => {
        // Create a server with made up config
        var config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: 'https://localhost:9000/',
        };
        await rebuttal.create(config);
        // Don't save storage to disk for tests.
        rebuttal.storage.fileName = null;
    });

    it('invite page answers', async () => {
        expect.assertions(0);
        await request(rebuttal.app).get('/invite/index.html').expect(200);
    });

    it('populates new storage', async () => {
        expect.hasAssertions();
        await rebuttal.populateNewConfig();
        expect(
            (await rebuttal.storage.getAllAccounts()).length,
        ).toBeGreaterThan(0);
    });
});
