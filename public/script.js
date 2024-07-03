const socket = io();
let vfcData = [];
let bpmData = [];

// Fonction pour calculer la VFC
function calculateVFC(data) {
  // Logique pour calculer la VFC à partir des données
  // Retourne un résultat aléatoire pour l'exemple
  return Math.random() > 0.5 ? 'normal' : 'anormal';
}

// Fonction pour afficher le résultat après 15 secondes
function displayResult(type, result) {
  const resultElement = document.getElementById(`${type}Result`);
  const doctorInfo = document.getElementById('doctorInfo');
  
  resultElement.textContent = result === 'normal' ? `${type.toUpperCase()} est normal.` : `${type.toUpperCase()} est anormal.`;
  
  if (result === 'anormal') {
    doctorInfo.style.display = 'block';
  }
}

// Démarrer la mesure du VFC
if (window.location.pathname === '/vfc.html') {
  socket.on('vfcData', (data) => {
    vfcData.push(data);
    // Mettre à jour le graphique ici
  });

  setTimeout(() => {
    const result = calculateVFC(vfcData);
    displayResult('vfc', result);
  }, 15000);
}

// Démarrer la mesure du BPM
if (window.location.pathname === '/bpm.html') {
  socket.on('bpmData', (data) => {
    bpmData.push(data);
    // Mettre à jour le graphique ici
  });

  setTimeout(() => {
    const avgBPM = bpmData.reduce((acc, val) => acc + val, 0) / bpmData.length;
    const result = avgBPM > 100 ? 'anormal' : 'normal'; // Exemples de seuils
    displayResult('bpm', result);
  }, 15000);
}

// Configuration des graphiques
const ctxVFC = document.getElementById('vfcChart')?.getContext('2d');
const ctxBPM = document.getElementById('bpmChart')?.getContext('2d');

if (ctxVFC) {
  new Chart(ctxVFC, {
    type: 'line',
    data: {
      datasets: [{
        label: 'VFC',
        data: vfcData,
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        fill: false,
      }],
    },
    options: {
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
        },
      },
    },
  });
}

if (ctxBPM) {
  new Chart(ctxBPM, {
    type: 'line',
    data: {
      datasets: [{
        label: 'BPM',
        data: bpmData,
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        fill: false,
      }],
    },
    options: {
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
        },
      },
    },
  });
}
