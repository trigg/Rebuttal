'use strict';

onstart.push(() => {
    toggleSettings = () => {
        isSettings = !isSettings;
        if (isSettings) {
            navigator.mediaDevices.enumerateDevices().then(updateOutputsInSettings).catch(e => console.error(e));
            el.popupsettings.style.display = 'flex';
        } else {
            el.popupsettings.style.display = 'none';
        }
    }

    toggleServer = () => {
        isServer = !isServer;
        if (isServer) {
            el.popupserver.style.display = 'flex';
        } else {
            el.popupserver.style.display = 'none';
        }
    }

    // Custom Selects
    const customSelect = function () {
        this.querySelector('.custom-select').classList.toggle('open');
    }

    document.querySelectorAll('.custom-select-wrapper').forEach((sel => {
        sel.addEventListener('click', customSelect);
    }));

    const dropDownCallback = function () {
        var lastselected = this.parentNode.querySelector('.custom-option.selected');
        if (lastselected) { lastselected.classList.remove('selected'); }
        this.classList.add('selected');
        this.closest('.custom-select').querySelector('.custom-select__trigger span').textContent = this.textContent;

        console.log(this.textContent);
        console.log(this.dataset.value);
        console.log(this.parentNode.dataset.id);

        switch (this.parentNode.dataset.id) {
            case "settingsfont":
                setConfig('font', this.dataset.value);
                changeFont(this.dataset.value);
                break;
            case "settingstheme":
                setConfig('theme', this.dataset.value);
                changeTheme(this.dataset.value);
                break;
            case "settingscamdevice":
                setConfig('cameradevice', this.dataset.value);
                startLocalDevices();
                break;
            case "settingsmicdevice":
                setConfig('microphonedevice', this.dataset.value);
                startLocalDevices();
                break;
        }


    }

    for (const option of document.querySelectorAll(".custom-option")) {
        option.addEventListener('click', dropDownCallback);
    }

    const setCustomSelect = function (ele, option) {
        ele.querySelectorAll(".custom-option").forEach(element => {
            if (element.dataset.value === option) {
                var lastselected = element.parentNode.querySelector('.custom-option.selected');
                if (lastselected) {
                    lastselected.classList.remove('selected');
                }

                ele.querySelector('.custom-select__trigger span').textContent = element.textContent;
                element.classList.add('selected');
            }
        })
    }

    const emptyCustomSelect = function (ele) {
        ele.querySelector('.custom-options').innerText = ''
    }

    const populateCustomSelect = function (ele, opts) {
        var innerlist = ele.querySelector('.custom-options');

        opts.forEach(opt => {

            var span = document.createElement('span');
            span.className = 'custom-option';
            span.dataset.value = opt.value;
            span.innerText = opt.text;
            span.addEventListener('click', dropDownCallback);

            innerlist.appendChild(span);
            if (innerlist.childElementCount == 1) {
                setCustomSelect(ele, opt.value);
            }
        })

    }

    setCustomSelect(el.settingsfont, font);

    updateThemesInSettings = function () {
        el.settingsthemelist.innerText = '';
        themelist.forEach(theme => {
            var span = document.createElement('span');
            span.className = 'custom-option';
            span.dataset.value = theme.id;
            span.innerText = theme.name;
            span.addEventListener('click', dropDownCallback);
            el.settingsthemelist.appendChild(span);
        });
        setCustomSelect(el.settingstheme, theme);
    }

    // Settings Tabs

    const switchToSettingsPane = (pane) => {
        el.settings.querySelectorAll('.settingspane').forEach(pane => {
            pane.style.display = 'none';
        });
        el[pane].style.display = 'block';
    }

    const switchToServerPane = (pane) => {
        el.server.querySelectorAll('.serverpane').forEach(pane => {
            pane.style.display = 'none';
        });
        el[pane].style.display = 'block';
    }

    el.settings.querySelectorAll('.settingstab').forEach(tab => {
        tab.onclick = (event) => {
            switchToSettingsPane(event.target.dataset.link);
        }
    })

    el.server.querySelectorAll('.servertab').forEach(tab => {
        tab.onclick = (event) => {
            switchToServerPane(event.target.dataset.link);
        }
    })

    switchToSettingsPane('settingspaneappearance');
    switchToServerPane('serverpanecreateroom');

    // Enumerate Devices

    updateInputsInSettings = function (devices) {
        // First, clear lists
        emptyCustomSelect(el.settingsmicdevice);
        emptyCustomSelect(el.settingscamdevice);

        populateCustomSelect(el.settingsmicdevice, [{ text: 'Any', value: 'none' }]);
        populateCustomSelect(el.settingscamdevice, [{ text: 'Any', value: 'none' }]);
        if (!devices) { return; }
        devices.forEach(device => {
            switch (device.kind) {
                case 'videoinput':
                    populateCustomSelect(el.settingscamdevice, [{ text: device.label, value: device.deviceId }]);
                    break;
                case 'audioinput':
                    populateCustomSelect(el.settingsmicdevice, [{ text: device.label, value: device.deviceId }]);
                    break;
                default:
                    console.log("Unknown device");
                    console.log(device);
                    break;
            }

        })
        var micId = getConfig('microphonedevice', 'none');
        var cameraId = getConfig('cameradevice', 'none');
        setCustomSelect(el.settingscamdevice, cameraId);
        setCustomSelect(el.settingsmicdevice, micId);

    }

    updateOutputsInSettings = function (devices) {
        emptyCustomSelect(el.settingsaudio);
        populateCustomSelect(el.settingsaudio, [{ text: 'Any', value: 'none' }]);
        if (!devices) { return; }
        devices.forEach(device => {
            switch (device.kind) {
                case 'audiooutput':
                    populateCustomSelect(el.settingsaudio, [{ text: device.label, value: device.deviceid }]);
                    break;
                default:
                    console.log("Unknown output devices");
                    console.log(device);
                    break;
            }
        })
        var outputId = getConfig('audiodevice', 'none');
        setCustomSelect(el.settingsaudio, outputId);
    }

    const setupCheckbox = function (setting, element, callback) {
        if (callback) {
            element.onclick = () => { setConfig(setting, element.checked); callback(); };
        }
        element.checked = getConfig(setting, false);
    }

    const setupSlider = function (setting, def, slider, label, callback) {
        if (callback) {
            slider.oninput = () => {
                setConfig(setting, slider.value);
                label.innerText = (label.dataset.prefix ? label.dataset.prefix : '') + slider.value + (label.dataset.postfix ? label.dataset.postfix : '');
                callback();
            }
        }
        slider.value = getConfig(setting, def);
        label.innerText = (label.dataset.prefix ? label.dataset.prefix : '') + slider.value + (label.dataset.postfix ? label.dataset.postfix : '');

    }
    // Callbacks for server commands

    el.createroomform.onsubmit = (event) => {
        event.preventDefault();
        var name = el.createroomname.value;
        el.createroomname.value = '';
        var type = el.createroomtype.value;
        send({ type: 'createroom', roomName: name, roomType: type });
        return false;
    };

    el.createuserform.onsubmit = (event) => {
        event.preventDefault();
        var name = el.createusername.value;
        el.createusername.value = "";
        var email = el.createuseremail.value;
        el.createuseremail.value = "";
        var group = el.createusergroup.value;
        console.log(name + " " + email + " " + group);
        send({ type: 'createuser', userName: name, groupName: group, email: email });
        return false;
    }

    // Options
    setupCheckbox('fliplocal', el.settingFlipWebcam, function (event) {
        var myselfie = document.querySelector('.selfie');
        if (myselfie) {
            if (event.target.checked) {
                myselfie.style.transform = 'rotateY(180deg)';
            } else {
                myselfie.style.transform = '';
            }
        }
    })


    setupCheckbox('noisesupress', el.settingNoiseSupress, () => { startLocalDevices(); });
    setupCheckbox('echocancel', el.settingEchoCancellation, () => { startLocalDevices(); });

    setupSlider('audiobitrate', 64, el.settingbitrate, el.settingbitrateoutput, () => { startLocalDevices(); });
    setupSlider('streamresolution', 1080, el.settingsstreamresolution, el.settingsstreamresolutionoutput, () => { if (localLiveStream) { startLocalDevices(); } });
    setupSlider('streamrate', 30, el.settingsstreamrate, el.settingsstreamrateoutput, () => { if (localLiveStream) { startLocalDevices(); } });

    el.settingbutton.onclick = toggleSettings;
    el.settingsclose.onclick = toggleSettings;

    el.serverbutton.onclick = toggleServer;
    el.serverclose.onclick = toggleServer;

});