const Discord = require('discord.js');
const client = new Discord.Client();
const tokens = require('./tokens.json');
const ytdl = require('ytdl-core');
const search = require('youtube-search');
let secret;
try {
  secret = require('./secret.json');
} catch (err) {
  console.log('Secret not found. Ignoring.');
}
const {
  Client
} = require('pg');

let db;

if (process.env.DATABASE_URL) {
  console.log('Connecting via heroku..');
  db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  });
} else {
  console.log('Connecting via local..')
  db = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: secret.dbpswrd,
    port: 5432,
  });
}

db.connect(err => {
  if (err) throw err;
  console.log('Connected!');
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

let queue = {};

client.on('message', async msg => {
  if (msg.author.bot) return;
  if (msg.channel.type == 'dm') return;
  if (!msg.content.startsWith(tokens.prefix)) return;
  if (msg.content.startsWith(tokens.prefix + 'play')) {
    if (!msg.member.voiceChannel) return msg.channel.send('Join a voice channel first.');
    msg.member.voiceChannel.join().then(connection => {
      const opts = {
        maxResults: 1,
        key: process.env.YOUTUBE_API_TOKEN || secret.youtube_api_key,
        order: 'viewCount'
      };
      const streamOptions = {
        seek: 0,
        volume: 1,
        bitrate: 96000,
        passes: 2
      };
      let song = msg.content.split(' ').slice(1).join(' ');
      if (!song) return msg.channel.send('Specify a song!');
      let foundSong;
      search(song, opts, function(err, results) {
        if (err) return console.log(err);
        results.forEach(function(element) {
          foundSong = element.link;
          msg.channel.send('', {
            embed: {
              description: `Playing [${element.title}](${element.link})`,
              timestamp: new Date(element.publishedAt),
              footer: {
                icon_url: client.user.avatarURL,
                text: "Uploaded"
              }
            }
          });
          const stream = ytdl(foundSong, {
            filter: 'audioonly'
          });
          const dispatcher = connection.playStream(stream, streamOptions);
          dispatcher.on('end', () => {
            collector.stop();
          });
          let collector = msg.channel.createMessageCollector(m => m);
          collector.on('collect', m => {
            if (!m.content.startsWith(tokens.prefix + 'skip')) return;
            msg.channel.send('skipped..');
            dispatcher.end();
          });
        });
      });
    });
  }
});

client.login(process.env.BOT_TOKEN || secret.token);

/*db.query('CREATE TABLE IF NOT EXISTS supertable (name text UNIQUE, i integer)');
db.query('INSERT INTO supertable (name, i) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING;', [msg.author.id, 3]);
db.query('SELECT * FROM supertable', (err, res) => {
  if (err) throw err;
  for (let row of res.rows) {
    console.log(row.name);
    console.log(row.i);
  }
});*/