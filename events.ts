/* eslint-disable @typescript-eslint/require-await */
/*
    Event Priority is used to allow plugins to cancel or alter events.
    All EARLY callbacks are called first,
    then NORMAL, and then LATE. FINAL is reserved for whoever registered the event and
    should not be used by unrelated plugins. Finally MONITOR is called but cannot
    be used to alter an event or cancel. Intended for logging or debugging
*/

export interface Event {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface Listeners {
    [key: string]: Priorities;
}

export interface Priorities {
    [key: number]: { (event: Event): void }[];
}

export const Priority = {
    EARLY: 1,
    NORMAL: 2,
    LATE: 3,
    FINAL: 4,
    MONITOR: 5,
};
type PriorityKeys = (typeof Priority)[keyof typeof Priority];
export const event = {
    listeners: {} as Listeners,
    listen: function (
        eventName: string,
        priority: PriorityKeys,
        fn: (event: Event) => void,
    ) {
        if (eventName in this.listeners) {
            this.listeners[eventName][priority].push(fn);
        } else {
            throw new Error('Listening to non-existant event : ' + eventName);
        }
    },
    trigger: async function (eventName: string, event: Event) {
        event.cancelled = false;
        event.eventtype = eventName;
        if (eventName in this.listeners) {
            for (const pri of Object.values(Priority)) {
                for (const fn of this.listeners[eventName][pri]) {
                    fn(event);
                    if (event.cancelled) {
                        return false;
                    }
                }
            }
        } else {
            throw new Error('Trigger non-existant event : ' + eventName);
        }
        return true;
    },
    register: function (eventName: string) {
        if (eventName in this.listeners) {
            console.log('Attemping to re-register event named : ' + eventName);
            return;
        }
        this.listeners[eventName] = {};
        this.listeners[eventName][Priority.EARLY] = [];
        this.listeners[eventName][Priority.NORMAL] = [];
        this.listeners[eventName][Priority.LATE] = [];
        this.listeners[eventName][Priority.FINAL] = [];
        this.listeners[eventName][Priority.MONITOR] = [];
    },
    init: function () {
        this.register('serverprep');
        this.register('serverstart');
        this.register('serverstop');

        this.register('connectionnew');
        this.register('connectionclose');

        this.register('userfailedauth');
        this.register('userauth');
        this.register('userquit');
        this.register('userjoinroom');
        this.register('userleaveroom');
        this.register('usercreate');
        this.register('userdelete');
        this.register('userchangename');
        this.register('usercontextmenucallback');

        this.register('roomcreate');
        this.register('roomdelete');

        this.register('messagesend');
        this.register('messagecreate');
        this.register('messagechange');

        this.register('pluginprep');
        this.register('pluginstart');
    },
};

export default event;
