'use strict';
// Fooled you

var onstart = [() => {
    // Grab all the constant elements
    // If it's moving parts (chat window, video window, userlist, roomlist) 
    // then absolutely do not use this

    var allElements = document.querySelectorAll('*[id]');
    allElements.forEach((element) => {
        el[element.id] = element;
    });

}];

window.onload = () => {
    onstart.forEach(script => {
        script();
    });
};