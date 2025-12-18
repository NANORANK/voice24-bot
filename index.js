const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_IDS = ['1432690520005804092'];

const dataDir = './data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const activeVoiceConnections = new Map();
const reconnectTimers = new Map();
const voiceReconnectData = new Map();

function createMainEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('<a:emoji_1:1449147958091055236> : ระบบออนช่องเสียง Discord')
        .setColor(0x66FF66)
        .setDescription(`
**╭・<a:emoji_2:1449148118690959440> : ตั้งค่าข้อมูลการออนช่องเสียง
︱・<a:emoji_34:1450185227577196780> : จัดการการออนช่องเสียง
╰・<a:emoji_10:1449150901628440767> : กด เริ่มออน เพื่อเริ่มออนช่องเสียง**
`)
        .setImage('https://cdn.discordapp.com/attachments/1373361712123740405/1407015471261159586/Register_-_Login.gif?ex=68a490c5&is=68a33f45&hm=777d07bd79d9574157bbd263b3fb1c373e2c08b758f1faf13d9b5ec867c2e17a&')
        .setFooter({
            text: `・ระบบออนช่องเสียง Discord`, 
            iconURL: 'https://img.icons8.com/dusk/64/furry-discord.png'
        });

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('manage_voice')
                .setLabel('꒰ จัดการออนช่องเสียง ꒱')
                .setStyle(ButtonStyle.Success)
                .setEmoji('<a:emoji_1:1449147958091055236>'),
            new ButtonBuilder()
                .setCustomId('setup_voice_config')
                .setLabel('꒰ ตั้งค่าข้อมูล ꒱')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('<a:greenpoofheart:1387148116591120568>')
        );

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('voice_options')
                .setPlaceholder('[ 💬 เลือกตัวเลือกเพิ่มเติม ]')
                .addOptions([
                    {
                        label: '>>> ล้างข้อมูลทั้งหมดของคุณ <<<',
                        description: 'ลบข้อมูลการตั้งค่าทั้งหมดของคุณ',
                        value: 'clear_data',
                        emoji: '<a:red_cycle:1403018523604942858>'
                    },
                    {
                        label: 'ล้างตัวเลือกใหม่',
                        value: 'refresh_selection',
                        emoji: '<:Ldelete:1387382890781999115>'
                    }
                ])
        );

    return { embeds: [embed], components: [selectRow, buttonRow] };
}

function createVoiceManagementUI(userId, user) {
    const isConnected = activeVoiceConnections.has(userId);
    
    const embed = new EmbedBuilder()
        .setTitle('<a:emoji_2:1449148118690959440> : จัดการออนช่องเสียง')
        .setDescription(
        `**\`\`\`` +
        `สถานะปัจจุบัน: ${isConnected ? '✅ เชื่อมต่ออยู่' : '❌ ไม่ได้เชื่อมต่อ'}` +
        `\`\`\`**`
        )
        .setColor(isConnected ? 0x00FF00 : 0xFF0000)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setImage('https://cdn.discordapp.com/attachments/1373550875435470869/1387011628993744959/animated-line-image-0124.gif?ex=685bcabd&is=685a793d&hm=7bd36296882e590596c045740dc37b8992c8527acfeca16d9dd4691462b3abc8&');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('start_voice')
                .setLabel('꒰ เริ่มออน ꒱')
                .setStyle(ButtonStyle.Success)
                .setEmoji('<a:emoji_34:1450185227577196780>')
                .setDisabled(isConnected),
            new ButtonBuilder()
                .setCustomId('stop_voice')
                .setLabel('꒰ หยุดออน ꒱')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('<a:red_cycle:1403018523604942858>')
                .setDisabled(!isConnected)
        );

    return { embeds: [embed], components: [row] };
}

