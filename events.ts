/* eslint-disable @typescript-eslint/require-await */
/*
    Event Priority is used to allow plugins to cancel or alter events.
    All EARLY callbacks are called first,
    then NORMAL, and then LATE. FINAL is reserved for whoever registered the event and
    should not be used by unrelated plugins. Finally MONITOR is called but cannot
    be used to alter an event or cancel. Intended for logging or debugging
*/

import { type rebuttalSocket } from "./server.ts";

export interface Event {
    [key: string]: unknown;
    cancelled: boolean,
    ref: rebuttalSocket,
}

export interface Listeners {
    [key: string]: Priorities;
}

export interface Priorities {
    [key: number]: { (event: Event): void }[];
}

export const priority = {
    EARLY: 1,
    NORMAL: 2,
    LATE: 3,
    FINAL: 4,
    MONITOR: 5,
};
type PriorityKeys = (typeof priority)[keyof typeof priority];
export const event = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    listeners: {} as Listeners,
    listen: function (
        event_name: string,
        priority: PriorityKeys,
        fn: (event: Event) => void,
    ) {
        if (event_name in this.listeners) {
            this.listeners[event_name][priority].push(fn);
        } else {
            throw new Error('Listening to non-existant event : ' + event_name);
        }
    },
    trigger: async function (event_name: string, event: {
        [key: string]: unknown;
    }) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const pass_event = event as Event; // Forcibly cast in readiness
        pass_event.cancelled = false;
        pass_event.eventtype = event_name;
        if (event_name in this.listeners) {
            for (const pri of Object.values(priority)) {
                for (const fn of this.listeners[event_name][pri]) {
                    fn(pass_event);
                    if (pass_event.cancelled) {
                        return pass_event;
                    }
                }
            }
        } else {
            throw new Error('Trigger non-existant event : ' + event_name);
        }
        return pass_event;
    },
    register: function (event_name: string) {
        if (event_name in this.listeners) {
            console.log('Attemping to re-register event named : ' + event_name);
            return;
        }
        this.listeners[event_name] = {};
        this.listeners[event_name][priority.EARLY] = [];
        this.listeners[event_name][priority.NORMAL] = [];
        this.listeners[event_name][priority.LATE] = [];
        this.listeners[event_name][priority.FINAL] = [];
        this.listeners[event_name][priority.MONITOR] = [];
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
