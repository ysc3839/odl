const app = require('./app');

const port = parseInt(process.env.PORT || 3000, 10);
app.listen(port);