function createLoadingUI(user) {
    const embed = new EmbedBuilder()
        .setTitle('<a:UNV24:1449040312617144465> : จัดการออนช่องเสียง')
        .setDescription('**```สถานะปัจจุบัน: 🔄 กำลังเชื่อมต่อ...```**')
        .setColor(0xFFFF00)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setImage('https://cdn.discordapp.com/attachments/1373550875435470869/1387011628993744959/animated-line-image-0124.gif?ex=685bcabd&is=685a793d&hm=7bd36296882e590596c045740dc37b8992c8527acfeca16d9dd4691462b3abc8&')

    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('start_voice')
                .setLabel('꒰ เริ่มออน ꒱')
                .setStyle(ButtonStyle.Success)
                .setEmoji('<a:emoji_19:1449151254189314150>')
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('stop_voice')
                .setLabel('꒰ หยุดออน ꒱')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('<a:red_cycle:1403018523604942858>')
                .setDisabled(true)
        );

    return { embeds: [embed], components: [row] };
}

function getUserConfig(userId) {
    const configPath = path.join(dataDir, `userConfig_${userId}.json`);
    if (!fs.existsSync(configPath)) {
        return null;
    }
    try {
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading user config for ${userId}:`, error);
        return null;
    }
}

function saveUserConfig(userId, config) {
    const configPath = path.join(dataDir, `userConfig_${userId}.json`);
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving user config for ${userId}:`, error);
        return false;
    }
}

async function validateDiscordToken(token) {
    try {
        if (!token || typeof token !== 'string') {
            return { valid: false, error: 'โทเค่นไม่ถูกต้อง' };
        }

        const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
        if (!tokenPattern.test(token) || token.length < 50) {
            return { valid: false, error: 'รูปแบบโทเค่นไม่ถูกต้อง' };
        }

        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            const userData = await response.json();
            return { 
                valid: true, 
                username: userData.username,
                id: userData.id
            };
        } else {
            return { valid: false, error: 'โทเค่นไม่ถูกต้องหรือหมดอายุ' };
        }
    } catch (error) {
        return { valid: false, error: 'ไม่สามารถตรวจสอบโทเค่นได้' };
    }
}

function createVoiceConnection(userId, userConfig) {
    return new Promise((resolve, reject) => {
        const maxTimeout = 10000;
        const { userToken, serverId, voiceChannelId, selfDeaf, selfMute } = userConfig;

        if (activeVoiceConnections.has(userId)) {
            const oldWs = activeVoiceConnections.get(userId);
            oldWs.close();
            activeVoiceConnections.delete(userId);
        }

        const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
        let heartbeatInterval;
        let isAuthenticated = false;
        let lastHeartbeatAck = Date.now();

        const connectionTimeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
        }, maxTimeout);

        ws.on('open', () => {
            console.log(`🔗 เปิด WebSocket สำหรับเสียงของผู้ใช้ ${userId}`);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                const { op, d, t } = message;

                if (op === 11) {
                    lastHeartbeatAck = Date.now();
                }

                if (op === 10) {
                    clearTimeout(connectionTimeout);
                    heartbeatInterval = setInterval(() => {
                        ws.send(JSON.stringify({ op: 1, d: null }));
                    }, d.heartbeat_interval);

                    ws.send(JSON.stringify({
                        op: 2,
                        d: {
                            token: userToken,
                            properties: {
                                $os: 'linux',
                                $browser: 'discord.js',
                                $device: 'discord.js'
                            },
                            intents: 1 << 7
                        }
                    }));
                }

                if (op === 0 && t === 'READY') {
                    isAuthenticated = true;
                    console.log(`✅ ยืนยันตัวตนเสียงสำเร็จสำหรับผู้ใช้ ${userId}`);

                    voiceReconnectData.set(userId, userConfig);

                    ws.send(JSON.stringify({
                        op: 4,
                        d: {
                            guild_id: serverId,
                            channel_id: voiceChannelId,
                            self_mute: selfMute === 'true',
                            self_deaf: selfDeaf === 'true'
                        }
                    }));

                    resolve(ws);
                }

                if (op === 9) {
                    console.error(`❌ เซสชั่นไม่ถูกต้องสำหรับผู้ใช้ ${userId}`);
                    ws.close();
                    reject(new Error('Token ไม่ถูกต้องหรือหมดอายุ'));
                }

            } catch (error) {
                console.error(`เกิดข้อผิดพลาดในการแยกวิเคราะห์ข้อความเสียงสำหรับผู้ใช้ ${userId}:`, error);
            }
        });

        ws.on('close', (code, reason) => {
            clearTimeout(connectionTimeout);
            if (heartbeatInterval) clearInterval(heartbeatInterval);

            console.log(`❌ การเชื่อมต่อเสียงปิดสำหรับผู้ใช้ ${userId} - Code: ${code}`);
            activeVoiceConnections.delete(userId);

            // auto-reconnect,> error code 1000, 1001, 1005, 1006
          // หลังจากนี้ console log output ของท่าน จะแสดง log การเชื่อมต่อต่างๆ (เยอะ) ไม่ต้องสนใจนะครับ แค่ debug ไว้ดูข้อผิดพลาด แต่ไม่มีปัญหาต่อการออนช่องเสียง
            if ((code === 1000 || code === 1001 || code === 1005 || code === 1006) && isAuthenticated && voiceReconnectData.has(userId)) {
                console.log(`🔄 กำลังจัดกำหนดการเชื่อมต่อใหม่สำหรับผู้ใช้ ${userId}`);
                scheduleVoiceReconnect(userId, userConfig);
            } else if (!isAuthenticated && code !== 4004) {
                reject(new Error(`การเชื่อมต่อปิด - Code: ${code}`));
            }
        });

        ws.on('error', (error) => {
            clearTimeout(connectionTimeout);
            console.error(`เกิดข้อผิดพลาดใน WebSocket เสียงสำหรับผู้ใช้ ${userId}:`, error);
            reject(error);
        });

        activeVoiceConnections.set(userId, ws);
    });
}

