# WhatsApp Bot Command Test Report

## Summary

- Total commands: 255
- Valid commands: 255
- Invalid commands: 0
- Commands using database: 50
- Commands with media handling: 0
- Commands using external APIs: 10

## Categories

### basic (22)

- File: src/commands/basic.js
- Valid commands: 22
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| help | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| ping | ✅ | sock, message | ❌ | ❌ | ❌ |
| info | ✅ | sock, message | ❌ | ❌ | ❌ |
| status | ✅ | sock, message | ❌ | ❌ | ❌ |
| about | ✅ | sock, message | ❌ | ❌ | ❌ |
| botinfo | ✅ | sock, sender | ❌ | ❌ | ❌ |
| dashboard | ✅ | sock, sender | ❌ | ❌ | ❌ |
| changelog | ✅ | sock, sender | ❌ | ❌ | ❌ |
| faq | ✅ | sock, sender | ❌ | ❌ | ❌ |
| privacy | ✅ | sock, sender | ❌ | ❌ | ❌ |
| terms | ✅ | sock, sender | ❌ | ❌ | ❌ |
| speed | ✅ | sock, sender | ❌ | ❌ | ❌ |
| system | ✅ | sock, sender | ❌ | ❌ | ❌ |
| owner | ✅ | sock, sender | ❌ | ❌ | ❌ |
| donate | ✅ | sock, sender | ❌ | ❌ | ❌ |
| report | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| feedback | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| source | ✅ | sock, sender | ❌ | ❌ | ❌ |
| runtime | ✅ | sock, sender | ❌ | ❌ | ❌ |
| premium | ✅ | sock, sender | ❌ | ❌ | ❌ |
| support | ✅ | sock, sender | ❌ | ❌ | ❌ |
| credits | ✅ | sock, sender | ❌ | ❌ | ❌ |

### educational (10)

- File: src/commands/educational/commands.js
- Valid commands: 10
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 4

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| translate | ✅ | sock, message, args | ❌ | ❌ | ✅ |
| dictionary | ✅ | sock, message, args | ❌ | ❌ | ✅ |
| define | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| calculate | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| periodic | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| translate | ✅ | sock, message, args | ❌ | ❌ | ✅ |
| dictionary | ✅ | sock, message, args | ❌ | ❌ | ✅ |
| define | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| calculate | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| periodic | ✅ | sock, message, args | ❌ | ❌ | ❌ |

### example-with-error-handling (3)

- File: src/commands/example-with-error-handling.js
- Valid commands: 3
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| echo | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| calculate | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| random | ✅ | sock, message, args | ❌ | ❌ | ❌ |

### fun (23)

- File: src/commands/fun.js
- Valid commands: 23
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 1

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| quote | ✅ | sock, sender | ❌ | ❌ | ❌ |
| joke | ✅ | sock, sender | ❌ | ❌ | ❌ |
| meme | ✅ | sock, sender | ❌ | ❌ | ✅ |
| tictactoe | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| hangman | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| wordle | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| quiz | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| rps | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| roll | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| flip | ✅ | sock, sender | ❌ | ❌ | ❌ |
| choose | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| truthordare | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| wouldyourather | ✅ | sock, sender | ❌ | ❌ | ❌ |
| neverhaveiever | ✅ | sock, sender | ❌ | ❌ | ❌ |
| riddle | ✅ | sock, sender | ❌ | ❌ | ❌ |
| reveal | ✅ | sock, message | ❌ | ❌ | ❌ |
| fact | ✅ | sock, sender | ❌ | ❌ | ❌ |
| trivia | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| _8ball | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| slot | ✅ | sock, sender | ❌ | ❌ | ❌ |
| fortune | ✅ | sock, sender | ❌ | ❌ | ❌ |
| horoscope | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| yomama | ✅ | sock, sender | ❌ | ❌ | ❌ |

### group (34)

