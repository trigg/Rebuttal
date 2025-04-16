import { create_rebuttal, rebuttal, rebuttalInternal } from '../server.ts';
import request from 'supertest';
import fs from 'fs';
import assert from 'assert';

describe('webserver works', () => {
    let rebuttal: rebuttal | null;
    let test_moved_uploads = false;
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
        const config = {
            storage: 'json',
            port: 9000,
            servername: 'testing server',
            serverimg: 'img/server.png',
            gravatarfallback: 'monsterid',
            url: 'https://localhost:9000/',
            plugins: [],
            test_mode: true,
        };
        rebuttal = await create_rebuttal(config);
        // Don't save storage to disk for tests.
    });

    it('invite page answers', async () => {
        expect.assertions(0);
        assert(rebuttal !== null);
        await request(rebuttal.app).get('/invite/index.html').expect(200);
    });

    it('populates new storage', async () => {
        expect.hasAssertions();
        const rebuttal_internal = rebuttal as rebuttalInternal;
        await rebuttal_internal?.populateNewConfig();
        const val = await rebuttal?.storage.getAllAccounts();
        expect(val).not.toBeFalsy();
        expect(val?.length).toBeGreaterThan(0);
    });
});
