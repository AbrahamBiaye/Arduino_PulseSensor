const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path'); // Module path pour manipuler les chemins

const portName = '/dev/tty.usbmodem143301';
const baudRate = 115200;

const port = new SerialPort({ path: portName, baudRate });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration de la connexion à la base de données MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'PulseSensorDB'
});

// Connecter à la base de données MySQL
db.connect(err => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
    return;
  }
  console.log('Connecté à la base de données MySQL');
});

app.use(express.static(path.join(__dirname, '/../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Utilisez secure: true en production avec HTTPS
}));

// Variable globale pour stocker l'ID de l'utilisateur connecté
let currentUserId = null;

// Middleware pour vérifier si l'utilisateur est connecté
function checkAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
}

// Redirection de / vers /login.html
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Servir login.html à partir de /login.html
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/login.html'));
});

// Routes pour les autres pages
app.get('/vfc.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/vfc.html'));
});

app.get('/bpm.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/bpm.html'));
});

app.get('/conseils.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/conseils.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/../public/register.html'));
});

// Routes d'API pour les données BPM et VFC
app.get('/api/bpm-data', checkAuth, (req, res) => {
  const query = 'SELECT * FROM bpm_data WHERE user_id = ?';
  db.query(query, [req.session.userId], (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des données:', err);
      res.status(500).send('Erreur serveur');
    } else {
      res.json(results);
    }
  });
});

app.get('/api/vfc-data', checkAuth, (req, res) => {
  const query = 'SELECT * FROM vfc_data WHERE user_id = ?';
  db.query(query, [req.session.userId], (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des données:', err);
      res.status(500).send('Erreur serveur');
    } else {
      res.json(results);
    }
  });
});

// Routes pour l'authentification
app.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  const query = 'SELECT * FROM users WHERE phone = ?';
  db.query(query, [phone], async (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des données:', err);
      return res.status(500).send('Erreur serveur');
    }
    if (results.length === 0) {
      return res.status(401).send('Téléphone ou mot de passe incorrect');
    }
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.userId = user.id;
      currentUserId = user.id; // Mettre à jour l'ID de l'utilisateur connecté
      return res.redirect('/');
    }
    res.status(401).send('Téléphone ou mot de passe incorrect');
  });
});

app.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = 'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)';
  db.query(query, [name, email, phone, hashedPassword], (err, result) => {
    if (err) {
      console.error('Erreur lors de l\'insertion des données:', err);
      return res.status(500).send('Erreur serveur');
    }
    res.redirect('/login.html');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Erreur lors de la déconnexion:', err);
    }
    currentUserId = null; // Réinitialiser l'ID de l'utilisateur connecté
    res.redirect('/login.html');
  });
});

// Gestion des données du capteur
parser.on('data', (data) => {
  const bpm = parseInt(data, 10);
  if (!isNaN(bpm) && currentUserId) {
    console.log(`BPM reçu : ${bpm}`);
    io.emit('bpmData', bpm);

    const bpmQuery = 'INSERT INTO bpm_data (bpm, user_id) VALUES (?, ?)';
    db.query(bpmQuery, [bpm, currentUserId], (err, result) => {
      if (err) {
        console.error('Erreur lors de l\'insertion des données BPM dans la base de données:', err);
      } else {
        console.log('Données BPM insérées avec succès dans la base de données');
      }
    });

    const vfc = Math.abs(60 / bpm * 1000); // Conversion en millisecondes
    io.emit('vfcData', vfc);

    const vfcQuery = 'INSERT INTO vfc_data (vfc, user_id) VALUES (?, ?)';
    db.query(vfcQuery, [vfc, currentUserId], (err, result) => {
      if (err) {
        console.error('Erreur lors de l\'insertion des données VFC dans la base de données:', err);
      } else {
        console.log('Données VFC insérées avec succès dans la base de données');
      }
    });
  }
});

server.listen(3000, () => {
  console.log('Serveur web démarré sur http://localhost:3000');
});
