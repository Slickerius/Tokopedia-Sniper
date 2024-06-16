const Discord = require(`discord.js`);
const puppeteer = require(`puppeteer`);
const mariadb = require(`mariadb`);
const client = new Discord.Client();
const cron = require(`node-cron`);
const config = require(`./config.json`)

const URL = config.URL;
const BLACKLIST = config.BLACKLIST;
const SEARCH = config.SEARCH;
let searchQueue = [];
const STD_INTERVAL = 2000;
const CHANNEL_ID = process.env.CHANNEL_ID; // change
const BOT_TOKEN = process.env.BOT_TOKEN; // change

const pool = mariadb.createPool({ // change
    host: `db`, 
    user: `tokpedsniper`, 
    password: `tokpedsniper`,
    database: `tokpedsniper`,
    connectionLimit: 5
});

let browser;

let postChannel;

let savedItems = [];

const init = (async() => {
    browser = await puppeteer.launch({ headless: true,
              executablePath: process.env.CHROME_BIN || null,
              args: [`--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`, 
              `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36`,
              `--user-data-dir=/tmp/user_data/`,
              `--start-maximized`] });
    console.log(await browser.userAgent());
    searchQueue = [...SEARCH];
    scrape(searchQueue[0]);
});

const checkItem = async(card) => {
    let conn;
    let ret = false;
    
    try {
        conn = await pool.getConnection();
        let res = await conn.query(`SELECT * FROM items WHERE name = ? AND price = ? AND url = ?`, [card[0], card[2], card[1]]);
        ret = res.length > 0;
    } catch (err) {
        throw err;
    } finally {
        if(conn) conn.end();
    }

    return ret;
};

const saveItem = async(card) => {
    let conn;
    try {
        conn = await pool.getConnection();
        let res = await conn.query(`INSERT INTO items (name, price, url) VALUES (?, ?, ?)`, [card[0], card[2], card[1]]);
    } catch (err) {
        throw err;
    } finally {
        if(conn) conn.end();
    }

};

const scrape = async (query) => {
    // const browser = await puppeteer.launch({ headless: false, args: [`--no-sandbox`,`--disable-setuid-sandbox`] });
    console.log(`zzScraping for query "${query}". . .`);
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    let conn;

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
    );
    
    await page.setViewport({ width: 1366, height: 768});
    await page.setDefaultNavigationTimeout(0);
    // await page.goto("https://webhook.site/442f7ed9-33db-4b5f-a6d8-56b72a1ca2a0", {waitUntil: `networkidle0`});

    await page.goto(URL + query, {waitUntil: `load`});
    await page.waitForTimeout(STD_INTERVAL);

    // const data = await page.evaluate(() => document.querySelector('*').outerHTML);
    // console.log(data);

    // scroll down
    let lastHeight = await page.evaluate(`document.body.scrollHeight`);
    let it = 5;
    
    while(true) {
        await page.evaluate(`window.scrollTo(document.body.scrollWidth, document.body.scrollHeight / ${it})`);
        await page.waitForTimeout(STD_INTERVAL); // sleep a bit
        let newHeight = await page.evaluate(`document.body.scrollHeight`);
        if(it > 0) it--;
        else break;
    }
    
    await page.waitForTimeout(STD_INTERVAL);
    
    const cardEls = await page.$$(`.YAEeaDkUOUIxPzURz6noDQ\\=\\=`);
    
    console.log(`cardEls ${cardEls}`);
    
    let cardList = [];
    for(let cardEl of cardEls){
        let cardIsAd = await cardEl.$(`.css-1gohnec`);
        if(cardIsAd !== null) continue;
        
        let cardInfo = await cardEl.$(`.LtzT2\\+1uM2newSaGKlnjAw\\=\\=`);
        
        console.log(`cardInfo ${cardInfo}`);
        
        // let cardName = await page.evaluate(el => el.title, cardInfo);
        // let cardURL = await page.evaluate(el => el.href, cardInfo); 
        
        let cardName = await cardEl.$(`.\\_4zuh5-h5tURvY6WpuPWQdA\\=\\=`);
        cardName = await page.evaluate(el => el.innerHTML, cardName);
        
        let cardURL = await page.evaluate(el => el.href, cardEl);
        
        let cardImg = await cardEl.$(`.css-1c345mg`);
        cardImg = await page.evaluate(el => el.src, cardImg);
        
        console.log(`cardName ${cardName}`);
        console.log(`cardURL ${cardURL}`);
        console.log(`cardImg ${cardImg}`);
        
        let cardPrice = await cardEl.$(`.KQib-amemtBlmDeX02RD6Q\\=\\=`);
        cardPrice = await page.evaluate(el => el.innerHTML, cardPrice);
        
        console.log(`cardPrice ${cardPrice}`);
        
        cardList.push([cardName, cardURL.split(`?`)[0], cardPrice, cardImg]);
    }
    
    // 70 items; 0-4 and 65-69 are ads
    let isPromotedStoreExists = (await page.$$(`.css-1rzg7ys`)).length > 0;
    if(isPromotedStoreExists) {
        cardList = cardList.slice(3);
    }

    // Do not include recommended items
    let recommendationLabels = (await page.$$(`.css-1lekzkb`)).length;
    if(recommendationLabels > 0)
        cardList = cardList.slice(0, -1 * 5 * recommendationLabels);
    
    let postMessage = ``;

    for(let card of cardList) {
        let exists = await checkItem(card); // change to await checkItem(card);
        let filtered = false;
        for(let bannedToken of BLACKLIST) {
            if(card[0].toLowerCase().includes(bannedToken)) {
                console.log(`Filtered: ${card[0]}`);
                filtered = true;
                break;
            }
        }

        if(card[1].length > 512) {
            console.log(`Filtered: ${card[0]}`);
            filtered = true;
        }

	if(!query.split(' ').every(token => card[0].toLowerCase().includes(token))) {
	    console.log(`Unrelated item filtered: ${card[0]}`);
	    filtered = true;
	}
        
        if(!exists && !filtered) {
            postChannel.send(`**New Item!**\n**Query**: "${query}"\n**Name**: ${card[0]}\n**Price**: **${card[2]}**\n**URL**: ${card[1]}\n\n**Image**: ${card[3]}`);
            try {
                saveItem(card); // change
            } catch(e) {
                console.log(`ERROR: ${e}`);
            }
        }
    }
        
    await page.close();
    await page.waitForTimeout(STD_INTERVAL);
    await context.close();
    searchQueue.shift();
    if(searchQueue.length > 0)
        return scrape(searchQueue[0]);
    
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
    
    init();
});

client.login(BOT_TOKEN);

cron.schedule(`0,30 * * * *`, () => {
    console.log(`Starting periodic scraping. . .`);
    searchQueue = [...SEARCH];
    scrape(searchQueue[0]);
});
