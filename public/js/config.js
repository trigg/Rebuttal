'use strict';

const getConfig = (name, defaultvalue) => {
    var value = window.localStorage.getItem(name);
    if (value) {
        return value;
    } else {
        return defaultvalue;
    }
}
const setConfig = (name, value) => {
    if (value) {
        window.localStorage.setItem(name, value);
    } else {
        window.localStorage.removeItem(name);
    }
}

theme = getConfig('theme', 'bubblegum');
font = getConfig('font', null);