const { GoogleSpreadsheet } = require('google-spreadsheet');
const Logger = require('../classes/rerelog');
const log = new Logger(5);
const creds = require('/Users/Zephyro/Downloads/quickstart-1599814377442-5ec02b6819bb.json');

const spreadsheetid = '1vG4wBLovRAaLqimX4twHhwhhnFTTS4aUcFrRVatxiS0';
const sheetname = '[DEV] Remtest';

/**
 * 
 * 
 */
async function run (data) {
    
    // Initialize the sheet - doc ID is the long id in the sheets URL
    let doc = new GoogleSpreadsheet(spreadsheetid);

    await doc.useServiceAccountAuth(creds);

    await doc.loadInfo(); // loads document properties and worksheets
    log.info('Google Sheet sync START');
    log.info(`Target sheet -> ${doc.title}`);

    const sheet = doc.sheetsByTitle[sheetname];
    let rows = await sheet.getRows({'limit': 101}); // 100 + header
    
    let i;
    const max = data.length > rows.length ? data.length : rows.length;
    log.debug(`data length: ${data.length}`);
    log.debug(`rows length: ${rows.length}`);
    log.trace(`iteration count: ${max}`);
    
    for (i = 0; i < max; i++) {
        log.trace(`i:${i}`);
        // both are defined => overwrite
        if (rows[i] !== undefined && data[i] !== undefined) {
            log.trace(`data: ${data[i].name}`);
            log.trace(`row: ${rows[i].name}`)
            rows[i].name = data[i].name;
            Object.keys(data[i]).map((key, j) => {
                // log(`> TRACE: i: ${i}`);
                log.trace(`key: ${key}, value: ${data[i][key]}`);
                rows[i][key] = data[i][key];
            })
            log.trace('saving...');
            await rows[i].save();
            log.trace('Done');
        }
        // sheet > members => delete
        else if (rows[i] !== undefined) {
            log.debug(`Old member removed from nw sheet: ${JSON.stringify(rows[i].name)}`)
            await rows[i].delete(); // VERIFY will this impact the length or rows?
        }
        // members > sheet => add new row
        else if (data[i] !== undefined) {
            let t1 = await sheet.addRow(data[i]); // VERIFY
            log.debug(`New member added to nw sheet: ${JSON.stringify(t1)}`);
        }
        // SHOULD be unreachable
        else {
            log.warn("Unreachable branch-condition in ./modules/sheets.js - run)");
        }
        log.trace('================');
    }
    log.info('Google Sheet sync END');
};


module.exports.doSheetUpload = run;
// rem-5-892@quickstart-1599814377442.iam.gserviceaccount.com
// 118232451383662433091
