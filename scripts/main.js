import {
    isMessageFromGM,
    amIRecipient,
    amISender,
    openActorSheet,
    scrollToBottom,
    saveThreadAsJournalEntry
} from './utils.js'
import comlinkFakeThread, {getFakeThreads} from './comlink-fake-thread-application.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Layer used to add a tool in the app control tools
 */
class ComlinkLayer extends foundry.canvas.layers.PlaceablesLayer {

    static documentName = "Scene"

    constructor(...args) {
        super(...args);

        this.isSetup = false;
    }

    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            zIndex: 180,
            name: "comlink"
        });
    }

    getDocuments() {
        return []
    }

    activate() {
        super.activate();
    }

    deactivate() {
        super.deactivate();
    }

    render(...args) {
        super.render(...args);
    }

}

/**
 * Init: define global game settings & helpers
 */
Hooks.once("init", async function () {
    const layers = { comlink: { layerClass: ComlinkLayer, group: "primary" } }
    CONFIG.Canvas.layers = foundry.utils.mergeObject(CONFIG.Canvas.layers, layers);
});

Hooks.on("renderSettingsConfig", (app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    const settingInput = root.querySelector('[name="comlink-thread.resetMessagesAction"]');
    if (!settingInput) return;

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.style.flex = ".5";
    resetButton.innerHTML = `<i class="fas fa-trash"></i> Supprimer`;
    resetButton.addEventListener("click", () => {
        new Dialog({
            title: "Supprimer tous les messages",
            content: "<p>Êtes-vous sûr de vouloir tout supprimer ? Cette action est irréversible.</p>",
            buttons: {
                yes: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Oui",
                    callback: () => {
                        clearComlinkMessages()
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Non"
                }
            },
            default: "no"
        }).render(true);
    });

    settingInput.replaceWith(resetButton);
});

Hooks.once("ready", function() {
    game.socket.on('module.comlink-thread', async data => {
        // Triggered when a player request the GM to update the list of messages
        // For GM only
        if (data.action === 'player-updateMessages' && game.user.isGM) {
            await game.settings.set("comlink-thread", "messages", data.messages)

            // Trigger a UI update for all connected users
            game.socket.emit('module.comlink-thread', {action: 'updateMessages'});
            updateComlinkDisplay();
        }
        // Triggered when a message has been created
        // For players only
        else if (data.action === 'addMessage' && isMessageFromGM(data.message) && amIRecipient(data.message)) {
            updateComlinkDisplay();
            notifyMessageReceived();
        }
        // Comlink display might need a refresh
        else if (comlinkThread.rendered || comlinkThread.element) {
            // Triggered when the list of messages has been updated
            if (data.action === 'updateMessages') {
                updateComlinkDisplay();
            }
            // Triggered when a single message has been updated
            else if (data.action === 'updateMessage') {
                updateComlinkDisplay();
            }
            // Triggered when the list of messages has been cleared
            else if (data.action === 'clearMessages') {
                updateComlinkDisplay();
            }
            // Triggered when a single message has been deleted
            else if (data.action === 'deleteMessage') {
                updateComlinkDisplay();
            }
        }
    });
});

// Function to update the message display
function updateComlinkDisplay() {
    setTimeout(() => comlinkThread.render({force: true}), 100); // This will force a re-render
}

// Function to update the fake message display
function updateComlinkFakeDisplay() {
    setTimeout(() => comlinkFakeThread.render({force: true}), 100); // This will force a re-render
}

// Function to update the fake message display
function updateComlinkForm() {
    setTimeout(() => comlinkForm.render({force: true}), 100); // This will force a re-render
}

function getApplicationRootElement(app) {
    if (app?.element instanceof HTMLElement) return app.element;
    if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
    return null;
}

