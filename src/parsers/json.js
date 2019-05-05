module.exports = (req, res, next) => {
  if (typeof req.body === 'string') {
    req.body = JSON.parse(req.body.trim());
  }

  res.json = (obj) => {
    res.send(JSON.stringify(obj));
  };

  next();
}
