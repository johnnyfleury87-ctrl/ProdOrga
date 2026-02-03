// Ce fichier génère des données fictives pour 300 collaborateurs.

function generateCollaborateursData() {
    const collaborateurs = [];
    const prenoms = ["Léa", "Hugo", "Chloé", "Louis", "Emma", "Gabriel", "Alice", "Jules", "Inès", "Adam"];
    const noms = ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent"];
    const zones = ["Z1", "Z2", "Z3", "Z4"];
    const shifts = ["Jour", "Nuit"];

    for (let i = 1; i <= 300; i++) {
        const prenom = prenoms[Math.floor(Math.random() * prenoms.length)];
        const nom = noms[Math.floor(Math.random() * noms.length)];
        
        // Créer des jours travaillés aléatoires (ex: 5 jours sur 7)
        let joursTravailles = [false, false, false, false, false, false, false];
        let joursCount = 0;
        while(joursCount < 5) {
            const dayIndex = Math.floor(Math.random() * 7);
            if (!joursTravailles[dayIndex]) {
                joursTravailles[dayIndex] = true;
                joursCount++;
            }
        }

        collaborateurs.push({
            id: i,
            prenom: prenom,
            nom: `${nom} ${i}`, // Ajoute un numéro pour garantir l'unicité
            taux: 100,
            zone: zones[Math.floor(Math.random() * zones.length)],
            shift: shifts[Math.floor(Math.random() * shifts.length)],
            dateEntree: '2020-01-01',
            dateFin: null,
            joursTravailles: joursTravailles,
            changements: [],
            absences: [] 
        });
    }

    return collaborateurs;
}