class ComlinkForm extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "comlink-form-window",
        tag: "section",
        position: {
            width: 380,
            height: 718
        },
        window: {
            title: "Comlink",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/comlink-thread/templates/editor.hbs"
        }
    };

    async _prepareContext() {
        // Alias
        const actors = game.actors.filter((a) => a.type === "character");

        // Recipients
        const recipientFilter = game.settings.get("comlink-thread", "recipientFilterOption");
        let usersCharacters = [];
        if (recipientFilter === "character") {
            usersCharacters = game.users.map((u) => u.character).filter(c => c);
        } else if (recipientFilter === "ownership") {
            const userIds = game.users.filter(u => !u.isGM).map((u) => u.id);
            usersCharacters = actors.filter(actor => {
                return Object.entries(actor.ownership).some(([userId, level]) => {
                    return userIds.includes(userId) && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                });
            });
        } else {
            usersCharacters = actors;
        }

        // Recipient folders
        let usersCharactersFolders = [];
        const showFolders = game.settings.get("comlink-thread", "recipientFoldersOption");
        if (showFolders && recipientFilter !== "all") {
            const usersCharactersIds = usersCharacters.map(c => c.id);

            usersCharactersFolders = game.folders
                .filter(f => f.type === "Actor" && f.contents.some(c => usersCharactersIds.includes(c.id)))
                .map(folder => ({ folder, nbRecipient: folder.contents.filter(c => c.hasPlayerOwner).length }));
        }

        return {
            actors,
            recipients: usersCharacters,
            recipientFolders: usersCharactersFolders,
            fakeThreads: getFakeThreads()
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);

        const root = getApplicationRootElement(this);
        if (!root) return;

        // Special checkbox "all" for recipients
        root.querySelectorAll(".recipient-option").forEach((checkbox) => {
            checkbox.addEventListener("change", (event) => {
                const { checked, value } = event.currentTarget;
                if (checked && value === "") {
                    root.querySelectorAll('.recipient-option:not([value=""])').forEach((input) => {
                        input.checked = false;
                    });
                } else if (checked && value !== "") {
                    const allCheckbox = root.querySelector('.recipient-option[value=""]');
                    if (allCheckbox?.checked) allCheckbox.checked = false;
                }
            });
        });

        root.querySelector("#send-message-btn")?.addEventListener("click", () => {
            const content = root.querySelector("#send-message-content")?.value;
            if (!content) return;

            const isFakeChat = !!root.querySelector("#fake-chat-checkbox")?.checked;
            if (isFakeChat) {
                const senderId = root.querySelector("#alias-select")?.value;
                const threadId = root.querySelector(".thread-option:checked")?.value;

                // Create a new message object
                const newMessage = {
                    id: foundry.utils.randomID(),
                    author: game.userId,
                    timestamp: Date.now(),
                    senderId,
                    threadId: threadId || foundry.utils.randomID(),
                    isAdmin: root.querySelector("#alias-select")?.value === "",
                    isRight: !!root.querySelector("#alignment-select")?.checked,
                    isAnonymous: !!root.querySelector("#anonymous-checkbox")?.checked,
                    isOffline: false,
                    content
                };

                createFakeComlinkMessage(newMessage, !threadId);
            } else {
                const senderId = root.querySelector("#alias-select")?.value;

                const recipientIds = getFormRecipientIds(root);

                // Create a new message object
                const newMessage = {
                    id: foundry.utils.randomID(),
                    author: game.userId,
                    timestamp: Date.now(),
                    senderId,
                    recipientIds,
                    isAdmin: root.querySelector("#alias-select")?.value === "",
                    isRight: false,
                    isAnonymous: !!root.querySelector("#anonymous-checkbox")?.checked,
                    isOffline: false,
                    isQuickAnswerAvailable: !!root.querySelector("#quick-answer-checkbox")?.checked,
                    content
                };

                createComlinkMessage(newMessage);
            }
        });
    }
}

/**
 * Retrieve list of recipients based on recipient-option checked
 * @param {HTMLElement} root
 * @returns {string[]}
 */
