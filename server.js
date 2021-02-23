const express = require('express')
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt-nodejs')
const cors = require('cors')
const knex = require('knex')
const clarifai = require('clarifai')

const handleApiCall = new clarifai.App({
    apiKey: '202ee69efb544ad49ae0159f5422669b'
});
    
    
const db = knex({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: true,
    }
});

const app = express()
app.use(bodyParser.json())
app.use(cors())

app.get('/', (req, res) => {
    res.json('WORKING!!!')
})

app.post('/signin', (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        return res.status(400).json('incorrect form submission')
    }
    db('login').where({ email: email })
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hashed_password)
            if (isValid) {
                db('users').where({ email: email })
                    .then(user => {
                        res.json(user[0])
                    })
                    .catch(err => res.status(400).json('unable to get user'))
            } else {
                res.status(400).json('invalid signin attempt')
            }
        }).catch(err => res.status(400).json('wrong credentials'))
})

app.post('/register', (req, res) => {
    const { email, name, password } = req.body
    if (!name || !email || !password) {
        return res.status(400).json('incorrect form submission')
    }
    const hashed_password = bcrypt.hashSync(password)
    db.transaction(trx => {
        trx.insert({
            email: email,
            hashed_password: hashed_password
        })
            .into('login')
            .transacting(trx)
            .returning('email')
            .then(loginEmail => {
                return trx('users').returning('*').insert({
                    email: loginEmail[0],
                    name: name,
                    joined: new Date()
                })
                    .then(user => {
                    res.json(user[0])
                    })
            })
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .catch(err => res.status(400).json('unable to register'))

})

app.get('/profile/:id', (req, res) => {
    const { id } = req.params
    // db.select('*').from('users').where({'id': id})
    db('users').where('id', id)
        .then(user => {
            if (user.length > 0) {
                res.json(user[0])
            } else {
                res.json('Not Found')
            }
        })
        .catch(err => {res.status(400).json('error getting user')}) 
})

app.put('/image', (req, res) => {
    const { id } = req.body
    // db('users').where({ id: id }).increment('entries', 1).returning('entries')
    db('users').where('id', '=', id).increment('entries', 1).returning('entries')
        .then(entries => {
            res.json(entries[0])
        })
        .catch(err => { res.status(400).json('unable to get count') }) 
})

app.post('/imageurl', (req, res) => {
    const { input } = req.body
    handleApiCall.models.predict(clarifai.FACE_DETECT_MODEL, input)
        .then(data => {
            res.json(data)
        })
        .catch(err => {
            res.status(400).json('no response from API')
        })
})

// bcrypt.hash("bacon", null, null, function (err, hash) {
//     // Store hash in your password DB.
// });

// // Load hash from your password DB.
// bcrypt.compare("bacon", hash, function (err, res) {
//     // res == true
// });

app.listen(process.env.PORT || 3000, () => {
    console.log('app is running on port 3000')
})
