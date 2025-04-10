/*
    Event Priority is used to allow plugins to cancel or alter events.
    All EARLY callbacks are called first,
    then NORMAL, and then LATE. FINAL is reserved for whoever registered the event and
    should not be used by unrelated plugins. Finally MONITOR is called but cannot
    be used to alter an event or cancel. Intended for logging or debugging
*/
var event = {
    listeners: {},
    priority: { EARLY: 1, NORMAL: 2, LATE: 3, FINAL: 4, MONITOR: 5 },
    listen: function (eventName, priority, fn) {
        if (eventName in this.listeners) {
            this.listeners[eventName][priority].push(fn);
        } else {
            throw new Error('Listening to non-existant event : ' + eventName);
        }
    },
    trigger: async function (eventName, event) {
        event.cancelled = false;
        event.eventtype = eventName;
        if (eventName in this.listeners) {
            for (let pri of Object.keys(this.listeners[eventName])) {
                for (let fn of this.listeners[eventName][pri]) {
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
    register: function (eventName) {
        if (eventName in this.listeners) {
            console.log('Attemping to re-register event named : ' + eventName);
            return;
        }
        this.listeners[eventName] = {};
        this.listeners[eventName][this.priority.EARLY] = [];
        this.listeners[eventName][this.priority.NORMAL] = [];
        this.listeners[eventName][this.priority.LATE] = [];
        this.listeners[eventName][this.priority.FINAL] = [];
        this.listeners[eventName][this.priority.MONITOR] = [];
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

module.exports = event;