function getFormRecipientIds(root) {
    // Sélectionner toutes les cases à cocher ayant le nom "option"
    const checkedBoxes = [...root.querySelectorAll(".recipient-option:checked")];

    // S'arrêter ici si l'option "Tous" est cochée
    if (checkedBoxes.some(c => !c.value)) return [];

    // Créer un tableau pour stocker les valeurs sélectionnées
    const selectedValues = new Set();
    // Parcourir les cases cochées et récupérez leurs valeurs
    checkedBoxes.forEach(checkbox => {
        if (checkbox.dataset.type === "character") {
            selectedValues.add(checkbox.value);
        } else if (checkbox.dataset.type === "folder") {
            // Récupérer le dossier avec les personnages
            const folder = game.folders.get(checkbox.value);
            // Filtrer et ajouter uniquement les perso des joueurs
            folder?.contents.filter(c => c.hasPlayerOwner).forEach(c => selectedValues.add(c.id));
        }
    });

    // Convertir le set sans doublon en array
    return [...selectedValues.values()];
}


class ComlinkThread extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "comlink-thread-window",
        tag: "section",
        position: {
            width: 900,
            height: 500
        },
        window: {
            title: "Comlink Thread",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/comlink-thread/templates/display.hbs"
        }
    };

    _onRender(context, options) {
        super._onRender(context, options);

        const root = getApplicationRootElement(this);
        if (!root) return;

        const currentThread = game.settings.get("comlink-thread", "currentThread");
        this._updateMessagesVisibility(root, currentThread.type, currentThread.userId);

        if (game.user.isGM) {
            root.querySelectorAll(".delete-btn").forEach((button) => {
                button.addEventListener("click", (event) => {
                    const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                    if (messageId) deleteComlinkMessage(messageId);
                });
            });
            root.querySelector(".screenshot-btn")?.addEventListener("click", () => {
                saveThreadAsJournalEntry(root);
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
        } else {
            root.querySelectorAll(".accept-btn").forEach((button) => {
                button.addEventListener("click", (event) => {
                    const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                    if (messageId) answerQuickComlinkMessage(messageId, true);
                });
            });
            root.querySelectorAll(".refuse-btn").forEach((button) => {
                button.addEventListener("click", (event) => {
                    const messageId = event.currentTarget.closest("[data-message-id]")?.dataset.messageId;
                    if (messageId) answerQuickComlinkMessage(messageId, false);
                });
            });
        }

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

            game.settings.set("comlink-thread", "currentThread", {type: "all", userId: null});
        });
        // Group conv
        root.querySelector(".comlink-contact.group")?.addEventListener("click", () => {
            this._updateMessagesVisibility(root, "group", null);

            game.settings.set("comlink-thread", "currentThread", {type: "group", userId: null});
        });
        // Character conv
        root.querySelectorAll(".comlink-contact:not(.group):not(.all)").forEach((contact) => {
            contact.addEventListener("click", (event) => {
                const senderId = event.currentTarget.dataset.senderId;
                this._updateMessagesVisibility(root, "character", senderId);

                game.settings.set("comlink-thread", "currentThread", {type: "character", userId: senderId});
            });
        });
    }

    _updateMessagesVisibility(root, type, userId) {
        let visibleMessages = [];
        let hiddenMessages = [];
        if (type === "character") {
            visibleMessages = [...root.querySelectorAll(`.message[data-sender-id="${userId}"]:not(.message-anonymous), .message[data-recipient-ids*="${userId}"]:not(.message-anonymous)`)];
            hiddenMessages = [...root.querySelectorAll(`.message-anonymous, .message:not([data-sender-id="${userId}"]):not([data-recipient-ids*="${userId}"])`)];
        } else if (type === "group") {
            visibleMessages = [...root.querySelectorAll('.message[data-recipient-ids=""]')];
            hiddenMessages = [...root.querySelectorAll('.message:not([data-recipient-ids=""])')];
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

        const userPageBtn = root.querySelector(".user-page-btn");
        if (userPageBtn) userPageBtn.dataset.userId = userId ?? "";

        const container = root.querySelector(".comlink-container");
        if (container) container.dataset.threadType = type;

        const messageList = root.querySelector(".comlink-message-list");
        if (messageList) scrollToBottom(messageList);
    }

    async _prepareContext() {
        let messages = game.settings.get("comlink-thread", "messages");
        messages = messages.filter(m => game.user.isGM || amIRecipient(m) || amISender(m));
        const contacts = new Map();
        messages.forEach(m => {
            // Retrieve actors objects
            m.sender = game.actors.get(m.senderId);
            m.recipients = m.recipientIds.map(id => game.actors.get(id));

            // Push contacts
            if (!m.isAdmin && !m.isRight && !m.isAnonymous && (game.user.isGM || amIRecipient(m))) {
                contacts.set(m.senderId, {
                    sender: m.sender,
                    isOffline: contacts.get(m.senderId)?.isOffline || m.isOffline
                });
            }
        });

        // Check if currentThread needs to be reset, to prevent opening on a deleted thread
        const currentThread = game.settings.get("comlink-thread", "currentThread");
        if (currentThread.userId && !contacts.get(currentThread.userId)) {
            game.settings.set("comlink-thread", "currentThread", {type: "all", userId: null});
        }

        return {
            messages,
            contacts: [...contacts.values()],
            isGM: game.user.isGM
        };
    }
}

