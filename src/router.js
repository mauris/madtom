const buildContextChain = (obj, commitStore, context) => {
  const buildFilterChain = (filterFunc) => {
    return buildContextChain({}, commitStore, context.concat([['filter', filterFunc]]));
  }

  obj.filter = (filterFunc) => {
    return buildFilterChain(filterFunc);
  };

  obj.emitKeyValue = () => {
    return buildContextChain({}, commitStore, context.concat([['emitKeyValue']]));
  };

  obj.forEach = () => {
    return buildContextChain({}, commitStore, context.concat([['forEach']]));
  };

  obj.isArray = () => {
    const filterFunc = Array.isArray;
    return buildFilterChain(filterFunc);
  };

  obj.isObject = () => {
    const filterFunc = d => !Array.isArray(d) && typeof d === 'object';
    return buildFilterChain(filterFunc);
  };

  obj.isString = () => {
    const filterFunc = d => typeof d === 'string';
    return buildFilterChain(filterFunc);
  }

  obj.hasKey = (key) => {
    const filterFunc = (d) => d[key] !== undefined;
    return buildFilterChain(filterFunc);
  };

  obj.stringMatch = (value) => {
    let filterFunc = (d => d === value);
    if (value instanceof Regex) {
      filterFunc = (d => String(d).match(value));
    }
    return buildFilterChain(filterFunc);
  };

  obj.matchValue = (key, value) => {
    let filterFunc = (d => d[key] === value);
    if (value instanceof Regex) {
      filterFunc = (d => String(d[key]).match(value));
    }
    return buildFilterChain(filterFunc);
  };

  obj.execute = (handler) => {
    commitStore.push([context, handler]);
  };

  return obj;
}

function executeContextBlock(type, args, body) {
  let newBody = null;

  const blockHandlers = {
    filter: (body) => {
      if (args[0](body)) {
        newBody = body;
      }
    },
    emitKeyValue: (body) => {
      newBody = Object
        .keys(body)
        .map((key) => ({
          key,
          value: body[key]
        }));
    },
  };

  if (blockHandlers[type] === undefined) {
    return body;
  }

  blockHandlers[type](body);

  return newBody;
}

function Router() {
  const commitStore = [];

  const middleware = (req, res, next) => {
    const processForContext = (i) => {
      if (i >= commitStore.length) {
        next();
        return;
      }

      const internalNext = (err) => {
        if (err) {
          next(err);
          return;
        }
        processForContext(i + 1);
      };

      const [ context, handler ] = commitStore[i];
      let body = req.body;
      context.forEach((tuple) => {
        if (body === null) {
          return;
        }
        const type = tuple[0];
        const args = tuple.slice(1);

        body = executeContextBlock(type, args, body);
      });

      if (body === null) {
        internalNext();
        return;
      }

      const modifiedReq = Object.assign({}, req);
      modifiedReq.body = body;
      try {
        handler(modifiedReq, res, internalNext);
      } catch (err) {
        next(err);
      }
    };

    processForContext(0);
  };

  buildContextChain(middleware, commitStore, []);

  return middleware;
}

module.exports = Router;
