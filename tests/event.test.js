const event = require('../events.js');

describe('Events', () => {
    var eventstage = -1;
    beforeAll(async () => {
        event.init();
    });

    it('Fails to listen to unregistered event', async () => {
        await expect(() => {
            event.listen('doesnotexist', event.priority.EARLY, () => {});
        }).toThrow();
    });

    it('Register new event', async () => {
        event.register('testevent');
        await expect(event.listeners).toHaveProperty('testevent');
    });

    it('Can add event listeners', async () => {
        event.listen('testevent', event.priority.MONITOR, function (e) {
            console.log('Sanity test-  should be last ' + e);
            if (eventstage >= event.priority.MONITOR) {
                throw new Error('Event priorities called out of order');
            }
            if (eventstage === 0) {
                throw new Error('Event priority MONITOR called first');
            }
            eventstage = event.priority.MONITOR;
        });

        event.listen('testevent', event.priority.EARLY, function (e) {
            console.log('Sanity test-  should be first ' + e);
            if (eventstage >= event.priority.EARLY) {
                throw new Error('Event priorities called out of order');
            }

            eventstage = event.priority.EARLY;
        });
        event.listen('testevent', event.priority.LATE, function (e) {
            console.log('Sanity test-  should be middle ' + e);
            if (eventstage >= event.priority.LATE) {
                throw new Error('Event priorities called out of order');
            }
            eventstage = event.priority.LATE;
        });
    });

    it('Can trigger event', async () => {
        event.trigger('testevent', {});
    });

    it('Can mutate values in a triggered event', async () => {
        event.register('mutateevent');

        event.listen('mutateevent', event.priority.EARLY, (e) => {
            e.a = 2;
        });

        event.listen('mutateevent', event.priority.NORMAL, (e) => {
            expect(e.a).toBe(2);
            expect(e.b).toBe(2);
            e.a = 1;
        });

        event.listen('mutateevent', event.priority.FINAL, (e) => {
            expect(e.a).toBe(1);
            expect(e.b).toBe(2);
            expect(e.c).toBe(3);
        });

        await event.trigger('mutateevent', { a: 1, b: 2, c: 3 });
    });

    it('Can cancel a triggered event', async () => {
        event.register('cancelevent');
        event.listen('cancelevent', event.priority.EARLY, (e) => {
            e.cancelled = true;
        });
        event.listen('cancelevent', event.priority.NORMAL, (_e) => {
            throw new Error('Continued with cancelled event');
        });
        event.listen('cancelevent', event.priority.MONITOR, (_e) => {
            throw new Error('Monitored cancelled event');
        });
        await event.trigger('cancelevent', {});
    });

    it('Failed to trigger unregistered event', async () => {
        await expect(async () => {
            await event.trigger('doesnotexist', {});
        }).rejects.toThrow();
    });

    it('Fails to reregister the same event', () => {
        expect(event.listeners).not.toHaveProperty('duplicate');
        event.register('duplicate');
        expect(event.listeners).toHaveProperty('duplicate');
        event.register('duplicate');
        expect(event.listeners).toHaveProperty('duplicate');
    });
});
