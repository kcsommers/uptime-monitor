/**
 * CLI related tasks
 */

// Dependencies
const readline = require('readline');
const util = require('util');
const debug = util.debuglog('cli');
const events = require('events');
class _events extends events { };
const e = new _events();

// Instantiate the CLI module object
const cli = {};

// Input handlers
e.on('man', function (str) {
  cli.responders.help();
});
e.on('help', function (str) {
  cli.responders.help();
});
e.on('exit', function (str) {
  cli.responders.exit();
});
e.on('stats', function (str) {
  cli.responders.stats();
});
e.on('list users', function (str) {
  cli.responders.listUsers();
});
e.on('more user info', function (str) {
  cli.responders.moreUserInfo(str);
});
e.on('list checks', function (str) {
  cli.responders.listChecks(str);
});
e.on('more check info', function (str) {
  cli.responders.moreCheckInfo(str);
});
e.on('list logs', function (str) {
  cli.responders.listLogs();
});
e.on('more log info', function (str) {
  cli.responders.moreLogInfo(str);
});

// Responders
cli.responders = {};

// Help / Man
cli.responders.help = function () {
  console.log('You asked for help');
}
cli.responders.exit = function () {
  process.exit(0);
}
cli.responders.stats = function () {
  console.log('You asked for stats');
}
cli.responders.listUsers = function () {
  console.log('You asked for help');
}
cli.responders.moreUserInfo = function (str) {
  console.log('You asked for help');
}
cli.responders.listChecks = function (str) {
  console.log('You asked for help');
}
cli.responders.moreCheckInfo = function (str) {
  console.log('You asked for help');
}
cli.responders.listLogs = function () {
  console.log('You asked for help');
}
cli.responders.moreLogIngfo = function (str) {
  console.log('You asked for help');
}

cli.processInput = function (str) {
  str = typeof (str) === 'string' && str.trim().length ? str.trim() : false;
  if (str) {
    // Codify the unique strings that identify the unique questions allowed to be asked
    const uniqueInputs = [
      'man',
      'help',
      'exit',
      'stats',
      'list users',
      'more user info',
      'list checks',
      'more checks info',
      'list logs',
      'more log info'
    ];

    // Go throught hte possible inputs and emit event when a match is found
    let matchFound = false;
    let counter = 0;
    uniqueInputs.some(function (input) {
      if (str.toLowerCase().indexOf(input) > -1) {
        matchFound = true;
        // Emit an event matching the unique input, and include the full string
        e.emit(input, str)
        return true;
      }
    });
    // If no match is found, tell the user to try again
    if (!matchFound) {
      console.log('Sorry, try again');
    }
  }
}

cli.init = function () {
  // Send the start message to the console in dark blue
  console.log('\x1b[34m%s\x1b[0m', 'The CLI is running');

  // Start the interface
  const _interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>'
  });

  // Create an initial prompt
  _interface.prompt();

  // Handle each line of input seperately
  _interface.on('line', function (str) {
    // Send to the input processor
    cli.processInput(str);

    // Re-initialize the prompt afterward
    _interface.prompt();
  });

  // If user stops the cli, kill the associated process
  _interface.on('close', function () {
    process.exit(0);
  });
}

// Export hte module
module.exports = cli;