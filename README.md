# Madtom JSON over TCP Framework

Inspired by the [json-over-tcp](https://github.com/turn/json-over-tcp) project and [Express.js Web Framework](https://expressjs.com/), Madtom is a TCP server framework that can process requests and responses in a middleware fashion similar to Express.js.

Optionally, Madtom also supports TCP with TLS out of the box.

````javascript
const madtom = require('madtom');

const app = madtom({
  /* Enable server-side TLS identity */
  tls: {
    key: './server-key.pem',
    cert: './server-cert.pem',
  },
});

/* use JSON as the parser for request body */
app.use(madtom.parsers.json);

app.tryCatch((err, req, res, next) => {
  console.log(`Error occurred:\n\t${err.message}`);
});

/*
  Add a router to the
 */
const router = madtom.Router();
app.use(router);

/*
  Executes only when request document has
  the key "fruit" in it.
 */
router
  .filter(doc => doc.fruit)
  .execute((req, res, next) => {
    if (req.body.fruit === 'tomato') {
      // handle the error
      next(new Error('I think tomato is considered vegetable'));
      return;
    }
    res.json({ status: 'ok' });
  });

/*
  Executes only when request document is an object
  and has the key "consume".

  emitKeyValue() will transform the request document into an
  array of key-value.
 */
router
  .isObject()
  .hasKey('consume')
  .emitKeyValue()
  .execute((req, res, next) => {
    req.body.forEach((tuple) => {
      console.log(`${tuple.key}: ${tuple.value}`);
    });
    res.json({ status: 'ok' });
  });

/*
  Start listening
 */
app.listen(8001, 'madtom.test', () => {
  console.log('listening!');
});
````

Source code open sourced under the MIT license.
