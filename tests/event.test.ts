import { event, priority } from '../events.ts';

describe('events', () => {
    let eventstage = -1;
    beforeAll(() => {
        event.init();
    });

    it('fails to listen to unregistered event', () => {
        expect.assertions(1);
        expect(() => {
            event.listen('doesnotexist', priority.EARLY, (_event) => { });
        }).toThrow('Listening to non-existant event : doesnotexist');
    });

    it('register new event', () => {
        expect.assertions(1);
        event.register('testevent');
        expect(event.listeners).toHaveProperty('testevent');
    });

    it('can add event listeners', () => {
        expect.assertions(0);
        event.listen('testevent', priority.MONITOR, function (_event) {
            console.log('Sanity test-  should be last');
            if (eventstage >= priority.MONITOR) {
                throw new Error('Event priorities called out of order');
            }
            if (eventstage === 0) {
                throw new Error('Event priority MONITOR called first');
            }
            eventstage = priority.MONITOR;
        });

        event.listen('testevent', priority.EARLY, function (_event) {
            console.log('Sanity test-  should be first');
            if (eventstage >= priority.EARLY) {
                throw new Error('Event priorities called out of order');
            }

            eventstage = priority.EARLY;
        });
        event.listen('testevent', priority.LATE, function (_event) {
            console.log('Sanity test-  should be middle');
            if (eventstage >= priority.LATE) {
                throw new Error('Event priorities called out of order');
            }
            eventstage = priority.LATE;
        });
    });

    it('can trigger event', async () => {
        expect.assertions(0);
        await event.trigger('testevent', {});
    });

    it('can mutate values in a triggered event', async () => {
        expect.assertions(5);
        event.register('mutateevent');

        event.listen('mutateevent', priority.EARLY, (e) => {
            e.a = 2;
        });

        event.listen('mutateevent', priority.NORMAL, (e) => {
            expect(e.a).toBe(2);
            expect(e.b).toBe(2);
            e.a = 1;
        });

        event.listen('mutateevent', priority.FINAL, (e) => {
            expect(e.a).toBe(1);
            expect(e.b).toBe(2);
            expect(e.c).toBe(3);
        });

        await event.trigger('mutateevent', { a: 1, b: 2, c: 3 });
    });

    it('can cancel a triggered event', async () => {
        expect.assertions(0);
        event.register('cancelevent');
        event.listen('cancelevent', priority.EARLY, (event) => {
            event.cancelled = true;
        });
        event.listen('cancelevent', priority.NORMAL, () => {
            throw new Error('Continued with cancelled event');
        });
        event.listen('cancelevent', priority.MONITOR, () => {
            throw new Error('Monitored cancelled event');
        });
        await event.trigger('cancelevent', {});
    });

    it('failed to trigger unregistered event', async () => {
        expect.assertions(1);
        await expect(async () => {
            await event.trigger('doesnotexist', {});
        }).rejects.toThrow('Trigger non-existant event : doesnotexist');
    });

    it('fails to reregister the same event', () => {
        expect.assertions(3);
        expect(event.listeners).not.toHaveProperty('duplicate');
        event.register('duplicate');
        expect(event.listeners).toHaveProperty('duplicate');
        event.register('duplicate');
        expect(event.listeners).toHaveProperty('duplicate');
    });
});
