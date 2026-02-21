# Changelog

## [ 1.0.1 ] 21/02/2026
* Application refactor to Foundry `ApplicationV2`
    * `ComlinkForm` migrated from `FormApplication` to `HandlebarsApplicationMixin(ApplicationV2)`
    * `ComlinkThread` migrated from `Application` to `HandlebarsApplicationMixin(ApplicationV2)`
    * `ComlinkFakeThread` migrated from `Application` to `HandlebarsApplicationMixin(ApplicationV2)`
    * `getData`/`activateListeners` workflows replaced with `_prepareContext`/`_onRender`
    * App renders switched from `render(true)` to `render({force: true})`
    * Existing UX behavior preserved (message creation, filters, thread navigation, GM actions)
* Foundry VTT v13 compatibility update
    * `module.json` updated to `minimum: 13` and `verified: 13`
    * Replaced deprecated `_id` usages with `id` in active code paths
    * Fixed quick-answer sender resolution when no character is selected (`game.user.character?.id`)
    * Updated canvas layer registration to merge into `CONFIG.Canvas.layers`
    * Updated settings render hook to support v13 render element usage
    * Fixed invalid setting registration (`type: null`) by using `type: String`
    * Added explicit `type: String` for recipient filter setting

## [ 1.0.0 ] 25/11/2024
* Message creation, _GM only_
    * Select message's emitter from any of the characters available
    * Possibility to send the message as anonymous
    * Select recipients from the list of players characters
    * Possibility to request a quick answer from the recipient (binary answer yes/no only)

* Comlink thread
    * Receive notification on message
    * List of known contacts
    * List of messages
* Comlink thread, _GM only_
    * Reorder messages
    * Delete messages
    * Set message anonymous and reveal message emitter
    * Set message emitter as offline (also visible in contact list)

* Fake message creation, _GM only_
    * Set message as anonymous
    * Thread attribution
    * Choose message's side

* Fake comlink thread
    * Same features + possibility to change message's side

* Screenshot thread into journal, _GM only_