// Function to handle message creation
async function createComlinkMessage(message) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "messages");

    // Add and save the new message
    messages.push(message);
    await game.settings.set("comlink-thread", "messages", messages);

    // Trigger a UI update for all connected users
    game.socket.emit('module.comlink-thread', {action: 'addMessage', message});
    updateComlinkDisplay();

    notifyMessageReceived();
}

// Function to handle fake message creation
async function createFakeComlinkMessage(message, newThread) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "fakeMessages");

    // Add and save the new message
    messages.push(message);
    await game.settings.set("comlink-thread", "fakeMessages", messages);

    updateComlinkFakeDisplay()
    if (newThread) updateComlinkForm()
}

async function clearComlinkMessages() {
    await game.settings.set("comlink-thread", "messages", [])

    // Trigger a UI update for all connected users
    game.socket.emit('module.comlink-thread', {action: 'clearMessages'});
    updateComlinkDisplay();
}

async function deleteComlinkMessage(messageId) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "messages");
    // Remove message from list
    await game.settings.set("comlink-thread", "messages", messages.filter(m => m.id !== messageId))

    // Trigger a UI update for all connected users
    game.socket.emit('module.comlink-thread', {action: 'deleteMessage', messageId});
    updateComlinkDisplay();
}

async function moveUpComlinkMessage(messageId) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "messages");

    // Find the index of the object with the matching id
    const index = messages.findIndex(item => item.id === messageId);

    // Check if the object was found and if it can be moved up
    if (index > 0) {
        // Swap the object with the one before it
        [messages[index - 1], messages[index]] = [messages[index], messages[index - 1]];

        // Save reordered list
        await game.settings.set("comlink-thread", "messages", messages)

        // Trigger a UI update for all connected users
        game.socket.emit('module.comlink-thread', {action: 'updateMessage', messageId});
        updateComlinkDisplay();
    }
}

function moveDownComlinkMessage(messageId) {
    // Retrieve existing messages
    let messages = game.settings.get("comlink-thread", "messages");

    // Find the index of the object with the matching id
    const index = messages.findIndex(item => item.id === messageId);

    // Check if the object was found and if it can be moved up
    if (index !== -1 && index < messages.length - 1) {
        // Swap the object with the one after it
        [messages[index + 1], messages[index]] = [messages[index], messages[index + 1]];

        // Save reordered list
        game.settings.set("comlink-thread", "messages", messages)

        // Trigger a UI update for all connected users
        game.socket.emit('module.comlink-thread', {action: 'updateMessage', messageId});
        updateComlinkDisplay();
    }
}

