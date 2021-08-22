'use strict';

onstart.push(() => {

    // Helpful functions

    const hideCustom = () => {
        el.popupcustomouter.style.display = 'none';
    }

    const div = ({ className, id }) => {
        var d = document.createElement("div");
        if (className) { d.className = className; }
        if (id) { d.id = id; }
        return d;
    }

    const img = ({ className, id, src, alt, title }) => {
        var i = document.createElement('img');
        if (className) { i.className = className; }
        if (alt) { i.setAttribute('alt', alt); }
        if (title) { i.setAttribute('title', title); }
        if (id) { i.id = id; }
        if (src) {
            i.src = 'img/' + theme + '/' + src;
            i.dataset.src = src;
        }
        return i;
    }

    send = (message) => {
        ws.send(JSON.stringify(message));
    }

    connect = () => {
        if (!electronMode) {
            ws = new WebSocket("wss://" + location.hostname + (location.port ? ':' + location.port : '') + "/ipc");
        } else {
            if (!customUrl) {
                return;
            }
            customUrl = customUrl.replace(/^https/i, 'wss');
            customUrl = customUrl.replace(/^http/i, 'ws');
            ws = new WebSocket(customUrl);
        }
        ws.onmessage = (message) => {
            const data = JSON.parse(message.data);
            if (data['type'] in wsFunc) {
                wsFunc[data['type']](data);
            } else {
                console.log("Unknown message type : " + data['type']);
                console.log(data);
            }
        };
        ws.onclose = () => {
            console.log("Connection lost");
            ws = null;
            showError("Connection lost");
        };
    }

    showError = (errMessage) => {
        el.app.innerText = errMessage;
    }

    const wsFunc = {
        "connect": (data) => {
            el.signuplogo.src = data.icon;
            el.signuptitle.innerHTML = markupParser.makeHtml(data.message);

            if (!electronMode) {
                themelist = data.themelist;
            }
        },
        "error": (data) => {
            el.signupReply.innerHTML = el.signupReply.innerHTML = markupParser.makeHtml(data.message);
            console.log(data.message);
        },
        "disconnect": (data) => {
            cleanupStream(data.userid);
        },
        "login": (data) => {
            const { success, userid } = data;
            if (success) {
                showApp();
                setLoginMessage('');
                iam = userid;
                playSound('login');
            } else {
                showLogin();
                setLoginMessage('Invalid email or password');
            }
        },
        "refreshNow": (data) => {
            window.location.href = '/';
        }
    }
    const processSignup = () => {
        var email = el.signupEmail.value;
        var email2 = el.signupEmail2.value;
        var user = el.signupUser.value;
        var password = el.signupPassword.value;
        var password2 = el.signupPassword2.value;
        var reply = el.signupReply;
        el.signupReply.innerText = ''
        if (!email) { el.signupEmail.focus(); return; }
        if (!(email.indexOf('@') > -1 && email.indexOf('.') > -1)) {
            el.signupReply.innerText = 'Please use an email address'
            el.signupEmail.focus(); return;
        }
        if (email !== email2) {
            el.signupReply.innerText = 'Email Addresses must match!'
            el.signupEmail2.focus(); return;
        }
        if (!user) { el.signupUser.focus(); return; }
        // TODO Probably want to be less stringent
        if (!user.match(/^[a-zA-Z0-9-_ ]+$/)) {
            el.signupReply.innerText = 'Username must only contain alphanumeric, dash, underscore and space';
            el.signupUser.focus(); return;
        }
        if (user.length < 3) {
            el.signupReply.innerText = 'Username must be longer than 3 characters';
            el.signupUser.focus(); return;
        }
        if (!password) { el.signupPassword.focus(); return; }
        if (password.length < 7) {
            el.signupReply.innerText = 'Password must be at least 7 characters';

        }
        if (password !== password2) {
            el.signupReply.innerText = 'Passwords must match!'
            el.signupPassword2.focus(); return;
        }

        send({
            type: 'signup',
            email,
            password,
            userName: user,
            signUp: signUpCode
        })

    }
    const changeImg = (img, src) => {
        img.src = 'img/' + theme + '/' + src;
        img.dataset.src = src;
    }
    changeFont = (fontName) => {
        console.log("Changing to font " + fontName);
        font = fontName;
        if (fontName) {
            el.app.style = 'font-family: ' + fontName;
        } else {
            el.app.style = '';
        }

    }

    changeTheme = (themeName) => {
        // Change CSS
        theme = themeName;
        var oldlinks = document.getElementsByTagName('link');
        var head = document.getElementsByTagName('head')[0];
        Object.values(oldlinks).forEach(link => {
            head.removeChild(link);
        });

        var newlink = document.createElement('link');
        newlink.setAttribute('rel', 'stylesheet');
        newlink.setAttribute('type', 'text/css');
        newlink.setAttribute('href', 'css/' + themeName + '.css');
        head.appendChild(newlink);

        // Change IMGs!
        var oldimg = document.getElementsByTagName('img');
        Object.values(oldimg).forEach(img => {
            if ('src' in img.dataset) {
                img.src = 'img/' + theme + '/' + img.dataset.src;
            }
        });
        // And... Image inputs?
        var oldimg = document.getElementsByTagName('input');
        Object.values(oldimg).forEach(img => {
            if (img.getAttribute('type') === 'image') {
                if ('src' in img.dataset) {
                    img.src = 'img/' + theme + '/' + img.dataset.src;
                }
            }
        });

    }

    // Prepare callbacks 
    el.signup.onsubmit = (e) => {
        e.preventDefault();
        processSignup();
        return false;
    }

    // Connect to W
    if (!electronMode) {
        connect();
    }
    showdown.setOption('tables', true);

    markupParser = new showdown.Converter();


    changeTheme('bubblegum');

    signUpCode = window.location.search
    signUpCode = signUpCode.replace(/\?/g, '');

});