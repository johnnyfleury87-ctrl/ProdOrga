const config = {
    planning: {
        shifts: ["Jour", "Nuit"],
        absenceCodes: {
            'V': { label: 'Vacances', color: 'gray' },
            'M': { label: 'Maladie', color: '#000080' },
            'R': { label: 'Récupération', color: '#800080' },
            'A': { label: 'Accident', color: '#add8e6' }
        }
    },
    picking: {
        DWELL_BASE: { 0: 1.4, 1: 1.1, 2: 0.9, 3: 0.7, 4: 0.7, 5: 0.9, 6: 1.1 },
        DWELL_INCREMENT_PER_QTY: 0.4,
        PACKAGING_MARGIN: 0.15, // 15%
        SAC_CAPACITY_MM3: 5000000, // Exemple: 5 litres
        SACS_PER_BOX: 2,
        M_PER_UNIT: 0.1 // 1 pixel = 10 cm
    },
    roles: {
        CHEF_DEPOT: 'Chef de dépôt',
        CHEF_ZONE: 'Chef de zone',
        ASSISTANT_LOG: 'Assistant logistique'
    }
};
