#!/usr/bin/env node
if (process.argv[2] === 'setup') {
    import('./setup.js').then((m) => m.runSetup()).catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    });
}
else {
    import('./server.js').then((m) => m.startServer()).catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    });
}
export {};
