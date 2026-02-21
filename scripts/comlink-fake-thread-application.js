import {openActorSheet, saveThreadAsJournalEntry, scrollToBottom} from './utils.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function getApplicationRootElement(app) {
    if (app?.element instanceof HTMLElement) return app.element;
    if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
    return null;
}

class ComlinkFakeThread extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "comlink-fake-thread-window",
        tag: "section",
        position: {
            width: 900,
            height: 500
        },
        window: {
            title: "Comlink Fake Thread",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/comlink-thread/templates/fake-display.hbs"
        }
    };

    _onRender(context, options) {
        super._onRender(context, options);

        const root = getApplicationRootElement(this);
        if (!root) return;

        const currentThread = game.settings.get("comlink-thread", "currentFakeThread");
        this._updateMessagesVisibility(root, currentThread.type, currentThread.threadId);

        root.querySelector(".clear-messages-btn")?.addEventListener("click", () => {
            clearComlinkMessages();
        });
        root.querySelector(".screenshot-btn")?.addEventListener("click", () => {
            saveThreadAsJournalEntry(root);
        });
        root.querySelectorAll(".delete-btn").forEach((button) => {
            button.addEventListener("click", (event) => {
                const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                if (messageId) deleteComlinkMessage(messageId);
            });
        });
        root.querySelectorAll(".move-up-btn").forEach((button) => {
            button.addEventListener("click", (event) => {
                const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                if (messageId) moveUpComlinkMessage(messageId);
            });
        });
        root.querySelectorAll(".move-down-btn").forEach((button) => {
            button.addEventListener("click", (event) => {
                const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                if (messageId) moveDownComlinkMessage(messageId);
            });
        });
        root.querySelectorAll(".toggle-anonymous-btn").forEach((button) => {
            button.addEventListener("click", (event) => {
                const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                if (messageId) toggleComlinkMessageAnonymous(messageId);
            });
        });
        root.querySelectorAll(".toggle-offline-btn").forEach((button) => {
            button.addEventListener("click", (event) => {
                const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                if (messageId) toggleComlinkMessageOffline(messageId);
            });
        });
        root.querySelectorAll(".toggle-right-btn").forEach((button) => {
            button.addEventListener("click", (event) => {
                const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                if (messageId) toggleComlinkMessageRight(messageId);
            });
        });
        root.querySelector("#comlink-thread-user-page")?.addEventListener("click", (event) => {
            openActorSheet(event.currentTarget.dataset.userId);
        });
        root.querySelectorAll(".message .profile-pic").forEach((picture) => {
            picture.addEventListener("dblclick", (event) => {
                const userId = event.currentTarget.dataset.userId;
                if (userId) openActorSheet(userId);
            });
        });
        // All messages conv
        root.querySelector(".comlink-contact.all")?.addEventListener("click", () => {
            this._updateMessagesVisibility(root, "all", null);

            game.settings.set("comlink-thread", "currentFakeThread", {type: "all", threadId: null});
        });
        // Character conv
        root.querySelectorAll(".comlink-contact:not(.all)").forEach((contact) => {
            contact.addEventListener("click", (event) => {
                const threadId = event.currentTarget.dataset.threadId;
                this._updateMessagesVisibility(root, "character", threadId);

                game.settings.set("comlink-thread", "currentFakeThread", {type: "character", threadId});
            });
        });
    }

    _updateMessagesVisibility(root, type, threadId) {
        let visibleMessages = [];
        let hiddenMessages = [];
        if (type === "character") {
            visibleMessages = [...root.querySelectorAll(`.message[data-thread-id="${threadId}"]`)];
            hiddenMessages = [...root.querySelectorAll(`.message:not([data-thread-id="${threadId}"])`)];
        } else {
            visibleMessages = [...root.querySelectorAll(".message")];
        }

        // Make sure they're visible
        visibleMessages.forEach((message) => {
            message.hidden = false;
        });
        // Make sure they're hidden
        hiddenMessages.forEach((message) => {
            message.hidden = true;
        });

        const container = root.querySelector(".comlink-container");
        if (container) container.dataset.threadType = type;

        const messageList = root.querySelector(".comlink-message-list");
        if (messageList) scrollToBottom(messageList);
    }

    async _prepareContext() {
        let messages = game.settings.get("comlink-thread", "fakeMessages");
        messages.forEach(m => {
            // Retrieve actors objects
            m.sender = game.actors.get(m.senderId);
        });

        const threads = getFakeThreads();
        // Check if currentThread needs to be reset, to prevent opening on a deleted thread
        const currentThread = game.settings.get("comlink-thread", "currentFakeThread");
        if (currentThread.threadId && !threads.includes(currentThread.threadId)) {
            game.settings.set("comlink-thread", "currentFakeThread", {type: "all", threadId: null});
        }

        return {
            messages,
            threads
        };
    }
}

