#!/usr/local/bin/node

"use strict";

var fs = require("fs"),
    path = require("path"),
    request = require('request'),
    domino = require("domino"),
    tiptoe = require("tiptoe"),
    winston = require("winston");

tiptoe(
    function getPageAndPrevious()
    {
        request("http://gatherer.wizards.com/Pages/Default.aspx", this.parallel());
        fs.readFile(path.join(__dirname, "previous_sets.json"), { encoding : "utf8"}, this.parallel());
    },
    function compareVersions(setsHTML, previousSetsJSON)
    {

        var sets = Array.from(domino.createWindow(setsHTML[0]).document.querySelectorAll("select#ctl00_ctl00_MainContent_Content_SearchControls_setAddText option")).map(function(o) { return o.getAttribute("value").trim(); }).filter(Boolean);
        if(sets.length<1)
        {
            winston.error("No sets found! Probably a temporary error...");
            process.exit(1);
        }

        var previousSets = JSON.parse(previousSetsJSON);

        var removedSets = previousSets.filter(function(s) { return !sets.include(s); });
        if(removedSets.length)
            winston.info("Sets Removed: %s", removedSets.join(", "));

        var addedSets = sets.filter(function(s) { return !previousSets.include(s); });
        if(addedSets.length)
            winston.info("Sets Added: %s", addedSets.join(", "));

        fs.writeFile(path.join(__dirname, "previous_sets.json"), JSON.stringify(sets, null, '  '), {encoding : "utf8"}, this);
    },
    function finish(err)
    {
        if(err)
        {
            winston.error(err);
            process.exit(1);
        }

        process.exit(0);
    }
);
