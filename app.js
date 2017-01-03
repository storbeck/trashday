var fetch = require('node-fetch');
var moment = require('moment');
var exec = require('child_process').exec;

// Light up LED when we are this many days until the event happens
const daysMarker = 2; 

// GPIO pins, change if you have hooked them up to different pins
const pins = {
    'garbage': 23,
    'recycle': 24
}

// Used for the AJAX call so we search from Sunday to Saturday
const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
const endOfWeek = moment().endOf('week').format('YYYY-MM-DD');

// Path is found using an undocumented API grabbed from https://311.columbus.gov/AddrLookupnew.aspx
const options = {
    host: 'http://recollect.net',
    path: `/api/places/E7892B0E-BD0A-11E6-8483-BF4F2A296F27/services/237/events?nomerge=1&hide=reminder_only&after=${startOfWeek}&before=${endOfWeek}&locale=en-US`,
}

fetch(options.host + options.path)
    .then(response => {
        return response.json();
    })
    .then(json => {
        parse(json);
    })

// Parse the JSON response from the API call
function parse(json) {
    var zones = getZones(json);
    var zoneEvents = getEvents(json, zones);
    var daysUntil = getDaysUntil(zoneEvents);

    // Output to console how many days until each event
    output(daysUntil);

    // Update the GPIO pins to HIGH if we've reached the day marker
    updatePins(daysUntil);
}

// Get the zone id for garbage, recycling, and yard waste so we can pick out the events later
function getZones(json) {
    var requiredZones = {};

    for (var zone_id in json.zones) {
        if (json.zones[zone_id].name.includes('garbage')) requiredZones['garbage'] = Number(zone_id);
        if (json.zones[zone_id].name.includes('recycle')) requiredZones['recycle'] = Number(zone_id);
        if (json.zones[zone_id].name.includes('yardwaste')) requiredZones['yardwaste'] = Number(zone_id);
    }

    return requiredZones;
}

// Get the date for each event we've previously looked for in our zones
function getEvents(json, zones) {
    var requiredEvents = {};

    json.events.forEach(event => {
        if (event.zone_id === zones.garbage) requiredEvents['garbage'] = event.day;
        if (event.zone_id === zones.recycle) requiredEvents['recycle'] = event.day;
        if (event.zone_id === zones.yardwaste) requiredEvents['yardwaste'] = event.day;
    });

    return requiredEvents;
}

// Get the difference between the current date and the date the event is, by default it is the day before
// Example is if date is tomorrow, it will return 0 instead of 1
function getDaysUntil(zoneEvents) {
    var requiredDaysUntil = {};
    var today = new moment();

    for (var key in zoneEvents) {
        requiredDaysUntil[key] = moment(zoneEvents[key]).diff(today, 'days');
    }

    return requiredDaysUntil;
}

// Output to console
function output(daysUntil) {
    for (var key in daysUntil) {
        console.log(`${key} is in ${daysUntil[key]} day(s)`);
    }
}

// Update the GPIO pins on the raspberry pi
function updatePins(daysUntil) {
    for (var key in daysUntil) {

        // Only update the gpio pin if we have it wired up (i don't wire up yard waste)
        if (pins[key]) {

            // Turn on the LED if number of days matches our defined marker
            if (daysUntil[key] === daysMarker) {
                exec(`gpio -g write ${pins[key]} 1`, handleOutput)

            // Turn off LED if days do not match
            } else {
                exec(`gpio -g write ${pins[key]} 0`, handleOutput)
            }
        }
    }
}

function handleOutput(error, stdout, stderr) {
    console.log(stdout);
}