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

class Currency {
    constructor(params) {
        this.params = params;
        this.currencies = Object.keys(currencyNames);
    }

    async text() {
        let messages = await this.handle(this.params);
        return messages.filter(message => message).join('\n');
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
        return [
            ':: 查詢匯率說明 ::',
            '查詢匯率請使用: 匯率 [幣名]',
            '查詢匯率與台幣兌換請使用: 匯率 [幣名] [台幣數量]',
            '查詢匯率與外幣兌換請使用: 匯率 [台幣數量] [幣名]',
            '可用幣別有 ' + (this.currencies.join(', ')),
        ];
    }

    async replyRate(command) {
        const data = await this.fetchRate(command.currency);
        if (!data) {
            return ['取得匯率資料失敗'];
        }

        const history = [
            ['day', '日歷史'],
            ['ltm', '三月歷史'],
            ['l6m', '半年歷史'],
        ].map(row => {
            return '<https://rate.bot.com.tw/xrt/quote/:type/:currency| :label>'
                .replace(':type', row[0])
                .replace(':currency', data.currency.toLowerCase())
                .replace(':label', row[1]);
        }).join(' | ');

        return [
            `台幣(TWD) => ${data.name}(${data.currency}) (更新時間: ${data.updated_at.fromNow()})`,
            `　現金匯率: 買入 ${data.rates.cash_buying}, 賣出 ${data.rates.cash_selling}`,
            `　即期匯率: 買入 ${data.rates.spot_buying}, 賣出 ${data.rates.spot_selling}`,
            '　<https://rate.bot.com.tw/xrt| 資料來源: 台灣銀行> | ' + history,
        ];
    }

    async replyToTwd(command) {
        const data = await this.fetchRate(command.currency);
        if (!data) {
            return ['取得匯率資料失敗'];
        }

        let rate = data.rates.cash_selling;
        let twd = Math.round(command.amount * rate * 100) / 100;

        return [
            ':amount :name(:currency) = :twd 台幣(TWD) :: 匯率 :rate'
                .replace(':amount', this.numberFormat(command.amount))
                .replace(':name', data.name)
                .replace(':currency', data.currency)
                .replace(':twd', this.numberFormat(twd))
                .replace(':rate', rate)
        ];
    }

    async replytoCurrency(command) {
        const data = await this.fetchRate(command.currency);
        if (!data) {
            return ['取得匯率資料失敗'];
        }

        let rate = data.rates.cash_selling;
        let calcAmount = Math.round(command.amount / rate * 100) / 100;

        return [
            ':amount 台幣(TWD) = :calcAmount :name(:currency) :: 匯率 :rate'
                .replace(':amount', this.numberFormat(command.amount))
                .replace(':calcAmount', this.numberFormat(calcAmount))
                .replace(':name', data.name)
                .replace(':currency', data.currency)
                .replace(':rate', rate)
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