/*
 * Primary file for the API
 *
 */

// Dependencies
const http = require('http');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');

// The server should respond to all requests with a string
const server = http.createServer((req, res) => {
  // Get url and parse it
  const parsedUrl = url.parse(req.url, true); // the true tells it to use the queryString library to get query key/value

  // Get the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, ''); // removes trailing slash

  // Get the query string as an object
  const queryStringObject = parsedUrl.query;

  // Get the http method
  const method = req.method.toLowerCase();

  // Get the headers as an object
  const headers = req.headers;

  // Get the payload, if any
  const decoder = new StringDecoder('utf-8');
  let buffer = '';
  req.on('data', (data) => {
    buffer += decoder.write(data);
    console.log('Data event: ', buffer);
  });
  req.on('end', () => {
    buffer += decoder.end();

    // Choose the handler this request should go to.
    const chosenHandler = typeof (router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

    //Construct data object to send to the handler
    const data = {
      'trimmedPath': trimmedPath,
      'queryStringObject': queryStringObject,
      'method': method,
      'headers': headers,
      'payload': buffer
    };

    // Route the request to the handler specified in the router
    chosenHandler(data, function (statusCode, payload) {
      // Use the status code called back by the handler or default to 200
      statusCode = typeof (statusCode) === 'number' ? statusCode : 200;

      // Use the payload called back by the handler, or default to an empty object
      payload = typeof (payload) === 'object' ? payload : {};

      // Convert the payload to a string
      const payloadString = JSON.stringify(payload);

      // Return the response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statusCode);
      res.end(payloadString);

      // Log the request path
      console.log('Returning this response: ', statusCode, payloadString);
    });
  });
});

// Start the server, and have it listen on config port
server.listen(config.port, function () {
  console.log('The server is listening on port ' + config.port + ' in ' + config.envName + ' mode');
});

// Define the handlers
const handlers = {};

// Sample handler
handlers.sample = function (data, callback) {
  // Callback an http status code, and a payload object
  callback(406, { 'name': 'sample handler' });
};

// Not found handler
handlers.notFound = function (data, callback) {
  callback(404);
}

// Define a request router
const router = {
  'sample': handlers.sample
};