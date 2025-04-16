/**
 * Actual checks on client should be done in its own repo. This just needs to check the plugin layer works fine
 */

import { create_rebuttal, type rebuttal } from '../server.ts';
import request from 'supertest';
import event, { Priority, type Event } from '../events.ts';
import assert from 'node:assert';

describe('webserver works', () => {
    let rebuttal: rebuttal | null = null;
    beforeAll(async () => {
        // Create a server with made up config
        const config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: 'https://localhost:9000/',
            plugins: ['webclient'],
            test_mode: true,
        };
        rebuttal = await create_rebuttal(config);
    });

    it('web client answers index', (done) => {
        expect.assertions(0);
        assert(rebuttal !== null);
        request(rebuttal.app).get('/').expect(200, done);
    });

    it('web client provides default theme', (done) => {
        expect.assertions(0);
        assert(rebuttal !== null);
        request(rebuttal.app)
            .get('/img/bubblegum/theme.json')
            .expect(200, done);
    });

    it('injects themes into welcome object', async () => {
        expect.assertions(1);
        event.listen('connectionnew', Priority.MONITOR, (e: Event) => {
            console.log(e);
            expect(e.welcomeObj).toHaveProperty('themelist');
        });
        await event.trigger('connectionnew', { welcomeObj: {} });
    });
});
