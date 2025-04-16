import { create_rebuttal } from '../server.ts';

describe("server can't start", () => {
    it('fails to start without storage', async () => {
        expect.assertions(1);
        const promise = async () => {
            await create_rebuttal({ storage: 'carrierpidgeon', plugins: [] });
        };
        await expect(promise).rejects.toThrow('no storage');
    });

    it('fails if a plugin is unknown', async () => {
        expect.assertions(1);
        const promise = async () => {
            await create_rebuttal({
                storage: 'json',
                plugins: ['notinstalled'],
            });
        };
        await expect(promise).rejects.toThrow('unknown plugin');
    });

    it('fails to find key', async () => {
        expect.assertions(1);
        const promise = async () => {
            await create_rebuttal({
                storage: 'json',
                keypath: '/root/keyfile.please.dont.be.here',
                plugins: [],
            });
        };
        await expect(promise).rejects.toThrow('key file not found');
    });

    it('fails to find cert', async () => {
        expect.assertions(1);
        const promise = async () => {
            await create_rebuttal({
                storage: 'json',
                certpath: '/root/certfile.please.dont.be.here',
                plugins: [],
            });
        };
        await expect(promise).rejects.toThrow('cert file not found');
    });
});
