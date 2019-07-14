/*
 * These are worker related tasks
 *
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');
const _logs = require('./logs');

// Instantiate workers module object
const workers = {};

// Lookup checks, gather data and send to validator
workers.gatherAllChecks = function () {
  // Get all checks that exist in the system
  _data.list('checks', function (err, checks) {
    if (!err && checks && checks.length) {
      checks.forEach(function (check) {
        // Read in the check data
        _data.read('checks', check, function (err, originalCheckData) {
          if (!err && originalCheckData) {
            // Pass the data to check validator
            workers.validateCheckData(originalCheckData);
          } else {
            console.log('Error reading one of the checks data');
          }
        });
      });
    } else {
      console.log('Error: could not find any checks to process');
    }
  });
};

// Sanity-check the check data
workers.validateCheckData = function (originalCheckData) {
  originalCheckData = typeof (originalCheckData) === 'object' && originalCheckData !== null ? originalCheckData : {};
  originalCheckData.id = typeof (originalCheckData.id) === 'string' && originalCheckData.id.trim().length === 20 ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof (originalCheckData.userPhone) === 'string' && originalCheckData.userPhone.trim().length === 10 ? originalCheckData.userPhone.trim() : false;
  originalCheckData.protocol = typeof (originalCheckData.protocol) === 'string' && ['https', 'http'].includes(originalCheckData.protocol) ? originalCheckData.protocol.trim() : false;
  originalCheckData.url = typeof (originalCheckData.url) === 'string' && originalCheckData.url.trim().length ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof (originalCheckData.method) === 'string' && ['get', 'post', 'put', 'delete'].includes(originalCheckData.method) ? originalCheckData.method.trim() : false;
  originalCheckData.successCodes = typeof (originalCheckData.successCodes) === 'object' && originalCheckData.successCodes instanceof Array ? originalCheckData.successCodes : false;
  originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) === 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds < 5 ? originalCheckData.timeoutSeconds : false;

  // Set the keys that may not be set if the workers have never seen this check before
  originalCheckData.state = originalCheckData.state = typeof (originalCheckData.protocol) === 'string' && ['up', 'down'].includes(originalCheckData.state) ? originalCheckData.state.trim() : 'down';
  originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) === 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // If all the checks pass, pass the data to the next step in the process
  if (originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.method &&
    originalCheckData.url &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds) {
    workers.performCheck(originalCheckData);
  } else {
    console.log('Error: one of the checks isnt right, skipping it');
  }
};

// Perform the check, send the original check data and the outcome of the process to the next step
workers.performCheck = function (originalCheckData) {
  // Prepare the inital check outcome
  const checkOutcome = {
    'error': false,
    'responseCode': false
  };

  // Mark that the outcome has not been sent yet
  let outcomeSent = false;

  // Parse the hostname and the path out of the original check data
  const parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
  const hostname = parsedUrl.hostname;
  const path = parsedUrl.path;

  // Construct the request
  const requestDetails = {
    'protocol': originalCheckData.protocol + ':',
    'hostname': hostname,
    'method': originalCheckData.method.toUpperCase(),
    'path': path,
    'timeout': originalCheckData.timeoutSeconds * 1000
  };

  // Instantiate the request object using http or https module
  const _moduleToUse = originalCheckData.protocol === 'http' ? http : https;
  const req = _moduleToUse.request(requestDetails, function (res) {
    // Grab the status of the sent request
    const status = res.statusCode;

    // Update the check outcome and pass the data along
    checkOutcome.responseCode = status;
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  })

  // Bind to the error event so it doesnt get thrown
  req.on('error', function (e) {
    // Update the check outcome and pass the data along
    checkOutcome.error = { 'error': true, 'value': e };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to the timeout event
  req.on('timeout', function (e) {
    // Update the check outcome and pass the data along
    checkOutcome.error = { 'error': true, 'value': 'timeout' };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // End the request (aka send it)
  req.end();
};

// Process the check outcome and update the check data, trigger alert to user if needed
// Special logic for accomodating a check that has never been tested before
workers.processCheckOutcome = function (originalCheckData, checkOutcome) {
  // Decide if the check is up or down in current state
  const state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.includes(checkOutcome.responseCode) ? 'up' : 'down';

  // Decide if an alert is warranted
  const alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

  // Update the check data
  const newCheckData = originalCheckData;
  newCheckData.state = state;
  const timeOfCheck = Date.now();
  newCheckData.lastChecked = timeOfCheck;

  // Log the outcome
  workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

  // Save the update
  _data.update('checks', newCheckData.id, newCheckData, function (err) {
    if (!err) {
      // Send check data to next phase if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData);
      } else {
        console.log('Check outcome has not changed, no alert needed')
      }
    } else {
      console.log('Error trying to save updates to one of the checks');
    }
  })
};

// Alert the user as to a change in their check status
workers.alertUserToStatusChange = function (newCheckData) {
  const message = 'Alert: your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol + '://' + newCheckData.url + ' is currently ' + newCheckData.state;

  helpers.sendTwilioSms(newCheckData.userPhone, message, function (err) {
    if (!err) {
      console.log('SUCCESS! User was alerted to a status change in their check via sms: ', message);
    } else {
      console.log('Error: could not send sms alert to user');
    }
  });
};

workers.log = function (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
  // Form the log data
  const logData = {
    'check': originalCheckData,
    'outcome': checkOutcome,
    'state': state,
    'alert': alertWarranted,
    'time': timeOfCheck
  };

  // Convert data to a string
  const logString = JSON.stringify(logData);

  // Determine the name of the log file
  const logFileName = originalCheckData.id;

  // Append the log string to the file
  _logs.append(logFileName, logString, function (err) {
    if (!err) {
      console.log('Logging to file succeeded');
    } else {
      console.log('Logging to file failed');
    }
  });
}

// Timer to execute the worker process once per minute
workers.loop = function () {
  setInterval(function () {
    workers.gatherAllChecks();
  }, 1000 * 60)
};

// Rotate (aka compress) the log files
workers.rotateLogs = function () {
  // List all the noncompressed log files in .logs folder
  _logs.list(false, function (err, logs) {
    if (!err && logs && logs.length) {
      logs.forEach(function (logName) {
        // Compress the data to a different file
        const logId = logName.replace('.log', '');
        const newFileId = logId + '-' + Date.now();
        _logs.compress(logId, newFileId, function (err) {
          if (!err) {
            // Truncate the log
            _logs.truncate(logId, function (err) {
              if (!err) {
                console.log('Success truncating log file');
              } else {
                console.log('Error truncating log file');
              }
            });
          } else {
            console.log('Error compressing one of the log files: ', err);
          }
        })
      });
    } else {
      console.log('Error: coould not find any logs to rotate')
    }
  })
};

// Timer to execute the log rotation process once per day
workers.logRotationLoop = function () {
  setInterval(function () {
    workers.rotateLogs();
  }, 1000 * 60 * 60 * 24);
}

// Init script
workers.init = function () {
  // Execute all the checks
  workers.gatherAllChecks();
  // Call the loop so the checks will execute later on
  workers.loop();

  // Compress all the logs immediately
  workers.rotateLogs();

  // Call the compression loop so logs will be compressed later on
  workers.logRotationLoop();
}

// Export the module
module.exports = workers;