- File: src/commands/group.js
- Valid commands: 34
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 13
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| everyone | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| bocchi | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| hier | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| kick | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| add | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| promote | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| demote | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| mute | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| unmute | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| antispam | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| antilink | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| antitoxic | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| antiraid | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| warn | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| removewarn | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| warnings | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| setname | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| setdesc | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| setppic | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| feature | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| link | ✅ | sock, message | ❌ | ❌ | ❌ |
| revoke | ✅ | sock, message | ❌ | ❌ | ❌ |
| tagall | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| mentionall | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| poll | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| vote | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| endpoll | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| quiz | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| trivia | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| wordchain | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| role | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| pin | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| unpin | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| pins | ✅ | sock, message, args | ✅ | ❌ | ❌ |

### media (22)

- File: src/commands/media.js
- Valid commands: 22
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 1

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| play | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| sticker | ✅ | sock, message | ❌ | ❌ | ❌ |
| toimg | ✅ | sock, message | ❌ | ❌ | ❌ |
| ytmp3 | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| ytmp4 | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| enhance | ✅ | sock, message | ❌ | ❌ | ❌ |
| sharpen | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| reverse | ✅ | sock, message | ❌ | ❌ | ❌ |
| ttp | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| attp | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| emojimix | ✅ | sock, message, args | ❌ | ❌ | ✅ |
| tovideo | ✅ | sock, message | ❌ | ❌ | ❌ |
| trim | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| speed | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| brightness | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| contrast | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| blur | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| rotate | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| flip | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| tint | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| negate | ✅ | sock, message | ❌ | ❌ | ❌ |
| grayscale | ✅ | sock, message | ❌ | ❌ | ❌ |

### menu (2)

- File: src/commands/menu.js
- Valid commands: 2
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| menu | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| help | ✅ | sock, message, args | ❌ | ❌ | ❌ |

### nsfw (25)

- File: src/commands/nsfw.js
- Valid commands: 25
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| togglensfw | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| isnsfw | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| nsfwsettings | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| nsfwstats | ✅ | sock, sender | ❌ | ❌ | ❌ |
| verify | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| nsfwhelp | ✅ | sock, sender | ❌ | ❌ | ❌ |
| waifu | ✅ | sock, sender | ❌ | ❌ | ❌ |
| neko | ✅ | sock, sender | ❌ | ❌ | ❌ |
| hentai | ✅ | sock, sender | ❌ | ❌ | ❌ |
| boobs | ✅ | sock, sender | ❌ | ❌ | ❌ |
| ass | ✅ | sock, sender | ❌ | ❌ | ❌ |
| pussy | ✅ | sock, sender | ❌ | ❌ | ❌ |
| blowjob | ✅ | sock, sender | ❌ | ❌ | ❌ |
| anal | ✅ | sock, sender | ❌ | ❌ | ❌ |
| feet | ✅ | sock, sender | ❌ | ❌ | ❌ |
| gifboobs | ✅ | sock, sender | ❌ | ❌ | ❌ |
| gifass | ✅ | sock, sender | ❌ | ❌ | ❌ |
| gifhentai | ✅ | sock, sender | ❌ | ❌ | ❌ |
| gifblowjob | ✅ | sock, sender | ❌ | ❌ | ❌ |
| uniform | ✅ | sock, sender | ❌ | ❌ | ❌ |
| thighs | ✅ | sock, sender | ❌ | ❌ | ❌ |
| femdom | ✅ | sock, sender | ❌ | ❌ | ❌ |
| tentacle | ✅ | sock, sender | ❌ | ❌ | ❌ |
| pantsu | ✅ | sock, sender | ❌ | ❌ | ❌ |
| kitsune | ✅ | sock, sender | ❌ | ❌ | ❌ |

### owner (12)

- File: src/commands/owner.js
- Valid commands: 12
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| restart | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| shutdown | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| maintenance | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| setname | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| setbio | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| setprefix | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| setlanguage | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| ban | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| unban | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| banlist | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| broadcast | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| serverinfo | ✅ | sock, message, args | ❌ | ❌ | ❌ |

### reactions (22)

