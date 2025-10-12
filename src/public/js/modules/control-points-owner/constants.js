// Control points owner constants
export const TEAM_COLORS = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFEB3B'
};

export const DISTANCE_OPTIONS = [
    { value: 5, label: '5m (Muy cercano)' },
    { value: 10, label: '10m (Cercano)' },
    { value: 25, label: '25m (Medio)' },
    { value: 50, label: '50m (Lejano)' },
    { value: 100, label: '100m (Muy lejano)' }
];

export const ACCURACY_OPTIONS = [
    { value: 5, label: '5m (Alta precisión)' },
    { value: 10, label: '10m (Buena precisión)' },
    { value: 20, label: '20m (Precisión media)' },
    { value: 50, label: '50m (Baja precisión)' },
    { value: 100, label: '100m (Muy baja precisión)' }
];

export const BOMB_TIME_OPTIONS = [
    { value: 60, label: '1 minuto' },
    { value: 120, label: '2 minutos' },
    { value: 180, label: '3 minutos' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' },
    { value: 900, label: '15 minutos' }
];

export const CONTROL_POINT_TYPES = {
    SITE: 'site',
    CONTROL_POINT: 'control_point'
};