/**
 * Init: define global game settings & helpers
 */
Hooks.once("init", async function () {
    ////// World
    game.settings.register("comlink-thread", "messages", {
        scope: "world", // 'world' for global settings, 'client' for per-user settings
        config: false, // Whether to show this setting in the Configuration UI
        type: Array,
        default: []
    });
    game.settings.register("comlink-thread", "fakeMessages", {
        scope: "world", // 'world' for global settings, 'client' for per-user settings
        config: false, // Whether to show this setting in the Configuration UI
        type: Array,
        default: []
    });
    game.settings.register("comlink-thread", "resetMessagesAction", {
        name: "Supprimer tous les messages",
        hint: "Supprimer l'intégralité des messages échangés entre les joueurs et le MJ.",
        scope: "world", // 'world' for global settings, 'client' for per-user settings
        config: true, // Whether to show this setting in the Configuration UI
        type: null,
        restricted: true // Restrict to GMs only
    });
    game.settings.register("comlink-thread", "recipientFilterOption", {
        name: "Destinataires possibles",
        hint: "Définir quels personnages peuvent être destinataire d'un message Comlink.",
        scope: "world", // 'world' for global settings, 'client' for per-user settings
        config: true, // Whether to show this setting in the Configuration UI
        restricted: true, // Restrict to GMs only
        // Creates a select dropdown
        choices: {
            "character": "Personnage principal de chaque joueur",
            "ownership": "Personnages gérés par les joueurs",
            "all": "Tous les personnages"
        },
        default: "character"
    });
    game.settings.register("comlink-thread", "recipientFoldersOption", {
        name: "Dossiers de destinataires",
        hint: "Permettre de sélectionner les dossiers des personnages pour sélectionner plusieurs destinataires en même temps. Les dossiers disponibles dépendent du paramètre de visibilité précédent \"Destinataires possibles\". Option indisponible si \"Tous les personnages\" est sélectionné.",
        scope: "world", // 'world' for global settings, 'client' for per-user settings
        config: true, // Whether to show this setting in the Configuration UI
        type: Boolean,
        restricted: true, // Restrict to GMs only
        default: true
    });

    ////// Client

    // Threads
    game.settings.register("comlink-thread", "currentThread", {
        scope: "client", // 'world' for global settings, 'client' for per-user settings
        config: false, // Whether to show this setting in the Configuration UI
        type: Object,
        default: {type: 'all', userId: null}
    });
    game.settings.register("comlink-thread", "currentFakeThread", {
        scope: "client", // 'world' for global settings, 'client' for per-user settings
        config: false, // Whether to show this setting in the Configuration UI
        type: Object,
        default: {type: 'all', threadId: null},
        restricted: true // Restrict to GMs only
    });
});
