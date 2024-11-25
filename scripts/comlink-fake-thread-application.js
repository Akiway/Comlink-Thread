import {createComlinkJournalEntryScreenshot, openActorSheet, saveThreadAsJournalEntry, scrollToBottom} from './utils.js'


class ComlinkFakeThread extends Application {
    // Define default options for the application
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "comlink-fake-thread-window";
        options.template = "modules/comlink-thread/templates/fake-display.hbs"; // Point to your template path
        options.width = 900;
        options.height = 500;
        options.title = "Comlink Fake Thread";
        options.resizable = true;
        return options;
    }


    // Optionally, add listeners for interactivity
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.close-btn').click(this.close.bind(this));

        const currentThread = game.settings.get("comlink-thread", "currentFakeThread");
        this._updateMessagesVisibility(html, currentThread.type, currentThread.threadId)

        html.find('.clear-messages-btn').click(() => {
            clearComlinkMessages()
        })
        html.find('.screenshot-btn').click(() => {
            saveThreadAsJournalEntry(html)
        })
        html.find('.delete-btn').click((el) => {
            deleteComlinkMessage(el.currentTarget.parentElement.parentElement.dataset.messageId)
        })
        html.find('.move-up-btn').click((el) => {
            moveUpComlinkMessage(el.currentTarget.parentElement.parentElement.dataset.messageId)
        })
        html.find('.move-down-btn').click((el) => {
            moveDownComlinkMessage(el.currentTarget.parentElement.parentElement.dataset.messageId)
        })
        html.find('.toggle-anonymous-btn').click((el) => {
            toggleComlinkMessageAnonymous(el.currentTarget.parentElement.parentElement.dataset.messageId)
        })
        html.find('.toggle-offline-btn').click((el) => {
            toggleComlinkMessageOffline(el.currentTarget.parentElement.parentElement.dataset.messageId)
        })
        html.find('.toggle-right-btn').click((el) => {
            toggleComlinkMessageRight(el.currentTarget.parentElement.parentElement.dataset.messageId)
        })
        html.find('#comlink-thread-user-page').click((el) => {
            openActorSheet(el.currentTarget.dataset.userId)
        })
        html.find('.message .profile-pic').dblclick((el) => {
            if (el.currentTarget.dataset.userId) openActorSheet(el.currentTarget.dataset.userId)
        })
        // All messages conv
        html.find('.comlink-contact.all').click(() => {
            this._updateMessagesVisibility(html, 'all', null)

            game.settings.set("comlink-thread", "currentFakeThread", {type: 'all', threadId: null});
        })
        // Character conv
        html.find('.comlink-contact:not(.all)').click((el) => {
            const threadId = el.currentTarget.dataset.threadId;
            this._updateMessagesVisibility(html, 'character', threadId)

            game.settings.set("comlink-thread", "currentFakeThread", {type: 'character', threadId: threadId});
        })

    }

    _updateMessagesVisibility(html, type, threadId) {
        let visibleMessages = null
        let hiddenMessages = null
        if (type === 'character') {
            visibleMessages = html.find(`.message[data-thread-id="${threadId}"]`);
            hiddenMessages = html.find(`.message:not([data-thread-id="${threadId}"])`);
        } else {
            visibleMessages = html.find(`.message`);
        }

        // Make sure they're visible
        visibleMessages?.each((index, m) => {
            m.hidden = false
        })
        // Make sure they're hidden
        hiddenMessages?.each((index, m) => {
            m.hidden = true
        })

        html.find('.comlink-container')[0].dataset.threadType = type

        scrollToBottom(html.find('.comlink-message-list')[0])
    }

    async getData() {
        let messages = game.settings.get("comlink-thread", "fakeMessages")
        messages.forEach(m => {
            // Retrieve actors objects
            m.sender = game.actors.get(m.senderId)
        })

        const threads = getFakeThreads()
        // Check if currentThread needs to be reset, to prevent opening on a deleted thread
        const currentThread = game.settings.get("comlink-thread", "currentFakeThread");
        if (currentThread.threadId && !threads.includes(currentThread.threadId)) game.settings.set("comlink-thread", "currentFakeThread", {type: 'all', threadId: null});

        return {
            messages,
            threads
        }
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
    setTimeout(() => comlinkFakeThread.render(true), 100); // This will force a re-render
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