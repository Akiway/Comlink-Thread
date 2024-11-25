////// Message utils
export function isMessageFromGM(message) {
    return game.users.get(message.author)?.isGM
}

export function amIRecipient(message) {
    // Does the message concerns everyone
    if (!message.recipientIds?.length) return true;

    // Is one of my characters listed as a recipient
    const playerCharactersIds = getPlayerCharacters(game.user._id).map(c => c._id)
    return message.recipientIds.some(recipientId => playerCharactersIds.includes(recipientId))

    // if (ownershipIncluded) {
    //     // Is one of my characters listed as a recipient
    //     const playerCharactersIds = getPlayerCharacters(game.user._id).map(c => c._id)
    //
    //     return message.recipients.some(recipient => playerCharactersIds.includes(recipient))
    // } else {
    //     // Is my main character listed as a recipient
    //     return message.recipients.some(recipient => recipient === game.user.character._id)
    // }
}

export function saveThreadAsJournalEntry(html) {
    const node = html.find('.mode-screenshot')[0]
    node.classList.add('active')

    setTimeout(async () => {
        try {
            const base64 = await window.domtoimage.toPng(node, {
                filter: node => {
                    return !node.classList?.contains('message-actions') && !node.classList?.contains('comlink-thread-actions') && !node.classList?.contains('comlink-contacts')
                }
            });

            node.classList.remove('active')

            await createComlinkJournalEntryScreenshot(base64);
        } catch (err) {
            console.error("Failed to capture or create journal entry:", err);
            ui.notifications.error("Echec de la capture d'écran pour l'ajout de la conversation au journal.");
        }
    }, 10)
}

const COMLINK_SCREENSHOT_FOLDER_NAME = "Conversations Comlink"
export async function createComlinkJournalEntryScreenshot(imageBase64) {
    const journalContent = `<img src="${imageBase64}" />`;

    // Check if the folder exists
    let folder = game.folders.find(f => f.name === COMLINK_SCREENSHOT_FOLDER_NAME && f.type === "JournalEntry");

    // Create the folder if it doesn't exist
    if (!folder) {
        folder = await Folder.create({
            name: COMLINK_SCREENSHOT_FOLDER_NAME,
            type: "JournalEntry",
            parent: null, // Adjust if you want to nest it
            sorting: "a",
            color: "#8d8e11" // Optional: define a color for the folder
        });
    }

    await JournalEntry.create({
        name: "Conversation Comlink",
        folder,
        pages: [
            {
                name: "Conversation",
                text: { content: journalContent, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
                type: "text"
            }
        ]
    });

    ui.notifications.info("La conversation a été enregistrée dans le journal.");
}

export function amISender(message) {
    // Did I write the message
    return message.senderId === game.user.character._id
}

////// DOM utils
export function scrollToBottom(el) {
    setTimeout(() => el.scrollTop = el.scrollHeight, 10)
}

export function getPlayerCharacters(playerId) {
    const actors =  game.actors.filter((a) => a.type === "character");
    return actors.filter(actor => {
        return Object.entries(actor.ownership).some(([userId, level]) => {
            return userId === playerId && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        });
    });
}

////// Game utils
export function openActorSheet(actorId) {
    const actor = game.actors.get(actorId);
    actor?.sheet.render(true)
}
