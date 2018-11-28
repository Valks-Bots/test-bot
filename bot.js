const dev_mode = false;

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

const prefix = dev_mode ? tokens.dev_prefix : tokens.prefix;

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

let queue = [];
let intervalID;

const commands = {
  'play': (msg) => {
    if (!msg.member.voiceChannel) return msg.channel.send('Join a voice channel first.');

    msg.member.voiceChannel.join().then(async connection => {
      const opts = {
        maxResults: 10,
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
      let songs = [];
      search(song, opts, async function(err, results) {
        if (err) return console.log(err);
        results.forEach(function(element) {
          songs.push({
            title: element.title,
            url: element.link,
            id: element.id
          });
        });
        getSongs(songs).then(async songs => {
          let message = [];
          for (let i = 0; i < songs.length; i++) {
            message[i] = `${i + 1}. ${songs[i].title}`;
          }

          msg.channel.send(embed('Choose a Song', message.join('\n'), `Pick a number between 1 and ${songs.length}.`)).then(message => {
            let songPicker = msg.channel.createMessageCollector(m => m);
            songPicker.on('collect', async m => {
              if (isNaN(m)) return;
              //await m.delete();
              let number = await parseInt(m) - 1;
              if (number < 0 || number > songs.length) return;
              songPicker.stop();
              message.delete();
              //channel.fetchMessages({ limit: 10 })
              if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [];
              queue[msg.guild.id].songs.push({
                url: songs[number].url,
                name: songs[number].title
              });
              if (queue[msg.guild.id].playing) return msg.channel.send(embed('', `Added ${songs[number].title} to the queue.`));

              playSong();

              async function playSong() {
                queue[msg.guild.id].playing = true;
                const stream = await ytdl(queue[msg.guild.id].songs[0].url, {
                  filter: 'audioonly'
                });
                const dispatcher = connection.playStream(stream, streamOptions);

                msg.channel.send(embed('', `Playing ${queue[msg.guild.id].songs[0].name}`)).then(async message => {
                  let collector_reaction = emoteCollector(message, ['▶', '⏸', '⏭'], msg.author.id);
                  dispatcher.on('start', async () => {
                    let song_length = 0;
                    ytdl.getInfo(songs[number].id, (err, info) => {
                      song_length = info.length_seconds;
                    });

                    await message.edit(embed('', `Playing ${queue[msg.guild.id].songs[0].name}`));
                    await message.react('▶');
                    await message.react('⏸');
                    await message.react('⏭');

                    collector_reaction.on('collect', (messageReaction, reactionCollector) => {
                      let reaction = messageReaction.emoji.name;
                      if (reaction == '⏸') {
                        if (!dispatcher.paused) {
                          dispatcher.pause();
                          clearInterval(intervalID);
                        }
                      }
                      if (reaction == '▶') {
                        if (dispatcher.paused) {
                          dispatcher.resume();
                          intervalID = setInterval(timeLeft, 15000);
                        }
                      }
                      if (reaction == '⏭') {
                        dispatcher.end();
                        message.edit(embed('', `Skipped ${queue[msg.guild.id].songs[0].name}`));
                      }
                    });

                    let progressBar = [];
                    let progressBarLength = 40;
                    for (let i = 0; i < progressBarLength; i++) {
                      if (i == 0) {
                        progressBar[i] = '[';
                      } else if (i == progressBarLength - 1) {
                        progressBar[i] = ']';
                      } else {
                        progressBar[i] = '-';
                      }
                    }

                    intervalID = setInterval(timeLeft, 3000);

                    function timeLeft() {
                      let current_time = Math.floor(dispatcher.time / 1000);
                      let percent = Math.floor(current_time / song_length * 100);
                      let progressBarPosition = Math.floor(percent / 100 * progressBarLength);
                      for (let i = 1; i < progressBarPosition - 2; i++) {
                        progressBar[i] = '=';
                      }
                      let theDate = new Date(dispatcher.time);
                      let showTime = theDate.getMinutes() + ":" + (theDate.getSeconds() < 10 ? '0' : '') + theDate.getSeconds();

                      let finalDate = new Date(song_length * 1000);
                      let endTime = finalDate.getMinutes() + ":" + (finalDate.getSeconds() < 10 ? '0' : '') + finalDate.getSeconds();
                      message.edit(embed('', `Playing ${queue[msg.guild.id].songs[0].name}`, `${progressBar.join('')} [${showTime} / ${endTime}]`));
                    }
                  });

                  dispatcher.on('end', async () => {
                    clearInterval(intervalID);
                    await collector_reaction.stop();
                    message.clearReactions();
                    message.edit(embed('', `Finished playing ${queue[msg.guild.id].songs[0].name}`));
                    queue[msg.guild.id].playing = false;
                    queue[msg.guild.id].songs.shift();
                    if (queue[msg.guild.id].songs.length != 0) {
                      playSong();
                    }
                  });

                  dispatcher.on('error', (err) => {
                    console.log(err);
                  });

                  dispatcher.on('debug', (info) => {
                    console.log(info);
                  });
                });
              }


              /*let collector = msg.channel.createMessageCollector(m => m);
              collector.on('collect', m => {
                if (m.content.startsWith(prefix + 'skip')) {
                  dispatcher.end();
                  msg.channel.send(embed('', `Skipped ${songs[number].title}`));
                }
                if (m.content.startsWith(prefix + 'time')) {
                  msg.channel.send(dispatcher.time / 1000);
                }
              });*/
            });
          });
        });
      });
    });
  }
};

client.on('message', async msg => {
  if (msg.author.bot) return;
  if (msg.channel.type == 'dm') return;
  if (!msg.content.startsWith(prefix)) return;
  if (commands.hasOwnProperty(msg.content.toLowerCase().slice(prefix.length).split(' ')[0])) {
    commands[msg.content.toLowerCase().slice(prefix.length).split(' ')[0]](msg);
  }

  if (msg.content.startsWith(prefix + 'play')) {

  }
});

function emoteCollector(reactionMessage, emotes, id) {
  const filter = (reaction, user) => {
    return emotes.includes(reaction.emoji.name) && user.id === id;
  };
  const collector = reactionMessage.createReactionCollector(filter);

  return collector;
}

function getSongs(songs) {
  return new Promise((resolve, reject) => {
    resolve(songs);
  });
}

function embed(title, desc, footer) {
  return {
    embed: {
      title: title,
      description: desc,
      footer: {
        text: footer
      }
    }
  }
}

if (dev_mode) {
  client.login(dev_mode ? secret.dev_token : secret.token);
} else {
  client.login(process.env.BOT_TOKEN);
}


/*db.query('CREATE TABLE IF NOT EXISTS supertable (name text UNIQUE, i integer)');
db.query('INSERT INTO supertable (name, i) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING;', [msg.author.id, 3]);
db.query('SELECT * FROM supertable', (err, res) => {
  if (err) throw err;
  for (let row of res.rows) {
    console.log(row.name);
    console.log(row.i);
  }
});*/