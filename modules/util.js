
/**
 * @param {number} number  
*  @returns string corresponding to the day of a given number (0 => Sun, 1 => Mon...), null if not found
 */
function findCorrespondingDayName(number) {
    switch (number) {
        case 0: return 'Sun';
        case 1: return 'Mon';
        case 2: return 'Tue';
        case 3: return 'Wed';
        case 4: return 'Thu';
        case 5: return 'Fri';
        case 6: return 'Sat';
    }
    return null;
}


/**
 * @param {string} string  
*  @returns number corresponding to the day of a given string (Sun => 0, Mon => 1...), null if not found
 */
function findCorrespondingDayNumber(string) {
    switch (string) {
        case 'sun': return 0;
        case 'mon': return 1;
        case 'tue': return 2;
        case 'wed': return 3;
        case 'thu': return 4;
        case 'fri': return 5;
        case 'sat': return 6;
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
    toAdd = "";
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
    if(nbToFill > 0) {
        return module.exports.fillUpSpaceRev(module.exports.fillUpSpace(string, string.length + nbToFill/2), string.length + nbToFill);
    } else {
        return string;
    }
}

module.exports.findCorrespondingDayName = findCorrespondingDayName;
module.exports.findCorrespondingDayNumber = findCorrespondingDayNumber;
module.exports.fillUpSpace = fillUpSpace;
module.exports.fillUpSpaceRev = fillUpSpaceRev;
module.exports.fillUpSpaceBoth = fillUpSpaceBoth;