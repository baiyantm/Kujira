const { GoogleSpreadsheet } = require('google-spreadsheet');

const mode = process.env.TOKEN ? 'prod' : 'dev';
const log = require('log4js').getLogger('sheets');

const creds = mode == "prod" ? JSON.parse(process.env.CREDS) : require('../resources/creds.json');
const config = require('../resources/config.json').sheets;

/**
 * Upload data to google sheets.
 * 
 * @param {{id, name, class, ap, aap, dp, gs, succession, axe, horse}[]}
 * @param {string} serverid
 * actually the paramter is missing status and the days, but line too long anyway...
 */
async function run (data, serverid) {
    log.info('Google Sheet sync START');

    if (config[serverid] === undefined) {
        log.error('unsuported server!');
        return;
    }
    const spreadsheetid = config[serverid].NWSpreadsheetID;
    const sheetid = config[serverid].NWSheetID;

    let doc = new GoogleSpreadsheet(spreadsheetid);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();

    log.info(`Target sheet -> ${doc.title}`);

    const sheet = doc.sheetsById[sheetid];
    let rows = await sheet.getRows({'limit': 101}); // 100 + header
    
    let i;
    let rowcount = data.length > rows.length ? data.length : rows.length;
    log.trace(`data length: ${data.length}`);
    log.trace(`row length: ${rows.length}`);
    log.trace(`doing ${rowcount} iterations...`);
    
    for (i = 0; i < rowcount; i++) {
        log.trace(`i:${i}`);
        // both are defined => overwrite
        if (rows[i] !== undefined && data[i] !== undefined) {
            log.trace(`data: ${data[i].name}`);
            log.trace(`row: ${rows[i].name}`)
            Object.keys(data[i]).map((key, j) => {
                log.trace(`   ${key}: ${data[i][key]}`);
                rows[i][key] = data[i][key];
            })
            log.trace('saving...');
            await rows[i].save();
            log.trace('Done');
            log.trace('================');
        }
        // sheet > members => the remaining entries should be deleted.
        else if (rows[i] !== undefined) {
            // deleting a row will update gsheets but not our rows variable
            // meaning that each subsequent local index will point to a decremented 
            // remote index.
            // delete (1), delete (2), delete (3) will delete i=1, i=3 and i=5

            // to get around this we will loop through the rest of the rows in reverse order.
            for (let j = rowcount - 1; j >= i; j--) {
                log.debug(`Old member removed from nw sheet: ${JSON.stringify(rows[j].name)}`)
                await rows[j].delete();
            }
            // stop the outer loop since we deleted the remaining entries.
            break;
        }
        // members > sheet => add new row
        else if (data[i] !== undefined) {
            let newrow = await sheet.addRow(data[i]); // VERIFY
            log.debug(`New member added to nw sheet: ${JSON.stringify(newrow.name)}`);
        }
    }
    log.info('Google Sheet sync END');
};

module.exports.doSheetUpload = run;
