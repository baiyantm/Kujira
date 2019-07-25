
/**
 * @param {number} number  
*  @returns string corresponding to the day of a given number (0 => Sun, 1 => Mon...), null if not found
 */
function findCorrespondingDayName(number) {
    switch (number) {
        case 0: return 'Sunday';
        case 1: return 'Monday';
        case 2: return 'Tuesday';
        case 3: return 'Wednesday';
        case 4: return 'Thursday';
        case 5: return 'Friday';
        case 6: return 'Saturday';
    }
    return null;
}


/**
 * @param {string} string  
*  @returns number corresponding to the day of a given string (sun => 0, mon => 1...), null if not found
 */
function findCorrespondingDayNumber(string) {
    if (string.startsWith('sun')) {
        return 0;
    } else if (string.startsWith('mon')) {
        return 1;
    } else if (string.startsWith('tue')) {
        return 2;
    } else if (string.startsWith('wed')) {
        return 3;
    } else if (string.startsWith('thu')) {
        return 4;
    } else if (string.startsWith('fri')) {
        return 5;
    } else if (string.startsWith('sat')) {
        return 6;
    }
    return null;
}

// ------ RichEmbed templates ------
/**
 * @param {string} string
 * @param {number} num
 * @returns a string with num size eventually filled with - at the end
 */
function fillUpSpace(string, num) {
    string += ' ';
    var i = string.length;
    while (i < num) {
        string += '-';
        i++;
    }
    return string += ' ';
}

/**
 * @param {string} string
 * @param {number} num
 * @returns a string with num size eventually filled with - at the beginning
 */
function fillUpSpaceRev(string, num) {
    var toAdd = "";
    var i = string.length;
    while (i < num) {
        toAdd += '-';
        i++;
    }
    toAdd += ' ';
    return toAdd + string;
}

/**
 * @param {string} string
 * @param {number} num
 * @returns a string with num size eventually filled with - at the beginning and at the end
 */
function fillUpSpaceBoth(string, num) {
    var nbToFill = num - string.length;
    if (nbToFill > 0) {
        return module.exports.fillUpSpaceRev(module.exports.fillUpSpace(string, string.length + nbToFill / 2), string.length + nbToFill);
    } else {
        return string;
    }
}

/**
 * @param {string|number} dd 
 * @param {string|number} hh 
 * @param {string|number} mm 
 * @returns number of minutes until dd hh mm
 */
function getMinUntil(dd, hh, mm) {
    let today = new Date();
    return (hh - today.getHours()) * 60 - today.getMinutes() + 24 * 60 * diffDays(today.getDay(), dd) + mm;
}

/**
 * @param {string|number} day1 
 * @param {string|number} day2 
 * @returns {string|number} the number of days between 2 dates
 */
function diffDays(day1, day2) {
    let i = 0;
    while (day1 != day2) {
        day1++;
        i++;
        if (day1 > 6) {
            day1 = 0;
        }
    }
    return i;
}


/**
 * @param {string|number} hh 
 * @returns whether hh has already passed compared to today
 */
function isNextDay(hh) {
    let today = new Date();
    return today.getHours() >= hh;
}

/**
 * @param {number} num 
 * @returns string with 0 at the beginning if < 10
 */
function zeroString(num) {
    if (num < 10) {
        return '0' + num;
    } else {
        return num;
    }
}

/**
 * @param {number} time in minutes
 * @returns {string} string with the time left before time
 */
function displayHoursMinBefore(time) {
    let hour = Math.trunc(time / 60);
    let min = time % 60;
    if (hour < 1) {
        return min + 'm';
    }
    else {
        if (min < 10) { min = '0' + min }
        return hour + 'h' + min + 'm';
    }
}

module.exports.findCorrespondingDayName = findCorrespondingDayName;
module.exports.findCorrespondingDayNumber = findCorrespondingDayNumber;
module.exports.fillUpSpace = fillUpSpace;
module.exports.fillUpSpaceRev = fillUpSpaceRev;
module.exports.fillUpSpaceBoth = fillUpSpaceBoth;
module.exports.getMinUntil = getMinUntil;
module.exports.diffDays = diffDays;
module.exports.isNextDay = isNextDay;
module.exports.zeroString = zeroString;
module.exports.displayHoursMinBefore = displayHoursMinBefore;