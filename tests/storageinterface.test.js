/**
 * Actual checks on client should be done in its own repo. This just needs to check the plugin layer works fine
 */

const StorageInterface = require("../storage/interface")
const json = require("../storage/json")
const sqlite = require("../storage/sqlite")
const { v4: uuidv4 } = require("uuid");

[sqlite, json].forEach((storage) => {
    storage.test_mode()
    storage.start()
})

describe("Storage systems have a full interface", () => {
    it('JSON Storage matches interface', async () => {
        for (const method in StorageInterface) {
            expect(json).toHaveProperty(method)
            expect(typeof json[method]).toBe("function")
        }
    })


    it('Sqlite Storage matches interface', async () => {
        for (const method in StorageInterface) {
            expect(sqlite).toHaveProperty(method)
            expect(typeof sqlite[method]).toBe("function")

        }
    })
})

for (const [sname, storage] of Object.entries(
    { json: json, sqlite: sqlite })) {

    describe("Storage " + sname + " holds user data correctly", () => {
        storage.test_passalong(() => {
            var userUuid = uuidv4();
            var userUuid2 = uuidv4();
            var password = uuidv4();
            var roomUuid = uuidv4();
            var roomUuid2 = uuidv4();
            var inviteUuid = uuidv4();

            // Create user
            storage.createAccount({
                id: userUuid,
                name: "test",
                password,
                email: "testuser@example.com",
                group: "user"
            });

            storage.createAccount({
                id: userUuid2,
                name: "toast",
                password,
                email: "toast@example.com",
                group: "user",
            })

            // Users with the same password CANNOT match hashes
            expect(storage.getAccountByID(userUuid).password).not.toEqual(storage.getAccountByID(roomUuid2))

            // Check user can login
            var returned_user = storage.getAccountByLogin("testuser@example.com", password);
            expect(returned_user).toHaveProperty("name", "test")
            expect(returned_user).toHaveProperty("id", userUuid)

            // Twiddle plugin to see if it keeps sane
            storage.setPluginData("testPlugin", "key1", "value1");
            storage.setPluginData("testPlugin", "key2", "value2");
            storage.setPluginData("notATestPlugin", "key1", "notvalue1");

            expect(storage.getPluginData("testPlugin", "key1")).toBe("value1");
            expect(storage.getPluginData("testPlugin", "key2")).toBe("value2");
            console.log(storage.getAllPluginData("notATestPlugin"));
            expect(storage.getAllPluginData("notATestPlugin")).toMatchObject({ "key1": "notvalue1" });

            storage.setPluginData("testPlugin", "key2", "updatedValue");
            storage.deleteAllPluginData("notATestPlugin");

            expect(storage.getAllPluginData("testPlugin")).toMatchObject({ key1: "value1", key2: "updatedValue" });
            expect(storage.getAllPluginData("notATestPlugin")).toMatchObject({});

            // Test room operations
            storage.createRoom({
                id: roomUuid,
                name: "testroom",
                type: "text",
            })
            expect(storage.getRoomByID(roomUuid)).toMatchObject({ id: roomUuid, name: "testroom", type: "text" });

            storage.updateRoom(
                roomUuid, { type: "text", name: "realroom" });
            expect(storage.getRoomByID(roomUuid)).toMatchObject({ id: roomUuid, name: "realroom", type: "text" });

            storage.createRoom({
                id: roomUuid2,
                name: "testroomtoo",
                type: "text",
            })

            expect(storage.getAllRooms()).toMatchObject([
                {
                    "id": roomUuid,
                    "name": "realroom",
                    "type": "text",
                },
                {
                    "id": roomUuid2,
                    "name": "testroomtoo",
                    "type": "text",
                },
            ]);

            storage.addNewMessage(roomUuid, {
                text: "Some Message",
                userid: userUuid,
                username: returned_user.name,
                tags: {},
            })

            storage.addNewMessage(roomUuid, {
                text: "A different Message",
                userid: userUuid,
                username: returned_user.name,
                tags: {},
            })

            var segment = storage.getTextRoomNewestSegment(roomUuid);
            var messages = storage.getTextForRoom(roomUuid, segment);
            expect(messages).toMatchObject([
                {
                    "idx": 0,
                    "roomid": roomUuid,
                    "tags": {},
                    "text": "Some Message",
                    "userid": userUuid,
                    "username": "test",
                },
                {
                    "idx": 1,
                    "roomid": roomUuid,
                    "tags": {},
                    "text": "A different Message",
                    "userid": userUuid,
                    "username": "test",
                },
            ]);

            var oldmessage = messages[1];
            oldmessage.text = "A whole new meaning";
            storage.updateMessage(roomUuid, oldmessage.idx, oldmessage);
            var messages = storage.getTextForRoom(roomUuid, segment);

            expect(messages).toMatchObject([
                {
                    "idx": 0,
                    "roomid": roomUuid,
                    "tags": {},
                    "text": "Some Message",
                    "userid": userUuid,
                    "username": "test",
                },
                {
                    "idx": 1,
                    "roomid": roomUuid,
                    "tags": {},
                    "text": "A whole new meaning",
                    "userid": userUuid,
                    "username": "test",
                },
            ]);

            // Delete message
            storage.removeMessage(roomUuid, messages[0].idx);

            var messages = storage.getTextForRoom(roomUuid, segment);

            expect(messages).toMatchObject([
                {
                    "idx": 0,
                    "text": "*Message Removed*",
                },
                {
                    "idx": 1,
                    "roomid": roomUuid,
                    "tags": {},
                    "text": "A whole new meaning",
                    "userid": userUuid,
                    "username": "test",
                },
            ]);

            // Check invite codes. Currently good enough if it doesn't crash I guess?
            storage.generateSignUp("user", inviteUuid);
            storage.expendSignUp(inviteUuid);

            // Check permissions
            storage.addGroupPermission("newgroup", "canjumpslightlyhigher");
            expect(storage.getGroupPermissionList("newgroup")).toMatchObject(["canjumpslightlyhigher"]);
            storage.addGroupPermission("newgroup", "cansitdown");
            storage.addGroupPermission("oldgroup", "canthrow");
            expect(storage.getGroupPermission("newgroup", "cansitdown")).toBe(true);
            expect(storage.getGroupPermission("newgroup", "canthrow")).toBe(false);
            expect(storage.getGroupPermission("oldgroup", "canthrow")).toBe(true);

            expect(storage.getGroups()).toMatchObject(["newgroup", "oldgroup"]);

            // Delete room
            storage.removeRoom(roomUuid);
            expect(storage.getRoomByID(roomUuid)).toBeNull();
            expect(storage.getAllRooms()).toMatchObject([
                {
                    "id": roomUuid2,
                    "name": "testroomtoo",
                    "type": "text",
                },
            ]);

            // Delete user
            storage.removeAccount(userUuid);
            expect(storage.getAccountByID(userUuid)).toBeNull()
            expect(storage.getAllAccounts()).toMatchObject([{ email: "toast@example.com", group: "user", id: userUuid2, name: "toast", password: expect.anything() }]);
        })

    })
}

// TODO MySQL