function scheduleVoiceReconnect(userId, userConfig, delay = 5000) {
    if (reconnectTimers.has(userId)) {
        clearTimeout(reconnectTimers.get(userId));
    }

    const timer = setTimeout(async () => {
        if (!activeVoiceConnections.has(userId)) {
            const validation = await validateDiscordToken(userConfig.userToken);

            if (!validation.valid) {
                console.log(`🚫 การเชื่อมต่อใหม่ล้มเหลวสำหรับผู้ใช้ ${userId} - โทเค่นไม่ถูกต้อง`);
                reconnectTimers.delete(userId);
                return;
            }

            try {
                await createVoiceConnection(userId, userConfig);
                console.log(`✅ เชื่อมต่อเสียงใหม่สำเร็จสำหรับผู้ใช้ ${userId}`);
            } catch (error) {
                console.error(`❌ การเชื่อมต่อเสียงใหม่ล้มเหลวสำหรับผู้ใช้ ${userId}:`, error);
                scheduleVoiceReconnect(userId, userConfig, 30000);
            }
        }
        reconnectTimers.delete(userId);
    }, delay);

    reconnectTimers.set(userId, timer);
}

function updateBotStatus() {
    const serverCount = client.guilds.cache.size;
    const activeUsers = activeVoiceConnections.size;
    
    const statusOptions = [
        {
            name: `🌿 : ${activeUsers} Active Users`,
            type: 4,
            state: `✅ : Already joined ${serverCount} servers`
        },
        {
            name: `✅ : Already joined ${serverCount} servers`,
            type: 4,
            state: `🌿 : ${activeUsers} Active Users`
        }
    ];
    
    const randomStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];
    
    client.user.setPresence({
        activities: [randomStatus],
        status: 'idle'
    });
}

