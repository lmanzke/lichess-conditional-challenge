# Versioned profile storage under new keys

Profiles are stored in `chrome.storage.sync` under the keys `lichessProfiles2` and `lichessProfile2:<id>`, and every stored profile carries a `version`. The keys of earlier versions (`lichessProfiles`, `lichessProfile:<id>`, `lichessTeamRules`) are only read, once, to migrate from, and are never written or removed.

We renamed the rule shape (`condition`/`operator`/`id`/`rules` became `combinator`/`relation`/`field`/`children`). Writing the new shape into the old keys would have been simpler, but sync storage is shared between devices that do not update at the same time. A device on the previous version decodes the new shape as rules with every field defaulted, finds no valid profile, writes a fresh default profile over the index and deletes the other profiles' items. New keys keep old versions working on their own data, at the price that edits no longer sync between old and new versions.

The version field lets the reader dispatch on the format, so that the next change can migrate in place. Exports carry the same version (`version: 2`), and the importer reads versions 1 and 2 through the same migration.

The old keys can be removed in a later release, once nobody is expected to run the previous version any more.
