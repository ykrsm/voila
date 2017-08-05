/**
 * impot libraries
 */

const express = require('express');
const bodyParser = require('body-parser');
const uniqid = require('uniqid');
const morgan = require('morgan');
const mongoose = require('mongoose');
const Ticket = require('./models/ticket');
const path = require('path');

require('dotenv').config();

const app = express();

/**
 * Configuration
 */

const port = process.env.PORT || 8080;

// To avoid error of mongoose mpromise DeprecationWarning
mongoose.Promise = global.Promise;

// During testing
if (process.env.NODE_ENV === 'test') {
  mongoose.connect(process.env.DB_URI);
} else if (process.env.NODE_ENV !== 'test') {
  // Activate morgan
  app.use(morgan('dev'));
  mongoose.connect(process.env.DB_TEST_URI);
}

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/json' }));

app.use(express.static(path.join(__dirname, '/../client/static')));
app.use('/dist', express.static(path.join(__dirname, '/../client/dist')));
app.use('/scripts', express.static(path.join(__dirname, '/../node_modules')));

/**
 * Route
 */

// Create an instance for API rotue
const apiRoute = express.Router();

/**
 * POST /api/ticket/:id/:key
 * Post userdata and check id and key with DB
 */
apiRoute.post('/tickets/:id/:key', (req, res) => {
  // Check if id and key are valid
  Ticket.findOne({
    id: req.params.id,
  }, (err, ticket) => {
    if (err) {
      res.status(400).json({
        id: req.params.id,
        error: err,
      });
    } else if (!ticket) {
      // ticket id is invalid
      res.status(400).json({
        id: req.params.id,
        error: 'No ticket found by the id',
      });
    } else {
      // ticket is is valid
      // Get data from params and save with unique key
      // get index of customer from DB that has key of params.key
      const customerIndex = ticket.customers.findIndex((customer) => {
        // Get a customer with unique key
        return customer.key === req.params.key;
      });
      if (customerIndex === -1) {
        // No customer found with the key
        res.status(400).json({
          id: req.params.id,
          key: req.params.key,
          error: 'A ticket found BUT No customer found by the key',
        });
      } else {
        // A customer found
        if (!req.body.data) {
          res.status(400).json({
            id: req.params.id,
            key: req.params.key,
            error: 'A ticket found and a customer found by the key BUT no data to post',
          });
        } else {
          // Save data to the customer at index
          ticket.customers[customerIndex].data = req.body.data;
          ticket.save((errSave) => {
            if (errSave) {
              res.status(400).json({
                id: req.params.id,
                key: req.params.key,
                error: errSave,
              });
            } else {
              res.status(201).json({
                id: req.params.id,
                key: req.params.key,
                message: 'Success',
              });
            }
          });
        }
      }
    }
  });
});

apiRoute.get('/tickets/setup', (req, res) => {
  const newTicket = new Ticket({
    id: 'TestID',
    password: 'Test PW',
  });

  newTicket.save((err) => {
    if (err) {
      res.status(400).json({
        message: err,
      });
    } else {
      res.status(201).json({
        message: 'New ticket created',
      });
    }
  });
});

/**
 * GET /api/ticket/:id
 * Get unique URL
 */
apiRoute.get('/tickets/:id', (req, res) => {
  // Check if query is an empty object
  // //////////////
  //   GENERATE  //
  // //////////////
  if (Object.keys(req.query).length === 0 && req.query.constructor === Object) {
    // query is empty obj
    // Generate unique URL
    // TODO Save id and key to the DB
    const key = uniqid();
    // Finc a ticket by id
    Ticket.findOne({
      id: req.params.id,
    }, (err, ticket) => {
      if (err) {
        res.status(400).json({
          id: req.params.id,
          error: err,
        });
      } else if (!ticket) {
        res.status(400).json({
          id: req.params.id,
          error: 'No ticket found by the id',
        });
      } else {
        ticket.customers.push({
          key,
        });
        ticket.save((errSave) => {
          if (errSave) {
            res.status(400).json({
              id: req.params.id,
              error: errSave,
            });
          } else {
            res.status(201).json({
              id: req.params.id,
              key,
              message: 'Success',
            });
          }
        });
      }
    });
  // ///////////////
  //     QUERY    //
  // ///////////////
  } else {
    // Query exist
    // Find
    Ticket.findOne({
      id: req.params.id,
    }, (errFind, ticket) => {
      if (errFind) {
        res.status(400).json({
          id: req.params.id,
          error: errFind,
        });
      } else if (!ticket) {
        // Not found
        res.status(400).json({
          id: req.params.id,
          error: 'No ticket found by the id',
        });
      } else {
        // Success
        res.status(200).json({
          result: ticket,
        });
      }
    });
  }
});

app.use('/api', apiRoute);

/**
 * Start server
 */

app.listen(port);
console.log(`Server running ${port}`);

// exports module only for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = app;
}
