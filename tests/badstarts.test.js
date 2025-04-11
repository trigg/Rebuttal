const { describe, expect, it } = require('@jest/globals');
const rebuttal = require('../server.js');

describe("server can't start", () => {
    it('fails to start without storage', async () => {
        expect.assertions(1);
        let promise = async () => {
            await rebuttal.create({ storage: 'carrierpidgeon' });
        };
        await expect(promise).rejects.toThrow('no storage');
    });

    it('fails if a plugin is unknown', async () => {
        expect.assertions(1);
        let promise = async () => {
            await rebuttal.create({
                storage: 'json',
                plugins: ['notinstalled'],
            });
        };
        await expect(promise).rejects.toThrow('unknown plugin');
    });

    it('fails to find key', async () => {
        expect.assertions(1);
        let promise = async () => {
            await rebuttal.create({
                storage: 'json',
                keypath: '/root/keyfile.please.dont.be.here',
            });
        };
        await expect(promise).rejects.toThrow('key file not found');
    });

    it('fails to find cert', async () => {
        expect.assertions(1);
        let promise = async () => {
            await rebuttal.create({
                storage: 'json',
                certpath: '/root/certfile.please.dont.be.here',
            });
        };
        await expect(promise).rejects.toThrow('cert file not found');
    });
});
