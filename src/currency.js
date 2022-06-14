const dayjs = require('dayjs');
require('dayjs/locale/zh-tw');
var relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(relativeTime)
dayjs.locale('zh-tw');

import BotRate from './bot_rate';

const currencyNames = {
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

const array_chunk = function (list, chunkSize) {
    return [...Array(Math.ceil(list.length / chunkSize))].map((_,i) => list.slice(i*chunkSize,i*chunkSize+chunkSize));
}

class Currency {
    constructor(params) {
        this.params = params;
        this.currencies = Object.keys(currencyNames);
    }

    async blocks() {
        return await this.handle(this.params);
    }

    async handle(params) {
        let command = this.parseCommands(params.text);

        switch (command.action) {
            case 'help': return this.replyHelp(command); break;
            case 'rate': return await this.replyRate(command); break;
            case 'toTWD': return await this.replyToTwd(command); break;
            case 'toCurrency': return await this.replytoCurrency(command); break;
        }
    }

    parseCommands(text = '') {
        const commands = text.trim().split(/[\s]+/).filter(cmd => cmd);
        let commandLen = commands.length;

        if (commandLen === 0 || commandLen > 2) {
            return {action: 'help'};
        }

        if (commandLen === 1) {
            return {
                action: 'rate',
                currency: (commands[0] || '').toUpperCase(),
            };
        }

        // currency to TWD: example 999 USD
        if (!Number.isNaN(commands[0]) && this.isCurrency(commands[1])) {
            return {
                action: 'toTWD',
                currency: commands[1].toUpperCase(),
                amount: parseFloat(commands[0]),
            };
        }

        // TWD to currency: example USD 999
        if (this.isCurrency(commands[0]) && !Number.isNaN(commands[1])) {
            return {
                action: 'toCurrency',
                currency: commands[0].toUpperCase(),
                amount: parseFloat(commands[1]),
            };
        }

        return {action: 'help'};
    }

    replyHelp(command) {
        const availableCurrencies = array_chunk(Object.entries(currencyNames), 10).map(rows => {
            return {
                "type": "section",
                "fields": rows.map(([key, value]) => {
                    return {
                        "type": "plain_text",
                        "text": `${key} - ${value}`
                    };
                }),
            };
        });

        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": [
                        "*查詢匯率說明*",
                        "- 查詢匯率: `匯率 [外幣代碼]`",
                        "- 台幣轉外幣: `匯率 [外幣代碼] [台幣值]`",
                        "- 外幣轉台幣: `匯率 [外幣值] [外幣代碼]`",
                    ].join('\n'),
                },
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "可用外幣"
                    },
                ]
            },
        ].concat(...availableCurrencies);
    }

    async replyRate(command) {
        const data = await this.fetchRate(command.currency);
        if (!data) {
            return [
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": "取得匯率資料失敗",
                    },
                },
            ];
        }

        const elements = [
            ['day', '日歷史'],
            ['ltm', '三月歷史'],
            ['l6m', '半年歷史'],
        ].map(row => {
            return {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": row[1]
                },
                "url": 'https://rate.bot.com.tw/xrt/quote/:type/:currency'
                    .replace(':type', row[0])
                    .replace(':currency', data.currency.toLowerCase()),
            };
        });

        return [
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `*台幣(TWD) > ${data.name}(${data.currency})*`,
                    },
                    {
                        "type": "mrkdwn",
                        "text": `(更新時間: ${data.updated_at.fromNow()})`,
                    }
                ]
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": [
                            '*現金匯率*',
                            `買入 ${data.rates.cash_buying}`,
                            `賣出 ${data.rates.cash_selling}`,
                        ].join('\n'),
                    },
                    {
                        "type": "mrkdwn",
                        "text": [
                            '*即期匯率*',
                            `買入 ${data.rates.spot_buying}`,
                            `賣出 ${data.rates.spot_selling}`,
                        ].join('\n'),
                    },
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "資料來源: <https://rate.bot.com.tw/xrt|台灣銀行>",
                    },
                ]
            },
            {
                "type": "actions",
                "elements": elements,
            },
        ];
    }

    async replyToTwd(command) {
        const data = await this.fetchRate(command.currency);
        if (!data) {
            return [
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": "取得匯率資料失敗",
                    },
                },
            ];
        }

        let rate = data.rates.cash_selling;
        let twd = Math.round(command.amount * rate * 100) / 100;

        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": '`$:amount` :name(:currency) = `$:twd` 台幣(TWD) :: 匯率 `:rate`'
                        .replace(':amount', this.numberFormat(command.amount))
                        .replace(':name', data.name)
                        .replace(':currency', data.currency)
                        .replace(':twd', this.numberFormat(twd))
                        .replace(':rate', rate)
                },
            },
        ];
    }

    async replytoCurrency(command) {
        const data = await this.fetchRate(command.currency);
        if (!data) {
            return [
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": "取得匯率資料失敗",
                    },
                },
            ];
        }

        let rate = data.rates.cash_selling;
        let calcAmount = Math.round(command.amount / rate * 100) / 100;

        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": '`$:amount` 台幣(TWD) = `$:calcAmount` :name(:currency) :: 匯率 `:rate`'
                        .replace(':amount', this.numberFormat(command.amount))
                        .replace(':calcAmount', this.numberFormat(calcAmount))
                        .replace(':name', data.name)
                        .replace(':currency', data.currency)
                        .replace(':rate', rate)
                },
            },
        ];
    }

    isCurrency(value) {
        let currency = (value || '').toUpperCase();
        return this.currencies.indexOf(currency) > -1;
    }

    numberFormat(value) {
        if (Number.isNaN(value)) return value;
        return value.toLocaleString('us', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    async fetchRate(currency) {
        let data = await BotRate();
        let rate = (data.rates || []).find(rate => rate.currency === currency);

        return {
            currency,
            name: rate.chinese_name,
            rates: rate,
            updated_at: dayjs.unix(data.updated_at),
        };
    }
}

export default Currency;