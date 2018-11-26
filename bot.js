const Discord = require('discord.js');
const client = new Discord.Client();
const {
  Client
} = require('pg');

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

db.connect(err => {
  if (err) throw err;
  console.log('Connected!');
});

db.query('CREATE TABLE IF NOT EXISTS mytable (i integer)');

db.query('INSERT INTO mytable (i) VALUES (5)');

db.query('SELECT i FROM mytable', (err, res) => {
  if (err) throw err;
  for (let row of res.rows) {
    console.log(row.i);
    //console.log(JSON.stringify(row));
  }
  db.end();
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('Pong!');
  }
});

client.login('NTE2NDgwOTQ2NDAxMzEyNzk5.Dt0SMg.eej4dkt3za84WN0V1nxT-nrVuuc');