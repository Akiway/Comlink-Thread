# Comlink-Thread
FoundryVTT module adding a comlink system for Shadowrun.

Credit for concept and design, forked from the initial project of the same name by TonkatsuRa: https://tonkatsura.github.io/Comlink-Thread/comlink.html.
Initial idea was to simply port his code into FoundryVTT, but I decided to go further and add features.

Credit for augmented-ui goes to propjockey (https://augmented-ui.com)


![image](https://user-images.githubusercontent.com/115587388/236695609-c1ea806c-49f6-47fa-a5e1-634ceb2eecd5.png)

**v1.0 features**
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


___


**Available languages**
* Français

___


**Potential features to come:**
* Send image instead in message
* English translation
* Better player thread management
* Better GM thread management
* Refacto to convert windows from Application into ApplicationV2
