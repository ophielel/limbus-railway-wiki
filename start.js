const { spawn } = require('child_process');
const children = ['backend/server.js', 'frontend/server.js'].map(file => spawn(process.execPath, [file], { stdio: 'inherit' }));
const stop = () => { children.forEach(child => child.kill()); process.exit(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
children.forEach(child => child.on('exit', code => { if (code && code !== 0) stop(); }));
setTimeout(() => console.log('\n打开浏览器访问：http://localhost:5173\n'), 400);
