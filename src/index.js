import qs from 'qs';
import Currency from './currency';

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    try {
        const body = await request.text();
        const params = qs.parse(body);
        const currency = new Currency(params);

        return new Response(
            JSON.stringify({
                text: await currency.text(),
                response_type: 'in_channel',
            }),
            { headers: { 'Content-type': 'application/json' } }
        );
    } catch (err) {
        console.error(err);
        const errorText = 'oops! something went wrong';
        return new Response(errorText);
    }
}