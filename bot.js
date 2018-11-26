const Discord = require('discord.js');
const client = new Discord.Client();
const {
  Client
} = require('pg');

const db = new Client({
  connectionString: process.env.DATABASE_URL || "localhost",
  ssl: true,
});

db.connect(err => {
  if (err) throw err;
  console.log('Connected!');
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