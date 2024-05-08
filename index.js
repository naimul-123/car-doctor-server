const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser')
const app = express();
const port = process.env.PORT
const username = process.env.DB_USER
const password = process.env.DB_PASSWORD
const secret = process.env.ACCESS_TOKEN_SECRET
const jwt = require('jsonwebtoken')

app.use(cors({
    origin: ['http://localhost:5173', 'https://car-doctor-bc488.web.app'],
    credentials: true
}));
app.use(express.json())
app.use(cookieParser())


app.get('/', async (req, res) => {
    res.send("Server is running ok");

})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${username}:${password}@cluster0.nevhe4f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Middleware
const varifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: "Not Authorization" })
    }

    jwt.verify(token, secret, async (err, decode) => {
        if (err) {
            return res.status(401).send({ message: err.message })
        }
        req.user = decode;
        next()

    })


}

const logger = (req, res, next) => {
    console.log(req.method, req.url)
    next()
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        const serviceCollection = client.db("carDoctor").collection("services")
        const bookingCollection = client.db("carDoctor").collection("bookings");

        // Making post rout for receivein user info from client and creating a token

        app.post('/jwt', (req, res) => {
            const userInfo = req.body;
            // now create a token
            const token = jwt.sign(userInfo, secret, { expiresIn: '1h' })
            res.cookie('token', token, {
                httpOnly: true, secure: true, sameSite: 'none'
            }).send({ success: true })


        })

        // clear cookie after logout
        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('log out user', user)
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        app.get('/services', async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray()
            res.send(result)
        })
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            options = {
                projection: {
                    title: 1, price: 1, service_id: 1, img: 1
                }
            }
            const service = await serviceCollection.findOne(query, options)

            res.send(service)
        })

        app.get("/bookings", logger, varifyToken, async (req, res) => {

            const userInfo = req.user

            if (req.query?.email !== req.user.email) {
                return res.status(403).send({ message: "Forbiden access" })
            }

            let query = {}
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result)
        })

        app.post("/booking", async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        })
        app.patch("/bookings/:id", async (req, res) => {
            const id = req.params.id;
            const bookingStatus = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = {
                $set: {
                    status: bookingStatus.status
                }
            }
            // console.log(bookingStatus)

            const result = await bookingCollection.updateOne(filter, updatedBooking);
            res.send(result)

        })
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query)
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`server is running at http://localhost:${port}`)
})

