const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

//middletear
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zeby8.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('tools-hub').collection('tools');
        const usersCollection = client.db('tools-hub').collection('users');
        const ordersCollection = client.db('tools-hub').collection('orders');
        const paymentCollection = client.db('tools-hub').collection('payments');
        const reviewCollection = client.db('tools-hub').collection('reviews');
        const faqCollection = client.db('tools-hub').collection('faq');
        const buyerCollection = client.db('tools-hub').collection('buyer');


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        app.get('/faq', async (req, res) => {
            const query = {};
            const cursor = faqCollection.find(query);
            const faq = await cursor.toArray();
            res.send(faq);
        });

        app.get('/buyers', async (req, res) => {
            const query = {};
            const cursor = buyerCollection.find(query);
            const buyers = await cursor.toArray();
            res.send(buyers);
        });

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        app.get('/users', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        app.get('/orders', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = ordersCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        app.get('/tool/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        });

        app.post('/review', async (req, res) => {
            const review = req.body;
            console.log('adding', review);
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        app.post('/order', async (req, res) => {
            const order = req.body;
            console.log('adding', order);
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        });
        app.post('/tool', async (req, res) => {
            const tool = req.body;
            console.log('adding', tool);
            const result = await toolsCollection.insertOne(tool);
            res.send(result);
        });

        app.put('/order/:id', async (req, res) => {
            const id = req.params.id;
            const statusCondition = req.body;
            console.log(statusCondition);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: statusCondition.status,
                }
            };
            const result = await ordersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        });


        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.toPay;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.patch('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const myProfile = req.body;
            console.log(myProfile);
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    fullName: myProfile.fullName,
                    education: myProfile.education,
                    location: myProfile.location,
                    phone: myProfile.phone,
                    linkedln: myProfile.linkedln,

                }
            }

            const updateUser = await usersCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        });
        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            console.log(payment);
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    isPaid: true,
                    transectionId: payment.transectionId,
                    status: payment.status
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateOrder = await ordersCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        });

        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            const query = { email: email }
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders);
        });
        app.put('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const updateAvailable = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    available: updateAvailable.available,
                }
            };
            const result = await toolsCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        });

        app.delete('/tool/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        });
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        });


        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query);
            res.send(order);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = (user.role === 'admin');
            res.send({ admin: isAdmin });
        });

        app.get('/user', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            res.send(user);
        });

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email: email };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token: token });
        });
    }
    finally {

    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Tools hub is running!🥰')
})

app.listen(port, () => {
    console.log(`Tools hub listening on port ${port}`)
})