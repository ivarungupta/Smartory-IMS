const child_process = require('child_process');

// commands list
const commands = [
    {
        name: 'Ap1-1',
        command: 'cd ./api1 && start nodemon api1.js'
    },
    {
        name: 'Ap1-2',
        command: 'cd ./api2 && start nodemon api2.js'
    }
];

// run command
function runCommand(command, name, callback) {
    child_process.exec(command, function (error, stdout, stderr) {
        if (stderr) {
            callback(stderr, null);
        } else {
            callback(null, `Successfully executed ${name} ...`);
        }
    });
}

// main calling function
function main() {
    commands.forEach(element => {
        runCommand(element.command, element.name, (err, res) => {
            if (err) {
                console.error(err);
            } else {
                console.log(res);
            }
        });
    });
}

// call main
main();