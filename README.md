
![plainlogo](https://user-images.githubusercontent.com/964775/119275812-1521cc80-bc0f-11eb-94e9-4ead6916a212.png)



Table of Contents
=================
   * [Rebuttal Electron App](#rebuttal-electron-app)
   * [Rebuttal webchat](#rebuttal-webchat)
      * [Customisation](#customisation)
         * [Themes](#themes)
      * [Installation](#installation)
      * [Using](#using)
         * [Permissions &amp; Groups](#permissions--groups)
         * [Sending images in text chat](#sending-images-in-text-chat)
            * [Mouse &amp; Keyboard](#mouse--keyboard)
            * [Touch screens](#touch-screens)

Created by [gh-md-toc](https://github.com/ekalinin/github-markdown-toc)

# Rebuttal Electron App

Install this repository and run `yarn client -- --url=https://127.0.0.1:9000/ipc` in the root. Naturally change the url to point to a running IPC URI on a server

# Rebuttal webchat

Rebuttal webchat is a multimedia webchat system featuring text channels and Voice, Webcam and Livestream rooms. It is written as a NodeJS server and a HTML/JS client served from the server

This is still extremely early development

## Customisation

### Themes

Rebuttal comes with 3 themes by default and allows extras. To create a theme called `example` you need to create `public/css/example.css` and `public/img/example/...`

SCSS sections are used to our own themes but not required of any new themes

## Installation
[See Wiki](https://github.com/trigg/Rebuttal/wiki/Server-Installation)

## Using

### Permissions & Groups

Users belong to one group only. A users permissions is defined by their group only.


| Permission Name | Description         |
| --------------- | ------------------- |
| createRoom      | Can create chat rooms |
| renameRoom      | Can change a rooms name |
| removeRoom      | Can remove a room, messages are deleted with or without permission when this happens |
| createUser      | Can create user. This is not linked to inviting users, and is intended for creating bot accounts |
| renameUser      | Can chane a users name |
| removeUser      | Can remove a user. Optionally deletes all messages and user uploads, with no other permission required |
| renameServer    | Can change `serverimg` and `servername` in config.json from web interface |
| inviteUser      | Can generate invites |
| joinVoiceRoom   | Can join voice chat rooms. Without this the user can only be involved in text chat |
| sendMessage     | Can send messages to text chat |
| changeMessage   | Can change the contents of another users message |
| setUserGroup    | Can change users to a different group |
| noInviteFor     | Invites for new users cannot be an invite at this level |
| inviteUserAny   | Users with this permission can give invites for any group, even those with `noInviteFor` |

### Sending images in text chat


#### Mouse & Keyboard

When viewing a text room Drag-and-Drop the image over the app. A preview should appear above the text input box. To cancel the upload press the red 'x'

#### Touch screens

Honestly I have no idea.




