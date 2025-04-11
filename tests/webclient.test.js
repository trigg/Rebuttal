/**
 * Actual checks on client should be done in its own repo. This just needs to check the plugin layer works fine
 */

const { beforeAll, describe, expect, it } = require('@jest/globals');
const rebuttal = require('../server.js');
const request = require('supertest');

describe('webserver works', () => {
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

    it('web client answers index', async () => {
        expect.assertions(1);
        const res = await request(rebuttal.app).get('/').send();
        expect(res.statusCode).toEqual(200);
    });

    it('web client provides default theme', async () => {
        expect.assertions(1);
        const res = (
            await request(rebuttal.app).get('/img/bubblegum/theme.json')
        ).setEncoding();
        expect(res.statusCode).toEqual(200);
    });

    it('injects themes into welcome object', () => {
        expect.assertions(1);
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