client.once('ready', async () => {
    console.log(`[STATUS] ✅ บอท ${client.user.tag} เริ่มออนไลน์แล้ว`);

    // ลงทะเบียนคำสั่ง
    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('[ADMIN] 🌿 • ตั้งค่าเมนูออนช่องเสียง')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('voice')
                    .setDescription('[ADMIN] 🌿 • ตั้งค่าเมนูออนช่องเสียง')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('☘️ •  เลือกช่องที่ต้องการส่งเมนูตั้งค่านี้')
                            .setRequired(true)
                            .addChannelTypes(ChannelType.GuildText)
                    )
            )
    ];

    try {
        await client.application.commands.set(commands);
        console.log('[STATUS] 🌿 ลงทะเบียนคำสั่งบอทแล้ว');
    } catch (error) {
        console.error('[ERROR] ❌ เกิดข้อผิดพลาดในการลงทะเบียนคำสั่งบอท:', error);
    }

    updateBotStatus();
    
    setInterval(updateBotStatus, 3000);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    const userId = interaction.user.id;

    if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            if (!ADMIN_IDS.includes(interaction.user.id)) {
                return interaction.reply({ content: '# `❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้`', ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'voice') {
                const channel = interaction.options.getChannel('channel');
                const mainUI = createMainEmbed();

                await channel.send(mainUI);
                await interaction.reply({
                    content: '`✅ ส่งเมนูไปที่ช่องแล้ว`',
                    ephemeral: true
                });
            }
        }
    }

    if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === 'setup_voice_config') {
            const userConfig = getUserConfig(userId);

            const modal = new ModalBuilder()
                .setCustomId('voice_config_modal')
                .setTitle('ตั้งค่าข้อมูลของเจ้าก่อนใช้งาน');

            const userTokenInput = new TextInputBuilder()
                .setCustomId('userToken')
                .setLabel('User Token')
                .setPlaceholder('ใส่โทเค่นของคุณ (จำกัด 1 โทเค่น)')
                .setStyle(TextInputStyle.Short)
                .setValue(userConfig?.userToken || '')
                .setRequired(true);

            const serverIdInput = new TextInputBuilder()
                .setCustomId('serverId')
                .setLabel('Server ID')
                .setPlaceholder('ใส่ไอดีเซิฟเวอร์')
                .setStyle(TextInputStyle.Short)
                .setValue(userConfig?.serverId || '')
                .setRequired(true);

            const voiceChannelIdInput = new TextInputBuilder()
                .setCustomId('voiceChannelId')
                .setLabel('Voice Channel ID')
                .setPlaceholder('ใส่ไอดีช่องเสียง')
                .setStyle(TextInputStyle.Short)
                .setValue(userConfig?.voiceChannelId || '')
                .setRequired(true);

            const selfDeafInput = new TextInputBuilder()
                .setCustomId('selfDeaf')
                .setLabel('ปิดหูไหม (true/false)')
                .setPlaceholder('true คือ ปิด')
                .setStyle(TextInputStyle.Short)
                .setValue(userConfig?.selfDeaf || '')
                .setRequired(true);

            const selfMuteInput = new TextInputBuilder()
                .setCustomId('selfMute')
                .setLabel('ปิดไมค์ไหม (true/false)')
                .setPlaceholder('false คือ เปิด')
                .setStyle(TextInputStyle.Short)
                .setValue(userConfig?.selfMute || '')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(userTokenInput);
            const secondActionRow = new ActionRowBuilder().addComponents(serverIdInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(voiceChannelIdInput);
            const fourthActionRow = new ActionRowBuilder().addComponents(selfDeafInput);
            const fifthActionRow = new ActionRowBuilder().addComponents(selfMuteInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

            await interaction.showModal(modal);
        }

        if (customId === 'manage_voice') {
            const userConfig = getUserConfig(userId);

            if (!userConfig) {
                return interaction.reply({ 
                    content: '# `❌ กรุณาตั้งค่าข้อมูลก่อนใช้งาน`', 
                    ephemeral: true 
                });
            }

            const uiData = createVoiceManagementUI(userId, interaction.user);
            await interaction.reply({ ...uiData, ephemeral: true });
        }

        if (customId === 'start_voice') {
            const userConfig = getUserConfig(userId);

            if (!userConfig) {
                return interaction.reply({ 
                    content: '# `❌ กรุณาตั้งค่าข้อมูลก่อนใช้งาน`', 
                    ephemeral: true 
                });
            }

            if (activeVoiceConnections.has(userId)) {
                return interaction.reply({ 
                    content: '# `❌ คุณกำลังเชื่อมต่ออยู่แล้ว`', 
                    ephemeral: true 
                });
            }

            const loadingUI = createLoadingUI(interaction.user);
            await interaction.update(loadingUI);

            try {
                await createVoiceConnection(userId, userConfig);

                const successUI = createVoiceManagementUI(userId, interaction.user);
                await interaction.editReply(successUI);
            } catch (error) {
                console.error(`เกิดข้อผิดพลาดในการเริ่มเสียงสำหรับผู้ใช้ ${userId}:`, error);

                const errorUI = createVoiceManagementUI(userId, interaction.user);
                await interaction.editReply(errorUI);
            }
        }

        if (customId === 'stop_voice') {
            if (!activeVoiceConnections.has(userId)) {
                return interaction.reply({ 
                    content: '# `❌ คุณไม่ได้เชื่อมต่ออยู่`', 
                    ephemeral: true 
                });
            }

            const ws = activeVoiceConnections.get(userId);
            ws.close();
            activeVoiceConnections.delete(userId);

            if (reconnectTimers.has(userId)) {
                clearTimeout(reconnectTimers.get(userId));
                reconnectTimers.delete(userId);
            }
            
            voiceReconnectData.delete(userId);

            const stoppedUI = createVoiceManagementUI(userId, interaction.user);
            await interaction.update(stoppedUI);
        }
    }

    if (interaction.isStringSelectMenu()) {
        const { customId, values } = interaction;

        if (customId === 'voice_options') {
            const selectedValue = values[0];

            if (selectedValue === 'clear_data') {
                const userConfig = getUserConfig(userId);
                
                if (!userConfig) {
                    return interaction.reply({
                        content: '# `❌ ไม่พบข้อมูลที่จะลบ`',
                        ephemeral: true
                    });
                }

                if (activeVoiceConnections.has(userId)) {
                    const ws = activeVoiceConnections.get(userId);
                    ws.close();
                    activeVoiceConnections.delete(userId);
                }

                if (reconnectTimers.has(userId)) {
                    clearTimeout(reconnectTimers.get(userId));
                    reconnectTimers.delete(userId);
                }

                voiceReconnectData.delete(userId);

                const configPath = path.join(dataDir, `userConfig_${userId}.json`);
                try {
                    if (fs.existsSync(configPath)) {
                        fs.unlinkSync(configPath);
                        await interaction.reply({
                            content: '# `✅ ลบข้อมูลทั้งหมดเรียบร้อยแล้ว`',
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: '# `❌ ไม่พบข้อมูลที่จะลบ`',
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error(`เกิดข้อผิดพลาดในการลบข้อมูลผู้ใช้สำหรับ ${userId}:`, error);
                    await interaction.reply({
                        content: '# `❌ เกิดข้อผิดพลาดในการลบข้อมูล`',
                        ephemeral: true
                    });
                }
            }

            if (selectedValue === 'refresh_selection') {
                const mainUI = createMainEmbed();
                await interaction.update(mainUI);
            }
        }
    }

    if (interaction.isModalSubmit()) {
        const { customId } = interaction;

        if (customId === 'voice_config_modal') {
            const userToken = interaction.fields.getTextInputValue('userToken');
            const serverId = interaction.fields.getTextInputValue('serverId');
            const voiceChannelId = interaction.fields.getTextInputValue('voiceChannelId');
            const selfDeaf = interaction.fields.getTextInputValue('selfDeaf');
            const selfMute = interaction.fields.getTextInputValue('selfMute');

            if (!['true', 'false'].includes(selfDeaf.toLowerCase()) || !['true', 'false'].includes(selfMute.toLowerCase())) {
                return interaction.reply({ 
                    content: '# `❌ กรุณากรอก true หรือ false เท่านั้นครับ`', 
                    ephemeral: true 
                });
            }

            const validation = await validateDiscordToken(userToken);
            if (!validation.valid) {
                return interaction.reply({ 
                    content: `# \`❌ โทเค่นไม่ถูกต้อง: ${validation.error}\``, 
                    ephemeral: true 
                });
            }

            const config = {
                userToken,
                serverId,
                voiceChannelId,
                selfDeaf: selfDeaf.toLowerCase(),
                selfMute: selfMute.toLowerCase()
            };

            if (saveUserConfig(userId, config)) {
                await interaction.reply({ 
                    content: '# `✅ บันทึกข้อมูลสำเร็จ`', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: '# `❌ ไม่สามารถบันทึกข้อมูลได้`', 
                    ephemeral: true 
                });
            }
        }
    }
});


if (!TOKEN) {
    console.error('❌ ใส่โทเค่นบอทก่อน');
    process.exit(1);
}

client.on('error', (error) => {
    console.error('❌ เกิดข้อผิดพลาดในการเริ่ม:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(TOKEN);