function toggleComlinkMessageAnonymous(messageId) {
    // Retrieve existing messages
    const messages = game.settings.get("comlink-thread", "messages");

    // Find the index of the object with the matching id
    const message = messages.find(item => item.id === messageId);
    message.isAnonymous = !message.isAnonymous

    // Save updated list
    game.settings.set("comlink-thread", "messages", messages)

    // Trigger a UI update for all connected users
    game.socket.emit('module.comlink-thread', {action: 'updateMessage', messageId});
    updateComlinkDisplay();
}

function toggleComlinkMessageOffline(messageId) {
    // Retrieve existing messages
    const messages = game.settings.get("comlink-thread", "messages");

    // Find the index of the object with the matching id
    const message = messages.find(item => item.id === messageId);
    message.isOffline = !message.isOffline

    // Save updated list
    game.settings.set("comlink-thread", "messages", messages)

    // Trigger a UI update for all connected users
    game.socket.emit('module.comlink-thread', {action: 'updateMessage', messageId});
    updateComlinkDisplay();
}

async function answerQuickComlinkMessage(messageId, response) {
    const characterId = game.user.character?.id;
    if (!characterId) {
        ui.notifications.error("Aucun personnage sélectionné pour envoyer le message Comlink");
        return;
    }

    // Retrieve existing messages
    const messages = game.settings.get("comlink-thread", "messages");

    // Find the index of the object with the matching id
    const message = messages.find(item => item.id === messageId);
    message.isQuickAnswerAvailable = false

    // Create the response message
    const newMessage = {
        id: foundry.utils.randomID(),
        author: game.userId,
        timestamp: Date.now(),
        senderId: characterId,
        recipientIds: [message.senderId],
        isAdmin: false,
        isRight: true,
        isAnonymous: false,
        isOffline: false,
        isQuickAnswerAvailable: false,
        content: response ? "Accepté" : "Refusé"
    };

    messages.push(newMessage)

    // Send an update messages request to GM => Player can't change game.settings
    game.socket.emit('module.comlink-thread', {action: 'player-updateMessages', messages});
}

function notifyMessageReceived() {
    ui.notifications.info("Nouveau message Comlink reçu");
}

const comlinkForm = new ComlinkForm()
const comlinkThread = new ComlinkThread()
/**
 * Controls: adds a new Comlink Thread control
 */
Hooks.on("getSceneControlButtons", (controls) => {
    const maxOrder = Math.max(0, ...Object.values(controls).map(control => control.order ?? 0));

    const v13Tools = {
        idle: {
            name: "idle",
            icon: "fas fa-messages",
            title: "Mode Comlink",
            order: 0,
            button: false,
            visible: true,
            onChange: () => {}
        },
        conversation: {
            name: "conversation",
            icon: "fas fa-message-lines",
            title: "Messagerie",
            order: 1,
            button: true,
            visible: true,
            onChange: (event, active) => {
                if (!active) return;
                comlinkThread.render({force: true});
            }
        }
    };

    if (game.user.isGM) {
        v13Tools["add-message"] = {
            name: "add-message",
            icon: "fas fa-message-plus",
            title: "Nouveau message",
            order: 2,
            button: true,
            visible: true,
            onChange: (event, active) => {
                if (!active) return;
                comlinkForm.render({force: true});
            }
        };

        v13Tools["fake-conversation"] = {
            name: "fake-conversation",
            icon: "fas fa-message-code",
            title: "Fausse conversation",
            order: 3,
            button: true,
            visible: true,
            onChange: (event, active) => {
                if (!active) return;
                comlinkFakeThread.render({force: true});
            }
        };
    }

    controls.comlink = {
        name: "comlink",
        title: "Comlink",
        icon: "fas fa-messages",
        order: maxOrder + 1,
        visible: true,
        activeTool: "idle",
        onChange: () => {},
        tools: v13Tools
    };
})


////// Handlebars helpers
Handlebars.registerHelper('join', function(array, separator) {
    return array.join(separator);
});
