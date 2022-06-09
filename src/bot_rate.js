const dayjs = require('dayjs')

const url = 'https://rate.bot.com.tw/xrt/flcsv/0/day';  // csv resource
const COLUMN_MAPPING = {
    'currency': 0,
    'cash_buying': 2,
    'cash_selling': 12,
    'spot_buying': 3,
    'spot_selling': 13
};
const CURRENCY_NAMES = {
    'USD': '美元',
    'HKD': '港幣',
    'GBP': '英鎊',
    'AUD': '澳幣',
    'CAD': '加拿大幣',
    'SGD': '新加坡幣',
    'CHF': '瑞士法郎',
    'JPY': '日圓',
    'ZAR': '南非幣',
    'SEK': '瑞典克朗',
    'NZD': '紐西蘭幣',
    'THB': '泰銖',
    'PHP': '菲律賓披索',
    'IDR': '印尼盾',
    'EUR': '歐元',
    'KRW': '菲律賓披索',
    'VND': '越南幣',
    'MYR': '馬來西亞幣',
    'CNY': '人民幣',
};


export default async function () {
    const response = await fetch(url, {
        headers: {
            'Accept-language': 'en',
            'Host': 'rate.bot.com.tw',
            'content-type': 'text/csv;charset=UTF-8',
        },
        cf: {
            cacheTtl: 300,
            cacheEverything: true,
        },
    });

    let updatedAt = parseHeaderUpdateTime(response.headers);

    let text = await response.text();
    let rates = parseContents(text);

    return {
        'rates': rates,
        'created_at': dayjs().unix(),
        'updated_at': updatedAt,
    };
};

function parseHeaderUpdateTime(headers) {
    if (!headers.has('Content-Disposition')) {
        return null;
    }

    let contentDisposition = headers.get('Content-Disposition');
    let founds = contentDisposition.match(/ExchangeRate@(.*).csv/);

    if (!founds || !founds[1]) return null;

    return dayjs(founds[1], "YYYYMMDDHHmm").unix();
}

function parseContents(content) {
    let data = CSVToArray(content, ',', true);
    return data.filter(row => row.length > 13)
        .map(row => {
            let values = {};
            for (const [key, colIndex] of Object.entries(COLUMN_MAPPING)) {
                let value = row[colIndex];
                values[key] = isNumeric(value) ? parseFloat(value) : value;
            }
            values.chinese_name = CURRENCY_NAMES[values.currency];
            return values;
        });
}

// source: https://www.30secondsofcode.org/js/s/csv-to-array
function CSVToArray(data, delimiter = ',', omitFirstRow = false) {
    return data
        .slice(omitFirstRow ? data.indexOf('\n') + 1 : 0)
        .split('\n')
        .map(v => v.split(delimiter));
}

// source: https://stackoverflow.com/a/175787
function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

