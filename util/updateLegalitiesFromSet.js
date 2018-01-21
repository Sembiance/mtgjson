"use strict";
/*global setImmediate: true*/

var async = require("async"),
    fs = require("fs"),
    shared = require('../shared/shared'),
    path = require("path"),
    tiptoe = require("tiptoe"),
    unique = require("array-unique"),
    winston = require("winston");

if (require.main == module) {
    async.eachSeries(
        shared.getSetsToDo(),
        processSet,
        function(err) {
            if(err) {
                winston.error(err);
                process.exit(1);
            }

            process.exit(0);
        });
}

function processSet(code, cb) {
    winston.info("Processing set: %s", code);

    tiptoe(
        function getJSON() {
            fs.readFile(path.join(__dirname, "..", "json", code + ".json"), {encoding : "utf8"}, this);
        },
        function processCards(setRaw) {
            var set = JSON.parse(setRaw);

            // Will contain all legalities on this set.
            var cardLegalitiesByName = {};
            // Which other sets have this card?
            var setCards = {};

            // Parsing each card...
            set.cards.forEach(function(card) {
                if (!card.printings || !Array.isArray(card.printings)) {
                  winston.warn('Card has none or invalid printings:', card.name);
                  winston.warn(card.printings);
                } else {
                  // We don't want to update our own set.
                  card.printings = card.printings.filter(code => code !== set.code);
                }

                if(!card.printings || !card.printings.length) {
                    // This card has no other printings, we don't need to bother.
                    return;
                }

                cardLegalitiesByName[card.name] = card.legalities;

                // Updates the printings where we need to update something
                card.printings.forEach(function(printingCode) {
                    if(!setCards.hasOwnProperty(printingCode))
                        setCards[printingCode] = [];

                    setCards[printingCode].push(card.name);
                    setCards[printingCode] = unique(setCards[printingCode]).sort();
                });
            });

            // Go over each set and update the legalities to reflect this set.
            async.eachSeries(
                Object.keys(setCards),
                function(setCode, subcb) {
                    updateLegalitiesForSetCards(setCode, setCards[setCode], cardLegalitiesByName, subcb);
                },
                this);
        },
        function finish(err) {
            setImmediate(function() { cb(err); });
        }
    );
}

/**
 * Updates the legalities of a list of sets with the given legalities.
 * @param setCode String with the name of the set we want to update
 * @param targetCardNames Array of Strings with the names of the cards we want to update on this set.
 * @param cardLegalitiesByName Dictionary with the key being the card name and the value is the legalities
 *                             we want to reflect on the given setCode.
 * @param cb Function with the callback to pass the error or pass no parameter
 */
function updateLegalitiesForSetCards(setCode, targetCardNames, cardLegalitiesByName, cb) {
    winston.info("Adding legalities to set [%s] for all cards: %s", setCode, targetCardNames.join(", "));

    var processFunction = function(set) {
        set.cards.forEach(function(card) {
            if(!targetCardNames.includes(card.name))
                return;

            if(!cardLegalitiesByName.hasOwnProperty(card.name))
                return;

            card.legalities = cardLegalitiesByName[card.name];
            shared.updateStandardForCard(card);
        });

        return(set);
    };

    shared.processSet(setCode, processFunction, cb);
}

module.exports = processSet;
