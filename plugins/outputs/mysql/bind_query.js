// Binds the event payload into a MySQL statement.
//
// '{|data|}' is the historical placeholder. It used to be replaced with
// JSON.stringify(data) inside a quoted SQL string, which let a single quote
// in any event field close that string. Quoted and bare forms are rewritten
// to '?' and the JSON is passed as a bound parameter. A query that already
// uses '?' (the default) is bound the same way. Placeholders inside SQL
// string literals are left alone.

var DATA_PLACEHOLDER = /'\{\|data\|\}'|"\{\|data\|\}"|\{\|data\|\}/g;

var DEFAULT_QUERY = 'call SP_UpdateSyncResult(?);';

function countPlaceholders(sql) {
    var count = 0;
    var quote = null;
    var i;
    var ch;

    for (i = 0; i < sql.length; i++) {
        ch = sql.charAt(i);
        if (quote) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === quote) {
                if (sql.charAt(i + 1) === quote) {
                    i++;
                    continue;
                }
                quote = null;
            }
            continue;
        }
        if (ch === '\'' || ch === '"') {
            quote = ch;
            continue;
        }
        if (ch === '?') {
            count++;
        }
    }
    return count;
}

function bindEventQuery(query, payload) {
    var sql = (query === undefined || query === null) ? '' : String(query);
    var params = [];
    var holes;
    var i;

    DATA_PLACEHOLDER.lastIndex = 0;
    sql = sql.replace(DATA_PLACEHOLDER, '?');
    holes = countPlaceholders(sql);
    for (i = 0; i < holes; i++) {
        params.push(payload);
    }
    return { sql: sql, params: params };
}

exports.DEFAULT_QUERY = DEFAULT_QUERY;
exports.bindEventQuery = bindEventQuery;
exports.countPlaceholders = countPlaceholders;
