const express = require('express');

const app = express();

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.use(function(req, res) {
  res.json(req.query);
});

module.exports = app;
