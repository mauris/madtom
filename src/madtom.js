const tls = require('tls');
const net = require('net');
const fs = require('fs');

const UTF8 = 'utf-8';

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function recursiveObjectAssign(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return null;
  }
  const result = {};
  Object
    .keys(source)
    .forEach((key) => {
      if (target[key] === undefined) {
        result[key] = source[key];
        return;
      }

      if (isObject(target[key]) && isObject(source[key])) {
        result[key] = recursiveObjectAssign(target[key], source[key]);
      } else {
        result[key] = target[key];
      }
    });
  return result;
}

function createServer(options, onSocketCreated) {
  const userTLSOptions = options.tls;
  if (userTLSOptions) {
    const { key, cert, caFile, verifyClient } = userTLSOptions;
    const tlsServerOptions = {
      key: fs.readFileSync(key),
      cert: fs.readFileSync(cert),
    };

    if (caFile !== undefined) {
      tlsServerOptions.ca = fs.readFileSync(caFile);
    }

    if (verifyClient) {
      tlsServerOptions.rejectUnauthorized = true;
      tlsServerOptions.requestCert = true;
    }

    return tls.createServer(tlsServerOptions, onSocketCreated);
  }
  return net.createServer(onSocketCreated);
}

const defaultInstanceOpts = {
  tls: false,
  keepAlive: {
    timeout: 5000, // ms
    max: 100000, // ms
  },
  timeout: {
    send: 600000, // ms
    recv: 600000, // ms
  },
  encoding: UTF8,
  delimiter: '\n',
};

function madtom(instanceOptsArg) {
  if (!(this instanceof madtom)) {
    // allow direct function call to create new instance too
    return new madtom(instanceOptsArg);
  }

  const instanceOpts = recursiveObjectAssign(instanceOptsArg, defaultInstanceOpts);

  const _middlewares = [];
  const _tryCatchHandlers = [];

  const handleError = (err, req, res) => {
    const executeTryCatch = (i, curErr) => {
      if (i >= _tryCatchHandlers.length) {
        // run built in error handler
        console.log(curErr);
        return;
      }
      const next = (newErr) => {
        executeTryCatch(i + 1, newErr);
      };
      try {
        _tryCatchHandlers[i](err, req, res, next);
      } catch (conErr) {
        executeTryCatch(i + 1, conErr);
      }
    };
    executeTryCatch(0, err);
  };

  const clientVerifier = (socket) => {
    return !(instanceOpts.tls && instanceOpts.verifyClient) || socket.authorized;
  };

  const processLine = (socket, body) => {
    if (_middlewares.length === 0 || body === '') {
      return;
    }
    const req = {
      socket,
      body
    };

    const res = {
      send: (data) => {
        socket.write(`${data}\n`);
      },
    };

    const executeMiddleware = (i) => {
      if (i >= _middlewares.length) {
        return;
      }
      const next = (err) => {
        if (err) {
          if (err instanceof Error) {
            handleError(err, req, res, next);
          } else {
            console.log(`Warning: error received but not an instance of Error.\n\t${err}`);
          }
          return;
        }
        executeMiddleware(i + 1);
      }
      try {
        _middlewares[i](req, res, next);
      } catch (err) {
        handleError(err, req, res, next);
      }
    };

    executeMiddleware(0);
  };


  const newSocketHandler = (socket) => {
    if (!clientVerifier(socket)) {
      socket.end();
      return;
    }
    let dataSoFar = '';

    setTimeout(() => {
      socket.end();
    }, instanceOpts.keepAlive.max);

    let timeoutTimer = setTimeout(() => {
      socket.end();
    }, instanceOpts.keepAlive.timeout);

    const processChunk = (chunk) => {
      const arr = chunk.split(instanceOpts.delimiter);
      dataSoFar += arr[0];
      if (arr.length > 1) {
        // a split occurs
        processLine(socket, dataSoFar);
        dataSoFar = arr[arr.length - 1];
        for (let i = 1; i < arr.length - 1; i += 1) {
          processLine(socket, arr[i]);
        }
      }
      clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(() => {
        socket.end();
      }, instanceOpts.keepAlive.timeout);
    };

    socket.setEncoding(instanceOpts.encoding);
    socket.on('data', processChunk);
    socket.on('error', (e) => {
      socket.end();
    });
    socket.on('end', () => {
      processLine(socket, dataSoFar);
      socket.end();
    });
  };

  const _server = createServer(instanceOpts, newSocketHandler);

  _server.on('error', (e) => console.log(e));

  this.use = function use(middleware) {
    _middlewares.push(middleware);
  };

  this.tryCatch = function tryCatch(handler) {
    _tryCatchHandlers.push(handler);
  };

  this.listen = function listen() {
    const argLength = arguments.length;
    let serverListenOpts = arguments[0];
    const callback = arguments[argLength - 1];
    if (typeof options === 'number') {
      serverListenOpts = {
        port: arguments[0],
      };
      if (argLength >= 3) {
        // (port, host, callback)
        serverListenOpts.host = arguments[1];
      }
      if (argLength >= 4) {
        // (port, host, backlog, callback)
        serverListenOpts.backlog = arguments[2];
      }
    }
    _server.listen(serverListenOpts, callback);
  };
}

module.exports = madtom;
