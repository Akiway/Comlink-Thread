import {
    isMessageFromGM,
    amIRecipient,
    amISender,
    openActorSheet,
    scrollToBottom,
    saveThreadAsJournalEntry
} from './utils.js'
import comlinkFakeThread, {getFakeThreads} from './comlink-fake-thread-application.js'

/**
 * Layer used to add a tool in the app control tools
 */
class ComlinkLayer extends PlaceablesLayer {

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
    CONFIG.Canvas.layers = foundry.utils.mergeObject(Canvas.layers, layers);
});

Hooks.once("renderSettingsConfig", (app, html, data) => {
    // Find the container for our setting
    const moduleSettings = html.find(`input[name="comlink-thread.resetMessagesAction"]`).parent();

    // Create a custom button
    const resetButton = $(`<button type="button" style="flex: .5;"><i class="fas fa-trash"></i> Supprimer</button>`);

    // Attach a click handler to the button
    resetButton.on("click", () => {
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

    // Append the button to the settings row
    moduleSettings.find("input").replaceWith(resetButton);
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
        else if (comlinkThread.rendered) {
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
    setTimeout(() => comlinkThread.render(true), 100); // This will force a re-render
}

// Function to update the fake message display
function updateComlinkFakeDisplay() {
    setTimeout(() => comlinkFakeThread.render(true), 100); // This will force a re-render
}

// Function to update the fake message display
function updateComlinkForm() {
    setTimeout(() => comlinkForm.render(true), 100); // This will force a re-render
}

class ComlinkForm extends FormApplication {
    // Define default options for the application
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "comlink-form-window";
        options.template = "modules/comlink-thread/templates/editor.hbs"; // Point to your template path
        options.width = 380;
        options.height = 718;
        options.title = "Comlink";
        options.resizable = true;
        return options;
    }

    async getData() {
        console.log('getData game', game)

        // Alias
        const actors =  game.actors.filter((a) => a.type === "character");
        console.log('getData actors', actors)

        // Recipients
        const recipientFilter = game.settings.get("comlink-thread", "recipientFilterOption")
        let usersCharacters = []
        if (recipientFilter === 'character') {
            usersCharacters = game.users.map((u) => u.character).filter(c => c)
        } else if (recipientFilter === 'ownership') {
            const userIds = game.users.filter(u => !u.isGM).map((u) => u._id)
            usersCharacters = actors.filter(actor => {
                return Object.entries(actor.ownership).some(([userId, level]) => {
                    return userIds.includes(userId) && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                });
            });
        } else {
            usersCharacters = actors
        }

        // Recipient folders
        let usersCharactersFolders = []
        const showFolders = game.settings.get("comlink-thread", "recipientFoldersOption")
        if (showFolders && recipientFilter !== 'all') {
            const usersCharactersIds = usersCharacters.map(c => c._id)

            usersCharactersFolders = game.folders
                .filter(f => f.type === "Actor" && f.contents.some(c => usersCharactersIds.includes(c._id)))
                .map(folder => ({ folder, nbRecipient: folder.contents.filter(c => c.hasPlayerOwner).length }) )
        }

        return {
            actors,
            recipients: usersCharacters,
            recipientFolders: usersCharactersFolders,
            fakeThreads: getFakeThreads()
        }
    }

    // Optionally, add listeners for interactivity
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.close-btn').click(this.close.bind(this));

        // Special checkbox "all" for recipients
        html.find('.recipient-option').change((el) => {
            const { checked, value } = el.currentTarget
            if (checked && value === '') {
                html.find('.recipient-option:not([value=""]):checked')?.each((index, input) => {
                    input.checked = false
                })
            } else if (checked && value !== '') {
                const checkbox = html.find('.recipient-option[value=""]:checked')?.[0]
                if (checkbox) checkbox.checked = false
            }
        })
        html.find('#send-message-btn').click(() => {
            const content = html.find('#send-message-content').val()
            if (!content) return;

            const isFakeChat = html.find('#fake-chat-checkbox')[0].checked
            if (isFakeChat) {
                const senderId = html.find('#alias-select').val()

                const threadId = html.find('.thread-option:checked').val();

                // Create a new message object
                const newMessage = {
                    id: foundry.utils.randomID(),
                    author: game.userId,
                    timestamp: Date.now(),
                    senderId,
                    threadId: threadId || foundry.utils.randomID(),
                    isAdmin: html.find('#alias-select').val() === '',
                    isRight: html.find('#alignment-select')[0].checked,
                    isAnonymous: html.find('#anonymous-checkbox')[0].checked,
                    isOffline: false,
                    content
                };

                createFakeComlinkMessage(newMessage, !threadId)
            } else {
                const senderId = html.find('#alias-select').val()

                const recipientIds = getFormRecipientIds(html)

                // Create a new message object
                const newMessage = {
                    id: foundry.utils.randomID(),
                    author: game.userId,
                    timestamp: Date.now(),
                    senderId,
                    recipientIds,
                    isAdmin: html.find('#alias-select').val() === '',
                    isRight: false,
                    isAnonymous: html.find('#anonymous-checkbox')[0].checked,
                    isOffline: false,
                    isQuickAnswerAvailable: html.find('#quick-answer-checkbox')[0].checked,
                    content
                };

                createComlinkMessage(newMessage);
            }
        })
    }
}

/**
 * Retrieve list of recipients based on recipient-option checked
 * @param html
 * @returns {any[]|*[]}
 */
function getFormRecipientIds(html) {
    // Sélectionner toutes les cases à cocher ayant le nom "option"
    const checkedBoxes = [...html.find('.recipient-option:checked')];

    // S'arrêter ici si l'option "Tous" est cochée
    if (checkedBoxes.some(c => !c.value)) return []

    // Créer un tableau pour stocker les valeurs sélectionnées
    const selectedValues = new Set();
    // Parcourir les cases cochées et récupérez leurs valeurs
    checkedBoxes.forEach(checkbox => {
        if (checkbox.dataset.type === 'character') {
            selectedValues.add(checkbox.value)
        } else if (checkbox.dataset.type === 'folder') {
            // Récupérer le dossier avec les personnages
            const folder = game.folders.get(checkbox.value)
            // Filtrer et ajouter uniquement les perso des joueurs
            folder.contents.filter(c => c.hasPlayerOwner).forEach(c => selectedValues.add(c._id))
        }
    });

    // Convertir le set sans doublon en array
    return [...selectedValues.values()]
}


class ComlinkThread extends Application {
    // Define default options for the application
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "comlink-thread-window";
        options.template = "modules/comlink-thread/templates/display.hbs"; // Point to your template path
        options.width = 900;
        options.height = 500;
        options.title = "Comlink Thread";
        options.resizable = true;
        return options;
    }

    // Optionally, add listeners for interactivity
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.close-btn').click(this.close.bind(this));

        const currentThread = game.settings.get("comlink-thread", "currentThread");
        this._updateMessagesVisibility(html, currentThread.type, currentThread.userId)

        if(game.user.isGM) {
            html.find('.delete-btn').click((el) => {
                deleteComlinkMessage(el.currentTarget.parentElement.parentElement.dataset.messageId)
            })
            html.find('.screenshot-btn').click(() => {
                saveThreadAsJournalEntry(html)
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
        } else {
            html.find('.accept-btn').click((el) => {
                answerQuickComlinkMessage(el.currentTarget.parentElement.dataset.messageId, true)
            })
            html.find('.refuse-btn').click((el) => {
                answerQuickComlinkMessage(el.currentTarget.parentElement.dataset.messageId, false)
            })
        }
        html.find('#comlink-thread-user-page').click((el) => {
            openActorSheet(el.currentTarget.dataset.userId)
        })
        html.find('.message .profile-pic').dblclick((el) => {
            if (el.currentTarget.dataset.userId) openActorSheet(el.currentTarget.dataset.userId)
        })
        // All messages conv
        html.find('.comlink-contact.all').click(() => {
            this._updateMessagesVisibility(html, 'all', null)

            game.settings.set("comlink-thread", "currentThread", {type: 'all', userId: null});
        })
        // Group conv
        html.find('.comlink-contact.group').click(() => {
            this._updateMessagesVisibility(html, 'group', null)

            game.settings.set("comlink-thread", "currentThread", {type: 'group', userId: null});
        })
        // Character conv
        html.find('.comlink-contact:not(.group):not(.all)').click((el) => {
            const senderId = el.currentTarget.dataset.senderId;
            this._updateMessagesVisibility(html, 'character', senderId)

            game.settings.set("comlink-thread", "currentThread", {type: 'character', userId: senderId});
        })

    }

    _updateMessagesVisibility(html, type, userId) {
        let visibleMessages = null
        let hiddenMessages = null
        if (type === 'character') {
            visibleMessages = html.find(`.message[data-sender-id="${userId}"]:not(.message-anonymous), .message[data-recipient-ids*="${userId}"]:not(.message-anonymous)`);
            hiddenMessages = html.find(`.message-anonymous, .message:not([data-sender-id="${userId}"]):not([data-recipient-ids*="${userId}"])`);
        } else if (type === 'group') {
            visibleMessages = html.find(`.message[data-recipient-ids=""]`);
            hiddenMessages = html.find(`.message:not([data-recipient-ids=""])`);
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

        html.find('.user-page-btn')[0].dataset.userId = userId
        html.find('.comlink-container')[0].dataset.threadType = type

        scrollToBottom(html.find('.comlink-message-list')[0])
    }

    async getData() {
        let messages = game.settings.get("comlink-thread", "messages");
        messages = messages.filter(m => game.user.isGM || amIRecipient(m) || amISender(m))
        const contacts = new Map()
        messages.forEach(m => {
            // Retrieve actors objects
            m.sender = game.actors.get(m.senderId)
            m.recipients = m.recipientIds.map(id => game.actors.get(id))

            // Push contacts
            if (!m.isAdmin && !m.isRight && !m.isAnonymous && (game.user.isGM || amIRecipient(m))) contacts.set(m.senderId, {
                sender: m.sender,
                isOffline: contacts.get(m.senderId)?.isOffline || m.isOffline
            })
        })

        // Check if currentThread needs to be reset, to prevent opening on a deleted thread
        const currentThread = game.settings.get("comlink-thread", "currentThread");
        if (currentThread.userId && !contacts.get(currentThread.userId)) game.settings.set("comlink-thread", "currentThread", {type: 'all', userId: null});

        return {
            messages,
            contacts: [...contacts.values()],
            isGM: game.user.isGM
        }
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
    if (!game.user.character._id) {
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
        senderId: game.user.character._id,
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
Hooks.on('getSceneControlButtons', (buttons) => {
    const comlinkTool = {
        icon: "fas fa-messages",
        layer: "comlink",
        name: "comlink",
        title: "Comlink",
        tools: [],
        visible: true
    }

    if(game.user.isGM) {
        comlinkTool.tools.push({
            name: "add-message",
            icon: "fas fa-message-plus",
            title: "Nouveau message",
            button: true,
            onClick: () => {
                comlinkForm.render(true);
            }
        })
    }
    comlinkTool.tools.push({
        name: "conversation",
        icon: "fas fa-message-lines",
        title: "Messagerie",
        button: true,
        onClick: () => {
            comlinkThread.render(true);
        }
    })
    if(game.user.isGM) {
        comlinkTool.tools.push({
            name: "fake-conversation",
            icon: "fas fa-message-code",
            title: "Fausse conversation",
            button: true,
            onClick: () => {
                comlinkFakeThread.render(true);
            }
        })
    }

    buttons.push(comlinkTool)
})


////// Handlebars helpers
Handlebars.registerHelper('join', function(array, separator) {
    return array.join(separator);
});
