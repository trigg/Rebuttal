# Rebuttal webchat

Rebuttal webchat is a multimedia webchat system featuring text channels and Voice, Webcam and Livestream rooms. It is written as a NodeJS server and a HTML/JS client served from the server

This is still extremely early development

## Customisation and Config

### Themes

Rebuttal comes with 3 themes by default and allows extras. To create a theme called `example` you need to create `public/css/example.css` and `public/img/example/...`

SCSS sections are used to our own themes but not required of any new themes

### Config

`config.json` contains the most basic options.

### Storage

Rebuttal comes with 2 storage systems, and more are possible but beyond the scope of this readme. JSON storage is easy for testing but completely unsafe as password and messages are stored plaintext.