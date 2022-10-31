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
const CHANNEL_ID = process.env.CHANNEL_ID;

const pool = mariadb.createPool({
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
              `--window-size=1200,800`,] });
    searchQueue = [...SEARCH];
    scrape(searchQueue[0]);
})();

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
    console.log(`Scraping for query "${query}". . .`);
    const page = await browser.newPage();
    let conn;

    await page.goto(URL + query, {waitUntil: `load`});
    await page.waitFor(STD_INTERVAL);
    
    // scroll down
    let lastHeight = await page.evaluate(`document.body.scrollHeight`);
    let it = 5;
    
    while(true) {
        await page.evaluate(`window.scrollTo(document.body.scrollWidth, document.body.scrollHeight / ${it})`);
        await page.waitFor(STD_INTERVAL); // sleep a bit
        let newHeight = await page.evaluate(`document.body.scrollHeight`);
        if(it > 0) it--;
        else break;
    }
    
    await page.waitFor(STD_INTERVAL);
    
    const cardEls = await page.$$(`.pcv3__container`);
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
    
    // 70 items; 0-4 and 65-69 are ads
    let test = await page.$$(`.css-14xd9o5`);
    let isPromotedStoreExists = (await page.$$(`.css-14xd9o5`)).length > 0;
    if(isPromotedStoreExists) {
        cardList = cardList.slice(8, 68);
    } else {
        cardList = cardList.slice(5, 65);
    }
    
    let postMessage = ``;

    for(let card of cardList) {
        let exists = await checkItem(card);
        let filtered = false;
        
        for(let bannedToken of BLACKLIST) {
            if(card[0].toLowerCase().includes(bannedToken)) {
                console.log(`Filtered: ${card[0]}`);
                filtered = true;
                break;
            }
        }
        
        if(!exists && !filtered) {
            postChannel.send(`**New Item!**\n**Name**: ${card[0]}\n**Price**: **${card[2]}**\n**URL**: ${card[1]}\n\n**Image**: ${card[3]}`);
            saveItem(card);
        }
    }
        
    await page.close();
    await page.waitFor(STD_INTERVAL);
    
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
});

client.login(process.env.BOT_TOKEN);

cron.schedule(`*/5 * * * *`, () => {
    console.log(`Starting periodic scraping. . .`);
    searchQueue = [...SEARCH];
    scrape(searchQueue[0]);
});
