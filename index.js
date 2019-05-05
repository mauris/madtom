const madtom = require('./src/madtom');
const jsonParser = require('./src/parsers/json');
const Router = require('./src/router');

madtom.parsers = {
  json: jsonParser,
};

madtom.Router = Router;

module.exports = madtom;
