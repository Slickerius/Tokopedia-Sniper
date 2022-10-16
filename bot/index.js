// SiakNG Status Bot by sl0ck
const Discord = require('discord.js');
const puppeteer = require(`puppeteer`);
const client = new Discord.Client();
const cron = require('node-cron');

const URL =`https://www.tokopedia.com/search?navsource=home&ob=9&source=universe&srp_component_id=01.02.01.01&st=product&q=kaset%20koes`;
const STD_INTERVAL = 2000;
const CARD_CLASS = `css-gfx8z3`;
const CHANNEL_ID = process.env.CHANNEL_ID;

let browser;

let postChannel;

let savedItems = [];

const init = (async() => {
	browser = await puppeteer.launch({ headless: true,
              executablePath: process.env.CHROME_BIN || null,
              args: [`--no-sandbox`, `--headless`, `--disable-gpu`, `--disable-dev-shm-usage`, 
			  `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36`,
			  `--user-data-dir=/tmp/user_data/`,
			  `--window-size=1200,800`,] });
	scrape();
})();

const scrape = async () => {
    // const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto(URL, {waitUntil: 'load'});
	await page.waitFor(STD_INTERVAL);
	
	// scroll down
	let lastHeight = await page.evaluate('document.body.scrollHeight');
	let it = 5;
	
    while(true) {
        await page.evaluate(`window.scrollTo(document.body.scrollWidth, document.body.scrollHeight / ${it})`);
        await page.waitFor(STD_INTERVAL); // sleep a bit
        let newHeight = await page.evaluate('document.body.scrollHeight');
		if(it > 0) it--;
		else break;
    }
	
	await page.waitFor(STD_INTERVAL);
	
	const cardEls = await page.$$('.pcv3__container');
	let cardList = [];
	for(let cardEl of cardEls){
		let cardInfo = await cardEl.$(`.pcv3__info-content`);
		let cardName = await page.evaluate(el => el.title, cardInfo);
		let cardURL = await page.evaluate(el => el.href, cardInfo); 
		
		let cardImg = await cardEl.$(`.css-1c345mg`);
		cardImg = await page.evaluate(el => el.src, cardImg);
		
		let cardPrice = await cardEl.$(`.prd_link-product-price`);
		cardPrice = await page.evaluate(el => el.innerHTML, cardPrice); 
		cardList.push([cardName, cardURL.split(`?`)[0], cardPrice, cardImg]);
	}
	cardList = cardList.slice(5, 65);
	
	let postMessage = ``;
	for(let card of cardList) {
		let exists = false;
		for(savedItem of savedItems) 
			if(card[0] == savedItem[0] && card[1] == savedItem[1])
				exists = true;
		if(!exists) {
			postChannel.send(`**New Item!**\n**Name**: ${card[0]}\n**Price**: **${card[2]}**\n**URL**: ${card[1]}\n\n**Image**: ${card[3]}`);
			savedItems.push(card);
		}
	}
	
	await page.close();
	return true;
};

client.on(`ready`, () => 
{
	console.log(`Connected as user: ${client.user.username}`);
	client.user.setActivity(`Koes Plus - Dheg Dheg Plas`, {
		type: `STREAMING`,
		url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
	});

    client.channels.cache.forEach((channel) => {
        if(channel.id == CHANNEL_ID)
			postChannel = channel;
    });
});

client.login(process.env.BOT_TOKEN);

cron.schedule('*/5 * * * *', () => {
	scrape();
});
