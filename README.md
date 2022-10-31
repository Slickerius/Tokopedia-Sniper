# Tokopedia Sniper Bot

A project initiated by Slickerius, intended to assist in hunting for rare items on the Indonesian e-commerce marketplace Tokopedia, inspired by his endeavours in hunting for antique 70s cassette tapes. 

Sometimes certain items are just so rare that they're (or the ones with lower prices are) listed for only a very brief amount of time on Tokopedia. If you're in such a scenario, then this bot is perfect for you! It was made to help notify whenever a new item with a certain name has been listed to Tokopedia. It does that by scraping the Tokopedia newest items list with given queries periodically every 5 minutes, then posting the new additions on a Discord channel of your choosing.

![](https://cdn.discordapp.com/attachments/815844122673938453/1036559382428798986/unknown.png)

### Prequisites
- Docker

For testing (with Node.js):
- MariaDB (v3.0.1 or its patches)
- Puppeteer (v2)
- Node.js (v12 or above)
- Discord.js (v12.5.1 or its patches)

### Usage
To use this app, edit the file `bot/.env`, and fill in your bot token and channel to which the notifications will be sent.

Then, you can configure the `config.json` file to add the queries you want to monitor by adding to the `SEARCH` array. You can also omit certain items with certain keywords by adding to the `BLACKLIST` array in the config file.

You can then run the app by using:
```
sudo docker-compose up --build -d
```