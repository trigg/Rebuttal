`use strict`
var el = {};

const getConfig = (name, defaultvalue) => {
    var value = window.localStorage.getItem(name);
    if (value) {
        return value;
    } else {
        return defaultvalue;
    }
}
const setConfig = (name, value) => {
    console.log(value);
    if (value) {
        window.localStorage.setItem(name, value);
    } else {
        window.localStorage.removeItem(name);
    }
}

theme = getConfig('theme', 'bubblegum');
font = getConfig('font', null);

const replaceButtons = () => {
    console.log(getConfig('serverList', "[]"));
    JSON.parse(getConfig('serverList', "[]")).forEach(server => {
        console.log(server);
    });
};

window.onload = () => {
    var allElements = document.querySelectorAll('*[id]');
    allElements.forEach((element) => {
        el[element.id] = element;
    });

    el.browsertabbuttons.onclick = () => {
        replaceButtons();
        el.serverbuttons.style.display = 'flex';
        el.serverformdiv.style.display = 'none';

    }
    el.browsertabform.onclick = () => {
        el.serverbuttons.style.display = 'none';
        el.serverformdiv.style.display = 'flex';
    }
    el.browsertabbuttons.onclick();

    el.serverform.onsubmit = (e) => {
        e.preventDefault();

        var ip = el.serverip.value;

        var server = { host: ip, name: '', img: '', users: [] };

        ws = new WebSocket(ip);
        var timeout = null;

        ws.onmessage = (message) => {
            console.log(message);
            var json = JSON.parse(message.data);
            if (json.type === 'connect') {
                server.name = json.message;
                server.img = json.icon;

                var serverlist = JSON.parse(getConfig('serverList', []));
                serverlist.push(server);
                setConfig('serverList', JSON.stringify(serverlist));

                el.serverip.value = '';
                el.browsertabbuttons.onclick();
                replaceButtons();
            }
            clearTimeout(timeout);
        };
        ws.onclose = () => {
            ws.close();
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => ws.close(), 1000);

        return false;
    }

    replaceButtons();
}