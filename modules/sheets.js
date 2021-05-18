const { GoogleSpreadsheet } = require('google-spreadsheet');
const { log } = require('./logger');
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
    log(`INFO: Uploading attendance data -> ${doc.title}`);

    const sheet = doc.sheetsByTitle[sheetname];
    let rows = await sheet.getRows({'limit': 101}); // 100 + header
    
    let i;
    const max = data.length > rows.length ? data.length : rows.length;
    log(`DEBUG: data length: ${data.length}`);
    log(`DEBUG: rows length: ${rows.length}`);
    
    for (i = 0; i <= max; i++) {
        log(`TRACE: i:${i}`);
        // both are defined => overwrite
        if (rows[i] !== undefined && data[i] !== undefined) {
            log(`TRACE: data: ${data[i].name}`);
            log(`TRACE: row: ${rows[i].name}`)
            rows[i].name = data[i].name;
            Object.keys(data[i]).map((key, j) => {
                log(`> TRACE: i: ${i}`);
                log(`> TRACE: key: ${key}`);
                log(`> TRACE: data[i][key]: ${data[i][key]}`);
                rows[i][key] = data[i][key];
            })
            log('TRACE: saving...');
            await rows[i].save();
            log('TRACE: Done');
        }
        // sheet > members => delete
        else if (rows[i] !== undefined) {
            await rows[i].delete(); // VERIFY will this impact the length or rows?
        }
        // members > sheet => add new row
        else if (data[i] !== undefined) {
            let t1 = await sheet.addRow(data[i]); // VERIFY
            log(`DEBUG: new row: ${JSON.stringify(t1)}`);
        }
        // SHOULD be unreachable
        else {
            log("WARNING: unreachable branch-condition in ./modules/sheets.js - run)");
        }
        log('TRACE: ================');
    }
    await sheet.saveUpdatedCells();
};


module.exports.doSheetUpload = run;
// rem-5-892@quickstart-1599814377442.iam.gserviceaccount.com
// 118232451383662433091