- File: src/commands/reactions.js
- Valid commands: 22
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| reactionmenu | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| reactionstatus | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| testgif | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| hug | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| pat | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| kiss | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| cuddle | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| smile | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| happy | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| wave | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| dance | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| cry | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| blush | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| laugh | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| wink | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| poke | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| slap | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| bonk | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| bite | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| yeet | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| punch | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| highfive | ✅ | sock, message, args | ❌ | ❌ | ❌ |

### user (12)

- File: src/commands/user.js
- Valid commands: 12
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 6
- Commands with media handling: 0
- Commands using external APIs: 1

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| register | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| profile | ✅ | sock, message, args | ✅ | ❌ | ✅ |
| setbio | ✅ | sock, message, args | ❌ | ❌ | ❌ |
| settitle | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| settheme | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| setprofilepic | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| level | ✅ | sock, sender | ✅ | ❌ | ❌ |
| daily | ✅ | sock, message | ✅ | ❌ | ❌ |
| leaderboard | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| achievements | ✅ | sock, sender | ❌ | ❌ | ❌ |
| inventory | ✅ | sock, sender | ❌ | ❌ | ❌ |
| transfer | ✅ | sock, sender, args | ❌ | ❌ | ❌ |

### user_extended (31)

- File: src/commands/user_extended.js
- Valid commands: 31
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 31
- Commands with media handling: 0
- Commands using external APIs: 0

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| crime | ✅ | sock, sender | ✅ | ❌ | ❌ |
| work | ✅ | sock, sender | ✅ | ❌ | ❌ |
| getjob | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| resign | ✅ | sock, sender | ✅ | ❌ | ❌ |
| afk | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| unafk | ✅ | sock, sender | ✅ | ❌ | ❌ |
| rep | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| fish | ✅ | sock, sender | ✅ | ❌ | ❌ |
| mine | ✅ | sock, sender | ✅ | ❌ | ❌ |
| sell | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| extendedInventory | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| craft | ✅ | sock, message, args | ✅ | ❌ | ❌ |
| invest | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| mail | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| reward | ✅ | sock, sender | ✅ | ❌ | ❌ |
| business | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| bounty | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| clan | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| hunt | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| farm | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| adventure | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| quest | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| shop | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| stats | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| hourly | ✅ | sock, sender | ✅ | ❌ | ❌ |
| weekly | ✅ | sock, sender | ✅ | ❌ | ❌ |
| lottery | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| recipe | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| dicebet | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| pets | ✅ | sock, sender, args | ✅ | ❌ | ❌ |
| marriage | ✅ | sock, sender, args | ✅ | ❌ | ❌ |

### utility (37)

- File: src/commands/utility.js
- Valid commands: 37
- Invalid commands: 0
- Has init function: Yes
- Commands using database: 0
- Commands with media handling: 0
- Commands using external APIs: 3

#### Commands

| Command | Valid | Parameters | Database | Media | External API |
|---------|-------|------------|----------|-------|-------------|
| weather | ✅ | sock, sender, args | ❌ | ❌ | ✅ |
| translate | ✅ | sock, sender, args | ❌ | ❌ | ✅ |
| calculate | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| dictionary | ✅ | sock, sender, args | ❌ | ❌ | ✅ |
| covid | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| currency | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| shortlink | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| wiki | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| poll | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| news | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| timezone | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| encode | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| decode | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| qrread | ✅ | sock, sender | ❌ | ❌ | ❌ |
| wolfram | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| github | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| npm | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| ipinfo | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| whois | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| ocr | ✅ | sock, sender | ❌ | ❌ | ❌ |
| qrgen | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| screenshot | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| color | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| lyrics | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| movie | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| anime | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| spotify | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| urban | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| crypto | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| stock | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| reminder | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| translate2 | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| countdown | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| poll2 | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| todo | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| notes | ✅ | sock, sender, args | ❌ | ❌ | ❌ |
| reverse | ✅ | sock, sender, args | ❌ | ❌ | ❌ |

