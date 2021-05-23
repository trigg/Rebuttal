
window.onload = () => {
    window.ipc.recv('userlist', (userlist) => {
        var d = document.createElement('div');
        d.className = 'list';
        userlist.forEach(user => {
            var dUser = document.createElement('div');
            dUser.className = 'user';
            dUser.id = user.id;


            var dImg = document.createElement('img');
            dImg.className = 'userimg';
            dImg.src = user.img;
            dImg.alt = '';
            dImg.title = '';
            var dUsername = document.createElement('div');
            dUsername.className = 'username';
            dUsername.innerText = user.name;

            d.appendChild(dUser);
            dUser.appendChild(dImg);
            dUser.appendChild(dUsername);
        })
        var body = document.getElementById('body');
        body.innerText = '';
        body.appendChild(d);
    })

    window.ipc.recv('talkstart', (userid) => {
        console.log('Talking start ' + userid)
        var dUser = document.getElementById(userid);
        dUser.classList.add('talking');
    });
    window.ipc.recv('talkstop', (userid) => {
        console.log('Talking stop ' + userid)
        var dUser = document.getElementById(userid);
        dUser.classList.remove('talking');
    })

    window.ipc.send('overlayready', [true]);
}