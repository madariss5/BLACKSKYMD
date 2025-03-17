/**
 * Utility Commands Module
 * Contains useful utility commands for WhatsApp bot
 */

// Handler for ping command
async function ping(sock, m) {
  const messageInfo = m.messages[0];
  const jid = messageInfo.key.remoteJid;
  
  const startTime = new Date().getTime();
  await sock.sendMessage(jid, { text: '📡 Pinging...' });
  const endTime = new Date().getTime();
  
  const pingTime = endTime - startTime;
  await sock.sendMessage(jid, { text: `🚀 Pong! Response time: ${pingTime}ms` });
}

// Handler for help command
async function help(sock, m, args) {
  const messageInfo = m.messages[0];
  const jid = messageInfo.key.remoteJid;
  
  const sections = [
    { title: "Basic Commands", rows: [
      { title: "!help", description: "Shows this help message" },
      { title: "!ping", description: "Check bot response time" },
      { title: "!info", description: "Show bot information" }
    ]},
    { title: "Reaction Commands", rows: [
      { title: "!hug @user", description: "Send a hug" },
      { title: "!slap @user", description: "Slap someone" },
      { title: "!kiss @user", description: "Kiss someone" },
      { title: "... and more", description: "Try !reactions to see all" }
    ]},
    { title: "Utility Commands", rows: [
      { title: "!sticker", description: "Convert image to sticker" },
      { title: "!weather [location]", description: "Get weather info" },
      { title: "!translate [text]", description: "Translate text" }
    ]}
  ];
  
  // Choose what to display based on arguments
  let helpMessage = "📚 *BLACKSKY-MD HELP MENU* 📚\n\n";
  
  if (args.length > 0) {
    const category = args[0].toLowerCase();
    const foundSection = sections.find(s => s.title.toLowerCase().includes(category));
    
    if (foundSection) {
      helpMessage += `*${foundSection.title}*\n\n`;
      foundSection.rows.forEach(cmd => {
        helpMessage += `• *${cmd.title}*: ${cmd.description}\n`;
      });
    } else {
      helpMessage += "Category not found. Available categories:\n";
      sections.forEach(s => helpMessage += `• ${s.title}\n`);
    }
  } else {
    // Show all commands
    sections.forEach(section => {
      helpMessage += `*${section.title}*\n`;
      section.rows.forEach(cmd => {
        helpMessage += `• *${cmd.title}*: ${cmd.description}\n`;
      });
      helpMessage += "\n";
    });
    
    helpMessage += "Use !help [category] for specific category help.";
  }
  
  await sock.sendMessage(jid, { text: helpMessage });
}

// Handler for info command
async function info(sock, m) {
  const messageInfo = m.messages[0];
  const jid = messageInfo.key.remoteJid;
  
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const formatUptime = 
    `${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;
  
  const infoMessage = `
🤖 *BLACKSKY-MD BOT INFO* 🤖

• *Version*: 2.5.0
• *Uptime*: ${formatUptime}
• *Library*: @whiskeysockets/baileys
• *Platform*: ${process.platform}
• *Node Version*: ${process.version}
• *Memory Usage*: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB
• *Owner*: Check @owner

*Repository*: https://github.com/madariss5/BLACKSKYMD

Thank you for using BLACKSKY-MD!
  `;
  
  await sock.sendMessage(jid, { text: infoMessage });
}

// Handler for reactions command
async function reactions(sock, m) {
  const messageInfo = m.messages[0];
  const jid = messageInfo.key.remoteJid;
  
  const reactionsMessage = `
*Available Reaction Commands* 🎭

*Positive Reactions*:
• !hug @user
• !pat @user
• !kiss @user
• !wave @user
• !dance @user
• !blush @user
• !laugh @user
• !wink @user
• !poke @user

*Negative Reactions*:
• !slap @user
• !bonk @user
• !bite @user
• !punch @user
• !highfive @user
• !yeet @user
• !kill @user

All commands require @mentioning a user.
  `;
  
  await sock.sendMessage(jid, { text: reactionsMessage });
}

// Export all command handlers
module.exports = {
  ping,
  help,
  info,
  reactions
};