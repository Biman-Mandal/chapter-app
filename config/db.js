const mongoose = require('mongoose');
const url = process.env.MONGO_URI;
mongoose.connect(url)
.then(() => {
    console.log('Database connected successfully');
    console.log(url, 'mongo url')
}).catch((err) => {
    console.log(url, 'mongo url')
    console.log('Error connecting Database', err);
});