async function clearComlinkMessages() {
    await game.settings.set("comlink-thread", "fakeMessages", [])

    // Trigger a UI update
    updateComlinkDisplay();
}

async function deleteComlinkMessage(messageId) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "fakeMessages");
    // Remove message from list
    await game.settings.set("comlink-thread", "fakeMessages", messages.filter(m => m.id !== messageId))

    // Trigger a UI update
    updateComlinkDisplay();
}

async function moveUpComlinkMessage(messageId) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "fakeMessages");

    // Find the index of the object with the matching id
    const index = messages.findIndex(item => item.id === messageId);

    // Check if the object was found and if it can be moved up
    if (index > 0) {
        // Swap the object with the one before it
        [messages[index - 1], messages[index]] = [messages[index], messages[index - 1]];

        // Save reordered list
        await game.settings.set("comlink-thread", "fakeMessages", messages)

        // Trigger a UI update
        updateComlinkDisplay();
    }
}

function moveDownComlinkMessage(messageId) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "fakeMessages");

    // Find the index of the object with the matching id
    const index = messages.findIndex(item => item.id === messageId);

    // Check if the object was found and if it can be moved up
    if (index !== -1 && index < messages.length - 1) {
        // Swap the object with the one after it
        [messages[index + 1], messages[index]] = [messages[index], messages[index + 1]];

        // Save reordered list
        game.settings.set("comlink-thread", "fakeMessages", messages)

        // Trigger a UI update
        updateComlinkDisplay();
    }
}

function toggleComlinkMessageAnonymous(messageId) {
    // Retrieve existing messages
    const messages = game.settings.get("comlink-thread", "fakeMessages");

    // Find the index of the object with the matching id
    const message = messages.find(item => item.id === messageId);
    message.isAnonymous = !message.isAnonymous

    // Save updated list
    game.settings.set("comlink-thread", "fakeMessages", messages)

    // Trigger a UI update
    updateComlinkDisplay();
}

function toggleComlinkMessageOffline(messageId) {
    // Retrieve existing messages
    const messages = game.settings.get("comlink-thread", "fakeMessages");

    // Find the index of the object with the matching id
    const message = messages.find(item => item.id === messageId);
    message.isOffline = !message.isOffline

    // Save updated list
    game.settings.set("comlink-thread", "fakeMessages", messages)

    // Trigger a UI update
    updateComlinkDisplay();
}

function toggleComlinkMessageRight(messageId) {
    // Retrieve existing messages
    const messages = game.settings.get("comlink-thread", "fakeMessages");

    // Find the index of the object with the matching id
    const message = messages.find(item => item.id === messageId);
    message.isRight = !message.isRight

    // Save updated list
    game.settings.set("comlink-thread", "fakeMessages", messages)

    // Trigger a UI update
    updateComlinkDisplay();
}

// Function to update the message display
function updateComlinkDisplay() {
    setTimeout(() => comlinkFakeThread.render({force: true}), 100); // This will force a re-render
}

export function getFakeThreads() {
    const messages = game.settings.get("comlink-thread", "fakeMessages");
    const threads = new Set()

    messages.forEach(m => {
        threads.add(m.threadId)
    })
    return [...threads.values()]
}


const comlinkFakeThread = new ComlinkFakeThread()

export default comlinkFakeThread
