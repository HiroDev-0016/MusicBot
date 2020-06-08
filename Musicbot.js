const http = require('http');
http.createServer(function(request,responce)
                  {
  responce.writeHead(200, {'Content-Type': 'text/plain'});
}).listen(3000);

const { Client, Util } = require('discord.js');
const { TOKEN, PREFIX, GOOGLE_API_KEY, COLOR, STATUS, CMDNAME } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');
const Discord = require("discord.js");

const client = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map(); 

client.on('message', message => {
  if (message.content === `${PREFIX}ping`) {
    message.reply('pong');
  }
});

client.on('message', message => {
  if (message.content === `${PREFIX}help`) {
    var embed = new Discord.RichEmbed()
    .setTitle('MUSIC COMMANDS')
    .setColor(`${COLOR}`)
    .setDescription(`${PREFIX}play, ${PREFIX}skip, ${PREFIX}np, ${PREFIX}volume, ${PREFIX}stop, ${PREFIX}resume, ${PREFIX}queue, ${PREFIX}pause, ${PREFIX}clean`);
    message.channel.send(embed);
  }
});


client.on('warn', console.warn);

client.on('error', console.error);


client.on('ready', () => {
      

  console.log(`${client.user.tag} Yo this ready!`)
        client.user.setActivity(`${STATUS}`);
    
});

client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconnect now...'));

client.on('reconnecting', () => console.log('I am reconnecting now!'));

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'play') {
	  const voiceChannel = msg.member.voiceChannel;
        if (!voiceChannel) return msg.channel.send('I\'m sorry but you need to be in a voice channel to play music!');
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has('CONNECT')) {
            return msg.channel.send('I cannot connect to your voice channel, make sure I have the proper permissions!');
        }
        if (!permissions.has('SPEAK')) {
            return msg.channel.send('I cannot speak in this voice channel, make sure I have the proper permissions!');
        }


        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
          var embed = new Discord.RichEmbed()
                .setTitle("Song Selection")
                .setDescription(`✅ Playlist: **${playlist.title}** adicionada a fila!`)
                .setColor("RANDOM")
            return msg.channel.send(embed);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    var embed = new Discord.RichEmbed()
                        .setTitle("🎺 Seleção de Música ✔️")
                        .setDescription(`${videos.map(video2 => `**${++index}** \`${video2.title}\` `).join('\n')}`)
                        .setColor("#ff2052")
                        .setFooter("Coloque um valor de 1-10, conforme o número do lado da música")

                    msg.channel.send(embed);
                    // eslint-disable-next-line max-depth
                    try {
                        var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                            maxMatches: 1,
                            time: 10000,
                            errors: ['time']
                        });
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send('Nenhum numéro ou número invalido posto, cancelando a seleção');
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return msg.channel.send('🆘 Eu não achei resultados para sua pesquisa');
                }
            }
            return handleVideo(video, msg, voiceChannel);
        }

	} else if (command === 'skip') {
    
    
		if (!msg.member.voiceChannel) return msg.channel.send('🛑 Você não está em um canal de voz!');
		if (!serverQueue) return msg.channel.send('Não tem nada tocando!');
		serverQueue.connection.dispatcher.end('Skip command has been used!');
    msg.channel.send('Música pulada com sucesso!');
    
		return undefined;
	} else if (command === 'stop') {
        if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
        if (!serverQueue) return msg.channel.send('There is nothing playing that I could stop for you.');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end('Stop command has been used!');
        msg.reply("Desconexão efetuada com sucesso!");
        return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('Você não está em um canal de voz');
		if (!serverQueue) return msg.channel.send('Não tem nada tocando');
		if (!args[1]) return msg.channel.send(`Atualmente o volume está em: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 4);
		return msg.channel.send(`Ajustei o volume para: **${args[1]}**`);
	} else if (command === 'clean') {
    if (!msg.member.voiceChannel) return msg.channel.send('Você não está em um canal de voz');
		if (!serverQueue) return msg.channel.send('A fila ja está limpa');
     msg.channel.send(`Cleared the queue`).then(m => serverQueue.connection.dispatcher.clear());
  } else if (command === 'duration') {
    if (!msg.member.voiceChannel) return msg.channel.send('Você não está em um canal de voz');
    if (!serverQueue) return msg.channel.send('Não tem nada tocando');
                  let data = await Promise.resolve(ytdl.getInfo(serverQueue.songs[0].url));
        let duration = (data.length_seconds * 1000).toFixed(0);
    var seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return msg.channel.send(`Duração da música - ${hours}h:${minutes}m:${seconds}s`);
}

  
  else if (command === 'np') {
    var embed = new Discord.RichEmbed()
    .setTitle("Detalhes do som")
    .setDescription(`🎶 \`Tocando:\` **${serverQueue.songs[0].title}**`)
    .setColor(`${COLOR}`)
		if (!serverQueue) return msg.channel.send('Não tem nada tocando');
		return msg.channel.send(embed);

} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('Não tem nada tocando.');
		var embed = new Discord.RichEmbed()
                .setTitle("Fila")
                .setDescription(`${serverQueue.songs.map(song => `**• ** ${song.title}`).join('\n')}

🎵 \`Now playing:\` **${serverQueue.songs[0].title}**`)
                .setColor(`${COLOR}`)
    return msg.channel.send(embed);
	} else if (command === 'pause') {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            var embed = new Discord.RichEmbed()
                .setTitle("Pause")
                .setDescription(`⏸ Musica pausada com sucesso!`)
                .setColor(`${COLOR}`)
            msg.channel.send(embed)
          
           }
          } else if (command === 'resume') {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            var embed = new Discord.RichEmbed()
                .setTitle("Resume")
                .setDescription(`▶ Musica retomada com sucesso!`)
                .setColor(`${COLOR}`)
            msg.channel.send(embed)
        }
    } 

});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 10,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`I could not join the voice channel: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`I could not join the voice channel: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
    var embed = new Discord.RichEmbed()
                .setTitle("Seleção ")
                .setDescription(`✅ Música adicionada com sucesso!`)
                .setColor(`${COLOR}`)
		 return msg.channel.send(embed);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') 
      console.log('Song ended');
       else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
             
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 10);

	var embed = new Discord.RichEmbed()
        .setTitle("Status")
        .setDescription(`🎵 \`Começando a tocar:\` **${song.title}**`)
        .setColor(`${COLOR}`)
    serverQueue.textChannel.send(embed);
  
  
}
          


client.login(TOKEN);
