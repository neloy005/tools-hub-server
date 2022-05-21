const express = require('express')
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

//middletear
app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Tools hub is running!🥰')
})

app.listen(port, () => {
    console.log(`Doctors app listening on port ${port}`)
})