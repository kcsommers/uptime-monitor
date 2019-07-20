/*
 * Primary file for the API
 *
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');
const cli = require('./lib/cli');

// Declare the app
const app = {};

// Init function
app.init = function () {
  // start the server
  server.init();

  // start the workers
  workers.init();

  // start the cli, but make sure it starts last
  setTimeout(function () {
    cli.init();
  }, 50);
}

// Execute
app.init();

// Export the app
module.exports = app;