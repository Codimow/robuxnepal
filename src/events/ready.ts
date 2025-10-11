export = {
    name: 'clientReady',
    once: true,
    execute(client: any) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
    },
};
