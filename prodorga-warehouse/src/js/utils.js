const utils = {
    dateToISOString(date) {
        return date.toISOString().split('T')[0];
    },

    getMonday(d) {
        d = new Date(d);
        const day = d.getDay(),
              diff = d.getDate() - day + (day === 0 ? -6 : 1); // ajustement pour le dimanche
        return new Date(d.setDate(diff));
    },

    getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    },

    getDateOfISOWeek(y, w) {
        const simple = new Date(y, 0, 1 + (w - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4)
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        else
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        return ISOweekStart;
    },
    
    /**
     * Charge et parse un fichier CSV depuis une URL en utilisant PapaParse.
     * @param {string} url - L'URL du fichier CSV.
     * @param {string} delimiter - Le séparateur de colonnes (ex: ';').
     * @returns {Promise<Array<Object>>} Une promesse qui résout avec un tableau d'objets.
     */
    fetchCSV(url, delimiter = ';') {
        return new Promise((resolve, reject) => {
            if (typeof Papa === 'undefined') {
                return reject(new Error("La bibliothèque PapaParse n'est pas chargée."));
            }
            Papa.parse(url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                delimiter: delimiter,
                complete: (results) => {
                    if (results.errors && results.errors.length) {
                        console.warn(`Erreurs de parsing pour ${url}:`, results.errors);
                        // Même avec des erreurs, PapaParse retourne souvent des données valides.
                        // On peut décider de continuer ou de rejeter. Pour l'instant, on continue.
                    }
                    resolve(results.data);
                },
                error: (error, file) => {
                    reject(new Error(`Erreur de chargement du fichier CSV ${url}: ${error}`));
                }
            });
        });
    }
};
