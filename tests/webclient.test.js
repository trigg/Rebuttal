/**
 * Actual checks on client should be done in its own repo. This just needs to check the plugin layer works fine
 */

const rebuttal = require('../server.js');
const request = require('supertest');
const fs = require('fs');

describe('Webserver works', () => {
    beforeAll(async () => {
        // Create a server with made up config
        var config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: 'https://localhost:9000/',
            plugins: ['webclient'],
        };
        await rebuttal.create(config);
        // Don't save storage to disk for tests.
        rebuttal.storage.fileName = null;
    });

    it('Web client answers index', async () => {
        const res = await request(rebuttal.app).get('/').send();
        expect(res.statusCode).toEqual(200);
    });

    it('Web client provides default theme', async () => {
        const res = (
            await request(rebuttal.app).get('/img/bubblegum/theme.json')
        ).setEncoding();
        expect(res.statusCode).toEqual(200);
    });

    it('Injects themes into welcome object', () => {
        rebuttal.event.listen(
            'connectionnew',
            rebuttal.event.priority.MONITOR,
            (e) => {
                console.log(e);
                expect(e.welcomeObj).toHaveProperty('themelist');
            },
        );
        rebuttal.event.trigger('connectionnew', { welcomeObj: {} });
    });
});
